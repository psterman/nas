const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// 调试日志函数
function debugLog(message) {
    console.log(`[Register API] ${message}`);
}

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, '../../data/users.json');

// 确保数据目录存在
function ensureDataDirExists() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        debugLog(`创建数据目录: ${dataDir}`);
    }
}

// 读取用户数据
function readUsers() {
    ensureDataDirExists();

    if (!fs.existsSync(USERS_FILE)) {
        // 如果文件不存在，创建默认管理员用户
        debugLog('用户数据文件不存在，创建默认管理员用户');
        const defaultAdmin = {
            id: uuidv4(),
            username: 'admin',
            password: bcrypt.hashSync('admin123', 10),
            email: 'admin@example.com',
            role: 'admin',
            createdAt: new Date().toISOString()
        };

        const data = { users: [defaultAdmin] };
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        debugLog(`创建用户数据文件: ${USERS_FILE}`);
        return data;
    }

    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        debugLog(`读取用户数据: ${parsedData.users.length}个用户`);
        return parsedData;
    } catch (error) {
        debugLog(`读取用户数据失败: ${error.message}`);
        return { users: [] };
    }
}

// 保存用户数据
function saveUsers(data) {
    ensureDataDirExists();

    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        debugLog('保存用户数据成功');
        return true;
    } catch (error) {
        debugLog(`保存用户数据失败: ${error.message}`);
        return false;
    }
}

// 注册路由
router.post('/', (req, res) => {
    debugLog('收到注册请求');
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);
    debugLog(`请求体: ${JSON.stringify(req.body)}`);

    try {
        const { username, password, email } = req.body;

        // 验证必填字段
        if (!username || !password || !email) {
            debugLog('注册失败: 缺少必填字段');
            return res.status(400).json({
                success: false,
                error: '用户名、密码和邮箱为必填项'
            });
        }

        // 验证密码长度
        if (password.length < 6) {
            debugLog('注册失败: 密码长度不足');
            return res.status(400).json({
                success: false,
                error: '密码长度必须至少为6个字符'
            });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            debugLog('注册失败: 邮箱格式不正确');
            return res.status(400).json({
                success: false,
                error: '请输入有效的邮箱地址'
            });
        }

        // 读取用户数据
        const data = readUsers();

        // 检查用户名是否已存在
        if (data.users.some(u => u.username === username)) {
            debugLog(`注册失败: 用户名已存在 - ${username}`);
            return res.status(400).json({
                success: false,
                error: '用户名已存在'
            });
        }

        // 检查邮箱是否已存在
        if (data.users.some(u => u.email === email)) {
            debugLog(`注册失败: 邮箱已被使用 - ${email}`);
            return res.status(400).json({
                success: false,
                error: '邮箱已被使用'
            });
        }

        // 创建新用户
        const newUser = {
            id: uuidv4(),
            username,
            password: bcrypt.hashSync(password, 10),
            email,
            role: 'user',
            createdAt: new Date().toISOString()
        };

        debugLog(`创建新用户: ${JSON.stringify({ ...newUser, password: '******' })}`);

        // 添加到用户列表
        data.users.push(newUser);

        // 保存数据
        if (!saveUsers(data)) {
            debugLog('注册失败: 保存用户数据失败');
            return res.status(500).json({
                success: false,
                error: '注册失败，请稍后重试'
            });
        }

        debugLog(`注册成功: ${username}`);

        // 返回成功消息
        const responseData = {
            success: true,
            message: '注册成功，请登录'
        };

        debugLog(`返回响应: ${JSON.stringify(responseData)}`);
        return res.status(201).json(responseData);
    } catch (error) {
        debugLog(`注册错误: ${error.message}`);
        debugLog(`错误堆栈: ${error.stack}`);
        return res.status(500).json({
            success: false,
            error: '注册失败，请稍后重试'
        });
    }
});

module.exports = router; 