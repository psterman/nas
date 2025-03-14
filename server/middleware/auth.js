const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 调试日志函数
function debugLog(message) {
    console.log(`[Auth Middleware] ${message}`);
}

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, '../../data/users.json');

// 读取用户数据
function readUsers() {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            debugLog(`用户数据文件不存在: ${USERS_FILE}`);
            return { users: [] };
        }

        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        debugLog(`读取用户数据失败: ${error.message}`);
        return { users: [] };
    }
}

// 认证中间件
const isAuthenticated = (req, res, next) => {
    debugLog(`验证请求: ${req.method} ${req.url}`);

    // 检查Authorization头
    const authHeader = req.headers.authorization;
    debugLog(`Authorization头: ${authHeader ? '存在' : '不存在'}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        debugLog('认证失败: 缺少或无效的Authorization头');
        return res.status(401).json({
            success: false,
            error: '未授权，请登录'
        });
    }

    // 提取令牌
    const token = authHeader.split(' ')[1];
    debugLog(`提取的令牌: ${token.substring(0, 10)}...`);

    try {
        // 验证令牌
        const decoded = jwt.verify(token, JWT_SECRET);
        debugLog(`令牌验证成功: ${JSON.stringify(decoded)}`);

        // 从用户数据中查找用户
        const data = readUsers();
        const user = data.users.find(u => u.id === decoded.id);

        if (!user) {
            debugLog(`认证失败: 用户不存在 - ID: ${decoded.id}`);
            return res.status(401).json({
                success: false,
                error: '用户不存在'
            });
        }

        // 将用户信息添加到请求对象
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };

        debugLog(`认证成功: ${user.username}`);
        next();
    } catch (error) {
        debugLog(`令牌验证失败: ${error.message}`);
        return res.status(401).json({
            success: false,
            error: '令牌无效或已过期'
        });
    }
};

// 管理员权限中间件
const isAdmin = (req, res, next) => {
    debugLog(`验证管理员权限: ${req.method} ${req.url}`);

    if (!req.user) {
        debugLog('管理员验证失败: 用户未认证');
        return res.status(401).json({
            success: false,
            error: '未授权，请登录'
        });
    }

    if (req.user.role !== 'admin') {
        debugLog(`管理员验证失败: 用户不是管理员 - ${req.user.username}`);
        return res.status(403).json({
            success: false,
            error: '权限不足，需要管理员权限'
        });
    }

    debugLog(`管理员验证成功: ${req.user.username}`);
    next();
};

module.exports = {
    isAuthenticated,
    isAdmin
}; 