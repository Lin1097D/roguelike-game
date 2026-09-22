const API = {
  async request(path, method = 'GET', body = null) {
    const opt = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opt.body = JSON.stringify(body);
    const res = await fetch(CONFIG.API_BASE + path, opt);
    return await res.json();
  },

  register: (username, password) => API.request('/register', 'POST', { username, password }),
  login:    (username, password) => API.request('/login', 'POST', { username, password }),

  getSave:  (userId) => API.request('/save/' + userId),

  kill:     (userId, monsterType) => API.request('/battle/kill', 'POST', { userId, monsterType }),
  hurt:     (userId, damage) => API.request('/battle/hurt', 'POST', { userId, damage }),
  heal:     (userId, hp, mp) => API.request('/battle/heal', 'POST', { userId, hp, mp }),
  useMp:    (userId, cost) => API.request('/battle/useMp', 'POST', { userId, cost }),
  tick:     (userId) => API.request('/battle/tick', 'POST', { userId }),
  revive:   (userId) => API.request('/battle/revive', 'POST', { userId }),

  // 装备
  getEquipment: (userId) => API.request('/equipment/' + userId),
  equipItem:    (userId, equipmentId) => API.request('/equipment/equip', 'POST', { userId, equipmentId }),
  unequipItem:  (userId, equipmentId) => API.request('/equipment/unequip', 'POST', { userId, equipmentId }),
  discardItem:  (userId, equipmentId) => API.request('/equipment/discard', 'POST', { userId, equipmentId }),
  autoEquip:    (userId) => API.request('/equipment/autoEquip', 'POST', { userId }),
  enhanceItem:  (userId, equipmentId) => API.request('/equipment/enhance', 'POST', { userId, equipmentId }),
  rerollItem: (userId, equipmentId) => API.request('/equipment/reroll', 'POST', { userId, equipmentId }),

  // 天赋
  getTalents:   (userId) => API.request('/talent/' + userId),
  drawTalent:   (userId) => API.request('/talent/draw', 'POST', { userId }),
  activateTalent: (userId, talentId) => API.request('/talent/activate', 'POST', { userId, talentId }),
  allocatePoint: (userId, stat, amount) => API.request('/talent/allocate', 'POST', { userId, stat, amount }),

  // 商店
  getShopItems: (userId) => API.request('/shop/' + userId),
  buyItem:      (userId, itemKey) => API.request('/shop/buy', 'POST', { userId, itemKey }),

  // 公告
  getAnnouncements: () => API.request('/announcement/recent'),
  
  // 成就
  getAchievements: (userId) => API.request('/achievement/' + userId),
  claimAchievement: (userId, key) => API.request('/achievement/claim', 'POST', { userId, achievementKey: key }),
  
  // 每日任务
  getDailies: (userId) => API.request('/daily/' + userId),
  claimDaily: (userId, key) => API.request('/daily/claim', 'POST', { userId, dailyKey: key }),
  
  // 转生
  doRebirth: (userId) => API.request('/rebirth/do', 'POST', { userId }),
  // 签到
  getSigninStatus: (userId) => API.request('/signin/' + userId),
  doSignin: (userId) => API.request('/signin/do', 'POST', { userId }),
  
  // 排行榜
  getRankLevel: () => API.request('/rank/level'),
  getRankAtk: () => API.request('/rank/atk'),
  getRankKill: () => API.request('/rank/kill'),
};