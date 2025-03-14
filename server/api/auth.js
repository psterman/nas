const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, '../../data/users.json');

// 调试日志函数
function debugLog(message) {
    console.log(`[Auth API] ${message}`);
}

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

// 登录路由
router.post('/login', (req, res) => {
    debugLog('收到登录请求');
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);
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

// 注册路由 - 确保这个路由不需要认证
router.post('/register', (req, res) => {
    try {
        debugLog(`收到注册请求: ${JSON.stringify(req.body)}`);
        debugLog(`请求头: ${JSON.stringify(req.headers)}`);

        // 检查请求体是否存在
        if (!req.body) {
            debugLog('注册失败: 请求体为空');
            return res.status(400).json({
                success: false,
                error: '请求体为空'
            });
        }

        const { username, password, email } = req.body;

        debugLog(`注册信息: 用户名=${username}, 密码长度=${password ? password.length : 0}, 邮箱=${email}`);

        // 验证必填字段
        if (!username || !password || !email) {
            debugLog('注册失败: 用户名、密码和邮箱为必填项');
            return res.status(400).json({
                success: false,
                error: '用户名、密码和邮箱为必填项'
            });
        }

        // 验证密码长度
        if (password.length < 6) {
            debugLog('注册失败: 密码长度必须至少为6个字符');
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
        debugLog(`读取到${data.users.length}个用户`);

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

        debugLog(`创建新用户: ${JSON.stringify(newUser)}`);

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

// 验证令牌路由
router.get('/validate-token', (req, res) => {
    debugLog('收到验证令牌请求');
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);

    try {
        // 从请求头中获取令牌
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            debugLog('验证令牌失败: 未提供令牌');
            return res.status(401).json({
                success: false,
                error: '未提供认证令牌'
            });
        }

        const token = authHeader.split(' ')[1];
        debugLog('验证JWT令牌');

        // 验证令牌
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                debugLog(`验证令牌失败: ${err.message}`);
                return res.status(401).json({
                    success: false,
                    error: '无效的认证令牌'
                });
            }

            // 读取用户数据
            const data = readUsers();
            debugLog(`查找用户ID: ${decoded.id}`);

            // 查找用户
            const user = data.users.find(u => u.id === decoded.id);
            if (!user) {
                debugLog(`验证令牌失败: 用户不存在 - ID: ${decoded.id}`);
                return res.status(401).json({
                    success: false,
                    error: '用户不存在'
                });
            }

            // 返回用户信息（不包含密码）
            const userWithoutPassword = { ...user };
            delete userWithoutPassword.password;

            debugLog(`验证令牌成功: ${user.username}`);
            return res.json({
                success: true,
                user: userWithoutPassword
            });
        });
    } catch (error) {
        debugLog(`验证令牌错误: ${error.message}`);
        debugLog(`错误堆栈: ${error.stack}`);
        return res.status(500).json({
            success: false,
            error: '验证令牌失败，请稍后重试'
        });
    }
});

// 添加一个简单的测试路由
router.get('/test', (req, res) => {
    debugLog('收到测试请求');
    return res.json({
        success: true,
        message: 'API路由工作正常'
    });
});

// 初始化时读取用户数据，确保文件存在
readUsers();

debugLog('认证API路由已加载');

module.exports = router; 