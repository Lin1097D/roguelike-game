const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM monster_log WHERE save_id=? ORDER BY kill_count DESC', [saveId]);
    res.json({ code: 0, list: rows });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;