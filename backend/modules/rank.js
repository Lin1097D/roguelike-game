const express = require('express');
const router = express.Router();
const pool = require('../db');

// 等级榜
router.get('/level', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.username, s.level, s.atk, s.kill_count
       FROM save s
       JOIN user u ON s.user_id = u.id
       ORDER BY s.level DESC, s.exp DESC
       LIMIT 100`
    );
    res.json({ code: 0, list: rows });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 攻击力榜
router.get('/atk', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.username, s.level, s.atk, s.kill_count
       FROM save s
       JOIN user u ON s.user_id = u.id
       ORDER BY s.atk DESC
       LIMIT 100`
    );
    res.json({ code: 0, list: rows });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 击杀榜
router.get('/kill', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.username, s.level, s.atk, s.kill_count
       FROM save s
       JOIN user u ON s.user_id = u.id
       ORDER BY s.kill_count DESC
       LIMIT 100`
    );
    res.json({ code: 0, list: rows });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;