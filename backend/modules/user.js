const express = require('express');
const router = express.Router();
const pool = require('../db');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  // 兼容老明文密码，登录成功后建议提示改密（或下次更新时自动迁移）
  if (!stored.includes(':')) return stored === password;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch (e) { return false; }
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ code: 1, msg: '用户名密码不能为空' });
  try {
    const [rows] = await pool.query('SELECT id FROM user WHERE username=?', [username]);
    if (rows.length > 0) return res.json({ code: 1, msg: '用户名已存在' });
    // 不再预建存档，交给 role/create 建
    const [result] = await pool.query(
      'INSERT INTO user (username, password) VALUES (?,?)',
      [username, hashPassword(password)]
    );
    res.json({ code: 0, msg: '注册成功', userId: result.insertId });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT id, password FROM user WHERE username=?', [username]);
    if (rows.length === 0) return res.json({ code: 1, msg: '用户不存在' });
    if (!verifyPassword(password, rows[0].password)) return res.json({ code: 1, msg: '密码错误' });
    res.json({ code: 0, msg: '登录成功', userId: rows[0].id });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;