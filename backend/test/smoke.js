// ============================================================
// 冒烟测试：用内存 mock 数据库启动完整后端，跑核心业务闭环
// 运行：node backend/test/smoke.js
// ============================================================
const http = require('http');
const path = require('path');

// ---- 1. 用内存 mock 覆盖 db 模块的 query ----
const mockdb = require('./mockdb');
const dbPath = path.join(__dirname, '..', 'db.js');
const dbModule = require(dbPath);
dbModule.query = mockdb.query;
dbModule.getConnection = async () => ({ release() {} });

// ---- 2. 启动真实 app（Express 路由全部走 mock 数据库）----
process.env.PORT = '18081';
const app = require('../app');
const server = app.listen(18081, () => console.log('[smoke] 服务已启动 :18081'));

const BASE = 'http://127.0.0.1:18081/api';

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; console.log('  ❌ ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

async function api(path, method = 'GET', body = null) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opt);
  return res.json();
}

(async () => {
  try {
    console.log('\n===== 1. 注册 / 登录 / 初始存档 =====');
    let r = await api('/register', 'POST', { username: 'tester', password: '123456' });
    check('注册成功', r.code === 0 && r.userId === 1, r);
    const userId = r.userId;

    r = await api('/register', 'POST', { username: 'tester', password: '123456' });
    check('重复注册被拒', r.code === 1, r);

    r = await api('/login', 'POST', { username: 'tester', password: 'wrong' });
    check('错误密码被拒', r.code === 1, r);

    r = await api('/login', 'POST', { username: 'tester', password: '123456' });
    check('登录成功', r.code === 0, r);

    // 注册后先取角色列表（无角色时后端自动创建战士）
    r = await api('/role/' + userId, 'GET');
    check('自动创建战士角色', r.code === 0 && r.roles.length === 1 && r.currentSaveId === 1, r);

    r = await api('/save/' + userId);
    check('获取存档', r.code === 0 && Number(r.data.saveId) === 1, r);
    let saveId = Number(r.data.saveId);
    check('战士初始属性', r.data.hp === 150 && r.data.atk === 5, r.data);

    console.log('\n===== 2. 战斗 / 击杀 / 死亡 / 复活 =====');
    r = await api('/battle/kill', 'POST', { saveId, monsterType: 'normal', damage: 5, monsterName: '史莱姆' });
    check('击杀成功', r.code === 0 && r.data.kill_count === 1, r);
    check('击杀回血未超上限', r.data.hp <= r.data.max_hp, { hp: r.data.hp, max: r.data.max_hp });
    check('连杀计数更新', r.data.combo === 1 && r.data.max_combo === 1, r.data);

    r = await api('/battle/kill', 'POST', { saveId, monsterType: 'elite', damage: 8, monsterName: '精英哥布林' });
    check('精英击杀计数', r.code === 0 && r.data.elite_count === 1, r);

    // 死亡后禁止继续击杀（防死后刷怪）
    r = await api('/battle/hurt', 'POST', { saveId, damage: 999999 });
    check('大伤害致死', r.code === 0 && r.dead === true, r);
    r = await api('/battle/kill', 'POST', { saveId, monsterType: 'normal', damage: 5, monsterName: '史莱姆' });
    check('死后击杀被拒', r.code === 1, r);

    r = await api('/battle/revive', 'POST', { saveId });
    check('复活成功且清零', r.code === 0 && r.data.kill_count === 0 && r.data.hp > 0 && r.data.level === 1 && r.data.gold === 0, r);
    check('复活按击杀数折算灵魂(2杀*0.2=0)', r.gained === 0, r);
    check('复活后连杀清零', r.data.combo === 0, r.data);

    // 不死鸟每局一次（直接改天赋 + 触发）
    await api('/talent/draw', 'POST', { saveId });
    const tlist = await api('/talent/' + saveId);
    const phoenix = tlist.list && tlist.list.find(t => t.key === 's_phoenix');
    if (phoenix) {
      await api('/talent/activate', 'POST', { saveId, talentId: phoenix.id });
      r = await api('/battle/hurt', 'POST', { saveId, damage: 999999 });
      if (r.revived) {
        check('不死鸟触发复活', true, r);
        await api('/battle/hurt', 'POST', { saveId, damage: 999999 });
        r = await api('/battle/hurt', 'POST', { saveId, damage: 999999 });
        check('同局第二次不再触发（每局一次）', r.dead === true || r.revived === false, r);
      } else {
        check('不死鸟触发复活（随机）', r.revived === true, r);
      }
    } else {
      console.log('  (跳过：本次抽卡未抽到不死鸟)');
    }

    console.log('\n===== 3. 每日任务 / 成就领取校验 =====');
    r = await api('/daily/claim', 'POST', { saveId, dailyKey: 'kill_100' });
    check('未达成任务领取被拒', r.code === 1, r);

    r = await api('/achievement/claim', 'POST', { saveId, achievementKey: 'kill_10' });
    check('未达成成就领取被拒', r.code === 1, r);

    // 直接推进击杀数（走 kill 10 次太慢，直改数据库模拟）
    await mockdb.query('UPDATE save SET kill_count = 15, base_atk = base_atk + 15, base_max_hp = base_max_hp + 15 WHERE id = ?', [saveId]);
    r = await api('/achievement/claim', 'POST', { saveId, achievementKey: 'kill_10' });
    check('达成后可领取成就', r.code === 0, r);
    r = await api('/achievement/claim', 'POST', { saveId, achievementKey: 'kill_10' });
    check('重复领取被拒', r.code === 1, r);

    // 每日任务进度（kill 15 -> kill_100 仍未达成）
    r = await api('/daily/claim', 'POST', { saveId, dailyKey: 'kill_500' });
    check('每日 500 杀未达成被拒', r.code === 1, r);

    console.log('\n===== 4. BOSS / 副本防刷 =====');
    r = await api('/boss/finish', 'POST', { saveId, bossKey: 'lava', win: true });
    check('未开始直接结算被拒', r.code === 1, r);

    r = await api('/boss/start', 'POST', { saveId, bossKey: 'lava' });
    check('BOSS 开始挑战', r.code === 0 && r.boss, r);
    r = await api('/boss/finish', 'POST', { saveId, bossKey: 'lava', win: true });
    check('开始后胜利结算', r.code === 0 && r.win === true, r);
    r = await api('/boss/finish', 'POST', { saveId, bossKey: 'lava', win: true });
    check('重复结算被拒（防刷）', r.code === 1, r);

    r = await api('/dungeon/finish', 'POST', { saveId, dungeonKey: 'cave', win: true, killed: 5 });
    check('副本未开始直接结算被拒', r.code === 1, r);
    r = await api('/dungeon/start', 'POST', { saveId, dungeonKey: 'cave' });
    check('副本开始', r.code === 0 && r.dungeon, r);
    r = await api('/dungeon/finish', 'POST', { saveId, dungeonKey: 'cave', win: true, killed: 5 });
    check('副本胜利结算', r.code === 0 && r.win === true, r);
    r = await api('/dungeon/finish', 'POST', { saveId, dungeonKey: 'cave', win: true, killed: 5 });
    check('副本重复结算被拒（防刷）', r.code === 1, r);

    console.log('\n===== 5. 签到 =====');
    r = await api('/signin/do', 'POST', { saveId });
    check('首次签到成功', r.code === 0 && r.streak === 1, r);
    r = await api('/signin/do', 'POST', { saveId });
    check('同日重复签到被拒', r.code === 1, r);

    console.log('\n===== 6. 角色管理（userId 正确性）=====');
    r = await api('/role/1', 'GET');
    check('获取角色列表（自动创建战士）', r.code === 0 && r.roles.length === 1, r);
    r = await api('/role/create', 'POST', { userId, roleKey: 'mage', roleName: '测试法师' });
    check('创建第二角色', r.code === 0, r);
    r = await api('/role/create', 'POST', { userId, roleKey: 'mage', roleName: '测试法师' });
    check('重名角色被拒', r.code === 1, r);
    r = await api('/role/create', 'POST', { userId, roleKey: 'mage', roleName: '' });
    check('空角色名被拒', r.code === 1, r);
    r = await api('/role/1', 'GET');
    check('角色列表 2 个', r.code === 0 && r.roles.length === 2, r);
    const newSaveId = r.roles.find(x => x.role_name === '测试法师').save_id;
    r = await api('/role/switch', 'POST', { userId, saveId: newSaveId });
    check('切换角色', r.code === 0, r);
    r = await api('/save/' + userId);
    check('切换后当前存档变化', r.data.saveId === newSaveId, r.data);

    console.log('\n===== 7. 装备 / 洗练 / 导入 =====');
    r = await api('/equipment/' + saveId, 'GET');
    check('装备列表可读', r.code === 0, r);

    // 装备掉落验证
    r = await api('/battle/kill', 'POST', { saveId, monsterType: 'normal', damage: 5, monsterName: '史莱姆' });
    check('再次击杀正常', r.code === 0, r);

    // 存档导入校验（数值钳制）
    r = await api('/save/import', 'POST', {
      saveId: newSaveId,
      data: { save: { hp: -5, level: 9999, gold: 999999999, atk: 10, max_hp: 50, mp: 10, max_mp: 30,
        crit_rate: 9, dodge_rate: -3, kill_count: 50, base_atk: 5, base_max_hp: 50, base_max_mp: 20,
        base_crit_rate: 0.05, base_dodge_rate: 0.03, free_points: 1, exp: 0, elite_count: 0, boss_count: 0,
        jieli: 0, skill_points: 0, total_skill_points: 0 } }
    });
    check('导入接口接受（数值被钳制）', r.code === 0, r);
    r = await api('/save/' + userId);
    check('导入后 level 被钳制到 100', r.data.level === 100, r.data);
    check('导入后 hp 被钳制到 0 以上', r.data.hp >= 0 && r.data.hp <= 1e9, r.data);
    check('导入后 crit_rate 被钳制到 0.95', r.data.crit_rate === 0.95, r.data);

    console.log('\n===== 8. 统计 / 排行 / 公告 =====');
    r = await api('/stats/' + saveId, 'GET');
    check('统计接口正常', r.code === 0, r);
    r = await api('/rank/kill', 'GET');
    check('排行接口正常', r.code === 0 && Array.isArray(r.list), r);
    r = await api('/announcement/recent', 'GET');
    check('公告接口正常', r.code === 0, r);

    console.log(`\n========== 结果：${passed} 通过 / ${failed} 失败 ==========`);
  } catch (e) {
    console.error('\n[smoke] 测试异常：', e);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
})();
