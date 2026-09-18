const express = require('express');
const router = express.Router();
const pool = require('../db');
const config = require('../config/gameConfig');

// 转生
router.post('/do', async (req, res) => {
  const { userId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = rows[0];

    if (s.level < 100) {
      return res.json({ code: 1, msg: '需要达到 100 级才能转生' });
    }

    const newRebirthCount = (s.rebirth_count || 0) + 1;
    const pointsGain = 10 * newRebirthCount;
    const newRebirthPoints = (s.rebirth_points || 0) + pointsGain;

    // 重置存档
    await pool.query(
      `UPDATE save SET 
        hp=100, max_hp=100, atk=1, mp=50, max_mp=50,
        crit_rate=0.05, dodge_rate=0.03,
        base_atk=1, base_max_hp=100, base_max_mp=50,
        base_crit_rate=0.05, base_dodge_rate=0.03,
        kill_count=0, elite_count=0, boss_count=0, gold=0,
        jieli=0, level=1, exp=0, free_points=0,
        rebirth_count=?, rebirth_points=?,
        updated_at=NOW()
       WHERE user_id=?`,
      [newRebirthCount, newRebirthPoints, userId]
    );

    // 清空装备和天赋
    await pool.query('DELETE FROM equipment WHERE user_id=?', [userId]);
    await pool.query('DELETE FROM talent WHERE user_id=?', [userId]);

    res.json({
      code: 0,
      msg: '转生成功',
      rebirthCount: newRebirthCount,
      rebirthPoints: newRebirthPoints,
      pointsGain
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;