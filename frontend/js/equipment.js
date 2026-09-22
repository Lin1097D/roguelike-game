const Equipment = {
  async refresh(state) {
    const r = await API.getEquipment(state.userId);
    if (r.code === 0) {
      state.equipped = r.equipped;
      state.bag = r.bag;
      UI.renderEquipment(state.equipped);
      UI.renderBag(state.bag);
    }
  },

  async equip(state, equipmentId) {
    const r = await API.equipItem(state.userId, equipmentId);
    if (r.code === 0) {
      UI.log('穿戴成功', 'good');
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      await Equipment.refresh(state);
    } else {
      UI.log('穿戴失败：' + r.msg, 'bad');
    }
  },

  async unequip(state, equipmentId) {
    const r = await API.unequipItem(state.userId, equipmentId);
    if (r.code === 0) {
      UI.log('已卸下', 'good');
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      await Equipment.refresh(state);
    } else {
      UI.log('卸下失败：' + r.msg, 'bad');
    }
  },

  async discard(state, equipmentId) {
    if (!confirm('确定丢弃这件装备？')) return;
    const r = await API.discardItem(state.userId, equipmentId);
    if (r.code === 0) {
      UI.log('已丢弃', 'normal');
      await Equipment.refresh(state);
    } else {
      UI.log('丢弃失败：' + r.msg, 'bad');
    }
  },

  async autoEquip(state) {
    const r = await API.autoEquip(state.userId);
    if (r.code === 0) {
      UI.log(`✅ 自动装备完成，换上了 ${r.equippedCount} 件最优装备`, 'good');
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      await Equipment.refresh(state);
    } else {
      UI.log('自动装备失败：' + r.msg, 'bad');
    }
  },

  async enhance(state, equipmentId) {
    const r = await API.enhanceItem(state.userId, equipmentId);
    if (r.code === 0) {
      const eq = r.equipment;
      const rateStr = Math.round(r.successRate * 100) + '%';
      if (r.success) {
        UI.log(`✨ 强化成功！【${eq.name}】→ +${eq.enhanceLevel}（花费 ${r.cost} 金币）`, 'good');
      } else {
        UI.log(`💔 强化失败（成功率 ${rateStr}）【${eq.name}】仍为 +${eq.enhanceLevel}，花费 ${r.cost} 金币`, 'bad');
      }
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      await Equipment.refresh(state);
    } else {
      UI.log('强化失败：' + r.msg, 'bad');
    }
  },

  async reroll(state, equipmentId) {
    const r = await API.rerollItem(state.userId, equipmentId);
    if (r.code === 0) {
      UI.log(`✨ 洗练成功！花费 ${r.cost} 金币`, 'good');
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      await Equipment.refresh(state);
    } else {
      UI.log('洗练失败：' + r.msg, 'bad');
    }
  },

  async compare(state, equipmentId) {
    const item = state.bag.find(x => x.id === equipmentId);
    if (!item) return;
    const current = state.equipped[item.slot];
    UI.showCompare(item, current);
  },

  showDrop(drop) {
    const qName = CONFIG.qualityNames[drop.quality];
    const sName = CONFIG.slotNames[drop.slot];
    UI.log(`🎁 掉落 [${qName}] ${drop.name}（${sName}）属性 +${drop.statValue}`, 'drop');
  }
};