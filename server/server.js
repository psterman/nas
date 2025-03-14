// 步骤1：添加用户管理所需的依赖和数据结构
const express = require('express');
const cors = require('cors');
//
步骤2：添加用户认证功能
const fs = require('fs');
const express = require('express'); const cors = require('cors'); const fileService = require('./file-service'); const app = express(); app.use(cors()); app.use(express.json()); app.use('/api', fileService); const PORT = process.env.PORT || 3000; app.listen(PORT, () => { console.log(Server running on port ); });
