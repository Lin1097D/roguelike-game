const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/level', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.role_name AS username, s.level, s.atk, s.kill_count
       FROM save s JOIN role r ON s.id = r.save_id
       ORDER BY s.level DESC, s.exp DESC LIMIT 100`
    );
    res.json({ code: 0, list: rows });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.get('/atk', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.role_name AS username, s.level, s.atk, s.kill_count
       FROM save s JOIN role r ON s.id = r.save_id
       ORDER BY s.atk DESC LIMIT 100`
    );
    res.json({ code: 0, list: rows });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.get('/kill', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.role_name AS username, s.level, s.atk, s.kill_count
       FROM save s JOIN role r ON s.id = r.save_id
       ORDER BY s.kill_count DESC LIMIT 100`
    );
    res.json({ code: 0, list: rows });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;