const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM monster_log WHERE user_id=? ORDER BY kill_count DESC',
      [userId]
    );
    res.json({ code: 0, list: rows });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;