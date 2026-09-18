const Battle = {
  currentMonster: null,
  autoTimer: null,
  rageTurns: 0,

  pickName(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  makeMonster(type, save) {
    const k = save.kill_count;
    const cfg = CONFIG.monster;
    const tier = Math.floor(k / cfg.tierSize);
    const baseHp = cfg.baseHp + tier * cfg.hpPerTier;
    const baseAtk = cfg.baseAtk + tier * cfg.atkPerTier;

    if (type === 'elite') {
      const m = cfg.eliteMultiplier;
      return { type, name: this.pickName(CONFIG.monsterNames.elite),
        hp: Math.floor(baseHp*m.hp), maxHp: Math.floor(baseHp*m.hp),
        atk: Math.floor(baseAtk*m.atk), crit: m.crit };
    }
    if (type === 'boss') {
      const m = cfg.bossMultiplier;
      return { type, name: this.pickName(CONFIG.monsterNames.boss),
        hp: Math.floor(baseHp*m.hp), maxHp: Math.floor(baseHp*m.hp),
        atk: Math.floor(baseAtk*m.atk), crit: m.crit };
    }
    return { type: 'normal', name: this.pickName(CONFIG.monsterNames.normal),
      hp: baseHp, maxHp: baseHp, atk: baseAtk, crit: 0.05 };
  },

  spawn(save) {
    const next = save.kill_count + 1;
    let type = 'normal';
    if (next % CONFIG.spawn.bossEvery === 0) type = 'boss';
    else if (next % CONFIG.spawn.eliteEvery === 0) type = 'elite';

    this.currentMonster = this.makeMonster(type, save);
    UI.renderMonster(this.currentMonster);

    if (type === 'elite') UI.log('⚡ 精英怪出现：' + this.currentMonster.name, 'elite');
    if (type === 'boss') UI.log('💀 BOSS出现：' + this.currentMonster.name, 'boss');
  },

  // ============ 伤害计算（含天赋） ============
  calcDamage(atk, critRate, jieli, talents, currentHp, maxHp) {
    jieli = jieli || 0;
    talents = talents || [];
    maxHp = maxHp || 1;

    // 1. 劫力倍率（对数）
    let jieliMult = 1 + Math.log2(jieli + 1);

    // 2. 劫力共鸣：劫力效果 ×1.5
    const jieliReso = talents.find(t => t.key === 's_jieli' && t.active);
    if (jieliReso) {
      jieliMult *= (1 + 0.5 * (jieliReso.stacks || 1));
    }

    // 3. 混沌之源：每 100 层劫力 +100%（可叠加）
    const chaos = talents.find(t => t.key === 'sss_chaos' && t.active);
    if (chaos) {
      jieliMult += Math.floor(jieli / 100) * 1.0 * (chaos.stacks || 1);
    }

    // 4. 狂战：血量 < 50% 时攻击 +30%
    let atkBonus = 1;
    const rage = talents.find(t => t.key === 'a_rage' && t.active);
    if (rage && currentHp / maxHp < 0.5) {
      atkBonus += 0.3 * (rage.stacks || 1);
    }

    // 5. 万象更新：每 10 层劫力 +1% 暴击
    let extraCrit = 0;
    const jieliCrit = talents.find(t => t.key === 'ss_jieli' && t.active);
    if (jieliCrit) {
      extraCrit = Math.floor(jieli / 10) * 0.01 * (jieliCrit.stacks || 1);
    }

    // 6. 暴击判定
    const totalCrit = critRate + extraCrit;
    const isCrit = Math.random() < totalCrit;

    // 7. 最终伤害
    let dmg = Math.floor(atk * jieliMult * atkBonus);
    if (isCrit) dmg = Math.floor(dmg * 2);

    return { dmg, isCrit };
  },

  async attackOnce(state) {
    const m = this.currentMonster;
    if (!m || m.hp <= 0) return;

    // 自动治疗：血量低于 60%
    const hpPercent = state.save.hp / state.save.max_hp;
    const healSkill = CONFIG.skills.heal;
    if (hpPercent < 0.6 && state.save.mp >= healSkill.cost) {
      const mr = await API.useMp(state.userId, healSkill.cost);
      if (mr.code === 0) {
        state.save.mp -= healSkill.cost;
        const healAmt = Math.floor(state.save.max_hp * 0.2);
        const hr = await API.heal(state.userId, healAmt, 0);
        if (hr.code === 0) state.save = { ...state.save, ...hr.data };
        UI.log(`💚 [自动] 血量过低，治疗回复 ${healAmt} 点`, 'good');
        UI.renderPlayer(state.save);
      }
    }

    // ============ 玩家攻击 ============
    let playerAtk = state.save.atk;
    if (this.rageTurns > 0) playerAtk = Math.floor(playerAtk * 1.5);

    const { dmg, isCrit } = this.calcDamage(
      playerAtk,
      state.save.crit_rate,
      state.save.jieli || 0,
      state.talents || [],
      state.save.hp,
      state.save.max_hp
    );
    m.hp -= dmg;
    UI.log(`你造成 ${dmg} 点伤害${isCrit ? ' (暴击!)' : ''}`, 'good');

    // 嗜血：天赋 + 词条
    const drainTalent = (state.talents || []).find(t => t.key === 'b_drain' && t.active);
    const talentDrain = drainTalent ? 0.05 * (drainTalent.stacks || 1) : 0;
    const equipDrain = state.save.drain || 0;
    const totalDrain = talentDrain + equipDrain;
    
    if (totalDrain > 0 && dmg > 0) {
      const healAmt = Math.floor(dmg * totalDrain);
      if (healAmt > 0) {
        const hr = await API.heal(state.userId, healAmt, 0);
        if (hr.code === 0) {
          state.save = { ...state.save, ...hr.data };
          UI.log(`🩸 嗜血回复 ${healAmt} 点血量`, 'good');
          UI.renderPlayer(state.save);
        }
      }
    }

    // 连击：10% 概率再攻击一次
    const doubleTalent = (state.talents || []).find(t => t.key === 'a_double' && t.active);
    if (doubleTalent && m.hp > 0) {
      const chance = 0.1 * (doubleTalent.stacks || 1);
      if (Math.random() < chance) {
        const second = this.calcDamage(
          playerAtk, state.save.crit_rate, state.save.jieli || 0,
          state.talents || [], state.save.hp, state.save.max_hp
        );
        m.hp -= second.dmg;
        UI.log(`⚡ 连击！额外造成 ${second.dmg} 点伤害${second.isCrit ? ' (暴击!)' : ''}`, 'good');
      }
    }

    // 击杀判定
    if (m.hp <= 0) {
      m.hp = 0;
      UI.renderMonster(m);
      await this.onKill(state);
      return;
    }
    UI.renderMonster(m);

    // ============ 怪物反击 ============
    const isDodge = Math.random() < state.save.dodge_rate;
    if (isDodge) {
      UI.log(`你闪避了 ${m.name} 的攻击`, 'good');
    } else {
      const mdmg = this.calcDamage(m.atk, m.crit, 0, [], m.hp, m.maxHp);
      UI.log(`${m.name} 造成 ${mdmg.dmg} 点伤害${mdmg.isCrit ? ' (暴击)' : ''}`, 'bad');
      const r2 = await API.hurt(state.userId, mdmg.dmg);
      if (r2.code === 0) {
        state.save.hp = r2.hp;
        UI.renderPlayer(state.save);
        if (r2.revived) {
          UI.log('🔥 不死鸟触发！你满血复活了', 'good');
        } else if (r2.dead) {
          await this.onDeath(state);
          return;
        }
      }
    }
    if (this.rageTurns > 0) this.rageTurns--;

    // 回合回复
    const tick = await API.tick(state.userId);
    if (tick.code === 0) {
      state.save.mp = tick.data.mp;
      state.save.hp = tick.data.hp;
      UI.renderPlayer(state.save);
    }
  },

  async onKill(state) {
    const m = this.currentMonster;
    UI.log(`击杀 ${m.name}！`, m.type === 'normal' ? 'good' : m.type);
    const r = await API.kill(state.userId, m.type);
    if (r.code === 0) {
      state.save = { ...state.save, ...r.data };
      const sr = await API.getSave(state.userId);
      if (sr.code === 0) state.save = sr.data;
      UI.renderPlayer(state.save);
	  if (r.levelUp) {
	    UI.log(`🎉 升级！等级 ${r.levelUp.newLevel}，获得 ${r.levelUp.freePointsGain} 自由属性点`, 'drop');
	  }

      if (r.drop) {
        Equipment.showDrop(r.drop);
        if (r.drop.replaced) {
          UI.log(`🗑️ 背包已满，自动丢弃较差的【${r.drop.replaced}】`, 'normal');
        } else {
          UI.log('📦 已放入背包', 'normal');
        }
        await Equipment.refresh(state);
      }
      if (r.discarded) {
        UI.log(`💨 掉落了【${r.discarded.name}】，但属性太差已丢弃`, 'normal');
      }
    }
    setTimeout(() => this.spawn(state.save), 300);
  },

  async onDeath(state) {
    this.stopAuto();
    UI.log('💀 你死了...', 'bad');
    const r = await API.revive(state.userId);
    if (r.code === 0) {
      state.save = r.data;
      state.save.soul = r.soul;
      state.save.equipment = {};
      UI.renderPlayer(state.save);
      UI.log(`获得 ${r.gained} 灵魂碎片，当前共 ${r.soul} 个`, 'good');
      setTimeout(() => this.spawn(state.save), 800);
    }
  },

  startAuto(state) {
    if (this.autoTimer) { this.stopAuto(); return; }
    document.getElementById('btnAuto').textContent = '停止战斗';
    const interval = 500 / (window.battleSpeed || 1);
    this.autoTimer = setInterval(() => {
      if (state.save && state.save.hp > 0 && this.currentMonster && this.currentMonster.hp > 0) {
        this.attackOnce(state);
      }
    }, interval);
  },

  stopAuto() {
    if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; }
    document.getElementById('btnAuto').textContent = '自动战斗';
  },

  async useSkill(type, state) {
    if (!state.save || state.save.hp <= 0) return;
    const sk = CONFIG.skills[type];
    if (!sk) return;
    if (state.save.mp < sk.cost) { UI.log('MP不足！', 'bad'); return; }

    const mr = await API.useMp(state.userId, sk.cost);
    if (mr.code !== 0) { UI.log('MP不足！', 'bad'); return; }
    state.save.mp -= sk.cost;
    UI.renderPlayer(state.save);

    if (type === 'heal') {
      const healAmt = Math.floor(state.save.max_hp * 0.2);
      const hr = await API.heal(state.userId, healAmt, 0);
      if (hr.code === 0) state.save = { ...state.save, ...hr.data };
      UI.log(`💚 治疗回复 ${healAmt} 点血量`, 'good');
      UI.renderPlayer(state.save);
    } else if (type === 'heavy') {
      if (!this.currentMonster || this.currentMonster.hp <= 0) return;
      const { dmg, isCrit } = this.calcDamage(
        Math.floor(state.save.atk * sk.mult),
        state.save.crit_rate,
        state.save.jieli || 0,
        state.talents || [],
        state.save.hp,
        state.save.max_hp
      );
      this.currentMonster.hp -= dmg;
      UI.log(`💥 重击造成 ${dmg} 点伤害${isCrit ? ' (暴击!)' : ''}`, 'good');
      if (this.currentMonster.hp <= 0) {
        this.currentMonster.hp = 0;
        UI.renderMonster(this.currentMonster);
        await this.onKill(state);
      } else UI.renderMonster(this.currentMonster);
    } else if (type === 'drain') {
      if (!this.currentMonster || this.currentMonster.hp <= 0) return;
      const { dmg } = this.calcDamage(
        Math.floor(state.save.atk * sk.mult),
        state.save.crit_rate,
        state.save.jieli || 0,
        state.talents || [],
        state.save.hp,
        state.save.max_hp
      );
      this.currentMonster.hp -= dmg;
      const healAmt = Math.floor(dmg * 0.3);
      const hr = await API.heal(state.userId, healAmt, 0);
      if (hr.code === 0) state.save = { ...state.save, ...hr.data };
      UI.log(`🩸 吸血造成 ${dmg} 伤害，回复 ${healAmt} 血量`, 'good');
      if (this.currentMonster.hp <= 0) {
        this.currentMonster.hp = 0;
        UI.renderMonster(this.currentMonster);
        await this.onKill(state);
      } else UI.renderMonster(this.currentMonster);
      UI.renderPlayer(state.save);
    } else if (type === 'rage') {
      this.rageTurns = 3;
      UI.log('🔥 狂暴！接下来 3 回合攻击 +50%', 'good');
    }
  }
};