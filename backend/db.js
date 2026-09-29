const mysql = require('mysql2/promise');

function buildPoolConfig() {
  // 1. 优先用完整 URL（Railway 的 MYSQL_URL，或者你本地自建的 DATABASE_URL）
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (url) {
    return url;
  }

  // 2. 拆开的变量（Railway 默认给的就是这种）
  const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
  const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
  const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME || 'roguelike';

  return {
    host, port, user, password, database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  };
}

const pool = mysql.createPool(buildPoolConfig());

// 启动时自检一次，报错更清晰
pool.query('SELECT 1')
  .then(() => console.log('[DB] 数据库连接成功'))
  .catch(err => {
    console.error('[DB] 数据库连接失败：', err.message);
    console.error('[DB] 请检查 .env 里的 MYSQLHOST / MYSQLUSER / MYSQLPASSWORD / MYSQLDATABASE');
  });

module.exports = pool;