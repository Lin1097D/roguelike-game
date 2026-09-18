const express = require('express');
const router = express.Router();
const pool = require('../db');
const config = require('../config/gameConfig');
const stats = require('./stats');

function rollQuality() {
  const rate = config.talent.qualityRate;
  const r = Math.random();
  let cum = 0;
  for (const q of ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS']) {
    cum += rate[q];
    if (r < cum) return q;
  }
  return 'D';
}

function rollTalent(quality) {
  const pool = config.talent.pool[quality];
  return pool[Math.floor(Math.random() * pool.length)];
}

// 查询玩家天赋
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM talent WHERE user_id=? ORDER BY active DESC, quality DESC, created_at DESC',
      [userId]
    );
    const list = rows.map(r => {
      const pool = config.talent.pool[r.quality] || [];
      const info = pool.find(t => t.key === r.talent_key);
      return {
        id: r.id,
        key: r.talent_key,
        quality: r.quality,
        stacks: r.stacks,
        active: r.active === 1,
        name: info ? info.name : r.talent_key,
        desc: info ? info.desc : '',
        effect: info ? info.effect : null
      };
    });
    res.json({ code: 0, list });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 抽一次
router.post('/draw', async (req, res) => {
  const { userId } = req.body;
  try {
    const [saveRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = saveRows[0];
    const cost = config.talent.drawCost;

    if (s.gold < cost) return res.json({ code: 1, msg: '金币不足' });

    await pool.query(
      'UPDATE save SET gold = gold - ?, draw_count = draw_count + 1, daily_draw = daily_draw + 1 WHERE user_id=?',
      [cost, userId]
    );

    const quality = rollQuality();
    const talent = rollTalent(quality);

    const [owned] = await pool.query(
      'SELECT * FROM talent WHERE user_id=? AND talent_key=?',
      [userId, talent.key]
    );

    let result;
    if (owned.length > 0) {
      const refund = config.talent.refundPoints[quality] || 1;
      await pool.query('UPDATE save SET free_points = free_points + ? WHERE user_id=?',
        [refund, userId]);
      await pool.query('UPDATE talent SET stacks = stacks + 1 WHERE id=?', [owned[0].id]);
      result = { duplicate: true, quality, name: talent.name, desc: talent.desc, refund };
    } else {
      const [activeRows] = await pool.query(
        'SELECT id FROM talent WHERE user_id=? AND active=1', [userId]
      );
      const shouldActivate = activeRows.length === 0 ? 1 : 0;

      await pool.query(
        'INSERT INTO talent (user_id, talent_key, quality, stacks, active) VALUES (?,?,?,1,?)',
        [userId, talent.key, quality, shouldActivate]
      );
      result = {
        duplicate: false,
        quality,
        name: talent.name,
        desc: talent.desc,
        autoActivated: shouldActivate === 1
      };
    }

    // ============ 抽到 SS / SSS 时发公告 ============
    if (quality === 'SSS' || quality === 'SS') {
      try {
        const [userRows] = await pool.query('SELECT username FROM user WHERE id=?', [userId]);
        const username = userRows.length > 0 ? userRows[0].username : '神秘玩家';
        const msg = `🌟 恭喜玩家【${username}】抽到了 ${quality} 级天赋【${talent.name}】！`;
        await pool.query('INSERT INTO announcement (message) VALUES (?)', [msg]);
      } catch (e) {
        // 公告发失败不影响抽卡
        console.log('[公告] 发送失败:', e.message);
      }
    }

    await stats.recalcAndSave(userId);
    const [newSave] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({ code: 0, result, save: newSave });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 激活天赋
router.post('/activate', async (req, res) => {
  const { userId, talentId } = req.body;
  try {
    await pool.query('UPDATE talent SET active=0 WHERE user_id=?', [userId]);
    await pool.query('UPDATE talent SET active=1 WHERE id=? AND user_id=?', [talentId, userId]);
    await stats.recalcAndSave(userId);
    const [newSave] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({ code: 0, msg: '切换成功', save: newSave });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 分配自由属性点
router.post('/allocate', async (req, res) => {
  const { userId, stat, amount } = req.body;
  try {
    if (!['atk', 'max_hp', 'max_mp'].includes(stat)) {
      return res.json({ code: 1, msg: '无效的属性' });
    }
    const [saveRows] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    const s = saveRows[0];
    if (s.free_points < amount) return res.json({ code: 1, msg: '自由属性点不足' });

    const baseField = stat === 'atk' ? 'base_atk'
                    : stat === 'max_hp' ? 'base_max_hp'
                    : 'base_max_mp';

    await pool.query(
      `UPDATE save SET ${baseField} = ${baseField} + ?, free_points = free_points - ? WHERE user_id=?`,
      [amount, amount, userId]
    );
    await stats.recalcAndSave(userId);
    const [newSave] = await pool.query('SELECT * FROM save WHERE user_id=?', [userId]);
    res.json({ code: 0, save: newSave });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;