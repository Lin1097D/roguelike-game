const express = require('express');
const router = express.Router();
const pool = require('../db');
const stats = require('./stats');
const equipmentUtil = require('./equipment');

router.post('/reroll', async (req, res) => {
  const { saveId, equipmentId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM equipment WHERE id=? AND save_id=?', [equipmentId, saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const eq = rows[0];
    if (eq.slot === 'artifact1' || eq.slot === 'artifact2') return res.json({ code: 1, msg: '神器无法洗练' });

    const qualityMult = { common: 1, fine: 1.5, rare: 2, epic: 3, legendary: 5 };
    const cost = Math.floor(1000 * (qualityMult[eq.quality] || 1) * ((eq.enhance_level || 0) + 1));
    const [saveRows] = await pool.query('SELECT gold, kill_count FROM save WHERE id=?', [saveId]);
    if (saveRows[0].gold < cost) return res.json({ code: 1, msg: `金币不足，需要 ${cost}` });

    await pool.query('UPDATE save SET gold = gold - ? WHERE id=?', [cost, saveId]);
    const currentKill = saveRows[0].kill_count || 0;
    const newAffixes = equipmentUtil.generateAffixes(eq.quality, currentKill);
    await pool.query('UPDATE equipment SET affixes=? WHERE id=?', [JSON.stringify(newAffixes), equipmentId]);
    const newSave = await stats.recalcAndSave(saveId);
    const [newEqRows] = await pool.query('SELECT * FROM equipment WHERE id=?', [equipmentId]);
    const newEq = newEqRows[0];

    res.json({
      code: 0, success: true, cost,
      equipment: { id: newEq.id, slot: newEq.slot, name: newEq.name, quality: newEq.quality, statValue: newEq.stat_value, enhanceLevel: newEq.enhance_level, affixes: newAffixes },
      save: newSave
    });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/enhance', async (req, res) => {
  const { saveId, equipmentId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM equipment WHERE id=? AND save_id=?', [equipmentId, saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const eq = rows[0];
    if (eq.slot === 'artifact1' || eq.slot === 'artifact2') return res.json({ code: 1, msg: '神器无法强化' });
    const MAX_LEVEL = 25;
    if (eq.enhance_level >= MAX_LEVEL) return res.json({ code: 1, msg: '已强化到最高等级' });

    const qualityMult = { common: 1, fine: 1.5, rare: 2, epic: 3, legendary: 5 };
    const lv = eq.enhance_level;
    const cost = Math.floor(100 * (lv + 1) * (qualityMult[eq.quality] || 1) * (1 + lv * 0.2));
    const [saveRows] = await pool.query('SELECT gold FROM save WHERE id=?', [saveId]);
    if (saveRows[0].gold < cost) return res.json({ code: 1, msg: `金币不足，需要 ${cost}` });

    const targetLv = lv + 1;
    let successRate = 1.0;
    if (targetLv <= 3) successRate = 1.0;
    else if (targetLv <= 6) successRate = 0.9;
    else if (targetLv <= 9) successRate = 0.8;
    else if (targetLv <= 12) successRate = 0.7;
    else if (targetLv <= 15) successRate = 0.6;
    else if (targetLv <= 18) successRate = 0.5;
    else if (targetLv <= 21) successRate = 0.4;
    else if (targetLv <= 24) successRate = 0.3;
    else successRate = 0.2;

    await pool.query('UPDATE save SET gold = gold - ?, daily_enhance = daily_enhance + 1 WHERE id=?', [cost, saveId]);
    const success = Math.random() < successRate;
    if (success) await pool.query('UPDATE equipment SET enhance_level = enhance_level + 1 WHERE id=?', [equipmentId]);

    const newSave = await stats.recalcAndSave(saveId);
    const [newEqRows] = await pool.query('SELECT * FROM equipment WHERE id=?', [equipmentId]);
    const newEq = newEqRows[0];

    res.json({
      code: 0, success, cost, successRate,
      equipment: { id: newEq.id, slot: newEq.slot, name: newEq.name, quality: newEq.quality, statValue: newEq.stat_value, enhanceLevel: newEq.enhance_level },
      save: newSave
    });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/autoEquip', async (req, res) => {
  const { saveId } = req.body;
  try {
    const qualityMult = { common: 1, fine: 1.5, rare: 2, epic: 3, legendary: 5 };
    const [allEq] = await pool.query('SELECT * FROM equipment WHERE save_id=?', [saveId]);

    const bySlot = {};
    for (const eq of allEq) {
      if (eq.slot === 'artifact1' || eq.slot === 'artifact2') continue;
      if (!bySlot[eq.slot]) bySlot[eq.slot] = [];
      bySlot[eq.slot].push(eq);
    }

    const bestIds = [];
    for (const slot in bySlot) {
      let best = null, bestScore = -1;
      for (const eq of bySlot[slot]) {
        const enhanceMult = 1 + (eq.enhance_level || 0) * 0.1;
        const score = eq.stat_value * enhanceMult * (qualityMult[eq.quality] || 1);
        if (score > bestScore) { bestScore = score; best = eq; }
      }
      if (best) bestIds.push(best.id);
    }

    await pool.query("UPDATE equipment SET equipped=0 WHERE save_id=? AND slot NOT IN ('artifact1','artifact2')", [saveId]);
    if (bestIds.length > 0) {
      await pool.query(`UPDATE equipment SET equipped=1 WHERE id IN (${bestIds.map(() => '?').join(',')})`, bestIds);
    }

    const newSave = await stats.recalcAndSave(saveId);
    res.json({ code: 0, msg: '自动装备完成', save: newSave, equippedCount: bestIds.length });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/equip', async (req, res) => {
  const { saveId, equipmentId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM equipment WHERE id=? AND save_id=?', [equipmentId, saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const eq = rows[0];
    if (eq.equipped === 1) return res.json({ code: 1, msg: '该装备已穿戴' });

    await pool.query('UPDATE equipment SET equipped=0 WHERE save_id=? AND slot=? AND equipped=1', [saveId, eq.slot]);
    await pool.query('UPDATE equipment SET equipped=1 WHERE id=?', [equipmentId]);

    const newSave = await stats.recalcAndSave(saveId);
    res.json({ code: 0, msg: '穿戴成功', save: newSave });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/unequip', async (req, res) => {
  const { saveId, equipmentId } = req.body;
  try {
    const [eqRows] = await pool.query('SELECT slot FROM equipment WHERE id=? AND save_id=?', [equipmentId, saveId]);
    if (eqRows.length === 0) return res.json({ code: 1, msg: '装备不存在' });
    const slot = eqRows[0].slot;

    const [bagRows] = await pool.query('SELECT COUNT(*) AS cnt FROM equipment WHERE save_id=? AND equipped=0 AND slot=?', [saveId, slot]);
    if (bagRows[0].cnt >= 10) return res.json({ code: 1, msg: '该槽位背包已满' });

    await pool.query('UPDATE equipment SET equipped=0 WHERE id=? AND save_id=?', [equipmentId, saveId]);
    const newSave = await stats.recalcAndSave(saveId);
    res.json({ code: 0, msg: '已卸下', save: newSave });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/discard', async (req, res) => {
  const { saveId, equipmentId } = req.body;
  try {
    await pool.query('DELETE FROM equipment WHERE id=? AND save_id=? AND equipped=0', [equipmentId, saveId]);
    res.json({ code: 0, msg: '已丢弃' });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM equipment WHERE save_id=? ORDER BY equipped DESC, created_at DESC', [saveId]);
    const equipped = {}, bag = [];
    for (const row of rows) {
      const item = {
        id: row.id, slot: row.slot, name: row.name, quality: row.quality,
        statValue: row.stat_value, enhanceLevel: row.enhance_level,
        setName: row.set_name, equipped: row.equipped === 1,
        affixes: (() => { try { return row.affixes ? JSON.parse(row.affixes) : []; } catch (e) { return []; } })()
      };
      if (item.equipped) equipped[item.slot] = item; else bag.push(item);
    }
    res.json({ code: 0, equipped, bag });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;