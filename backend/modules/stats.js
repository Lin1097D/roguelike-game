const pool = require('../db');
const config = require('../config/gameConfig');
const { SKILLS } = require('../config/skills');

function calcEquipmentBonus(equipmentList) {
  const bonus = { atk: 0, max_hp: 0, max_mp: 0, crit_rate: 0, dodge_rate: 0, drain: 0, goldPct: 0 };
  const setCount = {};
  for (const eq of equipmentList) {
    if (eq.slot === 'artifact1' || eq.slot === 'artifact2') {
      bonus.atk += config.artifact.bonus.atk;
      bonus.max_hp += config.artifact.bonus.max_hp;
      bonus.max_mp += config.artifact.bonus.max_mp;
      continue;
    }
    const slotCfg = config.equipmentSlots[eq.slot];
    if (slotCfg) {
      const stat = slotCfg.mainStat;
      const enhanceMult = 1 + (eq.enhance_level || 0) * 0.1;
      const value = eq.stat_value * enhanceMult;
      bonus[stat] = (bonus[stat] || 0) + value;
    }
    if (eq.affixes) {
      let affixes = [];
      try { affixes = typeof eq.affixes === 'string' ? JSON.parse(eq.affixes) : eq.affixes; } catch (e) { affixes = []; }
      for (const a of affixes) {
        if (a.key === 'atk') bonus.atk += a.value;
        if (a.key === 'max_hp') bonus.max_hp += a.value;
        if (a.key === 'max_mp') bonus.max_mp += a.value;
        if (a.key === 'crit') bonus.crit_rate += a.value;
        if (a.key === 'dodge') bonus.dodge_rate += a.value;
        if (a.key === 'drain') bonus.drain += a.value;
        if (a.key === 'goldPct') bonus.goldPct += a.value;
      }
    }
    if (eq.set_name) setCount[eq.set_name] = (setCount[eq.set_name] || 0) + 1;
  }
  for (const setName in setCount) {
    const count = setCount[setName];
    const setDef = config.setList.find(s => s.name === setName);
    if (!setDef) continue;
    let effect = null;
    if (count >= 4) effect = setDef.four;
    else if (count >= 2) effect = setDef.two;
    if (!effect) continue;
    if (effect.atkPct) bonus.atk += Math.floor(bonus.atk * effect.atkPct);
    if (effect.hpPct) bonus.max_hp += Math.floor(bonus.max_hp * effect.hpPct);
    if (effect.mpPct) bonus.max_mp += Math.floor(bonus.max_mp * effect.mpPct);
    if (effect.crit) bonus.crit_rate += effect.crit;
    if (effect.dodge) bonus.dodge_rate += effect.dodge;
    if (effect.drain) bonus.drain += effect.drain;
  }
  return bonus;
}

function calcTalentBonus(talentList, baseStats) {
  const bonus = { atk: 0, max_hp: 0, max_mp: 0, crit_rate: 0, dodge_rate: 0, drain: 0, goldPct: 0, dropMult: 1, revive: 0, noReset: false };
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
    if (e.revive) bonus.revive += e.revive * stacks;
    if (e.noReset) bonus.noReset = true;
  }
  return bonus;
}

async function calcSkillBonus(saveId) {
  const [rows] = await pool.query('SELECT skill_key, level FROM skill WHERE save_id=?', [saveId]);
  const bonus = { atkPct: 0, crit: 0, hpPct: 0, dodge: 0, drain: 0, goldPct: 0, revive: 0 };
  for (const row of rows) {
    const skill = SKILLS.find(s => s.key === row.skill_key);
    if (!skill) continue;
    for (const key in skill.effect) {
      bonus[key] = (bonus[key] || 0) + skill.effect[key] * row.level;
    }
  }
  return bonus;
}

async function recalcAndSave(saveId) {
  const [saveRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
  if (saveRows.length === 0) return null;
  const s = saveRows[0];

  const [eqRows] = await pool.query('SELECT * FROM equipment WHERE save_id=? AND equipped=1', [saveId]);
  const [talentRows] = await pool.query('SELECT * FROM talent WHERE save_id=? AND active=1', [saveId]);

  const eqBonus = calcEquipmentBonus(eqRows);
  const tBonus = calcTalentBonus(talentRows, s);
  const skBonus = await calcSkillBonus(saveId);

  const atkPct = skBonus.atkPct || 0;
  const hpPct = skBonus.hpPct || 0;
  const critAdd = skBonus.crit || 0;
  const dodgeAdd = skBonus.dodge || 0;
  const drainAdd = skBonus.drain || 0;
  const goldPctAdd = skBonus.goldPct || 0;

  const rebirthMult = 1 + (s.rebirth_points || 0) * 0.01;

  const baseAtk = s.base_atk + eqBonus.atk + tBonus.atk;
  const baseHp = s.base_max_hp + eqBonus.max_hp + tBonus.max_hp;
  const baseMp = s.base_max_mp + eqBonus.max_mp + tBonus.max_mp;

  const finalAtk = Math.floor(baseAtk * (1 + atkPct) * rebirthMult);
  const finalMaxHp = Math.floor(baseHp * (1 + hpPct) * rebirthMult);
  const finalMaxMp = Math.floor(baseMp * rebirthMult);
  const finalCrit = Math.round((s.base_crit_rate + eqBonus.crit_rate + tBonus.crit_rate + critAdd) * 1000) / 1000;
  const finalDodge = Math.round((s.base_dodge_rate + eqBonus.dodge_rate + tBonus.dodge_rate + dodgeAdd) * 1000) / 1000;
  const finalDrain = Math.round((eqBonus.drain + tBonus.drain + drainAdd) * 1000) / 1000;
  const finalGoldBonus = Math.round((eqBonus.goldPct + tBonus.goldPct + goldPctAdd) * 1000) / 1000;

  const finalHp = Math.min(s.hp, finalMaxHp);
  const finalMp = Math.min(s.mp, finalMaxMp);

  await pool.query(
    `UPDATE save SET atk=?, max_hp=?, max_mp=?, crit_rate=?, dodge_rate=?, drain=?, gold_bonus=?, hp=?, mp=? WHERE id=?`,
    [finalAtk, finalMaxHp, finalMaxMp, finalCrit, finalDodge, finalDrain, finalGoldBonus, finalHp, finalMp, saveId]
  );

  const [newRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
  return newRows[0];
}

async function getTalentBonus(saveId) {
  const [saveRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
  const [talentRows] = await pool.query('SELECT * FROM talent WHERE save_id=? AND active=1', [saveId]);
  if (saveRows.length === 0) return null;
  return calcTalentBonus(talentRows, saveRows[0]);
}

module.exports = { calcEquipmentBonus, calcTalentBonus, calcSkillBonus, recalcAndSave, getTalentBonus };