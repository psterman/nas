const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

/**
 * 获取系统可用的根目录和常用文件夹
 * 这是Web环境下的替代方案
 */
router.get('/available-folders', isAuthenticated, (req, res) => {
    try {
        const folders = [];

        // 获取用户主目录
        const homeDir = os.homedir();
        folders.push({
            name: '用户目录',
            path: homeDir
        });

        // 添加常用文件夹
        const commonFolders = ['Documents', 'Pictures', 'Music', 'Videos', 'Downloads'];
        commonFolders.forEach(folder => {
            const folderPath = path.join(homeDir, folder);
            if (fs.existsSync(folderPath)) {
                folders.push({
                    name: folder,
                    path: folderPath
                });
            }
        });

        // 在Windows系统上，添加所有可用的驱动器
        if (process.platform === 'win32') {
            // 获取所有可用的驱动器（从C到Z）
            for (let i = 67; i <= 90; i++) {
                const driveLetter = String.fromCharCode(i);
                const drivePath = `${driveLetter}:\\`;

                try {
                    // 检查驱动器是否存在
                    fs.accessSync(drivePath);
                    folders.push({
                        name: `${driveLetter}:`,
                        path: drivePath
                    });
                } catch (error) {
                    // 驱动器不存在或无法访问，跳过
                }
            }
        }

        return res.json({
            success: true,
            folders
        });
    } catch (error) {
        console.error('获取可用文件夹错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取可用文件夹失败'
        });
    }
});

/**
 * 列出指定目录下的子文件夹
 */
router.get('/list-subfolders', isAuthenticated, (req, res) => {
    try {
        const { folderPath } = req.query;

        if (!folderPath) {
            return res.status(400).json({
                success: false,
                error: '未提供文件夹路径'
            });
        }

        // 安全检查：确保用户不能访问系统关键目录
        const restrictedPaths = [
            '/bin', '/boot', '/etc', '/lib', '/root', '/sbin', '/sys',
            'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)'
        ];

        if (restrictedPaths.some(restricted => folderPath.startsWith(restricted))) {
            return res.status(403).json({
                success: false,
                error: '无权访问此目录'
            });
        }

        // 读取目录内容
        const items = fs.readdirSync(folderPath, { withFileTypes: true });

        // 过滤出子文件夹
        const subfolders = items
            .filter(item => item.isDirectory())
            .map(item => ({
                name: item.name,
                path: path.join(folderPath, item.name)
            }));

        return res.json({
            success: true,
            currentPath: folderPath,
            subfolders
        });
    } catch (error) {
        console.error('列出子文件夹错误:', error);
        return res.status(500).json({
            success: false,
            error: '列出子文件夹失败'
        });
    }
});

// 浏览文件夹（Web模式下使用）
router.get('/browse-folder-web', isAuthenticated, (req, res) => {
    try {
        // 获取当前用户的根目录
        const userDir = path.join(__dirname, '../../data/users', req.user.id);

        // 确保用户目录存在
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        // 获取请求的路径
        const requestPath = req.query.path || '/';

        // 构建完整路径
        let fullPath = userDir;
        if (requestPath !== '/') {
            // 规范化路径，防止路径遍历攻击
            const normalizedPath = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
            fullPath = path.join(userDir, normalizedPath);
        }

        // 确保路径在用户目录内
        if (!fullPath.startsWith(userDir)) {
            return res.status(403).json({
                success: false,
                error: '无效的路径'
            });
        }

        // 读取目录内容
        const items = fs.readdirSync(fullPath, { withFileTypes: true });

        // 处理文件和文件夹
        const files = items.map(item => {
            const itemPath = path.join(fullPath, item.name);
            const stats = fs.statSync(itemPath);

            return {
                name: item.name,
                isDirectory: item.isDirectory(),
                size: stats.size,
                modifiedTime: stats.mtime.toISOString()
            };
        });

        return res.json({
            success: true,
            path: requestPath,
            files
        });
    } catch (error) {
        console.error('浏览文件夹错误:', error);
        return res.status(500).json({
            success: false,
            error: '浏览文件夹失败'
        });
    }
});

module.exports = router; 