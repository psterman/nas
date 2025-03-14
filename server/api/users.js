const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

const router = express.Router();

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, '../../data/users.json');

// 读取用户数据
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return { users: [] };
    }

    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取用户数据失败:', error);
        return { users: [] };
    }
}

// 保存用户数据
function saveUsers(data) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('保存用户数据失败:', error);
        return false;
    }
}

// 获取用户列表（仅管理员可访问）
router.get('/admin/users', isAdmin, (req, res) => {
    try {
        const data = readUsers();

        // 返回用户列表，但不包含密码
        const users = data.users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt
        }));

        return res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error('获取用户列表错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取用户列表失败'
        });
    }
});

// 获取所有用户（用于共享文件夹选择用户）
router.get('/users', isAuthenticated, (req, res) => {
    try {
        const data = readUsers();

        // 返回用户列表，但不包含密码和敏感信息
        const users = data.users.map(user => ({
            id: user.id,
            username: user.username,
            role: user.role
        }));

        return res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error('获取用户列表错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取用户列表失败'
        });
    }
});

// 获取当前用户信息
router.get('/users/me', isAuthenticated, (req, res) => {
    try {
        const data = readUsers();

        // 查找用户
        const user = data.users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        // 返回用户信息，但不包含密码
        return res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取用户信息失败'
        });
    }
});

// 添加新用户（仅管理员可访问）
router.post('/admin/users', isAdmin, (req, res) => {
    try {
        const { username, password, email, role } = req.body;

        // 验证必填字段
        if (!username || !password || !email) {
            return res.status(400).json({
                success: false,
                error: '用户名、密码和邮箱为必填项'
            });
        }

        // 读取用户数据
        const data = readUsers();

        // 检查用户名是否已存在
        if (data.users.some(u => u.username === username)) {
            return res.status(400).json({
                success: false,
                error: '用户名已存在'
            });
        }

        // 检查邮箱是否已存在
        if (data.users.some(u => u.email === email)) {
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
            role: role || 'user',
            createdAt: new Date().toISOString()
        };

        // 添加到用户列表
        data.users.push(newUser);

        // 保存数据
        if (!saveUsers(data)) {
            return res.status(500).json({
                success: false,
                error: '添加用户失败'
            });
        }

        // 返回成功消息
        return res.status(201).json({
            success: true,
            message: '用户添加成功',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        console.error('添加用户错误:', error);
        return res.status(500).json({
            success: false,
            error: '添加用户失败'
        });
    }
});

// 更新用户信息（仅管理员可访问）
router.put('/admin/users/:id', isAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, email, role } = req.body;

        // 读取用户数据
        const data = readUsers();

        // 查找用户
        const userIndex = data.users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        // 如果更改用户名，检查是否已存在
        if (username && username !== data.users[userIndex].username) {
            if (data.users.some(u => u.username === username)) {
                return res.status(400).json({
                    success: false,
                    error: '用户名已存在'
                });
            }
        }

        // 如果更改邮箱，检查是否已存在
        if (email && email !== data.users[userIndex].email) {
            if (data.users.some(u => u.email === email)) {
                return res.status(400).json({
                    success: false,
                    error: '邮箱已被使用'
                });
            }
        }

        // 更新用户信息
        data.users[userIndex] = {
            ...data.users[userIndex],
            username: username || data.users[userIndex].username,
            email: email || data.users[userIndex].email,
            role: role || data.users[userIndex].role,
            ...(password ? { password: bcrypt.hashSync(password, 10) } : {})
        };

        // 保存数据
        if (!saveUsers(data)) {
            return res.status(500).json({
                success: false,
                error: '更新用户失败'
            });
        }

        // 返回成功消息
        return res.json({
            success: true,
            message: '用户更新成功',
            user: {
                id: data.users[userIndex].id,
                username: data.users[userIndex].username,
                email: data.users[userIndex].email,
                role: data.users[userIndex].role,
                createdAt: data.users[userIndex].createdAt
            }
        });
    } catch (error) {
        console.error('更新用户错误:', error);
        return res.status(500).json({
            success: false,
            error: '更新用户失败'
        });
    }
});

// 删除用户（仅管理员可访问）
router.delete('/admin/users/:id', isAdmin, (req, res) => {
    try {
        const { id } = req.params;

        // 读取用户数据
        const data = readUsers();

        // 查找用户
        const userIndex = data.users.findIndex(u => u.id === id);

        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }

        // 防止删除最后一个管理员
        if (data.users[userIndex].role === 'admin') {
            const adminCount = data.users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    error: '无法删除最后一个管理员'
                });
            }
        }

        // 删除用户
        data.users.splice(userIndex, 1);

        // 保存数据
        if (!saveUsers(data)) {
            return res.status(500).json({
                success: false,
                error: '删除用户失败'
            });
        }

        // 返回成功消息
        return res.json({
            success: true,
            message: '用户删除成功'
        });
    } catch (error) {
        console.error('删除用户错误:', error);
        return res.status(500).json({
            success: false,
            error: '删除用户失败'
        });
    }
});

module.exports = router; 