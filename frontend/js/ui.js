function showDamageNumber(text, isCrit) {
  const el = document.createElement('div');
  el.className = 'damage-float' + (isCrit ? ' crit' : '');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

const Sound = {
  cache: {},
  play(name) {
    if (!CONFIG.soundEnabled) return;
    try {
      if (!this.cache[name]) {
        const path = CONFIG.sounds[name];
        if (!path) return;
        this.cache[name] = new Audio(path);
      }
      const audio = this.cache[name].cloneNode();
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
  },
  toggle() {
    CONFIG.soundEnabled = !CONFIG.soundEnabled;
    UI.log(CONFIG.soundEnabled ? '🔊 音效已开启' : '🔇 音效已关闭', 'normal');
    localStorage.setItem('soundEnabled', CONFIG.soundEnabled ? '1' : '0');
    const btn = document.getElementById('btnSound');
    if (btn) btn.textContent = CONFIG.soundEnabled ? '🔊 音效' : '🔇 音效';
  }
};

if (localStorage.getItem('soundEnabled') === '0') {
  CONFIG.soundEnabled = false;
}

function actualStat(statValue, enhanceLevel) {
  const lv = enhanceLevel || 0;
  const val = statValue * (1 + lv * 0.1);
  if (val < 1) return val.toFixed(3);
  return Math.floor(val);
}

function enhanceColor(lv) {
  if (lv >= 21) return '#ff9500';
  if (lv >= 16) return '#b44aff';
  if (lv >= 11) return '#4a9eff';
  if (lv >= 6)  return '#4ecca3';
  return '#fff';
}

function renderAffixes(affixes) {
  if (!affixes || affixes.length === 0) return '';
  return affixes.map(a => {
    let valStr = a.value;
    if (a.key === 'crit' || a.key === 'dodge' || a.key === 'drain') {
      valStr = (a.value * 100).toFixed(2) + '%';
    } else if (a.key === 'goldPct') {
      valStr = (a.value * 100).toFixed(1) + '%';
    }
    return `<span style="color:#aaccff;font-size:11px;margin-right:6px;">${a.name} +${valStr}</span>`;
  }).join('');
}

const UI = {
  log(msg, cls = '') {
    const el = document.getElementById('log');
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = msg;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  renderPlayer(save) {
    document.getElementById('sAtk').textContent = save.atk;
    document.getElementById('sKill').textContent = save.kill_count;
    document.getElementById('sGold').textContent = save.gold;
    document.getElementById('sSoul').textContent = save.soul || 0;
    document.getElementById('sJieli').textContent = save.jieli || 0;
    document.getElementById('sFreePoints').textContent = save.free_points || 0;
    document.getElementById('hpText').textContent = save.hp + '/' + save.max_hp;
    document.getElementById('mpText').textContent = save.mp + '/' + save.max_mp;
    document.getElementById('hpBar').style.width = Math.max(0, save.hp / save.max_hp * 100) + '%';
    document.getElementById('mpBar').style.width = (save.mp / save.max_mp * 100) + '%';
    document.getElementById('sDrain').textContent = ((save.drain || 0) * 100).toFixed(2) + '%';
    document.getElementById('sGoldBonus').textContent = ((save.gold_bonus || 0) * 100).toFixed(1) + '%';

    const needExp = Math.floor(100 * save.level * Math.pow(1.2, (save.level || 1) - 1));
    document.getElementById('lvText').textContent = 'Lv.' + (save.level || 1);
    document.getElementById('expText').textContent = (save.exp || 0) + '/' + needExp;
    document.getElementById('expBar').style.width = Math.min(100, (save.exp || 0) / needExp * 100) + '%';
  },

  renderEquipment(equipped) {
    const slots = ['weapon', 'armor', 'ring', 'necklace', 'artifact1', 'artifact2'];
    for (const slot of slots) {
      const el = document.getElementById('eq-' + slot);
      if (!el) continue;
      const eq = equipped[slot];
      if (!eq) {
        const label = CONFIG.artifactSlots[slot] || CONFIG.slotNames[slot];
        el.className = 'eq-slot empty';
        el.innerHTML = `<div>${label}：空</div>`;
      } else {
        const color = CONFIG.qualityColors[eq.quality];
        const isArtifact = slot === 'artifact1' || slot === 'artifact2';
        const enhanceStr = eq.enhanceLevel > 0 
          ? ` <span style="color:${enhanceColor(eq.enhanceLevel)}">+${eq.enhanceLevel}</span>` 
          : '';
        const statText = isArtifact ? '三维 +100' : `+${actualStat(eq.statValue, eq.enhanceLevel)}`;
        const affixStr = renderAffixes(eq.affixes);
        const enhanceBtn = isArtifact ? '' : `
          <span onclick="event.stopPropagation(); onEnhance(${eq.id})" style="cursor:pointer;color:#f9c74f;font-size:11px;margin-right:6px;">强化</span>
          <span onclick="event.stopPropagation(); onReroll(${eq.id})" style="cursor:pointer;color:#4a9eff;font-size:11px;margin-right:6px;">洗练</span>
        `;
        const setTag = eq.setName 
          ? `<span style="color:#f9c74f;font-size:10px;margin-left:4px;">[${eq.setName}]</span>` 
          : '';
        el.className = 'eq-slot' + (isArtifact ? ' artifact' : '');
        el.innerHTML = `
          <div class="eq-name" style="color:${color}">${eq.name}${enhanceStr}${setTag}</div>
          <div class="eq-stat">${statText}</div>
          ${affixStr ? `<div class="eq-affix">${affixStr}</div>` : ''}
          <div class="eq-actions">
            ${enhanceBtn}
            <span onclick="event.stopPropagation(); onUnequip(${eq.id})" style="cursor:pointer;color:#ff5773;font-size:11px;">卸下</span>
          </div>
        `;
      }
    }
  },

  renderBag(bag) {
    const el = document.getElementById('bagList');
    if (!el) return;
    if (bag.length === 0) {
      el.innerHTML = '<div style="color:#555;font-size:12px;text-align:center;padding:8px;">背包空空如也</div>';
      return;
    }
    el.innerHTML = bag.map(item => {
      const color = CONFIG.qualityColors[item.quality];
      const isArtifact = item.slot === 'artifact1' || item.slot === 'artifact2';
      const sName = isArtifact ? CONFIG.artifactSlots[item.slot] : CONFIG.slotNames[item.slot];
      const enhanceStr = item.enhanceLevel > 0 
        ? ` <span style="color:${enhanceColor(item.enhanceLevel)}">+${item.enhanceLevel}</span>` 
        : '';
      const statText = isArtifact ? '三维 +100' : `+${actualStat(item.statValue, item.enhanceLevel)}`;
      const affixStr = renderAffixes(item.affixes);
      const enhanceBtn = isArtifact ? '' : `
        <span onclick="onEnhance(${item.id})" style="cursor:pointer;color:#f9c74f;">强化</span>
        <span onclick="onReroll(${item.id})" style="cursor:pointer;color:#4a9eff;">洗练</span>
      `;
      const setTag = item.setName 
        ? `<span style="color:#f9c74f;font-size:10px;margin-left:4px;">[${item.setName}]</span>` 
        : '';
      return `
        <div class="bag-item">
          <div class="bag-name" style="color:${color}">${item.name}${enhanceStr}${setTag}</div>
          <div class="bag-info">${sName} ${statText}</div>
          ${affixStr ? `<div class="eq-affix">${affixStr}</div>` : ''}
          <div class="bag-btns">
            <span onclick="onEquip(${item.id})" style="cursor:pointer;color:#4ecca3;">穿戴</span>
            ${enhanceBtn}
            <span onclick="onCompare(${item.id})" style="cursor:pointer;color:#d4af37;">对比</span>
            <span onclick="onDiscard(${item.id})" style="cursor:pointer;color:#ff5773;">丢弃</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderTalents(list) {
    const el = document.getElementById('talentList');
    if (!el) return;
    if (list.length === 0) {
      el.innerHTML = '<div style="color:#555;font-size:12px;text-align:center;padding:8px;">还没有天赋，去抽一个吧</div>';
      return;
    }
    el.innerHTML = list.map(t => {
      const colors = CONFIG.talentQualityColors || {};
      const color = colors[t.quality] || '#aaa';
      const activeTag = t.active
        ? '<span style="color:#4ecca3;font-size:11px;margin-left:6px;">[生效中]</span>'
        : `<span onclick="onActivateTalent(${t.id})" style="color:#f9c74f;font-size:11px;margin-left:6px;cursor:pointer;">[激活]</span>`;
      return `
        <div class="talent-item" style="border-color:${color}; ${t.active ? 'background:#1a3a3a;' : ''}">
          <div class="talent-name" style="color:${color}">
            [${t.quality || '?'}] ${t.name || '未知'} ${t.stacks > 1 ? '×' + t.stacks : ''}
            ${activeTag}
          </div>
          <div class="talent-desc">${t.desc || ''}</div>
        </div>
      `;
    }).join('');
  },

  renderMonster(monster) {
    document.getElementById('monsterBox').className = 'monster ' + monster.type;
    document.getElementById('mName').textContent = monster.name;
    document.getElementById('mHpText').textContent = Math.max(0, monster.hp) + '/' + monster.maxHp;
    document.getElementById('mHpBar').style.width = Math.max(0, monster.hp / monster.maxHp * 100) + '%';
    document.getElementById('mAtk').textContent = monster.atk;
  },

  renderShop(items) {
    const el = document.getElementById('shopList');
    if (!el) return;
    el.innerHTML = items.map(item => `
      <div class="shop-item">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
        <div class="shop-footer">
          <span class="shop-price">💰 ${item.price}</span>
          <span onclick="onBuyItem('${item.key}')" style="cursor:pointer;color:#d4af37;">购买</span>
        </div>
      </div>
    `).join('');
  },

  renderAchievements(list) {
    const el = document.getElementById('achievementList');
    if (!el) return;
    el.innerHTML = list.map(a => {
      const status = a.claimed
        ? '<span style="color:#666;">已领取</span>'
        : a.achieved
          ? `<span onclick="onClaimAchievement('${a.key}')" style="cursor:pointer;color:#4ecca3;">[领取]</span>`
          : '<span style="color:#888;">未达成</span>';
      let rewardStr = '';
      if (a.reward.gold) rewardStr += `💰${a.reward.gold} `;
      if (a.reward.soul) rewardStr += `💀${a.reward.soul}`;
      return `
        <div class="ach-item" style="opacity:${a.claimed ? 0.5 : 1}">
          <div class="ach-name">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
          <div class="ach-footer">${status} · 奖励 ${rewardStr}</div>
        </div>
      `;
    }).join('');
  },

  renderDailies(list) {
    const el = document.getElementById('dailyList');
    if (!el) return;
    el.innerHTML = list.map(d => {
      const status = d.claimed
        ? '<span style="color:#666;">已领取</span>'
        : d.achieved
          ? `<span onclick="onClaimDaily('${d.key}')" style="cursor:pointer;color:#4ecca3;">[领取]</span>`
          : `<span style="color:#888;">${d.progress}/${d.target}</span>`;
      return `
        <div class="daily-item" style="opacity:${d.claimed ? 0.5 : 1}">
          <div class="daily-name">${d.name}</div>
          <div class="daily-footer">${status} · 奖励 💰${d.reward.gold}</div>
        </div>
      `;
    }).join('');
  },

  renderSignin(streak, signedToday, rewards) {
    const el = document.getElementById('signinList');
    if (!el) return;
    el.innerHTML = rewards.map(r => {
      const isSigned = r.day <= streak;
      const isToday = r.day === streak && signedToday;
      const isNext = r.day === streak + 1 && !signedToday;
      let cls = 'signin-day';
      if (isSigned) cls += ' signed';
      if (isNext) cls += ' next';
      let rewardStr = `💰${r.gold}`;
      if (r.soul) rewardStr += `<br>💀${r.soul}`;
      if (r.free_points) rewardStr += `<br>⭐${r.free_points}`;
      return `
        <div class="${cls}">
          <div class="signin-day-num">第${r.day}天</div>
          <div class="signin-reward">${rewardStr}</div>
        </div>
      `;
    }).join('');

    const btn = document.getElementById('btnSignin');
    if (btn) {
      if (signedToday) {
        btn.textContent = '今日已签';
        btn.disabled = true;
      } else {
        btn.textContent = '签到';
        btn.disabled = false;
      }
    }
  },

  renderRank(list, tab, mySave) {
    const el = document.getElementById('rankList');
    if (!el) return;

    const tabs = document.getElementById('rankTabs');
    if (tabs) {
      tabs.innerHTML = `
        <div class="rank-tab ${tab === 'level' ? 'active' : ''}" onclick="onRankTab('level')">等级榜</div>
        <div class="rank-tab ${tab === 'atk' ? 'active' : ''}" onclick="onRankTab('atk')">攻击榜</div>
        <div class="rank-tab ${tab === 'kill' ? 'active' : ''}" onclick="onRankTab('kill')">击杀榜</div>
      `;
    }

    if (!list || list.length === 0) {
      el.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">暂无数据</div>';
      return;
    }

    el.innerHTML = list.map((item, index) => {
      let value = '';
      if (tab === 'level') value = `Lv.${item.level}`;
      else if (tab === 'atk') value = `攻击 ${item.atk}`;
      else if (tab === 'kill') value = `击杀 ${item.kill_count}`;

      let rankColor = '#b8a878';
      if (index === 0) rankColor = '#ffdd00';
      else if (index === 1) rankColor = '#c0c0c0';
      else if (index === 2) rankColor = '#cd7f32';

      return `
        <div class="rank-item">
          <div class="rank-num" style="color:${rankColor}">${index + 1}</div>
          <div class="rank-name">${item.username}</div>
          <div class="rank-value">${value}</div>
        </div>
      `;
    }).join('');
  },

  renderStats(data) {
    const el = document.getElementById('statsList');
    if (!el) return;
    const days = Math.floor((Date.now() - new Date(data.created_at).getTime()) / 86400000);
    const hours = Math.floor((data.play_time || 0) / 3600);
    const minutes = Math.floor(((data.play_time || 0) % 3600) / 60);

    el.innerHTML = `
      <div class="stats-item"><span>等级</span><span>Lv.${data.level}</span></div>
      <div class="stats-item"><span>转生次数</span><span>${data.rebirth_count}</span></div>
      <div class="stats-item"><span>总击杀</span><span>${data.kill_count}</span></div>
      <div class="stats-item"><span>精英击杀</span><span>${data.elite_count}</span></div>
      <div class="stats-item"><span>Boss 击杀</span><span>${data.boss_count}</span></div>
      <div class="stats-item"><span>总伤害</span><span>${data.total_damage}</span></div>
      <div class="stats-item"><span>总受伤</span><span>${data.total_damage_taken}</span></div>
      <div class="stats-item"><span>最高连杀</span><span>${data.max_combo}</span></div>
      <div class="stats-item"><span>死亡次数</span><span>${data.death_count}</span></div>
      <div class="stats-item"><span>游玩时长</span><span>${hours}小时${minutes}分</span></div>
      <div class="stats-item"><span>注册天数</span><span>${days}天</span></div>
    `;
  },

  renderMonsterLog(list) {
    const el = document.getElementById('monsterList');
    if (!el) return;
    if (!list || list.length === 0) {
      el.innerHTML = '<div style="color:#666;text-align:center;padding:20px;">还没有击杀记录</div>';
      return;
    }
    el.innerHTML = list.map(m => {
      const typeColor = m.monster_type === 'boss' ? '#e91e63'
                      : m.monster_type === 'elite' ? '#d4af37' : '#4ecca3';
      return `
        <div class="monster-item">
          <div class="monster-name" style="color:${typeColor}">${m.monster_name}</div>
          <div class="monster-info">击杀 ${m.kill_count} 次</div>
        </div>
      `;
    }).join('');
  },

  showCompare(newEq, oldEq) {
    const modal = document.createElement('div');
    modal.className = 'compare-modal';
    modal.innerHTML = `
      <div class="compare-box">
        <div class="compare-title">装备对比</div>
        <div class="compare-row">
          <div class="compare-col">
            <div class="compare-label">新装备</div>
            <div class="compare-name" style="color:${CONFIG.qualityColors[newEq.quality]}">${newEq.name}</div>
            <div>主属性 +${newEq.statValue}</div>
            <div>强化 +${newEq.enhanceLevel || 0}</div>
          </div>
          <div class="compare-col">
            <div class="compare-label">当前</div>
            <div class="compare-name" style="color:${oldEq ? CONFIG.qualityColors[oldEq.quality] : '#666'}">${oldEq ? oldEq.name : '无'}</div>
            <div>主属性 +${oldEq ? oldEq.statValue : 0}</div>
            <div>强化 +${oldEq ? (oldEq.enhanceLevel || 0) : 0}</div>
          </div>
        </div>
        <div class="compare-actions">
          <button onclick="this.closest('.compare-modal').remove()">关闭</button>
          <button onclick="onEquip(${newEq.id}); this.closest('.compare-modal').remove()">穿戴</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },
  renderBossList(bosses, remaining, dailyFree, extraCost) {
    const el = document.getElementById('bossList');
    if (!el) return;
  
    // 次数显示
    const header = document.getElementById('bossHeader');
    if (header) {
      header.innerHTML = `
        <div class="boss-header">
          <span>今日免费次数：<b style="color:#d4af37">${remaining}/${dailyFree}</b></span>
          <span style="font-size:12px;color:#b8a878;">额外挑战：${extraCost} 金币/次</span>
        </div>
      `;
    }
  
    el.innerHTML = bosses.map(b => `
      <div class="boss-item">
        <div class="boss-name">${b.name}</div>
        <div class="boss-info">HP ${b.hp} · 攻击 ${b.atk}</div>
        <div class="boss-reward">
          奖励：💰${b.reward.gold}
          ${b.reward.soul ? ` 💀${b.reward.soul}` : ''}
          ${b.reward.points ? ` ⭐${b.reward.points}` : ''}
        </div>
        <button class="btn boss-btn" onclick="onBossStart('${b.key}')">挑战</button>
      </div>
    `).join('');
  },
  
  renderBossBattle(boss, hp, maxHp) {
    const el = document.getElementById('bossList');
    if (!el) return;
    const pct = Math.max(0, hp / maxHp * 100);
    el.innerHTML = `
      <div class="boss-battle">
        <div class="boss-battle-name">⚔️ ${boss.name}</div>
        <div class="title-sm">血量 ${Math.max(0, hp)}/${maxHp}</div>
        <div class="bar hp-bar" style="height:20px;">
          <div style="width:${pct}%;background:linear-gradient(180deg,#e91e63,#8a0a30);box-shadow:0 0 8px rgba(233,30,99,0.6);"></div>
        </div>
        <div class="title-sm">攻击 ${boss.atk}</div>
        <div style="text-align:center;margin-top:10px;">
          <button class="btn" onclick="onBossAuto()" id="btnBossAuto" style="padding:6px 16px;">自动挑战</button>
        </div>
      </div>
    `;
  },
};


function onEquip(id)      { Equipment.equip(window.state, id); }
function onUnequip(id)    { Equipment.unequip(window.state, id); }
function onDiscard(id)    { Equipment.discard(window.state, id); }
function onAutoEquip()    { Equipment.autoEquip(window.state); }
function onEnhance(id)    { Equipment.enhance(window.state, id); }
function onReroll(id)     { Equipment.reroll(window.state, id); }
function onCompare(id)    { Equipment.compare(window.state, id); }
function onDrawTalent()   { Talent.draw(window.state); }
function onAllocate(stat) { Talent.allocate(window.state, stat); }
function onActivateTalent(id) { Talent.activate(window.state, id); }
function onClaimAchievement(key) { Achievement.claim(window.state, key); }
function onClaimDaily(key) { Daily.claim(window.state, key); }
function onBuyItem(key)   { Shop.buy(window.state, key); }
function onSignin()       { Signin.do(window.state); }
function onRankTab(tab)   { Rank.switchTab(window.state, tab); }
function onBossStart(key) { Boss.start(window.state, key); }
function onBossAuto()     { Boss.autoFight(window.state); }