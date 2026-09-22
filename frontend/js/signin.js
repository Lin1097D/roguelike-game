const Signin = {
  async refresh(state) {
    const r = await API.getSigninStatus(state.userId);
    if (r.code === 0) {
      UI.renderSignin(r.streak, r.signedToday, r.rewards);
    }
  },

  async do(state) {
    const r = await API.doSignin(state.userId);
    if (r.code === 0) {
      const reward = r.reward;
      let msg = `✅ 签到成功（第 ${r.streak} 天）！`;
      msg += `💰${reward.gold}`;
      if (reward.soul) msg += ` 💀${reward.soul}`;
      if (reward.free_points) msg += ` ⭐${reward.free_points}`;
      UI.log(msg, 'drop');
      // 刷新存档
      const sr = await API.getSave(state.userId);
      if (sr.code === 0) {
        state.save = sr.data;
        UI.renderPlayer(state.save);
      }
      await Signin.refresh(state);
    } else {
      UI.log('签到失败：' + r.msg, 'bad');
    }
  }
};

function onSignin() { Signin.do(window.state); }