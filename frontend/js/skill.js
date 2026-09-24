const Skill = {
  async refresh(state) {
    const r = await API.getSkills(state.userId);
    if (r.code === 0) {
      state.skillPoints = r.skillPoints;
      state.totalSkillPoints = r.totalSkillPoints;
      UI.renderSkills(r.skills, r.learned, r.skillPoints);
    }
  },

  async learn(state, skillKey) {
    const r = await API.learnSkill(state.userId, skillKey);
    if (r.code === 0) {
      UI.log(`✨ 技能升级成功！`, 'good');
      if (r.save) {
        state.save = { ...state.save, ...r.save };
        UI.renderPlayer(state.save);
      }
      await Skill.refresh(state);
    } else {
      UI.log('升级失败：' + r.msg, 'bad');
    }
  }
};

function onLearnSkill(key) { Skill.learn(window.state, key); }