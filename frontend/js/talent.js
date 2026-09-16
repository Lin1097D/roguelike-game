const Talent = {
  async refresh(state) {
    const r = await API.getTalents(state.userId);
    if (r.code === 0) {
      state.talents = r.list;
      UI.renderTalents(r.list);
    }
  },

  async draw(state) {
    const r = await API.drawTalent(state.userId);
    if (r.code === 0) {
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      const t = r.result;
      if (t.duplicate) {
        UI.log(`🔁 重复天赋【${t.name}】，层数 +1，折算 ${t.refund} 自由属性点`, 'normal');
      } else {
        UI.log(`✨ 恭喜获得【${t.quality}级天赋：${t.name}】`, 'drop');
        UI.log(`   效果：${t.desc}`, 'normal');
        if (t.autoActivated) {
          UI.log(`   （当前没有生效天赋，已自动激活）`, 'good');
        } else {
          UI.log(`   （去天赋面板点"激活"才会生效）`, 'normal');
        }
        if (t.quality === 'SSS' || t.quality === 'SS') {
          UI.log(`🌟 全服公告：有玩家抽到了 ${t.quality} 级天赋【${t.name}】！`, 'boss');
        }
      }
      await Talent.refresh(state);
    } else {
      UI.log('抽卡失败：' + r.msg, 'bad');
    }
  },

  async activate(state, talentId) {
    const r = await API.activateTalent(state.userId, talentId);
    if (r.code === 0) {
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      UI.log('✅ 已切换天赋', 'good');
      await Talent.refresh(state);
    } else {
      UI.log('切换失败：' + r.msg, 'bad');
    }
  },

  async allocate(state, stat) {
    const input = prompt('分配多少点到 ' + stat + '？', '1');
    const amount = parseInt(input);
    if (!amount || amount <= 0) return;
    const r = await API.allocatePoint(state.userId, stat, amount);
    if (r.code === 0) {
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      UI.log(`✅ 分配 ${amount} 点到 ${stat}`, 'good');
    } else {
      UI.log('分配失败：' + r.msg, 'bad');
    }
  }
};

function onDrawTalent() { Talent.draw(window.state); }
function onAllocate(stat) { Talent.allocate(window.state, stat); }
function onActivateTalent(id) { Talent.activate(window.state, id); }