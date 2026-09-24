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

        const goldPerHour = (config.goldGain.baseNormal + 10000 * config.goldGain.perKill) * 100;
        const expPerHour = config.level.expPerKill.normal * 10000;

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

router.post('/import', async (req, res) => {
  const { userId, data } = req.body;
  try {
    if (!data || !data.save) return res.json({ code: 1, msg: '数据格式错误' });

    const s = data.save;
    await pool.query(
      `UPDATE save SET 
        hp=?, max_hp=?, atk=?, mp=?, max_mp=?,
        crit_rate=?, dodge_rate=?,
        kill_count=?, elite_count=?, boss_count=?,
        gold=?, jieli=?, level=?, exp=?, free_points=?,
        base_atk=?, base_max_hp=?, base_max_mp=?,
        base_crit_rate=?, base_dodge_rate=?,
        skill_points=?, total_skill_points=?
       WHERE user_id=?`,
      [s.hp, s.max_hp, s.atk, s.mp, s.max_mp,
       s.crit_rate, s.dodge_rate,
       s.kill_count || 0, s.elite_count || 0, s.boss_count || 0,
       s.gold || 0, s.jieli || 0, s.level || 1, s.exp || 0, s.free_points || 0,
       s.base_atk || 1, s.base_max_hp || 100, s.base_max_mp || 50,
       s.base_crit_rate || 0.05, s.base_dodge_rate || 0.03,
       s.skill_points || 0, s.total_skill_points || 0,
       userId]
    );

    res.json({ code: 0, msg: '导入成功' });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;