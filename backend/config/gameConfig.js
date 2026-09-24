// 游戏数值配置 - 想调整平衡性只改这个文件
module.exports = {
  // 玩家初始属性
  player: {
    initHp: 100,
    initAtk: 1,
    initMp: 50,
    initCrit: 0.05,
    initDodge: 0.03
  },

  // 击杀成长
  killReward: {
    normal: { atk: 1, hp: 1, mp: 1, gold: 1 },
    elite:  { atk: 5, hp: 10, mp: 5, gold: 10 },
    boss:   { atk: 20, hp: 50, mp: 20, gold: 50 }
  },

	// 新增：金币成长公式
	goldGain: {
	  baseNormal: 1,       // 普通怪基础金币
	  perKill: 0.05,       // 每击杀 1 只怪，额外 +0.05
	  eliteMult: 5,        // 精英怪 ×5
	  bossMult: 20         // Boss ×20
	},
  // 击杀额外回复
  killHeal: { hp: 5, mp: 5 },

  // 每回合自动回复
  tickHeal: { hp: 1, mp: 2 },

  // 怪物成长（每 5 杀一档）
  monster: {
    tierSize: 5,
    baseHp: 30,
    baseAtk: 3,
    hpPerTier: 150,
    atkPerTier: 5,
    eliteMultiplier: { hp: 3, atk: 1.5, crit: 0.1 },
    bossMultiplier:  { hp: 10, atk: 2, crit: 0.2 }
  },

  // 精英/Boss 触发条件
  spawn: {
    eliteEvery: 10,   // 每 10 杀出精英
    bossEvery: 50     // 每 50 杀出 Boss
  },

  // 死亡奖励
  death: {
    soulPerKill: 0.2  // 每杀 1 只获得 0.2 灵魂碎片（即 5 杀得 1）
  },

  // 装备品质
  equipmentQuality: {
    common:    { name: '普通', color: '#aaa',    multiplier: 1 },
    fine:      { name: '精良', color: '#4ecca3', multiplier: 1.5 },
    rare:      { name: '稀有', color: '#4a9eff', multiplier: 2 },
    epic:      { name: '史诗', color: '#b44aff', multiplier: 3 },
    legendary: { name: '传说', color: '#ff9500', multiplier: 5 }
  },

  // 装备槽位
  equipmentSlots: {
    weapon:  { name: '武器', mainStat: 'atk',      statName: '攻击力' },
    armor:   { name: '护甲', mainStat: 'max_hp',   statName: '血量上限' },
    ring:    { name: '戒指', mainStat: 'crit_rate', statName: '暴击率' },
    necklace:{ name: '项链', mainStat: 'max_mp',   statName: '精神力上限' }
  },

  // 装备基础属性（随击杀数成长）
  equipmentBase: {
    weapon:  { base: 2, perKill: 0.1 },   // 攻击 = (2 + kill*0.1) × 品质倍率
    armor:   { base: 10, perKill: 0.5 },
    ring:    { base: 0.01, perKill: 0.001 },
    necklace:{ base: 5, perKill: 0.3 }
  },

  // 装备掉落概率
  dropRate: {
    normal: 0.8,   // 普通怪 80%
    elite:  1.0,    // 精英怪 100%
    boss:   1.0     // Boss 300%
  },

  // 掉落品质概率（按怪物类型）
  dropQuality: {
    normal: { common: 0.7, fine: 0.3, rare: 0, epic: 0, legendary: 0 },
    elite:  { common: 0, fine: 0.5, rare: 0.4, epic: 0.1, legendary: 0 },
    boss:   { common: 0, fine: 0, rare: 0.4, epic: 0.4, legendary: 0.2 }
  },

  // 装备名称库
  equipmentNames: {
    weapon:  ['铁剑', '巨斧', '法杖', '匕首', '长枪'],
    armor:   ['皮甲', '锁子甲', '板甲', '法袍', '鳞甲'],
    ring:    ['力量之戒', '幸运之戒', '守护之戒', '迅捷之戒'],
    necklace:['智慧项链', '魔力项链', '生命项链', '灵魂项链']
  },
  
  // 神器配置
  artifact: {
    slots: {
      artifact1: { name: '神器·上', mainStat: 'none' },
      artifact2: { name: '神器·下', mainStat: 'none' }
    },
    // 神器固定三维加成
    bonus: { atk: 100, max_hp: 100, max_mp: 100 },
    // 神器名称池（掉落时随机选一个）
    names: ['混沌之心', '虚空之眼', '永恒之核', '深渊之魂', '创世之石']
  },
  
  // 劫力配置
  jieli: {
    damagePerStack: 1.0,   // 每层 +100% 伤害
    perKill: 1,            // 每杀 1 只怪 +1 层
    perDeath: 1            // 每次死亡 +1 层
  },
  // 等级系统
  level: {
    maxLevel: 100,
    expPerKill: {
      normal: 10,
      elite: 50,
      boss: 200
    },
    pointsPerLevel: 3,
    bonusEvery10: 10,
    bonusEvery50: 50
  },
  // 天赋抽取配置
  talent: {
    drawCost: 1000,   // 每次抽取消耗金币
    // 重复天赋折算的自由属性点（按品阶）
    refundPoints: {
      D: 1, C: 2, B: 3, A: 5, S: 10, SS: 20, SSS: 50
    },
    // 各品阶出现概率
    qualityRate: {
      D: 0.40, C: 0.25, B: 0.18, A: 0.10, S: 0.05, SS: 0.015, SSS: 0.005
    },
    // 天赋池
    pool: {
      D: [
        { key: 'd_atk',    name: '微光',   desc: '攻击力 +3',       effect: { atk: 3 } },
        { key: 'd_hp',     name: '坚壁',   desc: '血量上限 +10',    effect: { max_hp: 10 } },
        { key: 'd_mp',     name: '灵泉',   desc: '精神力上限 +5',   effect: { max_mp: 5 } }
      ],
      C: [
        { key: 'c_atk',    name: '锐爪',   desc: '攻击力 +5%',      effect: { atkPct: 0.05 } },
        { key: 'c_hp',     name: '铁壁',   desc: '血量上限 +8%',    effect: { hpPct: 0.08 } },
        { key: 'c_dodge',  name: '风息',   desc: '闪避率 +2%',      effect: { dodge: 0.02 } }
      ],
      B: [
        { key: 'b_crit',   name: '猎手',   desc: '暴击率 +5%',      effect: { crit: 0.05 } },
        { key: 'b_drain',  name: '嗜血',   desc: '吸血 +5%',        effect: { drain: 0.05 } },
        { key: 'b_gold',   name: '精算',   desc: '金币获得 +20%',   effect: { goldPct: 0.2 } }
      ],
      A: [
        { key: 'a_rage',   name: '狂战',   desc: '血量低于 50% 时攻击 +30%', effect: { lowHpAtk: 0.3 } },
        { key: 'a_pierce', name: '破甲',   desc: '无视敌人 20% 防御',        effect: { pierce: 0.2 } },
        { key: 'a_double', name: '连击',   desc: '10% 概率攻击两次',         effect: { doubleHit: 0.1 } }
      ],
      S: [
        { key: 's_jieli',  name: '劫力共鸣', desc: '劫力效果 ×1.5',           effect: { jieliMult: 0.5 } },
        { key: 's_phoenix',name: '不死鸟',   desc: '死亡时 30% 概率满血复活（每局 1 次）', effect: { revive: 0.3 } },
        { key: 's_luck',   name: '幸运女神', desc: '装备掉率 ×2',             effect: { dropMult: 2 } }
      ],
      SS: [
        { key: 'ss_kill',  name: '杀戮机器', desc: '每击杀 100 只怪，永久攻击 +50', effect: { killAtk: 50 } },
        { key: 'ss_jieli', name: '万象更新', desc: '每 10 层劫力，暴击率 +1%',      effect: { jieliCrit: 0.01 } },
        { key: 'ss_soul',  name: '灵魂收割', desc: '灵魂碎片获得 +50%',             effect: { soulPct: 0.5 } }
      ],
      SSS: [
        { key: 'sss_chaos', name: '混沌之源', desc: '每 100 层劫力，攻击 +100%（可叠加）', effect: { jieliAtkPct: 1.0 } },
        { key: 'sss_cycle', name: '永劫回归', desc: '死亡不再清零属性，但金币清零',         effect: { noReset: true } }
      ]
    }
  },
  // 装备词条池
  affixPool: [
    { key: 'atk',     name: '力量', min: 3,   max: 15 },
    { key: 'max_hp',  name: '坚韧', min: 10,  max: 50 },
    { key: 'max_mp',  name: '智慧', min: 5,   max: 25 },
    { key: 'crit',    name: '锐利', min: 0.005, max: 0.03 },
    { key: 'dodge',   name: '迅捷', min: 0.003, max: 0.02 },
    { key: 'drain',   name: '嗜血', min: 0.005, max: 0.02 },
    { key: 'goldPct', name: '幸运', min: 0.05, max: 0.15 }
  ],
  // 装备套装
  setList: [
    {
      name: '战士套',
      two:  { atkPct: 0.2 },
      four: { atkPct: 0.5, crit: 0.1 }
    },
    {
      name: '守护套',
      two:  { hpPct: 0.2 },
      four: { hpPct: 0.5, dodge: 0.05 }
    },
    {
      name: '法师套',
      two:  { mpPct: 0.2 },
      four: { mpPct: 0.5, skillDmg: 0.3 }
    },
    {
      name: '猎手套',
      two:  { crit: 0.05 },
      four: { crit: 0.15, drain: 0.1 }
    }
  ],
  
  // 套装出现概率
  setChance: 0.3,
};