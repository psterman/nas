const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// 创建Express应用
const app = express();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 调试日志函数
function debugLog(message) {
    console.log(`[Server] ${message}`);
}

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    debugLog(`创建数据目录: ${dataDir}`);
}

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'data/users.json');

// 读取用户数据
function readUsers() {
    try {
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
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        debugLog('保存用户数据成功');
        return true;
    } catch (error) {
        debugLog(`保存用户数据失败: ${error.message}`);
        return false;
    }
}

// 设置CORS选项，允许来自Live Server的请求
const corsOptions = {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
};

// 启用CORS
app.use(cors(corsOptions));
debugLog('已启用CORS，允许来自Live Server的请求');

// 解析JSON请求体
app.use(bodyParser.json());
debugLog('已启用JSON请求体解析');

// 记录所有请求
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    debugLog(`[${timestamp}] ${req.method} ${req.url}`);

    // 记录请求头和请求体
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);
    if (req.body && Object.keys(req.body).length > 0) {
        debugLog(`请求体: ${JSON.stringify(req.body)}`);
    }

    // 记录响应
    const originalSend = res.send;
    res.send = function (body) {
        debugLog(`响应状态码: ${res.statusCode}`);
        debugLog(`响应体: ${body}`);
        return originalSend.call(this, body);
    };

    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname)));
debugLog(`静态文件目录: ${path.join(__dirname)}`);

// 处理JSON解析错误
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        debugLog(`JSON解析错误: ${err.message}`);
        return res.status(400).json({ success: false, error: '无效的请求数据' });
    }
    next(err);
});

// 添加一个简单的测试路由
app.get('/api/test', (req, res) => {
    debugLog('处理测试请求');
    return res.json({
        success: true,
        message: 'API路由工作正常'
    });
});

// 直接在server.js中定义登录路由
app.post('/api/login', (req, res) => {
    debugLog('收到登录请求 - 直接处理');
    debugLog(`请求URL: ${req.url}`);
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

// 直接在server.js中定义验证token路由
app.get('/api/validate-token', (req, res) => {
    debugLog('收到验证token请求 - 直接处理');
    debugLog(`请求URL: ${req.url}`);
    debugLog(`请求方法: ${req.method}`);
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);

    try {
        // 从请求头中获取令牌
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            debugLog('验证token失败: 未提供令牌');
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
                debugLog(`验证token失败: ${err.message}`);
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
                debugLog(`验证token失败: 用户不存在 - ID: ${decoded.id}`);
                return res.status(401).json({
                    success: false,
                    error: '用户不存在'
                });
            }

            // 返回用户信息（不包含密码）
            const userWithoutPassword = { ...user };
            delete userWithoutPassword.password;

            debugLog(`验证token成功: ${user.username}`);
            return res.json({
                success: true,
                user: userWithoutPassword
            });
        });
    } catch (error) {
        debugLog(`验证token错误: ${error.message}`);
        debugLog(`错误堆栈: ${error.stack}`);
        return res.status(500).json({
            success: false,
            error: '验证token失败，请稍后重试'
        });
    }
});

// API路由
try {
    // 认证API - 确保这个路由正确注册
    try {
        debugLog('尝试加载认证API路由...');
        const authRouter = require('./server/api/auth');
        app.use('/api/auth', authRouter);
        debugLog('已成功注册认证API路由 - 路径: /api/auth');
        debugLog('可用的认证路由:');
        debugLog('- POST /api/auth/login - 用户登录');
        debugLog('- POST /api/auth/register - 用户注册');
        debugLog('- GET /api/auth/validate-token - 验证令牌');
    } catch (error) {
        debugLog(`加载认证API路由失败: ${error.message}`);
        debugLog(`错误堆栈: ${error.stack}`);
    }

    // 注册API
    try {
        const registerRouter = require('./server/api/register');
        app.use('/api/register', registerRouter);
        debugLog('已注册用户注册API路由');
    } catch (error) {
        debugLog(`加载用户注册API路由失败: ${error.message}`);
    }

    // 其他API路由
    try {
        const browseFolderRouter = require('./server/api/browse-folder');
        app.use('/api', browseFolderRouter);
        debugLog('已注册文件浏览API路由');
    } catch (error) {
        debugLog(`加载文件浏览API路由失败: ${error.message}`);
    }

    try {
        const browseFolderWebRouter = require('./server/api/browse-folder-web');
        app.use('/api', browseFolderWebRouter);
        debugLog('已注册Web文件浏览API路由');
    } catch (error) {
        debugLog(`加载Web文件浏览API路由失败: ${error.message}`);
    }

    try {
        const sharedFoldersRouter = require('./server/api/shared-folders');
        app.use('/api', sharedFoldersRouter);
        debugLog('已注册共享文件夹API路由');
    } catch (error) {
        debugLog(`加载共享文件夹API路由失败: ${error.message}`);
    }

    try {
        const usersRouter = require('./server/api/users');
        app.use('/api', usersRouter);
        debugLog('已注册用户管理API路由');
    } catch (error) {
        debugLog(`加载用户管理API路由失败: ${error.message}`);
    }
} catch (error) {
    debugLog(`加载API路由失败: ${error.message}`);
}

// 处理API 404错误
app.use('/api/*', (req, res) => {
    debugLog(`API路由未找到: ${req.method} ${req.url}`);
    res.status(404).json({ success: false, error: 'API路由未找到' });
});

// 所有其他请求返回index.html
app.get('*', (req, res, next) => {
    // 排除API请求和静态文件请求
    if (!req.url.startsWith('/api/') && !req.url.includes('.')) {
        debugLog(`返回HTML页面: ${req.url}`);
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        next();
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    debugLog(`服务器错误: ${err.message}`);
    debugLog(`错误堆栈: ${err.stack}`);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 导出app实例
module.exports = app; 