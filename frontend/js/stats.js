const Stats = {
  async refresh(state) {
    const r = await API.getStats(state.userId);
    if (r.code === 0) {
      UI.renderStats(r.data);
    }
  }
};