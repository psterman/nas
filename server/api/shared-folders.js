const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// 存储共享文件夹信息的文件路径
const SHARED_FOLDERS_FILE = path.join(__dirname, '../../data/shared-folders.json');

// 确保数据目录存在
function ensureDataDirExists() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// 读取共享文件夹数据
function readSharedFolders() {
    ensureDataDirExists();

    if (!fs.existsSync(SHARED_FOLDERS_FILE)) {
        return { folders: [] };
    }

    try {
        const data = fs.readFileSync(SHARED_FOLDERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取共享文件夹数据失败:', error);
        return { folders: [] };
    }
}

// 保存共享文件夹数据
function saveSharedFolders(data) {
    ensureDataDirExists();

    try {
        fs.writeFileSync(SHARED_FOLDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('保存共享文件夹数据失败:', error);
        return false;
    }
}

// 验证文件夹路径是否存在且可访问
function validateFolderPath(folderPath) {
    try {
        if (!fs.existsSync(folderPath)) {
            return { valid: false, error: '文件夹路径不存在' };
        }

        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory()) {
            return { valid: false, error: '指定路径不是文件夹' };
        }

        // 尝试读取文件夹内容，检查权限
        fs.readdirSync(folderPath);

        return { valid: true };
    } catch (error) {
        console.error('验证文件夹路径错误:', error);
        return { valid: false, error: '无法访问文件夹，可能没有权限' };
    }
}

// 获取用户的共享文件夹列表
router.get('/shared-folders', isAuthenticated, (req, res) => {
    try {
        const data = readSharedFolders();

        // 过滤出当前用户创建的或有权访问的共享文件夹
        const userId = req.user.id;
        const userFolders = data.folders.filter(folder =>
            folder.createdBy === userId ||
            folder.isPublic ||
            (folder.users && folder.users.includes(userId))
        );

        return res.json({
            success: true,
            folders: userFolders
        });
    } catch (error) {
        console.error('获取共享文件夹列表错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取共享文件夹列表失败'
        });
    }
});

// 添加新的共享文件夹
router.post('/shared-folders', isAuthenticated, (req, res) => {
    try {
        const { name, path: folderPath, access, isPublic, users } = req.body;

        // 验证必填字段
        if (!name || !folderPath) {
            return res.status(400).json({
                success: false,
                error: '名称和路径为必填项'
            });
        }

        // 验证文件夹路径
        const pathValidation = validateFolderPath(folderPath);
        if (!pathValidation.valid) {
            return res.status(400).json({
                success: false,
                error: pathValidation.error
            });
        }

        // 读取现有数据
        const data = readSharedFolders();

        // 创建新的共享文件夹记录
        const newFolder = {
            id: uuidv4(),
            name,
            path: folderPath,
            access: access || 'read',
            isPublic: isPublic || false,
            users: users || [],
            createdBy: req.user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 添加到列表
        data.folders.push(newFolder);

        // 保存数据
        if (!saveSharedFolders(data)) {
            return res.status(500).json({
                success: false,
                error: '保存共享文件夹失败'
            });
        }

        return res.status(201).json({
            success: true,
            folder: newFolder
        });
    } catch (error) {
        console.error('添加共享文件夹错误:', error);
        return res.status(500).json({
            success: false,
            error: '添加共享文件夹失败'
        });
    }
});

// 获取特定共享文件夹的详情
router.get('/shared-folders/:id', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const data = readSharedFolders();

        // 查找指定ID的文件夹
        const folder = data.folders.find(f => f.id === id);

        if (!folder) {
            return res.status(404).json({
                success: false,
                error: '共享文件夹不存在'
            });
        }

        // 检查访问权限
        const userId = req.user.id;
        if (folder.createdBy !== userId && !folder.isPublic && !(folder.users && folder.users.includes(userId))) {
            return res.status(403).json({
                success: false,
                error: '无权访问此共享文件夹'
            });
        }

        return res.json({
            success: true,
            folder
        });
    } catch (error) {
        console.error('获取共享文件夹详情错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取共享文件夹详情失败'
        });
    }
});

