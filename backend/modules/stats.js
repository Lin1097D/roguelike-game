const pool = require('../db');
const config = require('../config/gameConfig');

function calcEquipmentBonus(equipmentList) {
  const bonus = { atk: 0, max_hp: 0, max_mp: 0, crit_rate: 0, dodge_rate: 0, drain: 0, goldPct: 0 };
  const setCount = {};

  for (const eq of equipmentList) {
    // 神器
    if (eq.slot === 'artifact1' || eq.slot === 'artifact2') {
      bonus.atk += config.artifact.bonus.atk;
      bonus.max_hp += config.artifact.bonus.max_hp;
      bonus.max_mp += config.artifact.bonus.max_mp;
      continue;
    }

    // 主属性
    const slotCfg = config.equipmentSlots[eq.slot];
    if (slotCfg) {
      const stat = slotCfg.mainStat;
      const enhanceMult = 1 + (eq.enhance_level || 0) * 0.1;
      const value = eq.stat_value * enhanceMult;
      bonus[stat] = (bonus[stat] || 0) + value;
    }

    // 词条
    if (eq.affixes) {
      let affixes = [];
      try {
        affixes = typeof eq.affixes === 'string' ? JSON.parse(eq.affixes) : eq.affixes;
      } catch (e) { affixes = []; }
      for (const a of affixes) {
        if (a.key === 'atk')      bonus.atk += a.value;
        if (a.key === 'max_hp')   bonus.max_hp += a.value;
        if (a.key === 'max_mp')   bonus.max_mp += a.value;
        if (a.key === 'crit')     bonus.crit_rate += a.value;
        if (a.key === 'dodge')    bonus.dodge_rate += a.value;
        if (a.key === 'drain')    bonus.drain += a.value;
        if (a.key === 'goldPct')  bonus.goldPct += a.value;
      }
    }

    // 统计套装件数
    if (eq.set_name) {
      setCount[eq.set_name] = (setCount[eq.set_name] || 0) + 1;
    }
  }

  // 计算套装效果
  for (const setName in setCount) {
    const count = setCount[setName];
    const setDef = config.setList.find(s => s.name === setName);
    if (!setDef) continue;

    let effect = null;
    if (count >= 4) effect = setDef.four;
    else if (count >= 2) effect = setDef.two;
    if (!effect) continue;

    if (effect.atkPct) bonus.atk += Math.floor(bonus.atk * effect.atkPct);
    if (effect.hpPct)  bonus.max_hp += Math.floor(bonus.max_hp * effect.hpPct);
    if (effect.mpPct)  bonus.max_mp += Math.floor(bonus.max_mp * effect.mpPct);
    if (effect.crit)   bonus.crit_rate += effect.crit;
    if (effect.dodge)  bonus.dodge_rate += effect.dodge;
    if (effect.drain)  bonus.drain += effect.drain;
  }

  return bonus;
}

function calcTalentBonus(talentList, baseStats) {
  const bonus = { atk: 0, max_hp: 0, max_mp: 0, crit_rate: 0, dodge_rate: 0, drain: 0,
                  goldPct: 0, dropMult: 1, jieliMult: 0, jieliCrit: 0, jieliAtkPct: 0,
                  lowHpAtk: 0, pierce: 0, doubleHit: 0, revive: 0, soulPct: 0,
                  killAtk: 0, noReset: false };

  for (const t of talentList) {
    const pool = config.talent.pool[t.quality] || [];
    const info = pool.find(x => x.key === t.talent_key);
    if (!info || !info.effect) continue;
    const stacks = t.stacks || 1;
    const e = info.effect;

    if (e.atk) bonus.atk += e.atk * stacks;
    if (e.max_hp) bonus.max_hp += e.max_hp * stacks;
    if (e.max_mp) bonus.max_mp += e.max_mp * stacks;
    if (e.atkPct) bonus.atk += Math.floor(baseStats.base_atk * e.atkPct * stacks);
    if (e.hpPct) bonus.max_hp += Math.floor(baseStats.base_max_hp * e.hpPct * stacks);
    if (e.crit) bonus.crit_rate += e.crit * stacks;
    if (e.dodge) bonus.dodge_rate += e.dodge * stacks;
    if (e.drain) bonus.drain += e.drain * stacks;
    if (e.goldPct) bonus.goldPct += e.goldPct * stacks;
    if (e.dropMult) bonus.dropMult *= e.dropMult;
    if (e.jieliMult) bonus.jieliMult += e.jieliMult * stacks;
    if (e.jieliCrit) bonus.jieliCrit += e.jieliCrit * stacks;
    if (e.jieliAtkPct) bonus.jieliAtkPct += e.jieliAtkPct * stacks;
    if (e.lowHpAtk) bonus.lowHpAtk += e.lowHpAtk * stacks;
    if (e.pierce) bonus.pierce += e.pierce * stacks;
    if (e.doubleHit) bonus.doubleHit += e.doubleHit * stacks;
    if (e.revive) bonus.revive += e.revive * stacks;
    if (e.soulPct) bonus.soulPct += e.soulPct * stacks;
    if (e.killAtk) bonus.killAtk += e.killAtk * stacks;
    if (e.noReset) bonus.noReset = true;
  }
  return bonus;
}

async function recalcAndSave(userId) {
  const [saveRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
  if (saveRows.length === 0) return null;
  const s = saveRows[0];

  const [eqRows] = await pool.query(
    'SELECT * FROM equipment WHERE user_id=? AND equipped=1',
    [userId]
  );
  const [talentRows] = await pool.query(
    'SELECT * FROM talent WHERE user_id=? AND active=1',
    [userId]
  );

  const eqBonus = calcEquipmentBonus(eqRows);
  const tBonus = calcTalentBonus(talentRows, s);

  const finalAtk = Math.floor(s.base_atk + eqBonus.atk + tBonus.atk);
  const finalMaxHp = Math.floor(s.base_max_hp + eqBonus.max_hp + tBonus.max_hp);
  const finalMaxMp = Math.floor(s.base_max_mp + eqBonus.max_mp + tBonus.max_mp);
  const finalCrit = Math.round((s.base_crit_rate + eqBonus.crit_rate + tBonus.crit_rate) * 1000) / 1000;
  const finalDodge = Math.round((s.base_dodge_rate + eqBonus.dodge_rate + tBonus.dodge_rate) * 1000) / 1000;

  const finalHp = Math.min(s.hp, finalMaxHp);
  const finalMp = Math.min(s.mp, finalMaxMp);

  const finalDrain = Math.round((eqBonus.drain + tBonus.drain) * 1000) / 1000;
  const finalGoldBonus = Math.round((eqBonus.goldPct + tBonus.goldPct) * 1000) / 1000;
  
  await pool.query(
    `UPDATE save SET 
      atk=?, max_hp=?, max_mp=?, crit_rate=?, dodge_rate=?,
      drain=?, gold_bonus=?,
      hp=?, mp=?
     WHERE user_id=?`,
    [finalAtk, finalMaxHp, finalMaxMp, finalCrit, finalDodge,
     finalDrain, finalGoldBonus,
     finalHp, finalMp, userId]
  );

  const [newRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
  return newRows[0];
}

async function getTalentBonus(userId) {
  const [saveRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
  const [talentRows] = await pool.query(
    'SELECT * FROM talent WHERE user_id=? AND active=1',
    [userId]
  );
  if (saveRows.length === 0) return null;
  return calcTalentBonus(talentRows, saveRows[0]);
}

module.exports = { calcEquipmentBonus, calcTalentBonus, recalcAndSave, getTalentBonus };