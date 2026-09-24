const Dungeon = {
  currentDungeon: null,
  currentMonster: null,
  killed: 0,
  totalMonsters: 0,
  timeLeft: 0,
  timer: null,
  attacking: false,

  async refresh(state) {
    const r = await API.getDungeonList(state.userId);
    if (r.code === 0) {
      state.dungeonRemaining = r.remaining;
      state.dungeonDailyFree = r.dailyFree;
      state.dungeonExtraCost = r.extraCost;
      UI.renderDungeonList(r.dungeons, r.remaining, r.dailyFree, r.extraCost);
    }
  },

  async start(state, dungeonKey) {
    this.stopTimer();

    let useGold = false;
    if (state.dungeonRemaining <= 0) {
      const msg = `今日免费次数已用完，花 ${state.dungeonExtraCost} 金币挑战？`;
      if (!confirm(msg)) return;
      useGold = true;
    }

    const r = await API.startDungeon(state.userId, dungeonKey, useGold);
    if (r.code !== 0) {
      UI.log('副本失败：' + r.msg, 'bad');
      return;
    }

    this.currentDungeon = r.dungeon;
    this.killed = 0;
    this.totalMonsters = r.dungeon.monsterCount;
    this.timeLeft = r.dungeon.timeLimit;
    this.attacking = false;

    UI.renderDungeonBattle(r.dungeon, this.killed, this.totalMonsters, this.timeLeft);
    UI.log(`🏰 进入副本【${r.dungeon.name}】！`, 'boss');

    if (r.useExtra) {
      UI.log(`花费 ${r.extraCost} 金币`, 'normal');
      const sr = await API.getSave(state.userId);
      if (sr.code === 0) {
        state.save = sr.data;
        UI.renderPlayer(state.save);
      }
    }

    // 生成第一只怪
    this.spawnDungeonMonster(state);
    // 启动计时
    this.startTimer(state);
  },

  spawnDungeonMonster(state) {
    const d = this.currentDungeon;
    if (!d) return;
    // 随机在副本怪属性 ±20% 浮动
    const hp = Math.floor(d.monsterHp * (0.8 + Math.random() * 0.4));
    this.currentMonster = {
      name: '副本怪 ' + (this.killed + 1),
      hp,
      maxHp: hp,
      atk: d.monsterAtk
    };
    UI.renderDungeonMonster(this.currentMonster, this.killed, this.totalMonsters, this.timeLeft);
  },

  startTimer(state) {
    this.timer = setInterval(() => {
      this.timeLeft--;
      UI.renderDungeonBattle(this.currentDungeon, this.killed, this.totalMonsters, this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.lose(state);
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  async attack(state) {
    if (!this.currentMonster || this.currentMonster.hp <= 0) return;
    if (this.timeLeft <= 0) return;

    const dmg = state.save.atk;
    this.currentMonster.hp -= dmg;
    UI.log(`你造成 ${dmg} 点伤害`, 'good');

    if (this.currentMonster.hp <= 0) {
      this.killed++;
      if (this.killed >= this.totalMonsters) {
        // 通关
        this.stopTimer();
        await this.win(state);
        return;
      }
      // 下一只
      this.spawnDungeonMonster(state);
    } else {
      UI.renderDungeonMonster(this.currentMonster, this.killed, this.totalMonsters, this.timeLeft);
    }

    // 怪物反击
    const mdmg = this.currentMonster.atk;
    const r2 = await API.hurt(state.userId, mdmg);
    if (r2.code === 0) {
      state.save.hp = r2.hp;
      UI.renderPlayer(state.save);
      if (r2.dead) {
        this.stopTimer();
        await this.lose(state);
        return;
      }
    }
  },

  async win(state) {
    this.stopTimer();
    this.attacking = false;
    UI.log(`🏆 通关副本【${this.currentDungeon.name}】！`, 'drop');

    const r = await API.finishDungeon(state.userId, this.currentDungeon.key, true, this.killed);
    if (r.code === 0 && r.win) {
      const rw = r.reward;
      let msg = '奖励：';
      if (rw.gold) msg += `💰${rw.gold} `;
      if (rw.soul) msg += `💀${rw.soul} `;
      if (rw.points) msg += `⭐${rw.points}`;
      UI.log(msg, 'drop');
      Sound.play('levelup');

      const sr = await API.getSave(state.userId);
      if (sr.code === 0) {
        state.save = sr.data;
        UI.renderPlayer(state.save);
      }
    }

    this.currentDungeon = null;
    this.currentMonster = null;
    setTimeout(() => this.refresh(state), 2000);
  },

  async lose(state) {
    this.stopTimer();
    this.attacking = false;
    UI.log(`💀 副本失败！`, 'bad');

    await API.finishDungeon(state.userId, this.currentDungeon.key, false, this.killed);

    this.currentDungeon = null;
    this.currentMonster = null;
    setTimeout(() => this.refresh(state), 2000);
  },

  async autoFight(state) {
    if (this.attacking) {
      this.attacking = false;
      clearInterval(this.autoTimer);
      document.getElementById('btnDungeonAuto').textContent = '自动挑战';
      return;
    }
    this.attacking = true;
    document.getElementById('btnDungeonAuto').textContent = '停止挑战';
    this.autoTimer = setInterval(() => {
      if (this.currentDungeon && this.currentMonster && this.currentMonster.hp > 0 && this.timeLeft > 0) {
        this.attack(state);
      }
    }, 500);
  }
};

function onDungeonStart(key) { Dungeon.start(window.state, key); }
function onDungeonAuto() { Dungeon.autoFight(window.state); }