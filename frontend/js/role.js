const Role = {
  async refresh(state) {
    const r = await API.getRoles(state.userId);
    if (r.code === 0) {
      state.roles = r.roles;
      UI.renderRoles(r.roles, r.allRoles);
    }
  },

  async create(state, roleKey, roleName) {
    if (!roleName || !roleName.trim()) {
      UI.log('请输入角色名', 'bad');
      return;
    }
    const r = await API.createRole(state.userId, roleKey, roleName.trim());
    if (r.code === 0) {
      UI.log('✅ 角色创建成功', 'good');
      await Role.refresh(state);
    } else {
      UI.log('创建失败：' + r.msg, 'bad');
    }
  },

  async delete(state, roleId) {
    if (!confirm('确定删除这个角色？所有数据都会丢失！')) return;
    const r = await API.deleteRole(state.userId, roleId);
    if (r.code === 0) {
      UI.log('✅ 角色已删除', 'good');
      await Role.refresh(state);
    } else {
      UI.log('删除失败：' + r.msg, 'bad');
    }
  },

  async switchRole(state, roleId) {
    // 这里只切换当前显示的 save
    const r = await API.getRoles(state.userId);
    if (r.code === 0) {
      const role = r.roles.find(x => x.id === roleId);
      if (!role) return;
      // 重新加载 save
      const sr = await API.getSave(state.userId);
      if (sr.code === 0) {
        state.save = sr.data;
        UI.renderPlayer(state.save);
        UI.log(`✅ 切换到角色【${role.role_name}】`, 'good');
      }
    }
  }
};

function onRoleCreate(roleKey) {
  const name = prompt('请输入角色名：');
  if (name) Role.create(window.state, roleKey, name);
}

function onRoleDelete(roleId) { Role.delete(window.state, roleId); }
function onRoleSwitch(roleId) { Role.switchRole(window.state, roleId); }