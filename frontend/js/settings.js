const Settings = {
  // 从 localStorage 加载
  load() {
    try {
      const saved = localStorage.getItem('gameSettings');
      if (saved) {
        const s = JSON.parse(saved);
        Object.assign(CONFIG.settings, s);
      }
    } catch (e) {}
    // 同步到 CONFIG
    CONFIG.soundEnabled = CONFIG.settings.soundEnabled;
    window.battleSpeed = CONFIG.settings.battleSpeed;
  },

  // 保存到 localStorage
  save() {
    localStorage.setItem('gameSettings', JSON.stringify(CONFIG.settings));
  },

  // 切换某项
  toggle(key) {
    CONFIG.settings[key] = !CONFIG.settings[key];
    Settings.save();
    Settings.apply();
    Settings.refresh();
  },

  // 设置某项
  set(key, value) {
    CONFIG.settings[key] = value;
    Settings.save();
    Settings.apply();
    Settings.refresh();
  },

  // 应用设置
  apply() {
    CONFIG.soundEnabled = CONFIG.settings.soundEnabled;
    window.battleSpeed = CONFIG.settings.battleSpeed;
    const btn = document.getElementById('btnSpeed');
    if (btn) btn.textContent = '速度 x' + CONFIG.settings.battleSpeed;
  },

  // 渲染设置页面
  refresh() {
    UI.renderSettings(CONFIG.settings);
  },

  // 导出存档
  async exportSave(state) {
    try {
      const save = state.save;
      const equip = state.equipped;
      const bag = state.bag;
      const data = { save, equip, bag, exportTime: new Date().toISOString() };
      const text = JSON.stringify(data, null, 2);

      // 弹窗显示
      const modal = document.createElement('div');
      modal.className = 'compare-modal';
      modal.innerHTML = `
        <div class="compare-box" style="max-width:90%;">
          <div class="compare-title">导出存档</div>
          <textarea style="width:100%;height:300px;background:#0a0806;color:#e8dcc0;border:1px solid #3a3020;border-radius:4px;padding:8px;font-family:monospace;font-size:11px;" readonly>${text.replace(/</g, '&lt;')}</textarea>
          <div class="compare-actions" style="margin-top:8px;">
            <button onclick="this.closest('.compare-modal').remove()">关闭</button>
            <button onclick="navigator.clipboard.writeText(document.querySelector('.compare-modal textarea').value); alert('已复制到剪贴板')">复制</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch (e) {
      UI.log('导出失败：' + e.message, 'bad');
    }
  },

  // 导入存档
  importSave(state) {
    const modal = document.createElement('div');
    modal.className = 'compare-modal';
    modal.innerHTML = `
      <div class="compare-box" style="max-width:90%;">
        <div class="compare-title">导入存档</div>
        <textarea id="importText" placeholder="粘贴 JSON..." style="width:100%;height:300px;background:#0a0806;color:#e8dcc0;border:1px solid #3a3020;border-radius:4px;padding:8px;font-family:monospace;font-size:11px;"></textarea>
        <div class="compare-actions" style="margin-top:8px;">
          <button onclick="this.closest('.compare-modal').remove()">取消</button>
          <button onclick="Settings.doImport()">导入</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  async doImport() {
    try {
      const text = document.getElementById('importText').value;
      const data = JSON.parse(text);
      if (!data.save) throw new Error('数据格式错误');

      // 调用 API 保存
      const r = await API.importSave(window.state.userId, data);
      if (r.code === 0) {
        UI.log('✅ 导入成功', 'good');
        // 刷新
        const sr = await API.getSave(window.state.userId);
        if (sr.code === 0) {
          window.state.save = sr.data;
          UI.renderPlayer(window.state.save);
        }
        await Equipment.refresh(window.state);
        document.querySelector('.compare-modal').remove();
      } else {
        UI.log('导入失败：' + r.msg, 'bad');
      }
    } catch (e) {
      UI.log('导入失败：' + e.message, 'bad');
    }
  },

  // 清空缓存
  clearCache() {
    if (!confirm('清空浏览器缓存？不会影响游戏数据。')) return;
    localStorage.clear();
    UI.log('✅ 缓存已清空', 'good');
  },

  // 退出登录
  logout() {
    logout();
  }
};

function onSettingToggle(key) { Settings.toggle(key); }
function onSettingSpeed(v) { Settings.set('battleSpeed', v); }
function onExportSave() { Settings.exportSave(window.state); }
function onImportSave() { Settings.importSave(window.state); }
function onClearCache() { Settings.clearCache(); }
function onSettingsLogout() { Settings.logout(); }