const express = require('express');
const router = express.Router();
const pool = require('../db');
const config = require('../config/gameConfig');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });

    const s = rows[0];

    // ============ 离线收益 ============
    let offlineReward = null;
    if (s.last_online) {
      const now = new Date();
      const last = new Date(s.last_online);
      const diffMs = now - last;
      const diffHours = diffMs / 1000 / 60 / 60;

      if (diffHours >= 0.1) {
        const cappedHours = Math.min(diffHours, 24);

        const goldPerHour = (config.goldGain.baseNormal + 100 * config.goldGain.perKill) * 100;
        const expPerHour = config.level.expPerKill.normal * 100;

        const goldReward = Math.floor(goldPerHour * cappedHours);
        const expReward = Math.floor(expPerHour * cappedHours);

        await pool.query(
          `UPDATE save SET gold = gold + ?, exp = exp + ? WHERE user_id=?`,
          [goldReward, expReward, userId]
        );

        offlineReward = {
          hours: Math.round(cappedHours * 10) / 10,
          gold: goldReward,
          exp: expReward
        };
      }
    }

    await pool.query('UPDATE save SET last_online=NOW() WHERE user_id=?', [userId]);

    const [newRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const [userRows] = await pool.query('SELECT soul_fragment FROM user WHERE id=?', [userId]);
    const [eqRows] = await pool.query(
      'SELECT * FROM equipment WHERE user_id=? AND equipped=1',
      [userId]
    );

    const data = newRows[0];
    data.soul = userRows[0].soul_fragment;
    data.equipment = {};
    for (const row of eqRows) {
      data.equipment[row.slot] = {
        id: row.id,
        name: row.name,
        quality: row.quality,
        statValue: row.stat_value
      };
    }

    res.json({ code: 0, data, offlineReward });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;