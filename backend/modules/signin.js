const express = require('express');
const router = express.Router();
const pool = require('../db');

const SIGN_REWARDS = [
  { day: 1, gold: 500 }, { day: 2, gold: 1000 }, { day: 3, gold: 2000 },
  { day: 4, gold: 3000, soul: 5 }, { day: 5, gold: 5000 },
  { day: 6, gold: 8000, soul: 10 }, { day: 7, gold: 15000, soul: 30, free_points: 5 }
];

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    const s = rows[0];
    const [todayRows] = await pool.query('SELECT (last_sign = CURDATE()) AS signed_today FROM save WHERE id=?', [saveId]);
    const signedToday = todayRows[0].signed_today === 1;
    res.json({ code: 0, streak: s.sign_streak || 0, signedToday, rewards: SIGN_REWARDS });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/do', async (req, res) => {
  const { saveId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    const s = rows[0];

    const [todayRows] = await pool.query('SELECT (last_sign = CURDATE()) AS signed_today FROM save WHERE id=?', [saveId]);
    if (todayRows[0].signed_today === 1) return res.json({ code: 1, msg: '今天已经签过了' });

    const [yRows] = await pool.query('SELECT (last_sign = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS signed_yesterday FROM save WHERE id=?', [saveId]);
    const signedYesterday = yRows[0].signed_yesterday === 1;

    let newStreak = s.sign_streak || 0;
    if (signedYesterday) newStreak = newStreak >= 7 ? 1 : newStreak + 1;
    else newStreak = 1;

    const reward = SIGN_REWARDS.find(r => r.day === newStreak) || SIGN_REWARDS[0];
    const gold = reward.gold || 0;
    const soul = reward.soul || 0;
    const points = reward.free_points || 0;

    await pool.query('UPDATE save SET gold = gold + ?, free_points = free_points + ?, sign_streak = ?, last_sign = CURDATE() WHERE id=?', [gold, points, newStreak, saveId]);
    if (soul > 0) {
      const [saveRows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
      await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, saveRows[0].user_id]);
    }

    res.json({ code: 0, msg: '签到成功', streak: newStreak, reward });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;