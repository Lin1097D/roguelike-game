const express = require('express');
const router = express.Router();
const pool = require('../db');
const stats = require('./stats');
const equipmentUtil = require('./equipment');

// ============ 具体路由放前面，通配路由放后面 ============

// 洗练装备词条
router.post('/reroll', async (req, res) => {
  const { userId, equipmentId } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM equipment WHERE id=? AND user_id=?',
      [equipmentId, userId]
    );
    if (rows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const eq = rows[0];

    if (eq.slot === 'artifact1' || eq.slot === 'artifact2') {
      return res.json({ code: 1, msg: '神器无法洗练' });
    }

    const qualityMult = { common: 1, fine: 1.5, rare: 2, epic: 3, legendary: 5 };
    const cost = Math.floor(1000 * (qualityMult[eq.quality] || 1) * ((eq.enhance_level || 0) + 1));

    const [saveRows] = await pool.query('SELECT gold FROM save WHERE user_id=?', [userId]);
    if (saveRows[0].gold < cost) {
      return res.json({ code: 1, msg: `金币不足，需要 ${cost} 金币` });
    }

    await pool.query('UPDATE save SET gold = gold - ? WHERE user_id=?', [cost, userId]);

    const newAffixes = equipmentUtil.generateAffixes(eq.quality, 100);

    await pool.query(
      'UPDATE equipment SET affixes=? WHERE id=?',
      [JSON.stringify(newAffixes), equipmentId]
    );

    const newSave = await stats.recalcAndSave(userId);

    const [newEqRows] = await pool.query('SELECT * FROM equipment WHERE id=?', [equipmentId]);
    const newEq = newEqRows[0];

    res.json({
      code: 0,
      success: true,
      cost,
      equipment: {
        id: newEq.id,
        slot: newEq.slot,
        name: newEq.name,
        quality: newEq.quality,
        statValue: newEq.stat_value,
        enhanceLevel: newEq.enhance_level,
        affixes: newAffixes
      },
      save: newSave
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 强化装备
router.post('/enhance', async (req, res) => {
  const { userId, equipmentId } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM equipment WHERE id=? AND user_id=?',
      [equipmentId, userId]
    );
    if (rows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const eq = rows[0];

    if (eq.slot === 'artifact1' || eq.slot === 'artifact2') {
      return res.json({ code: 1, msg: '神器无法强化' });
    }
    const MAX_LEVEL = 25;
    if (eq.enhance_level >= MAX_LEVEL) {
      return res.json({ code: 1, msg: '已强化到最高等级 +25' });
    }

    const qualityMult = { common: 1, fine: 1.5, rare: 2, epic: 3, legendary: 5 };
    const lv = eq.enhance_level;
    const cost = Math.floor(
      100 * (lv + 1) * (qualityMult[eq.quality] || 1) * (1 + lv * 0.2)
    );

    const [saveRows] = await pool.query('SELECT gold FROM save WHERE user_id=?', [userId]);
    if (saveRows[0].gold < cost) {
      return res.json({ code: 1, msg: `金币不足，需要 ${cost} 金币` });
    }

    const targetLv = lv + 1;
    let successRate = 1.0;
    if (targetLv <= 3)       successRate = 1.0;
    else if (targetLv <= 6)  successRate = 0.9;
    else if (targetLv <= 9)  successRate = 0.8;
    else if (targetLv <= 12) successRate = 0.7;
    else if (targetLv <= 15) successRate = 0.6;
    else if (targetLv <= 18) successRate = 0.5;
    else if (targetLv <= 21) successRate = 0.4;
    else if (targetLv <= 24) successRate = 0.3;
    else                     successRate = 0.2;

    await pool.query(
      'UPDATE save SET gold = gold - ?, daily_enhance = daily_enhance + 1 WHERE user_id=?',
      [cost, userId]
    );

    const success = Math.random() < successRate;

    if (success) {
      await pool.query(
        'UPDATE equipment SET enhance_level = enhance_level + 1 WHERE id=?',
        [equipmentId]
      );
    }

    const newSave = await stats.recalcAndSave(userId);

    const [newEqRows] = await pool.query('SELECT * FROM equipment WHERE id=?', [equipmentId]);
    const newEq = newEqRows[0];

    res.json({
      code: 0,
      success,
      cost,
      successRate,
      equipment: {
        id: newEq.id,
        slot: newEq.slot,
        name: newEq.name,
        quality: newEq.quality,
        statValue: newEq.stat_value,
        enhanceLevel: newEq.enhance_level
      },
      save: newSave
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 自动装备最优装备
router.post('/autoEquip', async (req, res) => {
  const { userId } = req.body;
  try {
    const qualityMult = { common: 1, fine: 1.5, rare: 2, epic: 3, legendary: 5 };
    const [allEq] = await pool.query('SELECT * FROM equipment WHERE user_id=?', [userId]);

    const bySlot = {};
    for (const eq of allEq) {
      if (eq.slot === 'artifact1' || eq.slot === 'artifact2') continue;
      if (!bySlot[eq.slot]) bySlot[eq.slot] = [];
      bySlot[eq.slot].push(eq);
    }

    const bestIds = [];
    for (const slot in bySlot) {
      let best = null;
      let bestScore = -1;
      for (const eq of bySlot[slot]) {
        const enhanceMult = 1 + (eq.enhance_level || 0) * 0.1;
        const score = eq.stat_value * enhanceMult * (qualityMult[eq.quality] || 1);
        if (score > bestScore) {
          bestScore = score;
          best = eq;
        }
      }
      if (best) bestIds.push(best.id);
    }

    await pool.query(
      "UPDATE equipment SET equipped=0 WHERE user_id=? AND slot NOT IN ('artifact1','artifact2')",
      [userId]
    );

    if (bestIds.length > 0) {
      await pool.query(
        `UPDATE equipment SET equipped=1 WHERE id IN (${bestIds.map(() => '?').join(',')})`,
        bestIds
      );
    }

    const newSave = await stats.recalcAndSave(userId);
    res.json({ code: 0, msg: '自动装备完成', save: newSave, equippedCount: bestIds.length });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 穿戴装备
router.post('/equip', async (req, res) => {
  const { userId, equipmentId } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM equipment WHERE id=? AND user_id=?',
      [equipmentId, userId]
    );
    if (rows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const eq = rows[0];
    if (eq.equipped === 1) return res.json({ code: 1, msg: '该装备已穿戴' });

    await pool.query(
      'UPDATE equipment SET equipped=0 WHERE user_id=? AND slot=? AND equipped=1',
      [userId, eq.slot]
    );
    await pool.query('UPDATE equipment SET equipped=1 WHERE id=?', [equipmentId]);

    const newSave = await stats.recalcAndSave(userId);
    res.json({ code: 0, msg: '穿戴成功', save: newSave });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 脱下装备
router.post('/unequip', async (req, res) => {
  const { userId, equipmentId } = req.body;
  try {
    const [eqRows] = await pool.query(
      'SELECT slot FROM equipment WHERE id=? AND user_id=?',
      [equipmentId, userId]
    );
    if (eqRows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const slot = eqRows[0].slot;

    const [bagRows] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM equipment WHERE user_id=? AND equipped=0 AND slot=?',
      [userId, slot]
    );
    if (bagRows[0].cnt >= 10) return res.json({ code: 1, msg: '该槽位背包已满，无法卸下' });

    await pool.query(
      'UPDATE equipment SET equipped=0 WHERE id=? AND user_id=?',
      [equipmentId, userId]
    );

    const newSave = await stats.recalcAndSave(userId);
    res.json({ code: 0, msg: '已卸下', save: newSave });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 丢弃装备
router.post('/discard', async (req, res) => {
  const { userId, equipmentId } = req.body;
  try {
    await pool.query(
      'DELETE FROM equipment WHERE id=? AND user_id=? AND equipped=0',
      [equipmentId, userId]
    );
    res.json({ code: 0, msg: '已丢弃' });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 获取背包 + 已穿戴装备
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM equipment WHERE user_id=? ORDER BY equipped DESC, created_at DESC',
      [userId]
    );
    const equipped = {};
    const bag = [];
    for (const row of rows) {
      const item = {
        id: row.id,
        slot: row.slot,
        name: row.name,
        quality: row.quality,
        statValue: row.stat_value,
        enhanceLevel: row.enhance_level,
        setName: row.set_name,
        equipped: row.equipped === 1,
        affixes: (() => {
          try {
            return row.affixes ? JSON.parse(row.affixes) : [];
          } catch (e) { return []; }
        })()
      };
      if (item.equipped) equipped[item.slot] = item;
      else bag.push(item);
    }
    res.json({ code: 0, equipped, bag });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;