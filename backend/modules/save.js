const express = require('express');
const router = express.Router();
const pool = require('../db');
const config = require('../config/gameConfig');

function expNeed(level) {
  return Math.floor(100 * level * Math.pow(1.15, level - 1));
}

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [userRows] = await pool.query('SELECT current_save_id FROM user WHERE id=?', [userId]);
    if (userRows.length === 0) return res.json({ code: 1, msg: '用户不存在' });
    const saveId = userRows[0].current_save_id;
    if (!saveId) return res.json({ code: 1, msg: '没有角色，请先创建' });

    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
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
        const hours = diffHours;
        const goldPerHour = (config.goldGain.baseNormal + 500 * config.goldGain.perKill) * 500;
        const expPerHour = config.level.expPerKill.normal * 500;

        const goldReward = Math.floor(goldPerHour * hours);
        const expReward = Math.floor(expPerHour * hours);

        // 离线经验可能触发升级
        let lv = s.level || 1;
        let exp = (s.exp || 0) + expReward;
        let freePoints = 0;
        while (lv < config.level.maxLevel) {
          const need = expNeed(lv);
          if (exp >= need) {
            exp -= need;
            lv += 1;
            freePoints += config.level.pointsPerLevel;
            if (lv % 10 === 0) freePoints += config.level.bonusEvery10;
            if (lv % 50 === 0) freePoints += config.level.bonusEvery50;
          } else break;
        }

        await pool.query(
          `UPDATE save SET gold = gold + ?, exp = ?, level = ?, free_points = free_points + ? WHERE id=?`,
          [goldReward, exp, lv, freePoints, saveId]
        );

        offlineReward = { hours: Math.round(hours * 10) / 10, gold: goldReward, exp: expReward };
      }
    }

    await pool.query('UPDATE save SET last_online=NOW() WHERE id=?', [saveId]);

    const [newRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    const [userSoulRows] = await pool.query('SELECT soul_fragment FROM user WHERE id=?', [userId]);
    const [eqRows] = await pool.query('SELECT * FROM equipment WHERE save_id=? AND equipped=1', [saveId]);

    const data = newRows[0];
    data.saveId = saveId;
    data.soul = userSoulRows[0].soul_fragment;
    data.equipment = {};
    for (const row of eqRows) {
      data.equipment[row.slot] = {
        id: row.id, name: row.name, quality: row.quality, statValue: row.stat_value
      };
    }

    res.json({ code: 0, data, offlineReward });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/import', async (req, res) => {
  const { saveId, data } = req.body;
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
       WHERE id=?`,
      [s.hp, s.max_hp, s.atk, s.mp, s.max_mp,
       s.crit_rate, s.dodge_rate,
       s.kill_count || 0, s.elite_count || 0, s.boss_count || 0,
       s.gold || 0, s.jieli || 0, s.level || 1, s.exp || 0, s.free_points || 0,
       s.base_atk || 1, s.base_max_hp || 100, s.base_max_mp || 50,
       s.base_crit_rate || 0.05, s.base_dodge_rate || 0.03,
       s.skill_points || 0, s.total_skill_points || 0,
       saveId]
    );

    res.json({ code: 0, msg: '导入成功' });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;