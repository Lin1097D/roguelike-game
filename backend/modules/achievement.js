const express = require('express');
const router = express.Router();
const pool = require('../db');

// 成就定义
const ACHIEVEMENTS = [
  { key: 'kill_10',     name: '初入江湖', desc: '击杀 10 只怪',       check: s => s.kill_count >= 10,          reward: { gold: 500 } },
  { key: 'kill_100',    name: '小有所成', desc: '击杀 100 只怪',      check: s => s.kill_count >= 100,         reward: { gold: 3000 } },
  { key: 'kill_1000',   name: '杀人如麻', desc: '击杀 1000 只怪',     check: s => s.kill_count >= 1000,        reward: { gold: 20000, soul: 5 } },
  { key: 'level_10',    name: '初露锋芒', desc: '达到 10 级',          check: s => s.level >= 10,               reward: { gold: 2000 } },
  { key: 'level_50',    name: '一代宗师', desc: '达到 50 级',          check: s => s.level >= 50,               reward: { gold: 50000, soul: 20 } },
  { key: 'gold_100000', name: '富甲一方', desc: '拥有 100000 金币',    check: s => s.gold >= 100000,            reward: { soul: 100 } },
  { key: 'talent_5',    name: '天赋异禀', desc: '拥有 5 个天赋',       check: null, reward: { gold: 5000 } },
  { key: 'sss_talent',  name: '天命之子', desc: '抽到 1 个 SSS 天赋',  check: null, reward: { gold: 50000, soul: 50 } },
  { key: 'legendary',   name: '传奇装备', desc: '拥有 1 件传说装备',   check: null, reward: { gold: 10000 } },
  { key: 'enhance_20',  name: '强化大师', desc: '强化到 +20',          check: null, reward: { gold: 30000 } }
];

// 查询玩家成就
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [saveRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = saveRows[0];

    const [talentRows] = await pool.query('SELECT COUNT(*) AS cnt FROM talent WHERE user_id=?', [userId]);
    const [legendaryRows] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM equipment WHERE user_id=? AND quality='legendary'",
      [userId]
    );
    const [enhanceRows] = await pool.query(
      'SELECT MAX(enhance_level) AS mx FROM equipment WHERE user_id=?',
      [userId]
    );
    const [sssRows] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM talent WHERE user_id=? AND quality='SSS'",
      [userId]
    );

    const talentCount = talentRows[0].cnt;
    const legendaryCount = legendaryRows[0].cnt;
    const maxEnhance = enhanceRows[0].mx || 0;
    const sssCount = sssRows[0].cnt;

    const [claimedRows] = await pool.query(
      'SELECT achievement_key FROM achievement WHERE user_id=? AND claimed=1',
      [userId]
    );
    const claimedSet = new Set(claimedRows.map(r => r.achievement_key));

    const list = ACHIEVEMENTS.map(a => {
      let achieved = false;
      if (a.check) {
        achieved = a.check(s);
      } else if (a.key === 'talent_5') {
        achieved = talentCount >= 5;
      } else if (a.key === 'sss_talent') {
        achieved = sssCount >= 1;
      } else if (a.key === 'legendary') {
        achieved = legendaryCount >= 1;
      } else if (a.key === 'enhance_20') {
        achieved = maxEnhance >= 20;
      }
      return {
        key: a.key,
        name: a.name,
        desc: a.desc,
        achieved,
        claimed: claimedSet.has(a.key),
        reward: a.reward
      };
    });

    res.json({ code: 0, list });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 领取成就奖励
router.post('/claim', async (req, res) => {
  const { userId, achievementKey } = req.body;
  try {
    const a = ACHIEVEMENTS.find(x => x.key === achievementKey);
    if (!a) return res.json({ code: 1, msg: '成就不存在' });

    const [rows] = await pool.query(
      'SELECT * FROM achievement WHERE user_id=? AND achievement_key=?',
      [userId, achievementKey]
    );
    if (rows.length > 0 && rows[0].claimed === 1) {
      return res.json({ code: 1, msg: '已领取' });
    }

    // 发奖励
    const gold = a.reward.gold || 0;
    const soul = a.reward.soul || 0;
    const points = a.reward.points || 0;

    await pool.query(
      'UPDATE save SET gold = gold + ?, free_points = free_points + ? WHERE user_id=?',
      [gold, points, userId]
    );
    if (soul > 0) {
      await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, userId]);
    }

    // 标记已领取
    if (rows.length > 0) {
      await pool.query('UPDATE achievement SET claimed=1 WHERE id=?', [rows[0].id]);
    } else {
      await pool.query(
        'INSERT INTO achievement (user_id, achievement_key, claimed) VALUES (?,?,1)',
        [userId, achievementKey]
      );
    }

    res.json({ code: 0, msg: '领取成功', reward: a.reward });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;