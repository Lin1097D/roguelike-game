const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const userRouter = require('./modules/user');
const saveRouter = require('./modules/save');
const battleRouter = require('./modules/battle');
const equipmentApiRouter = require('./modules/equipment_api');
const talentRouter = require('./modules/talent');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api', userRouter);
app.use('/api/save', saveRouter);
app.use('/api/battle', battleRouter);
app.use('/api/equipment', equipmentApiRouter);
app.use('/api/talent', talentRouter);
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});