// 技能配置
const SKILLS = [
  // 攻击路线
  { key: 'atk_up',      name: '力量强化', desc: '攻击 +5%',       max: 5, route: 'atk', need: null,       effect: { atkPct: 0.05 } },
  { key: 'crit_up',     name: '暴击强化', desc: '暴击率 +3%',     max: 5, route: 'atk', need: 'atk_up',   effect: { crit: 0.03 } },
  { key: 'crit_dmg',    name: '暴击伤害', desc: '暴击伤害 +20%',  max: 5, route: 'atk', need: 'crit_up',  effect: { critDmg: 0.2 } },
  { key: 'pierce',      name: '破甲',     desc: '无视防御 +5%',   max: 5, route: 'atk', need: 'crit_dmg', effect: { pierce: 0.05 } },
  { key: 'lethal',      name: '致命一击', desc: '5% 概率秒杀普通怪', max: 5, route: 'atk', need: 'pierce', effect: { lethal: 0.01 } },

  // 防御路线
  { key: 'hp_up',       name: '血量强化', desc: '血量上限 +5%',   max: 5, route: 'def', need: null,       effect: { hpPct: 0.05 } },
  { key: 'dodge_up',    name: '闪避强化', desc: '闪避率 +2%',     max: 5, route: 'def', need: 'hp_up',    effect: { dodge: 0.02 } },
  { key: 'regen',       name: '生命回复', desc: '每回合回血 +1%', max: 5, route: 'def', need: 'dodge_up', effect: { regen: 0.01 } },
  { key: 'thorns',      name: '荆棘',     desc: '反弹伤害 +10%',  max: 5, route: 'def', need: 'regen',    effect: { thorns: 0.1 } },
  { key: 'immortal',    name: '不死之身', desc: '死亡 20% 概率复活', max: 5, route: 'def', need: 'thorns', effect: { revive: 0.04 } },

  // 辅助路线
  { key: 'gold_up',     name: '金币强化', desc: '金币 +10%',      max: 5, route: 'util', need: null,      effect: { goldPct: 0.1 } },
  { key: 'exp_up',      name: '经验强化', desc: '经验 +10%',      max: 5, route: 'util', need: 'gold_up', effect: { expPct: 0.1 } },
  { key: 'drop_up',     name: '掉落强化', desc: '掉率 +10%',      max: 5, route: 'util', need: 'exp_up',  effect: { dropPct: 0.1 } },
  { key: 'drain_up',    name: '吸血强化', desc: '吸血 +2%',       max: 5, route: 'util', need: 'drop_up', effect: { drain: 0.02 } },
  { key: 'talent_up',   name: '天赋大师', desc: '天赋效果 +10%',  max: 5, route: 'util', need: 'drain_up', effect: { talentPct: 0.1 } }
];

module.exports = { SKILLS };