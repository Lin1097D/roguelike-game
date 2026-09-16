const express = require('express');
const router = express.Router();
const pool = require('../db');
const config = require('../config/gameConfig');
const equipmentUtil = require('./equipment');
const stats = require('./stats');

// 升到 N 级所需经验
function expNeed(level) {
  return Math.floor(100 * level * Math.pow(1.2, level - 1));
}

// 击杀怪物
router.post('/kill', async (req, res) => {
  const { userId, monsterType } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];

    const reward = config.killReward[monsterType] || config.killReward.normal;
    const heal = config.killHeal;

    const newKill = s.kill_count + 1;
    const newElite = s.elite_count + (monsterType === 'elite' ? 1 : 0);
    const newBoss = s.boss_count + (monsterType === 'boss' ? 1 : 0);
    const newJieli = (s.jieli || 0) + config.jieli.perKill;

    // 金币
    const goldCfg = config.goldGain;
    const goldBase = goldCfg.baseNormal + newKill * goldCfg.perKill;
    let goldGain = Math.floor(goldBase);
    if (monsterType === 'elite') goldGain = Math.floor(goldBase * goldCfg.eliteMult);
    if (monsterType === 'boss')  goldGain = Math.floor(goldBase * goldCfg.bossMult);

    const goldBonus = s.gold_bonus || 0;
    if (goldBonus > 0) {
      goldGain = Math.floor(goldGain * (1 + goldBonus));
    }

    // ============ 经验结算 ============
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
      } else {
        break;
      }
    }

    const levelUp = newLevel > (s.level || 1);

    const talentBonus = await stats.getTalentBonus(userId);

    await pool.query(
      `UPDATE save SET 
        base_atk = base_atk + ?, 
        base_max_hp = base_max_hp + ?, hp = LEAST(max_hp, hp + ? + ?),
        base_max_mp = base_max_mp + ?, mp = LEAST(max_mp, mp + ? + ?),
        kill_count = ?, elite_count = ?, boss_count = ?,
        gold = gold + ?, jieli = ?,
        level = ?, exp = ?, free_points = free_points + ?,
        updated_at = NOW()
       WHERE user_id = ?`,
      [reward.atk, reward.hp, reward.hp, heal.hp,
       reward.mp, reward.mp, heal.mp,
       newKill, newElite, newBoss, goldGain, newJieli,
       newLevel, newExp, freePointsGain,
       userId]
    );

    await stats.recalcAndSave(userId);

    let droppedEquipment = null;
    let discardedEquipment = null;
    let bagFull = false;

    // Boss 首杀掉神器
    if (monsterType === 'boss') {
      const [owned] = await pool.query(
        "SELECT slot FROM equipment WHERE user_id=? AND (slot='artifact1' OR slot='artifact2')",
        [userId]
      );
      const ownedSlots = owned.map(o => o.slot);
      let artifactSlot = null;
      if (!ownedSlots.includes('artifact1')) artifactSlot = 'artifact1';
      else if (!ownedSlots.includes('artifact2')) artifactSlot = 'artifact2';

      if (artifactSlot) {
        const art = equipmentUtil.generateArtifact(artifactSlot, newKill);
        const [result] = await pool.query(
          'INSERT INTO equipment (user_id, slot, name, quality, stat_value, affixes, set_name, equipped) VALUES (?,?,?,?,?,?,?,0)',
          [userId, art.slot, art.name, art.quality, art.statValue, JSON.stringify(art.affixes || []), null]
        );
        art.id = result.insertId;
        droppedEquipment = art;
      }
    }

    // 普通掉落
    if (!droppedEquipment) {
      const baseDropRate = config.dropRate[monsterType] || 0;
      const dropMult = (talentBonus && talentBonus.dropMult) ? talentBonus.dropMult : 1;
      const finalDropRate = baseDropRate * dropMult;

      let drop = null;
      if (Math.random() < finalDropRate) {
        drop = equipmentUtil.generateEquipment(monsterType, newKill);
      }

      if (drop) {
        const [slotBag] = await pool.query(
          'SELECT * FROM equipment WHERE user_id=? AND equipped=0 AND slot=? ORDER BY stat_value ASC',
          [userId, drop.slot]
        );

        if (slotBag.length >= equipmentUtil.SLOT_BAG_SIZE) {
          const worst = slotBag[0];
          if (drop.statValue > worst.stat_value) {
            await pool.query('DELETE FROM equipment WHERE id=?', [worst.id]);
            const [result] = await pool.query(
              'INSERT INTO equipment (user_id, slot, name, quality, stat_value, affixes, set_name, equipped) VALUES (?,?,?,?,?,?,?,0)',
              [userId, drop.slot, drop.name, drop.quality, drop.statValue, JSON.stringify(drop.affixes || []), drop.setName || null]
            );
            drop.id = result.insertId;
            drop.replaced = worst.name;
            droppedEquipment = drop;
          } else {
            discardedEquipment = {
              name: drop.name,
              quality: drop.quality,
              slot: drop.slot,
              statValue: drop.statValue
            };
          }
        } else {
          const [result] = await pool.query(
            'INSERT INTO equipment (user_id, slot, name, quality, stat_value, affixes, set_name, equipped) VALUES (?,?,?,?,?,?,?,0)',
            [userId, drop.slot, drop.name, drop.quality, drop.statValue, JSON.stringify(drop.affixes || []), drop.setName || null]
          );
          drop.id = result.insertId;
          droppedEquipment = drop;
        }
      }
    }

    const [newRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({
      code: 0,
      data: newRows[0],
      drop: droppedEquipment,
      discarded: discardedEquipment,
      bagFull,
      levelUp: levelUp ? { newLevel, freePointsGain } : null
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 受伤
router.post('/hurt', async (req, res) => {
  const { userId, damage } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = rows[0];
    let newHp = s.hp - damage;
    let dead = false;
    let revived = false;

    if (newHp <= 0) {
      const talentBonus = await stats.getTalentBonus(userId);
      if (talentBonus && talentBonus.revive > 0 && Math.random() < talentBonus.revive) {
        newHp = s.max_hp;
        revived = true;
      } else {
        newHp = 0;
        dead = true;
      }
    }

    await pool.query('UPDATE save SET hp=? WHERE user_id=?', [newHp, userId]);
    res.json({ code: 0, hp: newHp, dead, revived });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 恢复
router.post('/heal', async (req, res) => {
  const { userId, hp, mp } = req.body;
  try {
    await pool.query(
      'UPDATE save SET hp = LEAST(max_hp, hp + ?), mp = LEAST(max_mp, mp + ?) WHERE user_id=?',
      [hp, mp, userId]
    );
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({ code: 0, data: rows[0] });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 消耗 MP
router.post('/useMp', async (req, res) => {
  const { userId, cost } = req.body;
  try {
    const [rows] = await pool.query('SELECT mp FROM save WHERE user_id=?', [userId]);
    if (rows[0].mp < cost) return res.json({ code: 1, msg: 'MP不足' });
    await pool.query('UPDATE save SET mp = mp - ? WHERE user_id=?', [cost, userId]);
    res.json({ code: 0 });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 每回合回复
router.post('/tick', async (req, res) => {
  const { userId } = req.body;
  const tick = config.tickHeal;
  try {
    await pool.query(
      `UPDATE save SET 
        mp = LEAST(max_mp, mp + ?),
        hp = LEAST(max_hp, hp + ?)
       WHERE user_id=?`,
      [tick.mp, tick.hp, userId]
    );
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({ code: 0, data: rows[0] });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 死亡复活（等级保留）
router.post('/revive', async (req, res) => {
  const { userId } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = rows[0];
    const soul = Math.floor(s.kill_count * config.death.soulPerKill);
    const cfg = config.player;
    const newJieli = (s.jieli || 0) + config.jieli.perDeath;

    const talentBonus = await stats.getTalentBonus(userId);
    const noReset = talentBonus && talentBonus.noReset;

    if (noReset) {
      await pool.query(
        `UPDATE save SET gold=0, jieli=?, updated_at=NOW() WHERE user_id=?`,
        [newJieli, userId]
      );
    } else {
      await pool.query(
        `UPDATE save SET 
          hp=?, max_hp=?, atk=?, mp=?, max_mp=?, crit_rate=?, dodge_rate=?,
          base_atk=?, base_max_hp=?, base_max_mp=?, base_crit_rate=?, base_dodge_rate=?,
          kill_count=0, elite_count=0, boss_count=0, gold=0,
          jieli=?,
          updated_at=NOW()
         WHERE user_id=?`,
        [cfg.initHp, cfg.initHp, cfg.initAtk, cfg.initMp, cfg.initMp, cfg.initCrit, cfg.initDodge,
         cfg.initAtk, cfg.initHp, cfg.initMp, cfg.initCrit, cfg.initDodge,
         newJieli, userId]
      );

      await pool.query(
        "DELETE FROM equipment WHERE user_id=? AND slot NOT IN ('artifact1','artifact2')",
        [userId]
      );
    }

    await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, userId]);
    await stats.recalcAndSave(userId);

    const [newRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const [userRows] = await pool.query('SELECT soul_fragment FROM user WHERE id=?', [userId]);
    res.json({ code: 0, data: newRows[0], soul: userRows[0].soul_fragment, gained: soul });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;