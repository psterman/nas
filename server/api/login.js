const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 调试日志函数
function debugLog(message) {
    console.log(`[Login API] ${message}`);
}

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, '../../data/users.json');

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

// 登录路由
router.post('/', (req, res) => {
    debugLog('收到登录请求');
    debugLog(`请求URL: ${req.originalUrl}`);
    debugLog(`请求方法: ${req.method}`);
    debugLog(`请求体: ${JSON.stringify(req.body)}`);

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

module.exports = router; 