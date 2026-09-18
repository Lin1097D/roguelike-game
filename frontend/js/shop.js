const Shop = {
  async refresh(state) {
    const r = await API.getShopItems(state.userId);
    if (r.code === 0) {
      UI.renderShop(r.items);
    }
  },

  async buy(state, itemKey) {
    const r = await API.buyItem(state.userId, itemKey);
    if (r.code === 0) {
      UI.log('✅ 购买成功', 'good');
      if (r.data) {
        state.save = { ...state.save, ...r.data };
        UI.renderPlayer(state.save);
      }
    } else {
      UI.log('购买失败：' + r.msg, 'bad');
    }
  }
};

function onBuyItem(key) { Shop.buy(window.state, key); }