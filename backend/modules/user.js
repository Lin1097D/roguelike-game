const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ code: 1, msg: '用户名密码不能为空' });
  try {
    const [rows] = await pool.query('SELECT id FROM user WHERE username=?', [username]);
    if (rows.length > 0) return res.json({ code: 1, msg: '用户名已存在' });
    const [result] = await pool.query('INSERT INTO user (username,password) VALUES (?,?)', [username, password]);
    const userId = result.insertId;
    await pool.query('INSERT INTO save (user_id) VALUES (?)', [userId]);
    res.json({ code: 0, msg: '注册成功', userId });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT id,password FROM user WHERE username=?', [username]);
    if (rows.length === 0) return res.json({ code: 1, msg: '用户不存在' });
    if (rows[0].password !== password) return res.json({ code: 1, msg: '密码错误' });
    res.json({ code: 0, msg: '登录成功', userId: rows[0].id });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;