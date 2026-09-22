const Boss = {
  currentBoss: null,
  currentBossHp: 0,
  currentBossMaxHp: 0,

  async refresh(state) {
    const r = await API.getBossList(state.userId);
    if (r.code === 0) {
      state.bossRemaining = r.remaining;
      state.bossDailyFree = r.dailyFree;
      state.bossExtraCost = r.extraCost;
      UI.renderBossList(r.bosses, r.remaining, r.dailyFree, r.extraCost);
    }
  },

  async start(state, bossKey) {
    let useGold = false;
    if (state.bossRemaining <= 0) {
      const msg = `今日免费次数已用完，花 ${state.bossExtraCost} 金币挑战？`;
      if (!confirm(msg)) return;
      useGold = true;
    }

    const r = await API.startBossChallenge(state.userId, bossKey, useGold);
    if (r.code !== 0) {
      UI.log('挑战失败：' + r.msg, 'bad');
      return;
    }

    // 进入挑战
    this.currentBoss = r.boss;
    this.currentBossHp = r.boss.hp;
    this.currentBossMaxHp = r.boss.hp;

    UI.renderBossBattle(r.boss, this.currentBossHp, this.currentBossMaxHp);
    UI.log(`⚔️ 开始挑战【${r.boss.name}】！`, 'boss');

    if (r.useExtra) {
      UI.log(`花费 ${r.extraCost} 金币`, 'normal');
    }

    // 刷新次数
    await Boss.refresh(state);
  },

  async attack(state) {
    if (!this.currentBoss || this.currentBossHp <= 0) return;

    // 玩家攻击
    const dmg = state.save.atk * (1 + Math.log2((state.save.jieli || 0) + 1));
    const finalDmg = Math.floor(dmg);
    this.currentBossHp -= finalDmg;
    UI.log(`你造成 ${finalDmg} 点伤害`, 'good');
    showDamageNumber(finalDmg, false);
    Sound.play('attack');

    if (this.currentBossHp <= 0) {
      this.currentBossHp = 0;
      UI.renderBossBattle(this.currentBoss, 0, this.currentBossMaxHp);
      await this.win(state);
      return;
    }

    UI.renderBossBattle(this.currentBoss, this.currentBossHp, this.currentBossMaxHp);

    // BOSS 反击
    const bossDmg = this.currentBoss.atk;
    UI.log(`${this.currentBoss.name} 造成 ${bossDmg} 点伤害`, 'bad');
    const r2 = await API.hurt(state.userId, bossDmg);
    if (r2.code === 0) {
      state.save.hp = r2.hp;
      UI.renderPlayer(state.save);
      if (r2.dead) {
        await this.lose(state);
        return;
      }
    }

    // 回合回复
    const tick = await API.tick(state.userId);
    if (tick.code === 0) {
      state.save.mp = tick.data.mp;
      state.save.hp = tick.data.hp;
      UI.renderPlayer(state.save);
    }
  },

  async win(state) {
    UI.log(`🎉 击败了【${this.currentBoss.name}】！`, 'drop');
    const r = await API.finishBossChallenge(state.userId, this.currentBoss.key, true);
    if (r.code === 0 && r.win) {
      const rw = r.reward;
      let msg = '奖励：';
      if (rw.gold) msg += `💰${rw.gold} `;
      if (rw.soul) msg += `💀${rw.soul} `;
      if (rw.points) msg += `⭐${rw.points}`;
      UI.log(msg, 'drop');
      Sound.play('levelup');
    }
    this.currentBoss = null;
    setTimeout(() => {
      UI.renderBossList([], state.bossRemaining, state.bossDailyFree, state.bossExtraCost);
      Boss.refresh(state);
    }, 2000);
  },

  async lose(state) {
    UI.log(`💀 被【${this.currentBoss.name}】击败`, 'bad');
    await API.finishBossChallenge(state.userId, this.currentBoss.key, false);
    this.currentBoss = null;
    setTimeout(() => {
      Boss.refresh(state);
    }, 2000);
  },

  async autoFight(state) {
    if (this.bossTimer) {
      clearInterval(this.bossTimer);
      this.bossTimer = null;
      document.getElementById('btnBossAuto').textContent = '自动挑战';
      return;
    }
    document.getElementById('btnBossAuto').textContent = '停止挑战';
    this.bossTimer = setInterval(() => {
      if (this.currentBoss && this.currentBossHp > 0 && state.save.hp > 0) {
        this.attack(state);
      }
    }, 500);
  },

  stopAuto() {
    if (this.bossTimer) {
      clearInterval(this.bossTimer);
      this.bossTimer = null;
    }
    const btn = document.getElementById('btnBossAuto');
    if (btn) btn.textContent = '自动挑战';
  }
};

function onBossStart(key) { Boss.start(window.state, key); }
function onBossAuto() { Boss.autoFight(window.state); }