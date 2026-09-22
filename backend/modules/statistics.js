const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];

    const [userRows] = await pool.query('SELECT username, created_at FROM user WHERE id=?', [userId]);

    res.json({
      code: 0,
      data: {
        total_damage: s.total_damage || 0,
        total_damage_taken: s.total_damage_taken || 0,
        max_combo: s.max_combo || 0,
        play_time: s.play_time || 0,
        death_count: s.death_count || 0,
        kill_count: s.kill_count || 0,
        elite_count: s.elite_count || 0,
        boss_count: s.boss_count || 0,
        level: s.level || 1,
        rebirth_count: s.rebirth_count || 0,
        created_at: userRows[0].created_at
      }
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/playtime', async (req, res) => {
  const { userId, seconds } = req.body;
  try {
    await pool.query(
      'UPDATE save SET play_time = play_time + ? WHERE user_id=?',
      [seconds, userId]
    );
    res.json({ code: 0 });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;