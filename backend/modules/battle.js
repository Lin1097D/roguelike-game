const express = require('express');
const router = express.Router();
const pool = require('../db');
const config = require('../config/gameConfig');
const equipmentUtil = require('./equipment');
const stats = require('./stats');

function expNeed(level) {
  return Math.floor(100 * level * Math.pow(1.15, level - 1));
}

function checkSkillPoints(oldLevel, newLevel) {
  let points = 0;
  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    if (lv % 5 === 0) points += 1;
  }
  return points;
}

router.post('/kill', async (req, res) => {
  const { saveId, monsterType, damage, monsterName } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];

    const reward = config.killReward[monsterType] || config.killReward.normal;
    const heal = config.killHeal;

    const newKill = s.kill_count + 1;
    const newElite = s.elite_count + (monsterType === 'elite' ? 1 : 0);
    const newBoss = s.boss_count + (monsterType === 'boss' ? 1 : 0);
    const newJieli = (s.jieli || 0) + config.jieli.perKill;

    const goldCfg = config.goldGain;
    const goldBase = goldCfg.baseNormal + newKill * goldCfg.perKill;
    let goldGain = Math.floor(goldBase);
    if (monsterType === 'elite') goldGain = Math.floor(goldBase * goldCfg.eliteMult);
    if (monsterType === 'boss')  goldGain = Math.floor(goldBase * goldCfg.bossMult);
    const goldBonus = s.gold_bonus || 0;
    if (goldBonus > 0) goldGain = Math.floor(goldGain * (1 + goldBonus));

    const expGain = config.level.expPerKill[monsterType] || config.level.expPerKill.normal;
    let newExp = (s.exp || 0) + expGain;
    let newLevel = s.level || 1;
    let freePointsGain = 0;
    while (newLevel < config.level.maxLevel) {
      const need = expNeed(newLevel);
      if (newExp >= need) {
        newExp -= need;
        newLevel += 1;
        freePointsGain += config.level.pointsPerLevel;
        if (newLevel % 10 === 0) freePointsGain += config.level.bonusEvery10;
        if (newLevel % 50 === 0) freePointsGain += config.level.bonusEvery50;
      } else break;
    }
    const levelUp = newLevel > (s.level || 1);
    const talentBonus = await stats.getTalentBonus(saveId);
    const skillPointsGain = checkSkillPoints(s.level || 1, newLevel);

    await pool.query(
      `UPDATE save SET 
        base_atk = base_atk + ?, 
        base_max_hp = base_max_hp + ?, hp = LEAST(max_hp, hp + ? + ?),
        base_max_mp = base_max_mp + ?, mp = LEAST(max_mp, mp + ? + ?),
        kill_count = ?, elite_count = ?, boss_count = ?,
        gold = gold + ?, jieli = ?,
        level = ?, exp = ?, free_points = free_points + ?,
        daily_kill = daily_kill + 1,
        skill_points = skill_points + ?,
        total_skill_points = total_skill_points + ?,
        total_damage = total_damage + ?,
        max_combo = GREATEST(max_combo, ?),
        updated_at = NOW()
       WHERE id = ?`,
      [reward.atk, reward.hp, reward.hp, heal.hp,
       reward.mp, reward.mp, heal.mp,
       newKill, newElite, newBoss, goldGain, newJieli,
       newLevel, newExp, freePointsGain,
       skillPointsGain, skillPointsGain, damage || 0,
       newKill,
       saveId]
    );

    if (monsterName) {
      try {
        const [saveRows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
        const userId = saveRows[0] ? saveRows[0].user_id : null;
        if (userId) {
          await pool.query(
            `INSERT INTO monster_log (user_id, save_id, monster_name, monster_type, kill_count)
             VALUES (?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE kill_count = kill_count + 1`,
            [userId, saveId, monsterName, monsterType]
          );
        }
      } catch (e) {
        console.error('[monster_log] 写入失败:', e.message);
      }
    }

    await stats.recalcAndSave(saveId);

    let droppedEquipment = null;
    let discardedEquipment = null;
    let bagFull = false;

    if (monsterType === 'boss') {
      const [owned] = await pool.query(
        "SELECT slot FROM equipment WHERE save_id=? AND (slot='artifact1' OR slot='artifact2')",
        [saveId]
      );
      const ownedSlots = owned.map(o => o.slot);
      let artifactSlot = null;
      if (!ownedSlots.includes('artifact1')) artifactSlot = 'artifact1';
      else if (!ownedSlots.includes('artifact2')) artifactSlot = 'artifact2';

      if (artifactSlot) {
        const art = equipmentUtil.generateArtifact(artifactSlot, newKill);
        const [result] = await pool.query(
          'INSERT INTO equipment (save_id, slot, name, quality, stat_value, affixes, set_name, equipped) VALUES (?,?,?,?,?,?,?,0)',
          [saveId, art.slot, art.name, art.quality, art.statValue, JSON.stringify(art.affixes || []), null]
        );
        art.id = result.insertId;
        droppedEquipment = art;
      }
    }

    if (!droppedEquipment) {
      const baseDropRate = config.dropRate[monsterType] || 0;
      const dropMult = (talentBonus && talentBonus.dropMult) ? talentBonus.dropMult : 1;
      const finalDropRate = baseDropRate * dropMult;
      let drop = null;
      if (Math.random() < finalDropRate) drop = equipmentUtil.generateEquipment(monsterType, newKill);

      if (drop) {
        const [slotBag] = await pool.query(
          'SELECT * FROM equipment WHERE save_id=? AND equipped=0 AND slot=? ORDER BY stat_value ASC',
          [saveId, drop.slot]
        );
        if (slotBag.length >= equipmentUtil.SLOT_BAG_SIZE) {
          const worst = slotBag[0];
          if (drop.statValue > worst.stat_value) {
            await pool.query('DELETE FROM equipment WHERE id=?', [worst.id]);
            const [result] = await pool.query(
              'INSERT INTO equipment (save_id, slot, name, quality, stat_value, affixes, set_name, equipped) VALUES (?,?,?,?,?,?,?,0)',
              [saveId, drop.slot, drop.name, drop.quality, drop.statValue, JSON.stringify(drop.affixes || []), drop.setName || null]
            );
            drop.id = result.insertId;
            drop.replaced = worst.name;
            droppedEquipment = drop;
          } else {
            discardedEquipment = { name: drop.name, quality: drop.quality, slot: drop.slot, statValue: drop.statValue };
          }
        } else {
          const [result] = await pool.query(
            'INSERT INTO equipment (save_id, slot, name, quality, stat_value, affixes, set_name, equipped) VALUES (?,?,?,?,?,?,?,0)',
            [saveId, drop.slot, drop.name, drop.quality, drop.statValue, JSON.stringify(drop.affixes || []), drop.setName || null]
          );
          drop.id = result.insertId;
          droppedEquipment = drop;
        }
      }
    }

    const [newRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    res.json({
      code: 0,
      data: newRows[0],
      drop: droppedEquipment,
      discarded: discardedEquipment,
      bagFull,
      levelUp: levelUp ? { newLevel, freePointsGain } : null,
      expGain: expGain
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/hurt', async (req, res) => {
  const { saveId, damage } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];
    let newHp = s.hp - damage;
    let dead = false;
    let revived = false;

    if (newHp <= 0) {
      const talentBonus = await stats.getTalentBonus(saveId);
      const skillBonus = await stats.calcSkillBonus(saveId);
      const talentRevive = (talentBonus && talentBonus.revive) || 0;
      const skillRevive = (skillBonus && skillBonus.revive) || 0;
      const totalRevive = talentRevive + skillRevive;

      if (totalRevive > 0 && Math.random() < totalRevive) {
        newHp = s.max_hp; revived = true;
      } else { newHp = 0; dead = true; }
    }

    await pool.query('UPDATE save SET hp=?, total_damage_taken = total_damage_taken + ? WHERE id=?', [newHp, damage, saveId]);
    res.json({ code: 0, hp: newHp, dead, revived });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/heal', async (req, res) => {
  const { saveId, hp, mp } = req.body;
  try {
    await pool.query(
      'UPDATE save SET hp = LEAST(max_hp, hp + ?), mp = LEAST(max_mp, mp + ?) WHERE id=?',
      [hp, mp, saveId]
    );
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    res.json({ code: 0, data: rows[0] });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/useMp', async (req, res) => {
  const { saveId, cost } = req.body;
  try {
    const [rows] = await pool.query('SELECT mp FROM save WHERE id=?', [saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    if (rows[0].mp < cost) return res.json({ code: 1, msg: 'MP不足' });
    await pool.query('UPDATE save SET mp = mp - ? WHERE id=?', [cost, saveId]);
    res.json({ code: 0 });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/tick', async (req, res) => {
  const { saveId } = req.body;
  const tick = config.tickHeal;
  try {
    await pool.query(
      `UPDATE save SET mp = LEAST(max_mp, mp + ?), hp = LEAST(max_hp, hp + ?) WHERE id=?`,
      [tick.mp, tick.hp, saveId]
    );
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    res.json({ code: 0, data: rows[0] });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/revive', async (req, res) => {
  const { saveId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];
    const soul = Math.floor(s.kill_count * config.death.soulPerKill);
    const cfg = config.player;
    const newJieli = (s.jieli || 0) + config.jieli.perDeath;

    const talentBonus = await stats.getTalentBonus(saveId);
    const noReset = talentBonus && talentBonus.noReset;

    if (noReset) {
      await pool.query(
        'UPDATE save SET gold=0, jieli=?, death_count = death_count + 1, max_combo=0, updated_at=NOW() WHERE id=?',
        [newJieli, saveId]
      );
    } else {
      await pool.query(
        `UPDATE save SET 
          hp=?, max_hp=?, atk=?, mp=?, max_mp=?, crit_rate=?, dodge_rate=?,
          base_atk=?, base_max_hp=?, base_max_mp=?, base_crit_rate=?, base_dodge_rate=?,
          kill_count=0, elite_count=0, boss_count=0, gold=0, jieli=?,
          level=1, exp=0, max_combo=0,
          death_count = death_count + 1, updated_at=NOW()
         WHERE id=?`,
        [cfg.initHp, cfg.initHp, cfg.initAtk, cfg.initMp, cfg.initMp, cfg.initCrit, cfg.initDodge,
         cfg.initAtk, cfg.initHp, cfg.initMp, cfg.initCrit, cfg.initDodge, newJieli, saveId]
      );
      await pool.query("DELETE FROM equipment WHERE save_id=? AND slot NOT IN ('artifact1','artifact2')", [saveId]);
    }

    const [saveRows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
    await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, saveRows[0].user_id]);
    await stats.recalcAndSave(saveId);

    const [newRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    const [userRows] = await pool.query('SELECT soul_fragment FROM user WHERE id=?', [saveRows[0].user_id]);
    res.json({ code: 0, data: newRows[0], soul: userRows[0].soul_fragment, gained: soul });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;