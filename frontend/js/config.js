const CONFIG = {
  //API_BASE: 'http://localhost:3000/api',
  API_BASE: 'http://115.29.177.219/api',

  sounds: {
    attack: 'sounds/attack.mp3',
    kill: 'sounds/kill.mp3',
    levelup: 'sounds/levelup.mp3',
    drop: 'sounds/drop.mp3'
  },
  soundEnabled: true,

settings: {
    soundEnabled: true,
    battleSpeed: 1,
    autoHeal: true,
    autoDouble: false,
    showDamage: true
  },

  skills: {
    heavy: { cost: 8, mult: 2.0, name: '重击' },
    heal:  { cost: 10, name: '治疗' },
    drain: { cost: 12, mult: 1.5, name: '吸血' },
    rage:  { cost: 15, name: '狂暴' }
  },

  qualityColors: {
    common: '#aaa', fine: '#4ecca3', rare: '#4a9eff',
    epic: '#b44aff', legendary: '#ff9500'
  },

  qualityNames: {
    common: '普通', fine: '精良', rare: '稀有', epic: '史诗', legendary: '传说'
  },

  slotNames: {
    weapon: '武器', armor: '护甲', ring: '戒指', necklace: '项链'
  },

  artifactSlots: {
    artifact1: '神器·上',
    artifact2: '神器·下'
  },

  talentQualityColors: {
    D: '#888',
    C: '#aaa',
    B: '#4ecca3',
    A: '#4a9eff',
    S: '#b44aff',
    SS: '#ff9500',
    SSS: '#ff0044'
  },

  monsterNames: {
    normal: ['史莱姆', '哥布林', '野狼', '骷髅兵', '蝙蝠'],
    elite: ['精英史莱姆', '精英哥布林', '精英狼王', '骷髅队长', '血蝠'],
    boss: ['森林巨魔', '深渊领主', '远古巨龙', '亡灵之王']
  },

  monster: {
    tierSize: 5, baseHp: 30, baseAtk: 3,
    hpPerTier: 150, atkPerTier: 10,
    eliteMultiplier: { hp: 3, atk: 1.5, crit: 0.1 },
    bossMultiplier:  { hp: 10, atk: 2, crit: 0.2 }
  },

  spawn: { eliteEvery: 10, bossEvery: 50 },

  battleSpeed: 1,
};