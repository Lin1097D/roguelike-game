const ROLES = [
  {
    key: 'warrior',
    name: '战士',
    icon: '⚔️',
    desc: '高攻高血，正面硬刚',
    init: { atk: 5, hp: 150, mp: 30, crit: 0.05, dodge: 0.03 }
  },
  {
    key: 'mage',
    name: '法师',
    icon: '🔮',
    desc: '低血高精，技能强大',
    init: { atk: 2, hp: 80, mp: 100, crit: 0.08, dodge: 0.03 }
  },
  {
    key: 'assassin',
    name: '刺客',
    icon: '🗡️',
    desc: '极高攻低血，暴击之王',
    init: { atk: 8, hp: 70, mp: 50, crit: 0.2, dodge: 0.1 }
  },
  {
    key: 'priest',
    name: '牧师',
    icon: '✨',
    desc: '治疗强，吸血多',
    init: { atk: 1, hp: 100, mp: 80, crit: 0.05, dodge: 0.05 }
  }
];

module.exports = { ROLES };