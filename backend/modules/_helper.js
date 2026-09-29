const pool = require('../db');

async function getUserIdBySaveId(saveId) {
  const [rows] = await pool.query('SELECT user_id FROM save WHERE id=?', [saveId]);
  if (rows.length === 0) return null;
  return rows[0].user_id;
}

async function getCurrentSaveId(userId) {
  const [rows] = await pool.query('SELECT current_save_id FROM user WHERE id=?', [userId]);
  if (rows.length === 0 || !rows[0].current_save_id) return null;
  return rows[0].current_save_id;
}

module.exports = { getUserIdBySaveId, getCurrentSaveId };