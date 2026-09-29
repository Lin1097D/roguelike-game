const express = require('express');
const router = express.Router();
const pool = require('../db');

const ACHIEVEMENTS = [
  { key: 'kill_10', name: '初入江湖', desc: '击杀 10 只怪', check: s => s.kill_count >= 10, reward: { gold: 500 } },
  { key: 'kill_100', name: '小有所成', desc: '击杀 100 只怪', check: s => s.kill_count >= 100, reward: { gold: 3000 } },
  { key: 'kill_1000', name: '杀人如麻', desc: '击杀 1000 只怪', check: s => s.kill_count >= 1000, reward: { gold: 20000, soul: 5 } },
  { key: 'level_10', name: '初露锋芒', desc: '达到 10 级', check: s => s.level >= 10, reward: { gold: 2000 } },
  { key: 'level_50', name: '一代宗师', desc: '达到 50 级', check: s => s.level >= 50, reward: { gold: 50000, soul: 20 } },
  { key: 'gold_100000', name: '富甲一方', desc: '拥有 100000 金币', check: s => s.gold >= 100000, reward: { soul: 100 } },
  { key: 'talent_5', name: '天赋异禀', desc: '拥有 5 个天赋', check: null, reward: { gold: 5000 } },
  { key: 'sss_talent', name: '天命之子', desc: '抽到 1 个 SSS 天赋', check: null, reward: { gold: 50000, soul: 50 } },
  { key: 'legendary', name: '传奇装备', desc: '拥有 1 件传说装备', check: null, reward: { gold: 10000 } },
  { key: 'enhance_20', name: '强化大师', desc: '强化到 +20', check: null, reward: { gold: 30000 } }
];

async function buildAchievementState(saveId) {
  const [saveRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
  if (saveRows.length === 0) return null;
  const s = saveRows[0];
  const [talentRows] = await pool.query('SELECT COUNT(*) AS cnt FROM talent WHERE save_id=?', [saveId]);
  const [legendaryRows] = await pool.query("SELECT COUNT(*) AS cnt FROM equipment WHERE save_id=? AND quality='legendary'", [saveId]);
  const [enhanceRows] = await pool.query('SELECT MAX(enhance_level) AS mx FROM equipment WHERE save_id=?', [saveId]);
  const [sssRows] = await pool.query("SELECT COUNT(*) AS cnt FROM talent WHERE save_id=? AND quality='SSS'", [saveId]);
  return {
    s,
    talentCount: talentRows[0].cnt,
    legendaryCount: legendaryRows[0].cnt,
    maxEnhance: enhanceRows[0].mx || 0,
    sssCount: sssRows[0].cnt
  };
}

function isAchieved(a, st) {
  if (a.check) return a.check(st.s);
  if (a.key === 'talent_5') return st.talentCount >= 5;
  if (a.key === 'sss_talent') return st.sssCount >= 1;
  if (a.key === 'legendary') return st.legendaryCount >= 1;
  if (a.key === 'enhance_20') return st.maxEnhance >= 20;
  return false;
}

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const st = await buildAchievementState(saveId);
    if (!st) return res.json({ code: 1, msg: '存档不存在' });

    const [claimedRows] = await pool.query('SELECT achievement_key FROM achievement WHERE save_id=? AND claimed=1', [saveId]);
    const claimedSet = new Set(claimedRows.map(r => r.achievement_key));

    const list = ACHIEVEMENTS.map(a => ({
      key: a.key, name: a.name, desc: a.desc,
      achieved: isAchieved(a, st),
      claimed: claimedSet.has(a.key),
      reward: a.reward
    }));

    res.json({ code: 0, list });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/claim', async (req, res) => {
  const { saveId, achievementKey } = req.body;
  try {
    const a = ACHIEVEMENTS.find(x => x.key === achievementKey);
    if (!a) return res.json({ code: 1, msg: '成就不存在' });

    const st = await buildAchievementState(saveId);
    if (!st) return res.json({ code: 1, msg: '存档不存在' });
    if (!isAchieved(a, st)) return res.json({ code: 1, msg: '尚未达成' });

    const [rows] = await pool.query('SELECT * FROM achievement WHERE save_id=? AND achievement_key=?', [saveId, achievementKey]);
    if (rows.length > 0 && rows[0].claimed === 1) return res.json({ code: 1, msg: '已领取' });

    const gold = a.reward.gold || 0;
    const soul = a.reward.soul || 0;
    await pool.query('UPDATE save SET gold = gold + ? WHERE id=?', [gold, saveId]);
    if (soul > 0) {
      const [saveRows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
      await pool.query('UPDATE user SET soul_fragment = soul_fragment + ? WHERE id=?', [soul, saveRows[0].user_id]);
    }

    if (rows.length > 0) await pool.query('UPDATE achievement SET claimed=1 WHERE id=?', [rows[0].id]);
    else await pool.query('INSERT INTO achievement (save_id, achievement_key, claimed) VALUES (?,?,1)', [saveId, achievementKey]);

    res.json({ code: 0, msg: '领取成功', reward: a.reward });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;