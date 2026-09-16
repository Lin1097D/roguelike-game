const config = require('../config/gameConfig');

const BAG_SIZE = 30;
const SLOT_BAG_SIZE = 10;
const NORMAL_SLOTS = ['weapon', 'armor', 'ring', 'necklace'];

function calcStat(slot, quality, killCount) {
  const base = config.equipmentBase[slot];
  const mult = config.equipmentQuality[quality].multiplier;
  let value = (base.base + killCount * base.perKill) * mult;
  if (slot === 'ring') return Math.round(value * 1000) / 1000;
  return Math.floor(value);
}

function randomQuality(monsterType) {
  const table = config.dropQuality[monsterType];
  const r = Math.random();
  let cum = 0;
  for (const q of ['common', 'fine', 'rare', 'epic', 'legendary']) {
    cum += table[q];
    if (r < cum) return q;
  }
  return 'common';
}

function randomSlot() {
  return NORMAL_SLOTS[Math.floor(Math.random() * NORMAL_SLOTS.length)];
}

function randomName(slot) {
  const names = config.equipmentNames[slot];
  return names[Math.floor(Math.random() * names.length)];
}

function shouldDrop(monsterType) {
  return Math.random() < config.dropRate[monsterType];
}

// ============ 词条生成 ============
function generateAffixes(quality, killCount) {
  // 品质决定词条数量
  const countMap = { common: 0, fine: 1, rare: 2, epic: 2, legendary: 3 };
  const count = countMap[quality] || 0;
  if (count === 0) return [];

  // 成长倍率：随击杀数增长，最高 3 倍
  const growthMult = Math.min(1 + killCount / 500, 3);

  const affixes = [];
  const pool = config.affixPool;
  const usedKeys = new Set();

  for (let i = 0; i < count; i++) {
    // 过滤已用的词条，避免重复
    const available = pool.filter(a => !usedKeys.has(a.key));
    if (available.length === 0) break;
    const def = available[Math.floor(Math.random() * available.length)];
    usedKeys.add(def.key);

    // 随机数值
    const baseVal = def.min + Math.random() * (def.max - def.min);
    let value = baseVal * growthMult;

    // 暴击/闪避/吸血是小数，保留 3 位
    if (['crit', 'dodge', 'drain'].includes(def.key)) {
      value = Math.round(value * 1000) / 1000;
    } else if (def.key === 'goldPct') {
      value = Math.round(value * 1000) / 1000;
    } else {
      value = Math.floor(value);
    }

    affixes.push({
      key: def.key,
      name: def.name,
      value
    });
  }
  return affixes;
}

function generateEquipment(monsterType, killCount) {
  const slot = randomSlot();
  const quality = randomQuality(monsterType);
  const stat = calcStat(slot, quality, killCount);
  const affixes = generateAffixes(quality, killCount);
  
  // 30% 概率属于某个套装
    let setName = null;
    if (Math.random() < config.setChance) {
      const sets = config.setList;
      setName = sets[Math.floor(Math.random() * sets.length)].name;
    }
	
  return {
    slot,
    quality,
    name: randomName(slot),
    statValue: stat,
    affixes,
	setName
  };
}

function rollDrop(monsterType, killCount) {
  if (!shouldDrop(monsterType)) return null;
  return generateEquipment(monsterType, killCount);
}

function generateArtifact(slot, killCount) {
  const names = config.artifact.names;
  return {
    slot,
    quality: 'legendary',
    name: names[Math.floor(Math.random() * names.length)],
    statValue: 0,
    affixes: []
  };
}

module.exports = {
  calcStat, randomQuality, randomSlot, randomName,
  shouldDrop, generateEquipment, rollDrop,
  generateArtifact, generateAffixes,
  BAG_SIZE, SLOT_BAG_SIZE, NORMAL_SLOTS
};