// 更新共享文件夹
router.put('/shared-folders/:id', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const { name, path: folderPath, access, isPublic, users } = req.body;

        // 读取现有数据
        const data = readSharedFolders();

        // 查找指定ID的文件夹
        const folderIndex = data.folders.findIndex(f => f.id === id);

        if (folderIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '共享文件夹不存在'
            });
        }

        // 检查是否是创建者
        if (data.folders[folderIndex].createdBy !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '只有创建者可以修改共享文件夹'
            });
        }

        // 如果提供了新路径，验证路径
        if (folderPath && folderPath !== data.folders[folderIndex].path) {
            const pathValidation = validateFolderPath(folderPath);
            if (!pathValidation.valid) {
                return res.status(400).json({
                    success: false,
                    error: pathValidation.error
                });
            }
        }

        // 更新文件夹信息
        data.folders[folderIndex] = {
            ...data.folders[folderIndex],
            name: name || data.folders[folderIndex].name,
            path: folderPath || data.folders[folderIndex].path,
            access: access || data.folders[folderIndex].access,
            isPublic: isPublic !== undefined ? isPublic : data.folders[folderIndex].isPublic,
            users: users || data.folders[folderIndex].users,
            updatedAt: new Date().toISOString()
        };

        // 保存数据
        if (!saveSharedFolders(data)) {
            return res.status(500).json({
                success: false,
                error: '保存共享文件夹失败'
            });
        }

        return res.json({
            success: true,
            folder: data.folders[folderIndex]
        });
    } catch (error) {
        console.error('更新共享文件夹错误:', error);
        return res.status(500).json({
            success: false,
            error: '更新共享文件夹失败'
        });
    }
});

// 删除共享文件夹
router.delete('/shared-folders/:id', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;

        // 读取现有数据
        const data = readSharedFolders();

        // 查找指定ID的文件夹
        const folderIndex = data.folders.findIndex(f => f.id === id);

        if (folderIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '共享文件夹不存在'
            });
        }

        // 检查是否是创建者
        if (data.folders[folderIndex].createdBy !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: '只有创建者可以删除共享文件夹'
            });
        }

        // 删除文件夹记录
        data.folders.splice(folderIndex, 1);

        // 保存数据
        if (!saveSharedFolders(data)) {
            return res.status(500).json({
                success: false,
                error: '删除共享文件夹失败'
            });
        }

        return res.json({
            success: true,
            message: '共享文件夹已删除'
        });
    } catch (error) {
        console.error('删除共享文件夹错误:', error);
        return res.status(500).json({
            success: false,
            error: '删除共享文件夹失败'
        });
    }
});

// 获取共享文件夹中的文件列表
router.get('/shared-folders/:id/files', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const { path: relativePath = '/' } = req.query;

        // 读取共享文件夹数据
        const data = readSharedFolders();

        // 查找指定ID的文件夹
        const folder = data.folders.find(f => f.id === id);

        if (!folder) {
            return res.status(404).json({
                success: false,
                error: '共享文件夹不存在'
            });
        }

        // 检查访问权限
        const userId = req.user.id;
        if (folder.createdBy !== userId && !folder.isPublic && !(folder.users && folder.users.includes(userId))) {
            return res.status(403).json({
                success: false,
                error: '无权访问此共享文件夹'
            });
        }

        // 构建完整路径
        let fullPath = folder.path;

        // 如果请求的不是根目录，添加相对路径
        if (relativePath !== '/') {
            // 移除开头的斜杠并规范化路径
            const normalizedPath = relativePath.replace(/^\/+/, '').replace(/\//g, path.sep);
            fullPath = path.join(folder.path, normalizedPath);
        }

        // 验证路径是否在共享文件夹内（防止路径遍历攻击）
        if (!fullPath.startsWith(folder.path)) {
            return res.status(403).json({
                success: false,
                error: '无效的路径'
            });
        }

        // 检查路径是否存在
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                error: '路径不存在'
            });
        }

        // 读取目录内容
        const items = fs.readdirSync(fullPath, { withFileTypes: true });

        // 处理文件和文件夹
        const files = items.map(item => {
            const itemPath = path.join(fullPath, item.name);
            const stats = fs.statSync(itemPath);

            // 确定文件类型
            let type = 'file';
            if (item.isDirectory()) {
                type = 'folder';
            } else {
                // 根据扩展名确定文件类型
                const ext = path.extname(item.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
                    type = 'image';
                } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'].includes(ext)) {
                    type = 'video';
                } else if (['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext)) {
                    type = 'audio';
                } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
                    type = 'document';
                } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
                    type = 'archive';
                } else if (['.js', '.html', '.css', '.php', '.py', '.java', '.c', '.cpp', '.json'].includes(ext)) {
                    type = 'code';
                }
            }

            return {
                id: Buffer.from(itemPath).toString('base64'),
                name: item.name,
                type,
                size: stats.size,
                modifiedTime: stats.mtime.toISOString(),
                owner: req.user.username || folder.createdBy
            };
        });

        return res.json({
            success: true,
            path: relativePath,
            files
        });
    } catch (error) {
        console.error('获取文件列表错误:', error);
        return res.status(500).json({
            success: false,
            error: '获取文件列表失败'
        });
    }
});

