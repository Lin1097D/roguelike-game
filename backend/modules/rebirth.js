const express = require('express');
const router = express.Router();
const pool = require('../db');

// 升到 N 级所需经验（和 battle.js 一致）
function expNeed(level) {
  return Math.floor(100 * level * Math.pow(1.15, level - 1));
}

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

    // 保留 exp，重新计算等级
    let newExp = s.exp || 0;
    let newLevel = 1;
    let freePointsGain = 0;

    while (newLevel < 100) {
      const need = expNeed(newLevel);
      if (newExp >= need) {
        newExp -= need;
        newLevel += 1;
        freePointsGain += 3;
      } else {
        break;
      }
    }

    await pool.query(
      `UPDATE save SET 
        hp=100, max_hp=100, atk=1, mp=50, max_mp=50,
        crit_rate=0.05, dodge_rate=0.03,
        base_atk=1, base_max_hp=100, base_max_mp=50,
        base_crit_rate=0.05, base_dodge_rate=0.03,
        kill_count=0, elite_count=0, boss_count=0, gold=0,
        jieli=0,
        level=?, exp=?, free_points=free_points + ?,
        rebirth_count=?, rebirth_points=?,
        updated_at=NOW()
       WHERE user_id=?`,
      [newLevel, newExp, freePointsGain, newRebirthCount, newRebirthPoints, userId]
    );

    await pool.query('DELETE FROM equipment WHERE user_id=?', [userId]);
    await pool.query('DELETE FROM talent WHERE user_id=?', [userId]);

    res.json({
      code: 0,
      msg: '转生成功',
      rebirthCount: newRebirthCount,
      rebirthPoints: newRebirthPoints,
      pointsGain,
      newLevel,
      remainingExp: newExp
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;