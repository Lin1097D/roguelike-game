const Achievement = {
  async refresh(state) {
    const r = await API.getAchievements(state.userId);
    if (r.code === 0) {
      UI.renderAchievements(r.list);
    }
  },

  async claim(state, key) {
    const r = await API.claimAchievement(state.userId, key);
    if (r.code === 0) {
      UI.log('✅ 成就领取成功', 'good');
      const sr = await API.getSave(state.userId);
      if (sr.code === 0) {
        state.save = sr.data;
        UI.renderPlayer(state.save);
      }
      await Achievement.refresh(state);
    } else {
      UI.log('领取失败：' + r.msg, 'bad');
    }
  }
};

function onClaimAchievement(key) { Achievement.claim(window.state, key); }