// 下载文件
router.get('/shared-folders/:id/files/:fileId/download', isAuthenticated, (req, res) => {
    try {
        const { id, fileId } = req.params;

        // 读取共享文件夹数据
        const data = readSharedFolders();

        // 查找指定ID的文件夹
        const folder = data.folders.find(f => f.id === id);

        if (!folder) {
            return res.status(404).json({
                success: false,
                error: '共享文件夹不存在'
            });
        }

        // 检查访问权限
        const userId = req.user.id;
        if (folder.createdBy !== userId && !folder.isPublic && !(folder.users && folder.users.includes(userId))) {
            return res.status(403).json({
                success: false,
                error: '无权访问此共享文件夹'
            });
        }

        // 解码文件ID获取文件路径
        const filePath = Buffer.from(fileId, 'base64').toString();

        // 验证路径是否在共享文件夹内（防止路径遍历攻击）
        if (!filePath.startsWith(folder.path)) {
            return res.status(403).json({
                success: false,
                error: '无效的文件路径'
            });
        }

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: '文件不存在'
            });
        }

        // 检查是否是文件而不是目录
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            return res.status(400).json({
                success: false,
                error: '无法下载文件夹'
            });
        }

        // 设置文件名
        const fileName = path.basename(filePath);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

        // 发送文件
        res.sendFile(filePath);
    } catch (error) {
        console.error('下载文件错误:', error);
        return res.status(500).json({
            success: false,
            error: '下载文件失败'
        });
    }
});

// 搜索共享文件夹中的文件
router.get('/shared-folders/:id/search', isAuthenticated, (req, res) => {
    try {
        const { id } = req.params;
        const { q: query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: '搜索关键词不能为空'
            });
        }

        // 读取共享文件夹数据
        const data = readSharedFolders();

        // 查找指定ID的文件夹
        const folder = data.folders.find(f => f.id === id);

        if (!folder) {
            return res.status(404).json({
                success: false,
                error: '共享文件夹不存在'
            });
        }

        // 检查访问权限
        const userId = req.user.id;
        if (folder.createdBy !== userId && !folder.isPublic && !(folder.users && folder.users.includes(userId))) {
            return res.status(403).json({
                success: false,
                error: '无权访问此共享文件夹'
            });
        }

        // 搜索结果
        const results = [];

        // 递归搜索文件
        function searchFiles(dir, relativePath = '') {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const itemPath = path.join(dir, item.name);
                const itemRelativePath = path.join(relativePath, item.name);

                // 如果文件名包含搜索关键词，添加到结果
                if (item.name.toLowerCase().includes(query.toLowerCase())) {
                    const stats = fs.statSync(itemPath);

                    // 确定文件类型
                    let type = 'file';
                    if (item.isDirectory()) {
                        type = 'folder';
                    } else {
                        // 根据扩展名确定文件类型
                        const ext = path.extname(item.name).toLowerCase();
                        if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
                            type = 'image';
                        } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'].includes(ext)) {
                            type = 'video';
                        } else if (['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(ext)) {
                            type = 'audio';
                        } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
                            type = 'document';
                        } else if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
                            type = 'archive';
                        } else if (['.js', '.html', '.css', '.php', '.py', '.java', '.c', '.cpp', '.json'].includes(ext)) {
                            type = 'code';
                        }
                    }

                    results.push({
                        id: Buffer.from(itemPath).toString('base64'),
                        name: item.name,
                        type,
                        size: stats.size,
                        modifiedTime: stats.mtime.toISOString(),
                        owner: req.user.username || folder.createdBy,
                        path: itemRelativePath
                    });
                }

                // 如果是目录，递归搜索
                if (item.isDirectory()) {
                    searchFiles(itemPath, itemRelativePath);
                }
            }
        }

        // 开始搜索
        searchFiles(folder.path);

        return res.json({
            success: true,
            query,
            files: results
        });
    } catch (error) {
        console.error('搜索文件错误:', error);
        return res.status(500).json({
            success: false,
            error: '搜索文件失败'
        });
    }
});

module.exports = router; 