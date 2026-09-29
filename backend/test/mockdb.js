// ============================================================
// 内存数据库 Mock —— 仅用于本地冒烟测试
// 覆盖本项目用到的 SQL 子集（INSERT/SELECT/UPDATE/DELETE/简单JOIN/聚合）
// 占位符约定与 mysql2 一致：? 按 SQL 文本顺序对应参数数组
//（SET/VALUES 参数在前，WHERE 参数在尾部）
// ============================================================

function nowStr() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_SAVE = {
  role_key: 'warrior',
  hp: 100, max_hp: 100, atk: 1, mp: 50, max_mp: 50,
  crit_rate: 0.05, dodge_rate: 0.03, drain: 0, gold_bonus: 0,
  base_atk: 1, base_max_hp: 100, base_max_mp: 50,
  base_crit_rate: 0.05, base_dodge_rate: 0.03,
  kill_count: 0, elite_count: 0, boss_count: 0, gold: 0, jieli: 0,
  level: 1, exp: 0, free_points: 0, skill_points: 0, total_skill_points: 0, draw_count: 0,
  total_damage: 0, total_damage_taken: 0, max_combo: 0, combo: 0, play_time: 0, death_count: 0,
  daily_kill: 0, daily_draw: 0, daily_enhance: 0, last_daily: null,
  sign_streak: 0, last_sign: null, last_online: null,
  rebirth_count: 0, rebirth_points: 0,
  boss_challenge_count: 0, boss_challenge_date: null,
  dungeon_count: 0, dungeon_date: null,
  active_boss_key: null, active_dungeon_key: null, phoenix_used: 0
};

function makeRow(table, vals) {
  const row = { id: nextId(table) };
  if (table === 'save') Object.assign(row, DEFAULT_SAVE);
  else Object.assign(row, DEFAULT_ROW[table] || {});
  Object.assign(row, vals);
  row.created_at = row.created_at || nowStr();
  return row;
}

const DEFAULT_ROW = {
  user: { username: '', password: '', current_save_id: null, soul_fragment: 0 },
  role: { user_id: 0, role_key: '', role_name: '', save_id: 0 },
  equipment: { save_id: 0, slot: '', name: '', quality: 'common', stat_value: 0, affixes: null, set_name: null, enhance_level: 0, equipped: 0 },
  talent: { save_id: 0, talent_key: '', quality: 'D', stacks: 1, active: 0 },
  skill: { save_id: 0, skill_key: '', level: 1 },
  achievement: { save_id: 0, achievement_key: '', claimed: 0 },
  daily: { save_id: 0, daily_key: '', claimed: 0 },
  monster_log: { save_id: 0, monster_name: '', monster_type: 'normal', kill_count: 0 },
  boss_challenge_log: { save_id: 0, boss_key: '', result: '' },
  dungeon_log: { save_id: 0, dungeon_key: '', result: '', killed: 0 },
  announcement: { message: '' }
};

let idCounters = {};
function nextId(table) { idCounters[table] = (idCounters[table] || 0) + 1; return idCounters[table]; }

const tables = {};
function table(name) {
  if (!tables[name]) tables[name] = {};
  return tables[name];
}

