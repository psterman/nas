const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 创建Express应用
const app = express();
const PORT = 3001; // 使用不同的端口，避免与主服务器冲突

// JWT密钥
const JWT_SECRET = 'your-secret-key';

// 调试日志函数
function debugLog(message) {
    console.log(`[Login Server] ${message}`);
}

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'data/users.json');

// 读取用户数据
function readUsers() {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            debugLog('用户数据文件不存在');
            return { users: [] };
        }

        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        debugLog(`读取用户数据: ${parsedData.users.length}个用户`);
        return parsedData;
    } catch (error) {
        debugLog(`读取用户数据失败: ${error.message}`);
        return { users: [] };
    }
}

// 设置中间件
app.use(cors()); // 启用CORS
app.use(bodyParser.json()); // 解析JSON请求体

// 记录所有请求
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    debugLog(`[${timestamp}] ${req.method} ${req.url}`);
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);
    
    if (req.body && Object.keys(req.body).length > 0) {
        debugLog(`请求体: ${JSON.stringify(req.body)}`);
    }
    
    next();
});

// 登录路由
app.post('/login', (req, res) => {
    debugLog('收到登录请求');
    
    try {
        const { username, password, remember } = req.body;

        // 验证必填字段
        if (!username || !password) {
            debugLog('登录失败: 缺少用户名或密码');
            return res.status(400).json({
                success: false,
                error: '用户名和密码为必填项'
            });
        }

        // 读取用户数据
        const data = readUsers();
        debugLog(`查找用户: ${username}`);

        // 查找用户
        const user = data.users.find(u => u.username === username);
        if (!user) {
            debugLog(`登录失败: 用户不存在 - ${username}`);
            return res.status(401).json({
                success: false,
                error: '用户名或密码不正确'
            });
        }

        // 验证密码
        debugLog('验证密码');
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            debugLog('登录失败: 密码不正确');
            return res.status(401).json({
                success: false,
                error: '用户名或密码不正确'
            });
        }

        // 生成JWT令牌
        debugLog('生成JWT令牌');
        const expiresIn = remember ? '30d' : '1d';
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn }
        );

        // 返回用户信息（不包含密码）
        const userWithoutPassword = { ...user };
        delete userWithoutPassword.password;

        debugLog(`登录成功: ${username}`);
        return res.json({
            success: true,
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        debugLog(`登录错误: ${error.message}`);
        debugLog(`错误堆栈: ${error.stack}`);
        return res.status(500).json({
            success: false,
            error: '登录失败，请稍后重试'
        });
    }
});

// 测试路由
app.get('/test', (req, res) => {
    debugLog('收到测试请求');
    return res.json({
        success: true,
        message: '登录服务器工作正常'
    });
});

// 启动服务器
app.listen(PORT, () => {
    debugLog(`登录服务器已启动，监听端口 ${PORT}`);
    debugLog(`访问 http://localhost:${PORT}/test 测试服务器是否正常工作`);
}); 