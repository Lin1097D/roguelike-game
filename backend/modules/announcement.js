const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM announcement ORDER BY id DESC LIMIT 10'
    );
    res.json({ code: 0, list: rows });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

router.post('/push', async (req, res) => {
  const { message } = req.body;
  try {
    await pool.query('INSERT INTO announcement (message) VALUES (?)', [message]);
    res.json({ code: 0 });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;