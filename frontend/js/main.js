// 加载设置
if (typeof Settings !== 'undefined') {
  Settings.load();
}
const state = {
  userId: null,
  save: null,
  equipped: {},
  bag: [],
  talents: []
};
window.state = state;

let battleSpeed = 1;
window.battleSpeed = battleSpeed;

// ============ 游玩时长统计 ============
let playtimeTimer = null;

function startPlaytimeTimer() {
  if (playtimeTimer) return;
  playtimeTimer = setInterval(async () => {
    if (state.userId) {
      await API.sendPlaytime(state.userId, 60);
    }
  }, 60000);
}

function stopPlaytimeTimer() {
  if (playtimeTimer) {
    clearInterval(playtimeTimer);
    playtimeTimer = null;
  }
}

// ============ 注册 / 登录 ============
async function doRegister() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const r = await API.register(username, password);
  document.getElementById('authMsg').textContent = r.msg;
  document.getElementById('authMsg').style.color = r.code === 0 ? '#4ecca3' : '#ff5773';
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const r = await API.login(username, password);
  if (r.code === 0) {
    state.userId = r.userId;
    document.getElementById('authPanel').classList.add('hidden');
    document.getElementById('gamePanel').classList.remove('hidden');

    const sr = await API.getSave(state.userId);
    if (sr.code === 0) {
      state.save = sr.data;
      if (sr.offlineReward) {
        const o = sr.offlineReward;
        UI.log(`💤 离线 ${o.hours} 小时，获得 ${o.gold} 金币、${o.exp} 经验`, 'drop');
      }
    }

    UI.renderPlayer(state.save);
    await Equipment.refresh(state);
    Battle.spawn(state.save);
    UI.log('欢迎回来，' + username, 'good');

    startPolling();
    startPlaytimeTimer();
  } else {
    document.getElementById('authMsg').textContent = r.msg;
    document.getElementById('authMsg').style.color = '#ff5773';
  }
}

function logout() {
  Battle.stopAuto();
  if (typeof Boss !== 'undefined') Boss.stopAuto();
  stopPolling();
  stopPlaytimeTimer();
  state.userId = null; state.save = null; state.equipped = {}; state.bag = []; state.talents = [];
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('authPanel').classList.remove('hidden');
  document.getElementById('log').innerHTML = '';
  document.getElementById('authMsg').textContent = '';
}

// ============ 标签切换 ============
// ============ 主标签配置 ============
const MAIN_TABS = {
  battle: {
    name: '战斗',
    icon: '⚔️',
    subtabs: null,   // 无子标签，直接显示战斗
    default: 'battle'
  },
  grow: {
    name: '养成',
    icon: '🎒',
    subtabs: ['bag', 'talent', 'skill'],
    default: 'bag'
  },
  social: {
    name: '社交',
    icon: '🏆',
    subtabs: ['rank', 'boss', 'dungeon', 'monster'],
    default: 'rank'
  },
  shop: {
    name: '商店',
    icon: '🛒',
    subtabs: ['shop', 'daily', 'signin', 'achievement'],
    default: 'shop'
  },
  more: {
    name: '更多',
    icon: '⚙️',
    subtabs: ['stats', 'settings'],
    default: 'stats'
  }
};

const SUBTAB_NAMES = {
  battle: '战斗',
  bag: '背包',
  talent: '天赋',
  skill: '技能',
  rank: '排行',
  boss: 'BOSS',
  dungeon: '副本',
  monster: '图鉴',
  shop: '商店',
  daily: '每日',
  signin: '签到',
  achievement: '成就',
  stats: '统计',
  settings: '设置'
};

// 当前状态
let currentMainTab = 'battle';
let currentSubTab = null;

