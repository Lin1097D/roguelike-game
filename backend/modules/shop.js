const express = require('express');
const router = express.Router();
const pool = require('../db');

const SHOP_ITEMS = [
  { key: 'exp_pill',   name: '经验丹',    price: 500,  desc: '+1000 经验' },
  { key: 'gold_small', name: '金币袋·小', price: 1000, desc: '获得 1500 金币' },
  { key: 'gold_big',   name: '金币袋·大', price: 5000, desc: '获得 9000 金币' },
  { key: 'free_point', name: '属性点',    price: 3000, desc: '+1 自由属性点' }
];

router.get('/:userId', async (req, res) => {
  res.json({ code: 0, items: SHOP_ITEMS });
});

router.post('/buy', async (req, res) => {
  const { userId, itemKey } = req.body;
  try {
    const item = SHOP_ITEMS.find(i => i.key === itemKey);
    if (!item) return res.json({ code: 1, msg: '商品不存在' });

    const [rows] = await pool.query('SELECT gold FROM save WHERE user_id=?', [userId]);
    const s = rows[0];
    if (s.gold < item.price) return res.json({ code: 1, msg: '金币不足' });

    await pool.query('UPDATE save SET gold = gold - ? WHERE user_id=?', [item.price, userId]);

    if (itemKey === 'exp_pill') {
      await pool.query('UPDATE save SET exp = exp + 1000 WHERE user_id=?', [userId]);
    } else if (itemKey === 'gold_small') {
      await pool.query('UPDATE save SET gold = gold + 1500 WHERE user_id=?', [userId]);
    } else if (itemKey === 'gold_big') {
      await pool.query('UPDATE save SET gold = gold + 9000 WHERE user_id=?', [userId]);
    } else if (itemKey === 'free_point') {
      await pool.query('UPDATE save SET free_points = free_points + 1 WHERE user_id=?', [userId]);
    }

    const [newRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({ code: 0, msg: '购买成功', data: newRows[0] });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;