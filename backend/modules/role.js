const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ROLES } = require('../config/roles');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.role_key, r.role_name, r.save_id, s.level, s.atk, s.kill_count
       FROM role r LEFT JOIN save s ON r.save_id = s.id
       WHERE r.user_id=? ORDER BY r.id ASC`,
      [userId]
    );

    const [userRows] = await pool.query('SELECT current_save_id FROM user WHERE id=?', [userId]);
    let currentSaveId = userRows.length > 0 ? userRows[0].current_save_id : null;

    // 没有角色时自动创建默认战士
    if (rows.length === 0) {
      const warrior = ROLES[0];
      const cfg = warrior.init;
      const [saveResult] = await pool.query(
        `INSERT INTO save 
         (user_id, hp, max_hp, atk, mp, max_mp, crit_rate, dodge_rate, 
          base_atk, base_max_hp, base_max_mp, base_crit_rate, base_dodge_rate, role_key)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [userId, cfg.hp, cfg.hp, cfg.atk, cfg.mp, cfg.mp, cfg.crit, cfg.dodge,
         cfg.atk, cfg.hp, cfg.mp, cfg.crit, cfg.dodge, warrior.key]
      );
      await pool.query(
        'INSERT INTO role (user_id, role_key, role_name, save_id) VALUES (?,?,?,?)',
        [userId, warrior.key, warrior.name, saveResult.insertId]
      );
      await pool.query('UPDATE user SET current_save_id=? WHERE id=?', [saveResult.insertId, userId]);
      currentSaveId = saveResult.insertId;

      const [newRows] = await pool.query(
        `SELECT r.id, r.role_key, r.role_name, r.save_id, s.level, s.atk, s.kill_count
         FROM role r LEFT JOIN save s ON r.save_id = s.id
         WHERE r.user_id=? ORDER BY r.id ASC`,
        [userId]
      );
      return res.json({ code: 0, roles: newRows, allRoles: ROLES, currentSaveId });
    }

    res.json({ code: 0, roles: rows, allRoles: ROLES, currentSaveId });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/create', async (req, res) => {
  const { userId, roleKey, roleName } = req.body;
  try {
    const roleCfg = ROLES.find(r => r.key === roleKey);
    if (!roleCfg) return res.json({ code: 1, msg: '角色类型不存在' });

    const [countRows] = await pool.query('SELECT COUNT(*) AS cnt FROM role WHERE user_id=?', [userId]);
    if (countRows[0].cnt >= 3) return res.json({ code: 1, msg: '最多只能创建 3 个角色' });

    const [sameRows] = await pool.query('SELECT id FROM role WHERE user_id=? AND role_name=?', [userId, roleName]);
    if (sameRows.length > 0) return res.json({ code: 1, msg: '角色名已存在' });

    const cfg = roleCfg.init;
    const [saveResult] = await pool.query(
      `INSERT INTO save 
       (user_id, hp, max_hp, atk, mp, max_mp, crit_rate, dodge_rate, 
        base_atk, base_max_hp, base_max_mp, base_crit_rate, base_dodge_rate, role_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [userId, cfg.hp, cfg.hp, cfg.atk, cfg.mp, cfg.mp, cfg.crit, cfg.dodge,
       cfg.atk, cfg.hp, cfg.mp, cfg.crit, cfg.dodge, roleKey]
    );

    const [result] = await pool.query(
      'INSERT INTO role (user_id, role_key, role_name, save_id) VALUES (?,?,?,?)',
      [userId, roleKey, roleName, saveResult.insertId]
    );

    // 如果用户还没有 current_save_id，把它设成新建的这个
    const [uRows] = await pool.query('SELECT current_save_id FROM user WHERE id=?', [userId]);
    if (!uRows[0].current_save_id) {
      await pool.query('UPDATE user SET current_save_id=? WHERE id=?', [saveResult.insertId, userId]);
    }

    res.json({ code: 0, msg: '创建成功', roleId: result.insertId, saveId: saveResult.insertId });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/switch', async (req, res) => {
  const { userId, saveId } = req.body;
  try {
    const [rows] = await pool.query('SELECT id FROM role WHERE user_id=? AND save_id=?', [userId, saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '角色不存在' });
    await pool.query('UPDATE user SET current_save_id=? WHERE id=?', [saveId, userId]);
    res.json({ code: 0, msg: '切换成功', saveId });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/delete', async (req, res) => {
  const { userId, roleId } = req.body;
  try {
    const [rows] = await pool.query('SELECT save_id FROM role WHERE id=? AND user_id=?', [roleId, userId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '角色不存在' });
    const saveId = rows[0].save_id;

    await pool.query('DELETE FROM equipment WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM talent WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM skill WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM achievement WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM daily WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM monster_log WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM dungeon_log WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM boss_challenge_log WHERE save_id=?', [saveId]);
    await pool.query('DELETE FROM save WHERE id=?', [saveId]);
    await pool.query('DELETE FROM role WHERE id=?', [roleId]);

    const [userRows] = await pool.query('SELECT current_save_id FROM user WHERE id=?', [userId]);
    if (userRows[0].current_save_id === saveId) {
      const [remain] = await pool.query('SELECT save_id FROM role WHERE user_id=? ORDER BY id ASC LIMIT 1', [userId]);
      if (remain.length > 0) {
        await pool.query('UPDATE user SET current_save_id=? WHERE id=?', [remain[0].save_id, userId]);
      } else {
        await pool.query('UPDATE user SET current_save_id=NULL WHERE id=?', [userId]);
      }
    }

    res.json({ code: 0, msg: '删除成功' });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;