const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ROLES } = require('../config/roles');

// 获取角色列表
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.role_key, r.role_name, r.save_id, s.level, s.atk, s.kill_count
       FROM role r
       LEFT JOIN save s ON r.save_id = s.id
       WHERE r.user_id = ?
       ORDER BY r.id ASC`,
      [userId]
    );
    res.json({ code: 0, roles: rows, allRoles: ROLES });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 创建角色
router.post('/create', async (req, res) => {
  const { userId, roleKey, roleName } = req.body;
  try {
    const roleCfg = ROLES.find(r => r.key === roleKey);
    if (!roleCfg) return res.json({ code: 1, msg: '角色类型不存在' });

    // 检查数量
    const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM role WHERE user_id=?', [userId]);
    if (countRows[0].cnt >= 3) {
      return res.json({ code: 1, msg: '最多只能创建 3 个角色' });
    }

    // 检查同名
    const [sameRows] = await pool.query(
      'SELECT id FROM role WHERE user_id=? AND role_name=?',
      [userId, roleName]
    );
    if (sameRows.length > 0) {
      return res.json({ code: 1, msg: '角色名已存在' });
    }

    // 创建 save
    const cfg = roleCfg.init;
    const [saveResult] = await pool.query(
      `INSERT INTO save 
       (user_id, hp, max_hp, atk, mp, max_mp, crit_rate, dodge_rate, 
        base_atk, base_max_hp, base_max_mp, base_crit_rate, base_dodge_rate, role_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, cfg.hp, cfg.hp, cfg.atk, cfg.mp, cfg.mp, cfg.crit, cfg.dodge,
       cfg.atk, cfg.hp, cfg.mp, cfg.crit, cfg.dodge, roleKey]
    );

    // 创建 role 记录
    const [result] = await pool.query(
      'INSERT INTO role (user_id, role_key, role_name, save_id) VALUES (?,?,?,?)',
      [userId, roleKey, roleName, saveResult.insertId]
    );

    res.json({
      code: 0,
      msg: '创建成功',
      roleId: result.insertId,
      saveId: saveResult.insertId
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 删除角色
router.post('/delete', async (req, res) => {
  const { userId, roleId } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT save_id FROM role WHERE id=? AND user_id=?',
      [roleId, userId]
    );
    if (rows.length === 0) return res.json({ code: 1, msg: '角色不存在' });

    const saveId = rows[0].save_id;

    // 删除关联数据
    await pool.query('DELETE FROM equipment WHERE user_id=(SELECT user_id FROM role WHERE id=?)', [roleId]);
    await pool.query('DELETE FROM talent WHERE user_id=(SELECT user_id FROM role WHERE id=?)', [roleId]);
    await pool.query('DELETE FROM skill WHERE user_id=(SELECT user_id FROM role WHERE id=?)', [roleId]);
    await pool.query('DELETE FROM save WHERE id=?', [saveId]);
    await pool.query('DELETE FROM role WHERE id=?', [roleId]);

    res.json({ code: 0, msg: '删除成功' });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;