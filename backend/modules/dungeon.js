const express = require('express');
const router = express.Router();
const pool = require('../db');

const DUNGEON_LIST = [
  { key: 'novice', name: '新手地牢', level: '1~10', monsterCount: 10, timeLimit: 60, monsterHp: 100, monsterAtk: 20, reward: { gold: 5000, soul: 10, points: 0 } },
  { key: 'cave', name: '幽暗洞穴', level: '10~30', monsterCount: 20, timeLimit: 60, monsterHp: 500, monsterAtk: 80, reward: { gold: 20000, soul: 50, points: 3 } },
  { key: 'lava', name: '熔岩深渊', level: '30~60', monsterCount: 30, timeLimit: 60, monsterHp: 2000, monsterAtk: 300, reward: { gold: 80000, soul: 200, points: 10 } },
  { key: 'tomb', name: '亡灵墓穴', level: '60~80', monsterCount: 50, timeLimit: 60, monsterHp: 8000, monsterAtk: 800, reward: { gold: 300000, soul: 800, points: 30 } },
  { key: 'chaos', name: '混沌空间', level: '80~100', monsterCount: 100, timeLimit: 60, monsterHp: 30000, monsterAtk: 3000, reward: { gold: 1500000, soul: 3000, points: 100 } }
];

const DAILY_FREE = 3;
const EXTRA_COST = 3000;
const DUNGEON_TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟超时（副本限时 60s，给足余量）

// 进行中的副本：{ saveId: { dungeonKey, startedAt } }
const dungeonInProgress = {};

// 超时清理
setInterval(() => {
  const now = Date.now();
  for (const saveId in dungeonInProgress) {
    if (now - dungeonInProgress[saveId].startedAt > DUNGEON_TIMEOUT_MS) {
      delete dungeonInProgress[saveId];
    }
  }
}, 60 * 1000);

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [dateRows] = await pool.query('SELECT (dungeon_date IS NULL OR dungeon_date != CURDATE()) AS need_reset FROM save WHERE id=?', [saveId]);
    if (dateRows[0].need_reset === 1) {
      await pool.query('UPDATE save SET dungeon_count = 0, dungeon_date = CURDATE() WHERE id=?', [saveId]);
    }
    const [rows] = await pool.query('SELECT dungeon_count FROM save WHERE id=?', [saveId]);
    const used = rows[0].dungeon_count || 0;
    const remaining = Math.max(0, DAILY_FREE - used);
    res.json({ code: 0, remaining, used, dailyFree: DAILY_FREE, extraCost: EXTRA_COST, dungeons: DUNGEON_LIST });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/start', async (req, res) => {
  const { saveId, dungeonKey, useGold } = req.body;
  try {
    // 1. 已有进行中的副本，拒绝
    if (dungeonInProgress[saveId]) {
      return res.json({ code: 1, msg: '已有副本进行中，请先完成或等待超时' });
    }

    const dungeon = DUNGEON_LIST.find(d => d.key === dungeonKey);
    if (!dungeon) return res.json({ code: 1, msg: '副本不存在' });

    const [rows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (rows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = rows[0];
    const used = s.dungeon_count || 0;
    let useExtra = false;

    if (used >= DAILY_FREE) {
      if (!useGold) return res.json({ code: 1, msg: `今日免费次数已用完` });
      if (s.gold < EXTRA_COST) return res.json({ code: 1, msg: `金币不足` });
      await pool.query('UPDATE save SET gold = gold - ? WHERE id=?', [EXTRA_COST, saveId]);
      useExtra = true;
    } else {
      await pool.query('UPDATE save SET dungeon_count = dungeon_count + 1 WHERE id=?', [saveId]);
    }

    // 2. 标记进行中
    dungeonInProgress[saveId] = { dungeonKey, startedAt: Date.now() };

    res.json({ code: 0, dungeon, useExtra, extraCost: useExtra ? EXTRA_COST : 0 });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/finish', async (req, res) => {
  const { saveId, dungeonKey, win, killed } = req.body;
  try {
    // 1. 校验是否有进行中的副本，且 dungeonKey 匹配
    const inProgress = dungeonInProgress[saveId];
    if (!inProgress) {
      return res.json({ code: 1, msg: '没有进行中的副本' });
    }
    if (inProgress.dungeonKey !== dungeonKey) {
      return res.json({ code: 1, msg: '副本不匹配' });
    }

    const dungeon = DUNGEON_LIST.find(d => d.key === dungeonKey);
    if (!dungeon) {
      delete dungeonInProgress[saveId];
      return res.json({ code: 1, msg: '副本不存在' });
    }

    // 2. 先删除进行中标记，防止并发重复结算
    delete dungeonInProgress[saveId];

    await pool.query('INSERT INTO dungeon_log (save_id, dungeon_key, result, killed) VALUES (?,?,?,?)', [saveId, dungeonKey, win ? 'win' : 'lose', killed || 0]);

    if (!win) return res.json({ code: 0, win: false, msg: '副本失败' });

    const gold = dungeon.reward.gold || 0;
    const soul = dungeon.reward.soul || 0;
    const points = dungeon.reward.points || 0;
    await pool.query('UPDATE save SET gold = gold + ?, free_points = free_points + ? WHERE id=?', [gold, points, saveId]);
    if (soul > 0) {
      const [saveRows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
      await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, saveRows[0].user_id]);
    }

    try {
      const [saveRows2] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
      const [userRows] = await pool.query('SELECT username FROM user WHERE id=?', [saveRows2[0].user_id]);
      await pool.query('INSERT INTO announcement (message) VALUES (?)', [`🏰 恭喜玩家【${userRows[0].username}】通关副本【${dungeon.name}】！`]);
    } catch (e) {}

    res.json({ code: 0, win: true, reward: dungeon.reward });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;