// ============ 主标签切换 ============
function switchMainTab(mainTab) {
  // 切走 BOSS 标签，停止 BOSS 自动战斗
  if (currentMainTab === 'social' && currentSubTab === 'boss' && mainTab !== 'social') {
    if (typeof Boss !== 'undefined' && Boss.bossTimer) Boss.stopAuto();
  }

  currentMainTab = mainTab;

  // 更新底部导航高亮
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.main === mainTab);
  });

  const cfg = MAIN_TABS[mainTab];
  if (!cfg) return;

  // 渲染子标签
  const subTabsEl = document.getElementById('subTabs');
  if (cfg.subtabs) {
    subTabsEl.classList.remove('hidden');
    subTabsEl.innerHTML = cfg.subtabs.map(st => `
      <div class="subtab" data-sub="${st}" onclick="switchSubTab('${st}')">
        ${SUBTAB_NAMES[st] || st}
      </div>
    `).join('');
    // 切到默认子标签
    switchSubTab(cfg.default, true);
  } else {
    // 战斗：无子标签
    subTabsEl.classList.add('hidden');
    subTabsEl.innerHTML = '';
    switchSubTab('battle', true);
  }
}

// ============ 子标签切换 ============
function switchSubTab(subTab, force) {
  currentSubTab = subTab;

  // 更新子标签高亮
  document.querySelectorAll('.subtab').forEach(t => {
    t.classList.toggle('active', t.dataset.sub === subTab);
  });

  // 切内容
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + subTab);
  });

  // 加载数据
  if (subTab === 'bag') Equipment.refresh(state);
  if (subTab === 'talent') Talent.refresh(state);
  if (subTab === 'skill') Skill.refresh(state);
  if (subTab === 'rank') Rank.refresh(state);
  if (subTab === 'boss' && typeof Boss !== 'undefined' && !Boss.currentBoss) Boss.refresh(state);
  if (subTab === 'dungeon' && typeof Dungeon !== 'undefined' && !Dungeon.currentDungeon) Dungeon.refresh(state);
  if (subTab === 'monster') Monster.refresh(state);
  if (subTab === 'shop') Shop.refresh(state);
  if (subTab === 'daily') Daily.refresh(state);
  if (subTab === 'signin') Signin.refresh(state);
  if (subTab === 'achievement') Achievement.refresh(state);
  if (subTab === 'stats') Stats.refresh(state);
  if (subTab === 'settings') Settings.refresh();
  
}

// 兼容旧代码：switchTab 仍可用
function switchTab(tabName) {
  // 找到 tabName 属于哪个主标签
  for (const main in MAIN_TABS) {
    const cfg = MAIN_TABS[main];
    if (cfg.subtabs && cfg.subtabs.includes(tabName)) {
      switchMainTab(main);
      // switchMainTab 会切到默认子标签，需要再切到目标
      setTimeout(() => switchSubTab(tabName), 0);
      return;
    }
    if (cfg.default === tabName) {
      switchMainTab(main);
      return;
    }
  }
}

// ============ 战斗速度 ============
function toggleSpeed() {
  battleSpeed = battleSpeed === 1 ? 2 : (battleSpeed === 2 ? 4 : 1);
  window.battleSpeed = battleSpeed;
  document.getElementById('btnSpeed').textContent = '速度 x' + battleSpeed;
  if (Battle.autoTimer) {
    Battle.stopAuto();
    Battle.startAuto(state);
  }
}

// ============ 公告轮询 ============
let announcementTimer = null;
let lastAnnouncementId = 0;

async function pollAnnouncements() {
  const r = await API.getAnnouncements();
  if (r.code === 0 && r.list && r.list.length > 0) {
    const latest = r.list[0];
    if (latest.id > lastAnnouncementId) {
      for (const a of r.list.slice().reverse()) {
        if (a.id > lastAnnouncementId) {
          UI.log('📢 ' + a.message, 'drop');
        }
      }
      lastAnnouncementId = latest.id;
    }
  }
}

function startPolling() {
  if (announcementTimer) return;
  pollAnnouncements();
  announcementTimer = setInterval(pollAnnouncements, 10000);
}

function stopPolling() {
  if (announcementTimer) {
    clearInterval(announcementTimer);
    announcementTimer = null;
  }
}

// ============ 按钮回调 ============
function autoFight() { Battle.startAuto(state); }
function useSkill(type) { Battle.useSkill(type, state); }