// ---------- WHERE 解析（getParam：每次出现 ? 时调用，按 SQL 文本顺序取参） ----------
function parseWhere(whereSql, getParam) {
  // 去掉表别名前缀（本项目用到的 s. / r.），统一按列名处理
  whereSql = whereSql.replace(/\b(?:s|r)\.(\w+)/g, '$1');
  const conditions = [];
  const parts = whereSql.split(/\s+AND\s+/i);
  for (let part of parts) {
    part = part.trim();
    let m;

    if ((m = part.match(/^(\w+)\s*=\s*\?$/))) { const v = getParam(); conditions.push(r => r[m[1]] == v); continue; }
    if ((m = part.match(/^(\w+)\s*!=\s*\?$/))) { const v = getParam(); conditions.push(r => r[m[1]] != v); continue; }
    if ((m = part.match(/^(\w+)\s*=\s*(-?\d+(?:\.\d+)?)$/))) { conditions.push(r => r[m[1]] == Number(m[2])); continue; }
    if ((m = part.match(/^(\w+)\s*=\s*'([^']*)'$/))) { conditions.push(r => String(r[m[1]]) === m[2]); continue; }
    if ((m = part.match(/^(\w+)\s*>\s*\?$/))) { const v = getParam(); conditions.push(r => r[m[1]] > v); continue; }
    if ((m = part.match(/^(\w+)\s*<\s*\?$/))) { const v = getParam(); conditions.push(r => r[m[1]] < v); continue; }
    if ((m = part.match(/^(\w+)\s*IS\s+NULL$/i))) { conditions.push(r => r[m[1]] == null); continue; }
    if ((m = part.match(/^(\w+)\s*IS\s+NOT\s+NULL$/i))) { conditions.push(r => r[m[1]] != null); continue; }
    if ((m = part.match(/^(\w+)\s*IN\s*\(([^)]*)\)$/i))) {
      const list = m[2].split(',').map(x => x.trim().replace(/^'|'$/g, ''));
      const isQ = list.some(x => x === '?');
      if (isQ) {
        const vals = getParam();
        const arr = Array.isArray(vals) ? vals : [vals];
        conditions.push(r => arr.includes(r[m[1]]));
      } else {
        conditions.push(r => list.includes(String(r[m[1]])));
      }
      continue;
    }
    if ((m = part.match(/^(\w+)\s+NOT\s+IN\s*\(([^)]*)\)$/i))) {
      const list = m[2].split(',').map(x => x.trim().replace(/^'|'$/g, ''));
      const isQ = list.some(x => x === '?');
      if (isQ) {
        const vals = getParam();
        const arr = Array.isArray(vals) ? vals : [vals];
        conditions.push(r => !arr.includes(r[m[1]]));
      } else {
        conditions.push(r => !list.includes(String(r[m[1]])));
      }
      continue;
    }
    throw new Error('mock WHERE 无法解析: ' + part);
  }
  return row => conditions.every(fn => fn(row));
}

// ---------- 表达式解析（UPDATE SET 右侧 / SELECT 列） ----------
function evalExpr(expr, row, getParam) {
  expr = expr.trim();
  if (expr === '?') return getParam();
  if (expr === 'NOW()') return nowStr();
  if (expr === 'CURDATE()') return todayStr();
  if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);   // 数字字面量优先于列引用
  if (expr === 'NULL' || expr === 'null') return null;
  let m;
  if ((m = expr.match(/^(\w+)\s*\+\s*\?$/))) { const v = getParam(); return (row[m[1]] || 0) + v; }
  if ((m = expr.match(/^(\w+)\s*-\s*\?$/))) { const v = getParam(); return (row[m[1]] || 0) - v; }
  if ((m = expr.match(/^(\w+)\s*\+\s*(-?\d+(?:\.\d+)?)$/))) { const v = row[m[1]] || 0; return v + Number(m[2]); }
  if ((m = expr.match(/^(\w+)\s*-\s*(-?\d+(?:\.\d+)?)$/))) { const v = row[m[1]] || 0; return v - Number(m[2]); }
  if ((m = expr.match(/^(\w+)$/))) return row[m[1]];
  if ((m = expr.match(/^LEAST\((.+)\)$/i))) {
    const inner = m[1].split(',').map(x => x.trim());
    const vals = inner.map(x => {
      if (x === '?') return getParam();
      if (/^\w+$/.test(x)) return row[x];
      if (/^\w+\s*\+\s*\?\s*\+\s*\?$/.test(x)) {
        const mm = x.match(/^(\w+)\s*\+\s*\?\s*\+\s*\?$/);
        return (row[mm[1]] || 0) + getParam() + getParam();
      }
      if (/^\w+\s*\+\s*\?$/.test(x)) {
        const mm = x.match(/^(\w+)\s*\+\s*\?$/);
        return (row[mm[1]] || 0) + getParam();
      }
      return Number(x);
    });
    return Math.min(...vals);
  }
  throw new Error('mock expr 无法解析: ' + expr);
}

