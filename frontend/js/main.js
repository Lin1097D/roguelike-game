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
  stopPolling();
  stopPlaytimeTimer();
  state.userId = null; state.save = null; state.equipped = {}; state.bag = []; state.talents = [];
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('authPanel').classList.remove('hidden');
  document.getElementById('log').innerHTML = '';
  document.getElementById('authMsg').textContent = '';
}

// ============ 标签切换 ============
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + tabName);
  });
  if (tabName === 'bag') Equipment.refresh(state);
  if (tabName === 'talent') Talent.refresh(state);
  if (tabName === 'shop') Shop.refresh(state);
  if (tabName === 'achievement') Achievement.refresh(state);
  if (tabName === 'daily') Daily.refresh(state);
  if (tabName === 'signin') Signin.refresh(state);
  if (tabName === 'rank') Rank.refresh(state);
  if (tabName === 'stats') Stats.refresh(state);
  if (tabName === 'monster') Monster.refresh(state);
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