const express = require('express');
const router = express.Router();
const pool = require('../db');

const BOSS_LIST = [
  { key: 'lava', name: '熔岩巨人', hp: 10000, atk: 500, crit: 0.05, reward: { gold: 5000, soul: 20, points: 0 } },
  { key: 'ice', name: '冰霜巨龙', hp: 30000, atk: 1500, crit: 0.1, reward: { gold: 15000, soul: 50, points: 5 } },
  { key: 'void', name: '虚空领主', hp: 80000, atk: 4000, crit: 0.15, reward: { gold: 50000, soul: 150, points: 15 } },
  { key: 'abyss', name: '深渊魔王', hp: 200000, atk: 10000, crit: 0.2, reward: { gold: 150000, soul: 500, points: 50 } },
  { key: 'chaos', name: '混沌之神', hp: 500000, atk: 25000, crit: 0.25, reward: { gold: 500000, soul: 2000, points: 200 } }
];

const DAILY_FREE = 3;
const EXTRA_COST = 5000;
const CHALLENGE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟超时

// 进行中的挑战：{ saveId: { bossKey, startedAt } }
const bossInProgress = {};

// 超时清理
setInterval(() => {
  const now = Date.now();
  for (const saveId in bossInProgress) {
    if (now - bossInProgress[saveId].startedAt > CHALLENGE_TIMEOUT_MS) {
      delete bossInProgress[saveId];
    }
  }
}, 60 * 1000);

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [dateRows] = await pool.query('SELECT (boss_challenge_date IS NULL OR boss_challenge_date != CURDATE()) AS need_reset FROM save WHERE id=?', [saveId]);
    if (dateRows[0].need_reset === 1) {
      await pool.query('UPDATE save SET boss_challenge_count = 0, boss_challenge_date = CURDATE() WHERE id=?', [saveId]);
    }
    const [rows] = await pool.query('SELECT boss_challenge_count FROM save WHERE id=?', [saveId]);
    const used = rows[0].boss_challenge_count || 0;
    const remaining = Math.max(0, DAILY_FREE - used);
    res.json({ code: 0, remaining, used, dailyFree: DAILY_FREE, extraCost: EXTRA_COST, bosses: BOSS_LIST });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/start', async (req, res) => {
  const { saveId, bossKey, useGold } = req.body;
  try {
    // 1. 已有进行中的挑战，拒绝
    if (bossInProgress[saveId]) {
      return res.json({ code: 1, msg: '已有挑战进行中，请先完成或等待超时' });
    }

    const boss = BOSS_LIST.find(b => b.key === bossKey);
    if (!boss) return res.json({ code: 1, msg: 'BOSS不存在' });

    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];
    const used = s.boss_challenge_count || 0;
    let useExtra = false;

    if (used >= DAILY_FREE) {
      if (!useGold) return res.json({ code: 1, msg: `今日免费次数已用完，需要花 ${EXTRA_COST} 金币` });
      if (s.gold < EXTRA_COST) return res.json({ code: 1, msg: `金币不足` });
      await pool.query('UPDATE save SET gold = gold - ? WHERE id=?', [EXTRA_COST, saveId]);
      useExtra = true;
    } else {
      await pool.query('UPDATE save SET boss_challenge_count = boss_challenge_count + 1 WHERE id=?', [saveId]);
    }

    // 2. 标记进行中
    bossInProgress[saveId] = { bossKey, startedAt: Date.now() };

    res.json({ code: 0, boss, useExtra, extraCost: useExtra ? EXTRA_COST : 0 });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/finish', async (req, res) => {
  const { saveId, bossKey, win } = req.body;
  try {
    // 1. 校验是否真的有进行中的挑战，且 bossKey 匹配
    const inProgress = bossInProgress[saveId];
    if (!inProgress) {
      return res.json({ code: 1, msg: '没有进行中的挑战' });
    }
    if (inProgress.bossKey !== bossKey) {
      return res.json({ code: 1, msg: '挑战的 BOSS 不匹配' });
    }

    const boss = BOSS_LIST.find(b => b.key === bossKey);
    if (!boss) {
      delete bossInProgress[saveId];
      return res.json({ code: 1, msg: 'BOSS不存在' });
    }

    // 2. 先删除进行中标记，防止并发重复结算
    delete bossInProgress[saveId];

    await pool.query('INSERT INTO boss_challenge_log (save_id, boss_key, result) VALUES (?,?,?)', [saveId, bossKey, win ? 'win' : 'lose']);

    if (!win) return res.json({ code: 0, win: false, msg: '挑战失败' });

    const gold = boss.reward.gold || 0;
    const soul = boss.reward.soul || 0;
    const points = boss.reward.points || 0;
    await pool.query('UPDATE save SET gold = gold + ?, free_points = free_points + ? WHERE id=?', [gold, points, saveId]);
    if (soul > 0) {
      const [saveRows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
      await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, saveRows[0].user_id]);
    }

    try {
      const [saveRows2] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
      const [userRows] = await pool.query('SELECT username FROM user WHERE id=?', [saveRows2[0].user_id]);
      await pool.query('INSERT INTO announcement (message) VALUES (?)', [`⚔️ 恭喜玩家【${userRows[0].username}】击败了 BOSS【${boss.name}】！`]);
    } catch (e) {}

    res.json({ code: 0, win: true, reward: boss.reward });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;