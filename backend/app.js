require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const userRouter = require('./modules/user');
const saveRouter = require('./modules/save');
const battleRouter = require('./modules/battle');
const equipmentApiRouter = require('./modules/equipment_api');
const talentRouter = require('./modules/talent');
const shopRouter = require('./modules/shop');
const announcementRouter = require('./modules/announcement');
const achievementRouter = require('./modules/achievement');
const dailyRouter = require('./modules/daily');
const rebirthRouter = require('./modules/rebirth');
const signinRouter = require('./modules/signin');
const rankRouter = require('./modules/rank');
const statisticsRouter = require('./modules/statistics');
const monsterRouter = require('./modules/monster');
const bossRouter = require('./modules/boss');
const skillRouter = require('./modules/skill');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api', userRouter);
app.use('/api/save', saveRouter);
app.use('/api/battle', battleRouter);
app.use('/api/equipment', equipmentApiRouter);
app.use('/api/talent', talentRouter);
app.use('/api/shop', shopRouter);
app.use('/api/announcement', announcementRouter);
app.use('/api/achievement', achievementRouter);
app.use('/api/daily', dailyRouter);
app.use('/api/rebirth', rebirthRouter);
app.use('/api/signin', signinRouter);
app.use('/api/rank', rankRouter);
app.use('/api/stats', statisticsRouter);
app.use('/api/monster', monsterRouter);
app.use('/api/boss', bossRouter);
app.use('/api/skill', skillRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});