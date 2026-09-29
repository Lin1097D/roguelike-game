const express = require('express');
const router = express.Router();
const pool = require('../db');

const DAILY_TASKS = [
  { key: 'kill_100', name: '击杀 100 只怪', target: 100, reward: { gold: 1000 } },
  { key: 'kill_500', name: '击杀 500 只怪', target: 500, reward: { gold: 5000 } },
  { key: 'draw_1', name: '抽取 1 次天赋', target: 1, reward: { gold: 500 } },
  { key: 'enhance_3', name: '强化 3 次装备', target: 3, reward: { gold: 2000 } }
];

function getProgress(t, s) {
  if (t.key === 'kill_100' || t.key === 'kill_500') return s.daily_kill || 0;
  if (t.key === 'draw_1') return s.daily_draw || 0;
  if (t.key === 'enhance_3') return s.daily_enhance || 0;
  return 0;
}

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [saveRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (saveRows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = saveRows[0];

    const [dateRows] = await pool.query(
      'SELECT (last_daily IS NULL OR last_daily != CURDATE()) AS need_reset FROM save WHERE id=?', [saveId]
    );
    if (dateRows[0].need_reset === 1) {
      await pool.query('UPDATE save SET last_daily=CURDATE(), daily_kill=0, daily_draw=0, daily_enhance=0 WHERE id=?', [saveId]);
      await pool.query('UPDATE daily SET claimed=0 WHERE save_id=?', [saveId]);
      s.daily_kill = 0; s.daily_draw = 0; s.daily_enhance = 0;
    }

    const [claimedRows] = await pool.query('SELECT daily_key FROM daily WHERE save_id=? AND claimed=1', [saveId]);
    const claimedSet = new Set(claimedRows.map(r => r.daily_key));

    const list = DAILY_TASKS.map(t => {
      const progress = getProgress(t, s);
      return {
        key: t.key, name: t.name, target: t.target,
        progress: Math.min(progress, t.target),
        achieved: progress >= t.target,
        claimed: claimedSet.has(t.key),
        reward: t.reward
      };
    });

    res.json({ code: 0, list });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/claim', async (req, res) => {
  const { saveId, dailyKey } = req.body;
  try {
    const t = DAILY_TASKS.find(x => x.key === dailyKey);
    if (!t) return res.json({ code: 1, msg: '任务不存在' });

    const [saveRows] = await pool.query('SELECT * FROM save WHERE id=?', [saveId]);
    if (saveRows.length === 0) return res.json({ code: 1, msg: '存档不存在' });
    const s = saveRows[0];
    const progress = getProgress(t, s);
    if (progress < t.target) return res.json({ code: 1, msg: '任务未完成' });

    const [rows] = await pool.query('SELECT * FROM daily WHERE save_id=? AND daily_key=?', [saveId, dailyKey]);
    if (rows.length > 0 && rows[0].claimed === 1) return res.json({ code: 1, msg: '已领取' });

    await pool.query('UPDATE save SET gold = gold + ? WHERE id=?', [t.reward.gold || 0, saveId]);

    if (rows.length > 0) await pool.query('UPDATE daily SET claimed=1 WHERE id=?', [rows[0].id]);
    else await pool.query('INSERT INTO daily (save_id, daily_key, claimed) VALUES (?,?,1)', [saveId, dailyKey]);

    res.json({ code: 0, msg: '领取成功', reward: t.reward });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;