const state = {
  userId: null,
  save: null,
  equipped: {},
  bag: []
};
window.state = state;

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
    if (sr.code === 0) state.save = sr.data;
    UI.renderPlayer(state.save);
    await Equipment.refresh(state);
    Battle.spawn(state.save);
    UI.log('欢迎回来，' + username, 'good');
  } else {
    document.getElementById('authMsg').textContent = r.msg;
    document.getElementById('authMsg').style.color = '#ff5773';
  }
}

function logout() {
  Battle.stopAuto();
  state.userId = null; state.save = null; state.equipped = {}; state.bag = [];
  document.getElementById('gamePanel').classList.add('hidden');
  document.getElementById('authPanel').classList.remove('hidden');
  document.getElementById('log').innerHTML = '';
  document.getElementById('authMsg').textContent = '';
}

function autoFight() { Battle.startAuto(state); }
function useSkill(type) { Battle.useSkill(type, state); }

// function toggleBag() {
//   const el = document.getElementById('bagPanel');
//   el.classList.toggle('hidden');
//   if (!el.classList.contains('hidden')) {
//     Equipment.refresh(state);
//   }
  
// }

// function toggleTalent() {
//   const el = document.getElementById('talentPanel');
//   el.classList.toggle('hidden');
//   if (!el.classList.contains('hidden')) {
//     Talent.refresh(state);
//   }
// }

// 标签切换
function switchTab(tabName) {
  // 切换标签高亮
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  // 切换内容区
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + tabName);
  });
  // 切到背包时刷新数据
  if (tabName === 'bag') {
    Equipment.refresh(state);
  }
  // 切到天赋时刷新数据
  if (tabName === 'talent') {
    Talent.refresh(state);
  }
}