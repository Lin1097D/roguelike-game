const Monster = {
  async refresh(state) {
    const r = await API.getMonsterLog(state.userId);
    if (r.code === 0) {
      UI.renderMonsterLog(r.list);
    }
  }
};