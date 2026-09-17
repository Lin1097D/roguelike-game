// 前端配置 - 和游戏逻辑解耦
const CONFIG = {
  API_BASE: 'https://roguelike-game-production-2110.up.railway.app/api',

  // 技能配置
  skills: {
    heavy: { cost: 8, mult: 2.0, name: '重击' },
    heal:  { cost: 10, name: '治疗' },
    drain: { cost: 12, mult: 1.5, name: '吸血' },
    rage:  { cost: 15, name: '狂暴' }
  },

  // 装备品质颜色
  qualityColors: {
    common: '#aaa',
    fine: '#4ecca3',
    rare: '#4a9eff',
    epic: '#b44aff',
    legendary: '#ff9500'
  },

  qualityNames: {
    common: '普通', fine: '精良', rare: '稀有', epic: '史诗', legendary: '传说'
  },

  slotNames: {
    weapon: '武器', armor: '护甲', ring: '戒指', necklace: '项链'
  },

// 在 CONFIG 对象里加：
artifactSlots: {
  artifact1: '神器·上',
  artifact2: '神器·下'
},
talentQualityColors: {
  D: '#888', C: '#aaa', B: '#4ecca3', A: '#4a9eff',
  S: '#b44aff', SS: '#ff9500', SSS: '#ff0044'
},
  // 怪物名称库
  monsterNames: {
    normal: ['史莱姆', '哥布林', '野狼', '骷髅兵', '蝙蝠'],
    elite: ['精英史莱姆', '精英哥布林', '精英狼王', '骷髅队长', '血蝠'],
    boss: ['森林巨魔', '深渊领主', '远古巨龙', '亡灵之王']
  },

  // 怪物成长（和 backend config 保持一致）
  monster: {
    tierSize: 5,
    baseHp: 30,
    baseAtk: 3,
    hpPerTier: 15,
    atkPerTier: 2,
    eliteMultiplier: { hp: 3, atk: 1.5, crit: 0.1 },
    bossMultiplier:  { hp: 10, atk: 2, crit: 0.2 }
  },

  spawn: {
    eliteEvery: 10,
    bossEvery: 50
  }
};