const Daily = {
  async refresh(state) {
    const r = await API.getDailies(state.userId);
    if (r.code === 0) {
      UI.renderDailies(r.list);
    }
  },

  async claim(state, key) {
    const r = await API.claimDaily(state.userId, key);
    if (r.code === 0) {
      UI.log('✅ 每日任务领取成功', 'good');
      const sr = await API.getSave(state.userId);
      if (sr.code === 0) {
        state.save = sr.data;
        UI.renderPlayer(state.save);
      }
      await Daily.refresh(state);
    } else {
      UI.log('领取失败：' + r.msg, 'bad');
    }
  }
};

function onClaimDaily(key) { Daily.claim(window.state, key); }

async function onRebirth() {
  if (!confirm('转生会清空等级、属性、装备、天赋、金币，确定吗？')) return;
  const r = await API.doRebirth(window.state.userId);
  if (r.code === 0) {
    UI.log(`🔄 转生成功！第 ${r.rebirthCount} 次，获得 ${r.pointsGain} 转生点（共 ${r.rebirthPoints}）`, 'drop');
    const sr = await API.getSave(window.state.userId);
    if (sr.code === 0) {
      window.state.save = sr.data;
      UI.renderPlayer(window.state.save);
    }
    await Equipment.refresh(window.state);
  } else {
    UI.log('转生失败：' + r.msg, 'bad');
  }
}