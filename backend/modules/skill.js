const express = require('express');
const router = express.Router();
const pool = require('../db');
const { SKILLS } = require('../config/skills');

router.get('/:saveId', async (req, res) => {
  const { saveId } = req.params;
  try {
    const [saveRows] = await pool.query('SELECT skill_points, total_skill_points FROM save WHERE id=?', [saveId]);
    const [rows] = await pool.query('SELECT skill_key, level FROM skill WHERE save_id=?', [saveId]);
    const learned = {};
    for (const r of rows) learned[r.skill_key] = r.level;
    res.json({ code: 0, skillPoints: saveRows[0].skill_points || 0, totalSkillPoints: saveRows[0].total_skill_points || 0, learned, skills: SKILLS });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

router.post('/learn', async (req, res) => {
  const { saveId, skillKey } = req.body;
  try {
    const skill = SKILLS.find(s => s.key === skillKey);
    if (!skill) return res.json({ code: 1, msg: '技能不存在' });

    const [saveRows] = await pool.query('SELECT skill_points FROM save WHERE id=?', [saveId]);
    if ((saveRows[0].skill_points || 0) < 1) return res.json({ code: 1, msg: '技能点不足' });

    if (skill.need) {
      const [needRows] = await pool.query('SELECT level FROM skill WHERE save_id=? AND skill_key=?', [saveId, skill.need]);
      const needLevel = needRows.length > 0 ? needRows[0].level : 0;
      const needSkill = SKILLS.find(s => s.key === skill.need);
      if (needLevel < needSkill.max) return res.json({ code: 1, msg: `前置技能【${needSkill.name}】需要满级` });
    }

    const [curRows] = await pool.query('SELECT level FROM skill WHERE save_id=? AND skill_key=?', [saveId, skillKey]);
    const curLevel = curRows.length > 0 ? curRows[0].level : 0;
    if (curLevel >= skill.max) return res.json({ code: 1, msg: '技能已满级' });

    if (curRows.length > 0) await pool.query('UPDATE skill SET level = level + 1 WHERE save_id=? AND skill_key=?', [saveId, skillKey]);
    else await pool.query('INSERT INTO skill (save_id, skill_key, level) VALUES (?,?,1)', [saveId, skillKey]);

    await pool.query('UPDATE save SET skill_points = skill_points - 1 WHERE id=?', [saveId]);
    const stats = require('./stats');
    const newSave = await stats.recalcAndSave(saveId);
    res.json({ code: 0, msg: '升级成功', newLevel: curLevel + 1, save: newSave });
  } catch (e) { res.json({ code: 1, msg: e.message }); }
});

module.exports = router;