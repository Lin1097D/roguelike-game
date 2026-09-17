// const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//   host: 'localhost',
//   user: 'root',
//   password: 'Admin123',   // ← 改成你自己重置后的密码
//   database: 'roguelike',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });
// const mysql = require('mysql2/promise');

// const pool = mysql.createPool({
//   host: 'rm-bp1zuf87qt168qhx3no.mysql.rds.aliyuncs.com',
//   port: 3306,
//   user: 'roguelike_LinSheng',
//   password: '5845201314_Dls',
//   database: 'roguelike',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// module.exports = pool;

const mysql = require('mysql2/promise');
const pool = mysql.createPool(process.env.DATABASE_URL);

module.exports = pool;