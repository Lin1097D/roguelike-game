const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });

    const [userRows] = await pool.query('SELECT soul_fragment FROM user WHERE id=?', [userId]);
    const [eqRows] = await pool.query(
      'SELECT * FROM equipment WHERE user_id=? AND equipped=1',
      [userId]
    );

    const data = rows[0];
    data.soul = userRows[0].soul_fragment;

    // 组装已穿戴装备
    data.equipment = {};
    for (const row of eqRows) {
      data.equipment[row.slot] = {
        id: row.id,
        name: row.name,
        quality: row.quality,
        statValue: row.stat_value
      };
    }

    res.json({ code: 0, data });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;