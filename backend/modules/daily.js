const express = require('express');
const router = express.Router();
const pool = require('../db');

const DAILY_TASKS = [
  { key: 'kill_100',  name: '击杀 100 只怪', target: 100, reward: { gold: 1000 } },
  { key: 'kill_500',  name: '击杀 500 只怪', target: 500, reward: { gold: 5000 } },
  { key: 'draw_1',    name: '抽取 1 次天赋', target: 1,   reward: { gold: 500 } },
  { key: 'enhance_3', name: '强化 3 次装备', target: 3,   reward: { gold: 2000 } }
];

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [saveRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = saveRows[0];

    // 用 MySQL 判断是否跨天（避免时区问题）
    const [dateRows] = await pool.query(
      'SELECT (last_daily IS NULL OR last_daily != CURDATE()) AS need_reset FROM save WHERE user_id=?',
      [userId]
    );
    const needReset = dateRows[0].need_reset === 1;

    if (needReset) {
      await pool.query(
        'UPDATE save SET last_daily=CURDATE(), daily_kill=0, daily_draw=0, daily_enhance=0 WHERE user_id=?',
        [userId]
      );
      await pool.query('UPDATE daily SET claimed=0 WHERE user_id=?', [userId]);
      s.daily_kill = 0;
      s.daily_draw = 0;
      s.daily_enhance = 0;
    }

    const [claimedRows] = await pool.query(
      'SELECT daily_key FROM daily WHERE user_id=? AND claimed=1',
      [userId]
    );
    const claimedSet = new Set(claimedRows.map(r => r.daily_key));

    const list = DAILY_TASKS.map(t => {
      let progress = 0;
      if (t.key === 'kill_100' || t.key === 'kill_500') progress = s.daily_kill || 0;
      if (t.key === 'draw_1') progress = s.daily_draw || 0;
      if (t.key === 'enhance_3') progress = s.daily_enhance || 0;

      return {
        key: t.key,
        name: t.name,
        target: t.target,
        progress: Math.min(progress, t.target),
        achieved: progress >= t.target,
        claimed: claimedSet.has(t.key),
        reward: t.reward
      };
    });

    res.json({ code: 0, list });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/claim', async (req, res) => {
  const { userId, dailyKey } = req.body;
  try {
    const t = DAILY_TASKS.find(x => x.key === dailyKey);
    if (!t) return res.json({ code: 1, msg: '任务不存在' });

    const [rows] = await pool.query(
      'SELECT * FROM daily WHERE user_id=? AND daily_key=?',
      [userId, dailyKey]
    );
    if (rows.length > 0 && rows[0].claimed === 1) {
      return res.json({ code: 1, msg: '已领取' });
    }

    const gold = t.reward.gold || 0;
    await pool.query('UPDATE save SET gold = gold + ? WHERE user_id=?', [gold, userId]);

    if (rows.length > 0) {
      await pool.query('UPDATE daily SET claimed=1 WHERE id=?', [rows[0].id]);
    } else {
      await pool.query(
        'INSERT INTO daily (user_id, daily_key, claimed) VALUES (?,?,1)',
        [userId, dailyKey]
      );
    }

    res.json({ code: 0, msg: '领取成功', reward: t.reward });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;