// 按顶层逗号分割（跳过括号内的逗号，如 LEAST(max_hp, hp + ? + ?)）
function splitTopLevel(str, sep = ',') {
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

// 从参数数组尾部取出 WHERE 参数（保持原顺序）
// mysql2 中 WHERE 的 ? 位于参数数组末尾，按 SQL 文本顺序排列
function takeWhereParams(params, whereSql) {
  const count = (whereSql.match(/\?/g) || []).length;
  return params.splice(params.length - count);
}

// ---------- 主入口 ----------
async function query(sql, params) {
  params = params || [];
  sql = sql.replace(/\s+/g, ' ').trim();

  // ===== INSERT =====
  let m = sql.match(/^INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(.*)$/i);
  if (m) {
    const tname = m[1];
    const cols = m[2].split(',').map(c => c.trim());
    const placeholders = m[3].split(',').map(c => c.trim());
    const onDup = m[4];
    const vals = {};
    let pi = 0;
    placeholders.forEach((p, i) => {
      if (p === '?') { vals[cols[i]] = params[pi++]; }
      else {
        const v = p.replace(/^'|'$/g, '');
        // 数字字面量转 Number，保证 claimed=1 / equipped=0 等 === 比较正确
        vals[cols[i]] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      }
    });
    const tbl = table(tname);

    if (onDup && /ON DUPLICATE KEY UPDATE/i.test(onDup)) {
      const dup = Object.values(tbl).find(r => r.save_id == vals.save_id && r.monster_name == vals.monster_name);
      if (dup) {
        const updM = onDup.match(/UPDATE (\w+)\s*=\s*(\w+)\s*\+\s*\?/i);
        if (updM) dup[updM[1]] = (dup[updM[1]] || 0) + params[pi++];
        return [{ affectedRows: 1, insertId: dup.id }, []];
      }
    }

    const row = makeRow(tname, vals);
    tbl[row.id] = row;
    return [{ affectedRows: 1, insertId: row.id }, []];
  }

  // ===== SELECT =====
  m = sql.match(/^SELECT\s+(.+?)\s+FROM\s+(.+?)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
  if (m) {
    const selCols = m[1];
    const fromPart = m[2];
    const whereSql = m[3] || '';
    const orderSql = m[4] || '';
    const limit = m[5] ? Number(m[5]) : 0;

    // JOIN：rank（save s JOIN role r）与角色列表（role r LEFT JOIN save s）
    if (/JOIN/i.test(fromPart)) {
      const jm = fromPart.match(/^(\w+)\s+s\s+JOIN\s+(\w+)\s+r\s+ON\s+s\.(\w+)\s*=\s*r\.(\w+)$/i);
      if (jm) {
        const rows = [];
        for (const r of Object.values(table('role'))) {
          const s = table('save')[r.save_id];
          if (s) rows.push({
            username: r.role_name, level: s.level, atk: s.atk, kill_count: s.kill_count,
            exp: s.exp
          });
        }
        if (orderSql) {
          const om = orderSql.match(/^(\w+\.)?(\w+)\s+(ASC|DESC)$/i);
          if (om) {
            const key = om[2];
            const dir = om[3].toUpperCase() === 'ASC' ? 1 : -1;
            rows.sort((a, b) => (a[key] - b[key]) * dir);
          }
        }
        if (limit) rows.length = Math.min(rows.length, limit);
        return [rows, []];
      }

      const rj = fromPart.match(/^(\w+)\s+r\s+LEFT\s+JOIN\s+(\w+)\s+s\s+ON\s+r\.(\w+)\s*=\s*s\.(\w+)$/i);
      if (rj) {
        const whereParams = takeWhereParams(params, whereSql.replace(/[rs]\./g, ''));
        const whereFn = whereSql ? parseWhere(whereSql.replace(/r\./g, '').replace(/s\./g, ''), () => whereParams.shift()) : null;
        const rows = [];
        for (const r of Object.values(table('role'))) {
          const s = table('save')[r.save_id];
          if (whereFn && !whereFn(r)) continue;
          rows.push({
            id: r.id, role_key: r.role_key, role_name: r.role_name, save_id: r.save_id,
            level: s ? s.level : null, atk: s ? s.atk : null, kill_count: s ? s.kill_count : null
          });
        }
        return [rows, []];
      }

      // user u JOIN save s（统计接口取注册时间）
      const uj = fromPart.match(/^(\w+)\s+u\s+JOIN\s+(\w+)\s+s\s+ON\s+s\.(\w+)\s*=\s*u\.(\w+)$/i);
      if (uj) {
        const whereParams = takeWhereParams(params, whereSql.replace(/[su]\./g, ''));
        const whereFn = whereSql ? parseWhere(whereSql.replace(/s\./g, '').replace(/u\./g, ''), () => whereParams.shift()) : null;
        const rows = [];
        for (const sv of Object.values(table('save'))) {
          if (whereFn && !whereFn(sv)) continue;
          const u = table('user')[sv.user_id];
          if (u) rows.push({ created_at: u.created_at });
        }
        return [rows, []];
      }
    }

    const tname = fromPart.trim();
    const tbl = table(tname);
    const whereParams = takeWhereParams(params, whereSql);
    const whereFn = whereSql ? parseWhere(whereSql, () => whereParams.shift()) : null;
    let rows = Object.values(tbl).filter(r => !whereFn || whereFn(r));

    if (orderSql) {
      const sorts = orderSql.split(',').map(p => p.trim()).map(part => {
        const pm = part.match(/^(\w+\.)?(\w+)\s+(ASC|DESC)$/i);
        return { key: pm[2], dir: pm[3].toUpperCase() === 'ASC' ? 1 : -1 };
      });
      rows.sort((a, b) => {
        for (const s of sorts) {
          const av = a[s.key], bv = b[s.key];
          if (av == null && bv == null) continue;
          if (av == null) return 1 * s.dir;
          if (bv == null) return -1 * s.dir;
          if (av < bv) return -1 * s.dir;
          if (av > bv) return 1 * s.dir;
        }
        return 0;
      });
    }
    if (limit) rows = rows.slice(0, limit);

    if (/COUNT\s*\(\*/i.test(selCols)) {
      const cm = selCols.match(/COUNT\s*\(\*\)\s+AS\s+(\w+)/i);
      if (cm) return [[{ [cm[1]]: rows.length }], []];
    }
    if (/MAX\(/i.test(selCols)) {
      const mm = selCols.match(/MAX\((\w+)\)\s+AS\s+(\w+)/i);
      if (mm) {
        const vals = rows.map(r => r[mm[1]]).filter(v => v != null);
        return [[{ [mm[2]]: vals.length ? Math.max(...vals) : null }], []];
      }
    }

    const boolAlias = sql.match(/AS\s+(need_reset|signed_today|signed_yesterday)/i);
    if (boolAlias) {
      const alias = boolAlias[1];
      const row = rows[0];
      let val = 0;
      if (alias === 'need_reset') val = (row.last_daily == null || String(row.last_daily).slice(0, 10) !== todayStr()) ? 1 : 0;
      if (alias === 'signed_today') val = row.last_sign == todayStr() ? 1 : 0;
      if (alias === 'signed_yesterday') val = row.last_sign == yesterdayStr() ? 1 : 0;
      return [[{ [alias]: val }], []];
    }

    if (selCols === '*') return [rows, []];
    const cols = selCols.split(',').map(c => c.trim().replace(/^(\w+\.)?(\w+)$/, '$2'));
    return [rows.map(r => { const o = {}; cols.forEach(c => { o[c] = r[c]; }); return o; }), []];
  }

  // ===== UPDATE =====
  m = sql.match(/^UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
  if (m) {
    const tname = m[1];
    const setSql = m[2];
    const whereSql = m[3];
    const tbl = table(tname);
    // WHERE 参数在数组尾部，先取出；剩余参数按 SET 顺序从头部消费
    const whereParams = takeWhereParams(params, whereSql);
    const whereFn = parseWhere(whereSql, () => whereParams.shift());
    let affected = 0;
    const setParts = splitTopLevel(setSql).map(p => p.trim());
    for (const row of Object.values(tbl)) {
      if (!whereFn(row)) continue;
      for (const part of setParts) {
        const pm = part.match(/^(\w+)\s*=\s*(.+)$/);
        if (!pm) throw new Error('mock SET 无法解析: ' + part);
        row[pm[1]] = evalExpr(pm[2], row, () => params.shift());
      }
      row.updated_at = row.updated_at || nowStr();
      affected++;
    }
    return [{ affectedRows: affected }, []];
  }

  // ===== DELETE =====
  m = sql.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (m) {
    const tname = m[1];
    const tbl = table(tname);
    const whereSql = m[2] || '';
    const whereParams = takeWhereParams(params, whereSql);
    const whereFn = whereSql ? parseWhere(whereSql, () => whereParams.shift()) : null;
    let affected = 0;
    for (const id of Object.keys(tbl)) {
      if (!whereFn || whereFn(tbl[id])) { delete tbl[id]; affected++; }
    }
    return [{ affectedRows: affected }, []];
  }

  throw new Error('mock 无法解析 SQL: ' + sql);
}

module.exports = { query };
