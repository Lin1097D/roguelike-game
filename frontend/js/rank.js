const Rank = {
  currentTab: 'level',

  async refresh(state, tab) {
    if (tab) this.currentTab = tab;
    let r;
    if (this.currentTab === 'level') r = await API.getRankLevel();
    else if (this.currentTab === 'atk') r = await API.getRankAtk();
    else if (this.currentTab === 'kill') r = await API.getRankKill();

    if (r.code === 0) {
      UI.renderRank(r.list, this.currentTab, state.save);
    }
  },

  switchTab(state, tab) {
    this.currentTab = tab;
    this.refresh(state, tab);
  }
};

function onRankTab(tab) { Rank.switchTab(window.state, tab); }