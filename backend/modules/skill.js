const express = require('express');
const router = express.Router();
const pool = require('../db');
const { SKILLS } = require('../config/skills');

// 查询技能
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const [saveRows] = await pool.query('SELECT skill_points, total_skill_points FROM save WHERE user_id=?', [userId]);
    const [rows] = await pool.query('SELECT skill_key, level FROM skill WHERE user_id=?', [userId]);
    const learned = {};
    for (const r of rows) learned[r.skill_key] = r.level;

    res.json({
      code: 0,
      skillPoints: saveRows[0].skill_points || 0,
      totalSkillPoints: saveRows[0].total_skill_points || 0,
      learned,
      skills: SKILLS
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

// 学习/升级技能
router.post('/learn', async (req, res) => {
  const { userId, skillKey } = req.body;
  try {
    const skill = SKILLS.find(s => s.key === skillKey);
    if (!skill) return res.json({ code: 1, msg: '技能不存在' });

    // 检查技能点
    const [saveRows] = await pool.query('SELECT skill_points FROM save WHERE user_id=?', [userId]);
    if ((saveRows[0].skill_points || 0) < 1) {
      return res.json({ code: 1, msg: '技能点不足' });
    }

    // 检查前置技能
    if (skill.need) {
      const [needRows] = await pool.query(
        'SELECT level FROM skill WHERE user_id=? AND skill_key=?',
        [userId, skill.need]
      );
      const needLevel = needRows.length > 0 ? needRows[0].level : 0;
      const needSkill = SKILLS.find(s => s.key === skill.need);
      if (needLevel < needSkill.max) {
        return res.json({ code: 1, msg: `前置技能【${needSkill.name}】需要满级` });
      }
    }

    // 检查当前等级
    const [curRows] = await pool.query(
      'SELECT level FROM skill WHERE user_id=? AND skill_key=?',
      [userId, skillKey]
    );
    const curLevel = curRows.length > 0 ? curRows[0].level : 0;
    if (curLevel >= skill.max) {
      return res.json({ code: 1, msg: '技能已满级' });
    }

    // 升级
    if (curRows.length > 0) {
      await pool.query('UPDATE skill SET level = level + 1 WHERE user_id=? AND skill_key=?', [userId, skillKey]);
    } else {
      await pool.query('INSERT INTO skill (user_id, skill_key, level) VALUES (?,?,1)', [userId, skillKey]);
    }

    // 扣技能点
    await pool.query('UPDATE save SET skill_points = skill_points - 1 WHERE user_id=?', [userId]);

    // 重算属性
    const stats = require('./stats');
    const newSave = await stats.recalcAndSave(userId);

    res.json({
      code: 0,
      msg: '升级成功',
      newLevel: curLevel + 1,
      save: newSave
    });
  } catch (e) {
    res.json({ code: 1, msg: e.message });
  }
});

module.exports = router;