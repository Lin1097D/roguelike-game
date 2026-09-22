const express = require('express');
const router = express.Router();
const pool = require('../db');

const BOSS_LIST = [
  { key: 'lava',   name: '熔岩巨人', hp: 10000,  atk: 500,   reward: { gold: 5000,   soul: 20,   points: 0 } },
  { key: 'ice',    name: '冰霜巨龙', hp: 30000,  atk: 1500,  reward: { gold: 15000,  soul: 50,   points: 5 } },
  { key: 'void',   name: '虚空领主', hp: 80000,  atk: 4000,  reward: { gold: 50000,  soul: 150,  points: 15 } },
  { key: 'abyss',  name: '深渊魔王', hp: 200000, atk: 10000, reward: { gold: 150000, soul: 500,  points: 50 } },
  { key: 'chaos',  name: '混沌之神', hp: 500000, atk: 25000, reward: { gold: 500000, soul: 2000, points: 200 } }
];

const DAILY_FREE = 3;
const EXTRA_COST = 5000;

// 查询状态
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    // 用 MySQL 判断今天是否重置
    const [dateRows] = await pool.query(
      'SELECT (boss_challenge_date IS NULL OR boss_challenge_date != CURDATE()) AS need_reset FROM save WHERE user_id=?',
      [userId]
    );
    if (dateRows[0].need_reset === 1) {
      await pool.query(
        'UPDATE save SET boss_challenge_count = 0, boss_challenge_date = CURDATE() WHERE user_id=?',
        [userId]
      );
    }

    const [rows] = await pool.query('SELECT boss_challenge_count FROM save WHERE user_id=?', [userId]);
    const used = rows[0].boss_challenge_count || 0;
    const remaining = Math.max(0, DAILY_FREE - used);

    res.json({
      code: 0,
      remaining,
      used,
      dailyFree: DAILY_FREE,
      extraCost: EXTRA_COST,
      bosses: BOSS_LIST
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 开始挑战
router.post('/start', async (req, res) => {
  const { userId, bossKey, useGold } = req.body;
  try {
    const boss = BOSS_LIST.find(b => b.key === bossKey);
    if (!boss) return res.json({ code: 1, msg: 'BOSS不存在' });

    // 检查次数
    const [rows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = rows[0];
    const used = s.boss_challenge_count || 0;
    let useExtra = false;

    if (used >= DAILY_FREE) {
      // 需要花金币
      if (!useGold) {
        return res.json({ code: 1, msg: `今日免费次数已用完，需要花 ${EXTRA_COST} 金币` });
      }
      if (s.gold < EXTRA_COST) {
        return res.json({ code: 1, msg: `金币不足，需要 ${EXTRA_COST} 金币` });
      }
      await pool.query('UPDATE save SET gold = gold - ? WHERE user_id=?', [EXTRA_COST, userId]);
      useExtra = true;
    } else {
      await pool.query('UPDATE save SET boss_challenge_count = boss_challenge_count + 1 WHERE user_id=?', [userId]);
    }

    res.json({
      code: 0,
      boss,
      useExtra,
      extraCost: useExtra ? EXTRA_COST : 0
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 结算挑战
router.post('/finish', async (req, res) => {
  const { userId, bossKey, win } = req.body;
  try {
    const boss = BOSS_LIST.find(b => b.key === bossKey);
    if (!boss) return res.json({ code: 1, msg: 'BOSS不存在' });

    // 记录日志
    await pool.query(
      'INSERT INTO boss_challenge_log (user_id, boss_key, result) VALUES (?,?,?)',
      [userId, bossKey, win ? 'win' : 'lose']
    );

    if (!win) {
      return res.json({ code: 0, win: false, msg: '挑战失败' });
    }

    // 发奖励
    const gold = boss.reward.gold || 0;
    const soul = boss.reward.soul || 0;
    const points = boss.reward.points || 0;

    await pool.query(
      'UPDATE save SET gold = gold + ?, free_points = free_points + ? WHERE user_id=?',
      [gold, points, userId]
    );
    if (soul > 0) {
      await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, userId]);
    }

    // 全服公告
    try {
      const [userRows] = await pool.query('SELECT username FROM user WHERE id=?', [userId]);
      const username = userRows[0].username;
      const msg = `⚔️ 恭喜玩家【${username}】击败了 BOSS【${boss.name}】！`;
      await pool.query('INSERT INTO announcement (message) VALUES (?)', [msg]);
    } catch (e) {}

    res.json({
      code: 0,
      win: true,
      reward: boss.reward
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;