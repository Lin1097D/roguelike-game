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

// 渲染词条
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
	// 等级和经验
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
        const statText = isArtifact 
          ? '三维 +100' 
          : `+${actualStat(eq.statValue, eq.enhanceLevel)}`;
        const affixStr = renderAffixes(eq.affixes);
        const enhanceBtn = isArtifact ? '' : `<span onclick="event.stopPropagation(); onEnhance(${eq.id})" style="cursor:pointer;color:#f9c74f;font-size:11px;margin-right:6px;">强化</span>`;
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
      const sName = isArtifact
        ? CONFIG.artifactSlots[item.slot]
        : CONFIG.slotNames[item.slot];
      const enhanceStr = item.enhanceLevel > 0 
        ? ` <span style="color:${enhanceColor(item.enhanceLevel)}">+${item.enhanceLevel}</span>` 
        : '';
      const statText = isArtifact 
        ? '三维 +100' 
        : `+${actualStat(item.statValue, item.enhanceLevel)}`;
      const affixStr = renderAffixes(item.affixes);
      const enhanceBtn = isArtifact ? '' : `<span onclick="onEnhance(${item.id})" style="cursor:pointer;color:#f9c74f;">强化</span>`;
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
      const color = CONFIG.talentQualityColors[t.quality] || '#aaa';
      const activeTag = t.active
        ? '<span style="color:#4ecca3;font-size:11px;margin-left:6px;">[生效中]</span>'
        : `<span onclick="onActivateTalent(${t.id})" style="color:#f9c74f;font-size:11px;margin-left:6px;cursor:pointer;">[激活]</span>`;
      return `
        <div class="talent-item" style="border-color:${color}; ${t.active ? 'background:#1a3a3a;' : ''}">
          <div class="talent-name" style="color:${color}">
            [${t.quality}] ${t.name} ${t.stacks > 1 ? '×' + t.stacks : ''}
            ${activeTag}
          </div>
          <div class="talent-desc">${t.desc}</div>
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
  }
};

function onEquip(id)      { Equipment.equip(window.state, id); }
function onUnequip(id)    { Equipment.unequip(window.state, id); }
function onDiscard(id)    { Equipment.discard(window.state, id); }
function onAutoEquip()    { Equipment.autoEquip(window.state); }
function onEnhance(id)    { Equipment.enhance(window.state, id); }
function onDrawTalent()   { Talent.draw(window.state); }
function onAllocate(stat) { Talent.allocate(window.state, stat); }
function onActivateTalent(id) { Talent.activate(window.state, id); }