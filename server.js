const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// 创建Express应用
const app = express();

// 设置端口
const PORT = process.env.PORT || 3000;

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 配置 Cloudinary
cloudinary.config({
    cloud_name: 'dyzgmkuu6',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:3000',
        'https://nas-chi.vercel.app',
        'https://nas-chi.github.io'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Origin',
        'X-Requested-With',
        'Content-Length'
    ],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    maxAge: 86400 // 24小时
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
    debugLog(`请求头: ${JSON.stringify(req.headers)}`);
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname)));
debugLog(`静态文件目录: ${path.join(__dirname)}`);

// 添加专门的静态文件路由来访问storage目录中的文件
app.use('/storage', express.static(path.join(__dirname, 'storage')));
debugLog(`添加storage静态文件目录: ${path.join(__dirname, 'storage')}`);

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

// 验证用户是否已登录的中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: '未提供认证令牌' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: '无效的认证令牌' });
        }

        req.user = user;
        next();
    });
}

// 文件系统操作相关的常量和配置
const FILE_STORAGE_PATH = path.join(__dirname, 'storage'); // 文件存储根目录
const MAX_UPLOAD_SIZE = 1024 * 1024 * 100; // 最大上传文件大小(100MB)

// 确保存储目录存在
if (!fs.existsSync(FILE_STORAGE_PATH)) {
    fs.mkdirSync(FILE_STORAGE_PATH, { recursive: true });
    debugLog(`创建文件存储目录: ${FILE_STORAGE_PATH}`);
}

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(FILE_STORAGE_PATH, req.body.path || '');
        fs.mkdirSync(uploadPath, { recursive: true });
        debugLog(`文件将保存到: ${uploadPath}`);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // 解码原始文件名
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        debugLog(`原始文件名: ${originalName}`);

        // 生成安全的文件名
        const ext = path.extname(originalName);
        const nameWithoutExt = path.basename(originalName, ext)
            .replace(/[^\w\u4e00-\u9fa5]/g, '_');
        const timestamp = Date.now();
        const newFilename = `${nameWithoutExt}_${timestamp}${ext}`;

        debugLog(`生成的文件名: ${newFilename}`);
        cb(null, newFilename);
    }
});

// 配置文件上传
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
        fieldSize: 10 * 1024 * 1024 // 10MB，用于表单字段
    }
});

// 获取文件和文件夹列表
app.get('/api/files', authenticateToken, (req, res) => {
    try {
        // 获取请求的路径，默认为根目录
        const requestPath = decodeURIComponent(req.query.path || '');
        const fullPath = path.join(FILE_STORAGE_PATH, requestPath);

        // 检查路径是否存在
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, error: '路径不存在' });
        }

        // 检查路径是否是目录
        if (!fs.statSync(fullPath).isDirectory()) {
            return res.status(400).json({ success: false, error: '请求的路径不是目录' });
        }

        // 读取目录内容
        const items = fs.readdirSync(fullPath, { encoding: 'utf8' });

        // 获取每个项目的详细信息
        const fileList = items.map(item => {
            const itemPath = path.join(fullPath, item);
            const stats = fs.statSync(itemPath);
            const isDirectory = stats.isDirectory();

            // 确保文件名是正确的 UTF-8 编码
            const decodedName = Buffer.from(item).toString('utf8');

            return {
                name: decodedName,
                path: path.join(requestPath, decodedName).replace(/\\/g, '/'),
                isDirectory,
                size: isDirectory ? null : stats.size,
                modifiedTime: stats.mtime.toISOString(),
                createdTime: stats.birthtime.toISOString()
            };
        });

        // 分离文件夹和文件，并按名称排序
        const folders = fileList
            .filter(item => item.isDirectory)
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        const files = fileList
            .filter(item => !item.isDirectory)
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

        // 返回结果
        return res.json({
            success: true,
            path: requestPath,
            items: [...folders, ...files]
        });
    } catch (error) {
        debugLog(`获取文件列表错误: ${error.message}`);
        return res.status(500).json({ success: false, error: '获取文件列表失败' });
    }
});

// 处理文件上传
app.post('/api/files/upload', authenticateToken, upload.array('file'), async (req, res) => {
    try {
        debugLog('开始处理文件上传请求');
        const files = req.files;
        const uploadPath = req.body.path || '';

        if (!files || files.length === 0) {
            throw new Error('没有收到文件');
        }

        debugLog(`收到 ${files.length} 个文件`);
        const results = await Promise.all(files.map(async (file) => {
            try {
                debugLog(`处理文件: ${file.originalname}`);
                const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
                const filePath = path.join(uploadPath, file.filename);
                const fullLocalPath = path.join(FILE_STORAGE_PATH, filePath);

                // 检查文件是否存在
                if (!fs.existsSync(file.path)) {
                    throw new Error(`找不到上传的文件: ${file.path}`);
                }

                // 获取文件大小
                const stats = fs.statSync(file.path);
                debugLog(`文件大小: ${stats.size} 字节`);

                // 确定资源类型
                const ext = path.extname(file.originalname).toLowerCase();
                let resourceType = 'raw';
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
                    resourceType = 'image';
                } else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'].includes(ext)) {
                    resourceType = 'video';
                }

                // 构建 Cloudinary 上传路径 - 使用原始文件名
                const cloudinaryFileName = originalName;
                const cloudinaryPath = path.join(uploadPath, cloudinaryFileName).replace(/\\/g, '/');
                debugLog(`Cloudinary 上传路径: ${cloudinaryPath}, 资源类型: ${resourceType}`);

                // 返回结果对象 - 先返回本地文件信息
                const result = {
                    originalName,
                    filename: file.filename,
                    path: filePath,
                    fullPath: fullLocalPath,
                    size: stats.size,
                    localFileExists: true
                };

                // 上传到 Cloudinary
                debugLog(`开始上传到 Cloudinary: ${file.path}`);
                let cloudinaryResult = null;

                try {
                    // 确保 Cloudinary 配置正确
                    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
                        throw new Error('Cloudinary 配置缺失，请设置 CLOUDINARY_API_KEY 和 CLOUDINARY_API_SECRET 环境变量');
                    }

                    debugLog(`Cloudinary 配置: API_KEY=${process.env.CLOUDINARY_API_KEY.substring(0, 5)}..., API_SECRET=${process.env.CLOUDINARY_API_SECRET.substring(0, 5)}...`);

                    // 对于大文件，使用分块上传
                    if (stats.size > 10 * 1024 * 1024) { // 大于10MB
                        debugLog(`使用分块上传大文件: ${file.path}`);

                        // 设置分块上传选项
                        const uploadOptions = {
                            resource_type: resourceType,
                            public_id: cloudinaryPath,
                            chunk_size: 6000000, // 6MB 分块
                            timeout: 600000, // 10分钟超时
                            use_filename: true,
                            unique_filename: false,
                            overwrite: true
                        };

                        // 使用流式上传
                        cloudinaryResult = await new Promise((resolve, reject) => {
                            const uploadStream = cloudinary.uploader.upload_stream(
                                uploadOptions,
                                (error, result) => {
                                    if (error) {
                                        debugLog(`Cloudinary 上传错误: ${error.message}`);
                                        reject(error);
                                    } else {
                                        debugLog(`Cloudinary 上传成功: ${result.secure_url}`);
                                        resolve(result);
                                    }
                                }
                            );

                            // 创建文件读取流
                            const readStream = fs.createReadStream(file.path);

                            // 处理读取错误
                            readStream.on('error', (error) => {
                                debugLog(`文件读取错误: ${error.message}`);
                                reject(error);
                            });

                            // 添加上传进度日志
                            let uploadedBytes = 0;
                            readStream.on('data', (chunk) => {
                                uploadedBytes += chunk.length;
                                const progress = ((uploadedBytes / stats.size) * 100).toFixed(2);
                                if (uploadedBytes % (1024 * 1024) === 0) { // 每MB记录一次
                                    debugLog(`上传进度 ${progress}% - ${uploadedBytes}/${stats.size} 字节`);
                                }
                            });

                            // 通过管道传输到上传流
                            readStream.pipe(uploadStream);
                        });
                    } else {
                        // 对于小文件，使用直接上传
                        cloudinaryResult = await cloudinary.uploader.upload(file.path, {
                            public_id: cloudinaryPath,
                            resource_type: resourceType,
                            use_filename: true,
                            unique_filename: false,
                            overwrite: true,
                            timeout: 120000 // 2分钟超时
                        });
                    }

                    debugLog(`Cloudinary 上传成功: ${cloudinaryResult.secure_url}`);

                    // 验证上传的文件大小
                    const sizeDiff = Math.abs(cloudinaryResult.bytes - stats.size);
                    const sizePercent = (sizeDiff / stats.size) * 100;

                    if (sizePercent > 5) { // 允许5%的误差
                        debugLog(`警告: 文件大小差异过大 - 本地: ${stats.size}, Cloudinary: ${cloudinaryResult.bytes}, 差异: ${sizePercent.toFixed(2)}%`);
                    }

                    // 如果 Cloudinary 上传成功，添加 Cloudinary 信息
                    if (cloudinaryResult) {
                        result.cloudinaryUrl = cloudinaryResult.secure_url;
                        result.cloudinarySize = cloudinaryResult.bytes;
                        result.format = cloudinaryResult.format;
                        result.resourceType = cloudinaryResult.resource_type;
                        result.publicId = cloudinaryResult.public_id;
                        result.downloadUrl = cloudinaryResult.secure_url;

                        // 保存 Cloudinary 信息到本地文件
                        const metadataPath = `${file.path}.metadata.json`;
                        fs.writeFileSync(metadataPath, JSON.stringify({
                            cloudinaryUrl: cloudinaryResult.secure_url,
                            publicId: cloudinaryResult.public_id,
                            resourceType: cloudinaryResult.resource_type,
                            uploadedAt: new Date().toISOString()
                        }));
                        debugLog(`已保存 Cloudinary 元数据到: ${metadataPath}`);
                    }
                } catch (cloudinaryError) {
                    debugLog(`Cloudinary 上传失败: ${cloudinaryError.message}`);
                    debugLog(`错误详情: ${JSON.stringify(cloudinaryError)}`);
                    // 即使 Cloudinary 上传失败，我们也保留本地文件
                }

                return result;
            } catch (error) {
                debugLog(`文件处理错误: ${error.message}`);
                debugLog(`错误堆栈: ${error.stack}`);
                throw error;
            }
        }));

        debugLog('所有文件处理完成');
        res.json({
            success: true,
            files: results
        });
    } catch (error) {
        debugLog(`文件上传错误: ${error.message}`);
        debugLog(`错误堆栈: ${error.stack}`);
        res.status(500).json({
            success: false,
            error: `文件上传失败: ${error.message}`
        });
    }
});

// 下载文件
app.get('/api/files/download', authenticateToken, async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path || '');
        if (!filePath) {
            return res.status(400).json({ success: false, error: '未提供文件路径' });
        }

        debugLog(`请求下载文件: ${filePath}`);

        // 首先检查本地文件是否存在
        const localPath = path.join(FILE_STORAGE_PATH, filePath);
        debugLog(`检查本地文件: ${localPath}`);

        if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            debugLog(`使用本地文件: ${localPath}`);

            // 设置文件名
            const originalName = path.basename(filePath);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);

            // 对于视频文件，使用流式传输
            const ext = path.extname(filePath).toLowerCase();
            if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'].includes(ext)) {
                debugLog(`使用流式传输视频文件: ${localPath}`);

                // 获取文件大小
                const stat = fs.statSync(localPath);
                const fileSize = stat.size;

                // 处理范围请求
                const range = req.headers.range;
                if (range) {
                    debugLog(`收到范围请求: ${range}`);
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                    const chunksize = (end - start) + 1;

                    debugLog(`范围请求参数: start=${start}, end=${end}, chunksize=${chunksize}`);

                    const file = fs.createReadStream(localPath, { start, end });
                    const head = {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': 'video/mp4',
                        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`
                    };

                    res.writeHead(206, head);
                    file.pipe(res);
                } else {
                    debugLog(`发送完整视频文件: ${localPath}`);
                    const head = {
                        'Content-Length': fileSize,
                        'Content-Type': 'video/mp4',
                        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`
                    };

                    res.writeHead(200, head);
                    fs.createReadStream(localPath).pipe(res);
                }
                return;
            }

            // 对于非视频文件，直接发送
            return res.sendFile(localPath);
        }

        // 如果本地文件不存在，尝试从 Cloudinary 下载
        debugLog(`本地文件不存在，尝试从 Cloudinary 下载`);

        // 构建 public_id
        const publicId = filePath.replace(/\\/g, '/');
        debugLog(`Cloudinary public_id: ${publicId}`);

        try {
            // 尝试获取资源信息
            const result = await cloudinary.api.resource(publicId);
            debugLog(`找到 Cloudinary 资源: ${result.secure_url}`);

            // 设置响应头，确保浏览器下载文件而不是直接显示
            const originalName = path.basename(filePath);
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);

            // 重定向到 Cloudinary 的下载 URL
            return res.redirect(result.secure_url);
        } catch (error) {
            debugLog(`尝试其他资源类型: ${error.message}`);

            // 如果第一次尝试失败，尝试其他资源类型
            const resourceTypes = ['image', 'video', 'raw'];
            for (const type of resourceTypes) {
                try {
                    const result = await cloudinary.api.resource(publicId, { resource_type: type });
                    debugLog(`找到 ${type} 类型的资源: ${result.secure_url}`);

                    const originalName = path.basename(filePath);
                    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
                    return res.redirect(result.secure_url);
                } catch (e) {
                    debugLog(`${type} 类型查找失败: ${e.message}`);
                }
            }

            throw new Error('找不到文件');
        }
    } catch (error) {
        debugLog(`下载文件错误: ${error.message}`);
        return res.status(404).json({
            success: false,
            error: '文件不存在或无法访问'
        });
    }
});

// 创建文件夹
app.post('/api/files/create-folder', authenticateToken, (req, res) => {
    try {
        // 获取请求的路径和文件夹名称
        const { path: folderPath, name } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, error: '未提供文件夹名称' });
        }

        // 构建完整路径
        const basePath = folderPath || '';
        const fullPath = path.join(FILE_STORAGE_PATH, basePath, name);

        // 检查文件夹是否已存在
        if (fs.existsSync(fullPath)) {
            return res.status(400).json({ success: false, error: '文件夹已存在' });
        }

        // 创建文件夹
        fs.mkdirSync(fullPath, { recursive: true });

        // 返回成功响应
        return res.json({
            success: true,
            message: '文件夹创建成功',
            folder: {
                name,
                path: path.join(basePath, name).replace(/\\/g, '/'),
                isDirectory: true,
                createdTime: new Date().toISOString()
            }
        });
    } catch (error) {
        debugLog(`创建文件夹错误: ${error.message}`);
        return res.status(500).json({ success: false, error: '创建文件夹失败' });
    }
});

// 删除文件
app.delete('/api/files', authenticateToken, async (req, res) => {
    try {
        const filePath = decodeURIComponent(req.query.path || '');
        if (!filePath) {
            return res.status(400).json({ success: false, error: '未提供文件路径' });
        }

        debugLog(`请求删除文件: ${filePath}`);

        // 构建本地文件路径
        const localPath = path.join(FILE_STORAGE_PATH, filePath);
        debugLog(`本地文件路径: ${localPath}`);

        // 检查元数据文件是否存在
        const metadataPath = `${localPath}.metadata.json`;
        let cloudinaryInfo = null;

        if (fs.existsSync(metadataPath)) {
            try {
                const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                cloudinaryInfo = JSON.parse(metadataContent);
                debugLog(`找到 Cloudinary 元数据: ${JSON.stringify(cloudinaryInfo)}`);
            } catch (err) {
                debugLog(`读取元数据文件失败: ${err.message}`);
            }
        }

        // 如果有 Cloudinary 信息，尝试从 Cloudinary 删除
        let cloudinaryDeleted = false;
        if (cloudinaryInfo && cloudinaryInfo.publicId) {
            try {
                debugLog(`尝试从 Cloudinary 删除: ${cloudinaryInfo.publicId}, 资源类型: ${cloudinaryInfo.resourceType || 'auto'}`);
                const result = await cloudinary.uploader.destroy(
                    cloudinaryInfo.publicId,
                    { resource_type: cloudinaryInfo.resourceType || 'auto' }
                );

                debugLog(`Cloudinary 删除结果: ${JSON.stringify(result)}`);

                if (result.result === 'ok') {
                    cloudinaryDeleted = true;
                    debugLog(`成功从 Cloudinary 删除: ${cloudinaryInfo.publicId}`);
                } else {
                    debugLog(`从 Cloudinary 删除失败: ${result.result}`);
                }
            } catch (cloudinaryError) {
                debugLog(`Cloudinary 删除错误: ${cloudinaryError.message}`);

                // 尝试其他资源类型
                const resourceTypes = ['image', 'video', 'raw'];
                for (const type of resourceTypes) {
                    if (type === cloudinaryInfo.resourceType) continue; // 跳过已尝试的类型

                    try {
                        debugLog(`尝试以 ${type} 类型删除: ${cloudinaryInfo.publicId}`);
                        const result = await cloudinary.uploader.destroy(
                            cloudinaryInfo.publicId,
                            { resource_type: type }
                        );

                        if (result.result === 'ok') {
                            cloudinaryDeleted = true;
                            debugLog(`成功以 ${type} 类型从 Cloudinary 删除: ${cloudinaryInfo.publicId}`);
                            break;
                        }
                    } catch (e) {
                        debugLog(`以 ${type} 类型删除失败: ${e.message}`);
                    }
                }
            }
        } else {
            debugLog(`没有找到 Cloudinary 元数据，尝试使用文件路径作为 public_id`);

            // 如果没有元数据，尝试使用文件路径作为 public_id
            const publicId = filePath.replace(/\\/g, '/');

            try {
                const result = await cloudinary.uploader.destroy(publicId);
                if (result.result === 'ok') {
                    cloudinaryDeleted = true;
                    debugLog(`成功从 Cloudinary 删除: ${publicId}`);
                }
            } catch (e) {
                debugLog(`使用文件路径删除失败: ${e.message}`);

                // 尝试其他资源类型
                const resourceTypes = ['image', 'video', 'raw'];
                for (const type of resourceTypes) {
                    try {
                        const result = await cloudinary.uploader.destroy(publicId, { resource_type: type });
                        if (result.result === 'ok') {
                            cloudinaryDeleted = true;
                            debugLog(`成功以 ${type} 类型从 Cloudinary 删除: ${publicId}`);
                            break;
                        }
                    } catch (typeError) {
                        debugLog(`以 ${type} 类型删除失败: ${typeError.message}`);
                    }
                }
            }
        }

        // 删除本地文件
        let localDeleted = false;
        if (fs.existsSync(localPath)) {
            try {
                if (fs.statSync(localPath).isDirectory()) {
                    // 如果是目录，递归删除
                    fs.rmdirSync(localPath, { recursive: true });
                } else {
                    // 如果是文件，直接删除
                    fs.unlinkSync(localPath);
                }

                // 删除元数据文件
                if (fs.existsSync(metadataPath)) {
                    fs.unlinkSync(metadataPath);
                    debugLog(`已删除元数据文件: ${metadataPath}`);
                }

                localDeleted = true;
                debugLog(`已删除本地文件: ${localPath}`);
            } catch (fsError) {
                debugLog(`删除本地文件失败: ${fsError.message}`);
                throw new Error(`删除本地文件失败: ${fsError.message}`);
            }
        } else {
            debugLog(`本地文件不存在: ${localPath}`);
        }

        // 返回结果
        res.json({
            success: true,
            message: '文件删除成功',
            details: {
                path: filePath,
                cloudinaryDeleted,
                localDeleted
            }
        });
    } catch (error) {
        debugLog(`删除文件错误: ${error.message}`);
        res.status(500).json({
            success: false,
            error: `删除文件失败: ${error.message}`
        });
    }
});

// 重命名文件或文件夹
app.put('/api/files/rename', authenticateToken, (req, res) => {
    try {
        // 获取请求的路径和新名称
        const { path: filePath, newName } = req.body;

        if (!filePath) {
            return res.status(400).json({ success: false, error: '未提供文件路径' });
        }

        if (!newName) {
            return res.status(400).json({ success: false, error: '未提供新名称' });
        }

        const fullPath = path.join(FILE_STORAGE_PATH, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, error: '文件或文件夹不存在' });
        }

        // 获取目录和文件名
        const dirPath = path.dirname(fullPath);
        const newFullPath = path.join(dirPath, newName);

        // 检查新名称是否已存在
        if (fs.existsSync(newFullPath)) {
            return res.status(400).json({ success: false, error: '该名称已被使用' });
        }

        // 重命名文件或文件夹
        fs.renameSync(fullPath, newFullPath);

        // 构建新路径
        const newFilePath = path.join(path.dirname(filePath), newName).replace(/\\/g, '/');

        // 返回成功响应
        return res.json({
            success: true,
            message: '重命名成功',
            oldPath: filePath,
            newPath: newFilePath
        });
    } catch (error) {
        debugLog(`重命名文件错误: ${error.message}`);
        return res.status(500).json({ success: false, error: '重命名失败' });
    }
});

// 获取文件信息
app.get('/api/files/info', authenticateToken, (req, res) => {
    try {
        // 获取请求的文件路径
        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).json({ success: false, error: '未提供文件路径' });
        }

        const fullPath = path.join(FILE_STORAGE_PATH, filePath);

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ success: false, error: '文件或文件夹不存在' });
        }

        // 获取文件信息
        const stats = fs.statSync(fullPath);
        const isDirectory = stats.isDirectory();

        // 返回文件信息
        return res.json({
            success: true,
            file: {
                name: path.basename(fullPath),
                path: filePath,
                isDirectory,
                size: isDirectory ? null : stats.size,
                modifiedTime: stats.mtime.toISOString(),
                createdTime: stats.birthtime.toISOString(),
                // 如果是文件，尝试猜测MIME类型
                mimetype: isDirectory ? null : require('mime-types').lookup(fullPath) || 'application/octet-stream'
            }
        });
    } catch (error) {
        debugLog(`获取文件信息错误: ${error.message}`);
        return res.status(500).json({ success: false, error: '获取文件信息失败' });
    }
});

// 测试 Cloudinary 连接
app.get('/api/test-cloudinary', async (req, res) => {
    try {
        debugLog('测试 Cloudinary 连接');

        // 检查环境变量
        if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return res.json({
                success: false,
                connected: false,
                message: 'Cloudinary 配置缺失，请设置 CLOUDINARY_API_KEY 和 CLOUDINARY_API_SECRET 环境变量'
            });
        }

        // 测试 Cloudinary API
        try {
            const result = await cloudinary.api.ping();
            debugLog(`Cloudinary 连接测试结果: ${JSON.stringify(result)}`);

            return res.json({
                success: true,
                connected: true,
                message: 'Cloudinary 连接成功',
                details: result
            });
        } catch (error) {
            debugLog(`Cloudinary 连接测试失败: ${error.message}`);

            return res.json({
                success: false,
                connected: false,
                message: `Cloudinary 连接失败: ${error.message}`,
                error: error.message
            });
        }
    } catch (error) {
        debugLog(`测试 Cloudinary 连接出错: ${error.message}`);

        return res.status(500).json({
            success: false,
            connected: false,
            message: `测试 Cloudinary 连接出错: ${error.message}`,
            error: error.message
        });
    }
});

// 更新 Cloudinary 配置
app.post('/api/update-cloudinary-config', authenticateToken, async (req, res) => {
    try {
        const { apiKey, apiSecret } = req.body;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({
                success: false,
                message: '请提供 API Key 和 API Secret'
            });
        }

        // 更新环境变量
        process.env.CLOUDINARY_API_KEY = apiKey;
        process.env.CLOUDINARY_API_SECRET = apiSecret;

        // 重新配置 Cloudinary
        cloudinary.config({
            cloud_name: 'dyzgmkuu6',
            api_key: apiKey,
            api_secret: apiSecret
        });

        // 测试连接
        try {
            const result = await cloudinary.api.ping();
            debugLog(`Cloudinary 配置更新成功，连接测试结果: ${JSON.stringify(result)}`);

            return res.json({
                success: true,
                message: 'Cloudinary 配置更新成功',
                details: result
            });
        } catch (error) {
            debugLog(`Cloudinary 配置更新后连接测试失败: ${error.message}`);

            return res.json({
                success: false,
                message: `Cloudinary 配置更新后连接测试失败: ${error.message}`,
                error: error.message
            });
        }
    } catch (error) {
        debugLog(`更新 Cloudinary 配置出错: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: `更新 Cloudinary 配置出错: ${error.message}`,
            error: error.message
        });
    }
});

// Cloudinary 状态检查
app.get('/api/cloudinary/status', authenticateToken, async (req, res) => {
    try {
        debugLog('开始检查 Cloudinary 状态');
        debugLog(`当前配置: cloud_name=dyzgmkuu6, api_key=${process.env.CLOUDINARY_API_KEY?.substring(0, 5)}..., api_secret=${process.env.CLOUDINARY_API_SECRET?.substring(0, 5)}...`);

        // 检查环境变量是否设置
        if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            throw new Error('Cloudinary 配置缺失');
        }

        // 测试 Cloudinary 连接
        const result = await cloudinary.api.ping();
        debugLog('Cloudinary 连接测试成功');
        res.json({ success: true, message: 'Cloudinary 连接正常', config: { cloud_name: 'dyzgmkuu6' } });
    } catch (error) {
        debugLog(`Cloudinary 连接测试失败: ${error.message}`);
        debugLog(`错误详情: ${JSON.stringify(error)}`);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.error || error.message
        });
    }
});

// Cloudinary 配置更新
app.post('/api/cloudinary/config', authenticateToken, async (req, res) => {
    try {
        const { apiKey, apiSecret } = req.body;
        debugLog('收到 Cloudinary 配置更新请求');

        if (!apiKey || !apiSecret) {
            throw new Error('API Key 和 API Secret 不能为空');
        }

        debugLog(`更新配置: api_key=${apiKey.substring(0, 5)}..., api_secret=${apiSecret.substring(0, 5)}...`);

        // 更新环境变量
        process.env.CLOUDINARY_API_KEY = apiKey;
        process.env.CLOUDINARY_API_SECRET = apiSecret;

        // 更新 Cloudinary 配置
        cloudinary.config({
            cloud_name: 'dyzgmkuu6',
            api_key: apiKey,
            api_secret: apiSecret
        });

        // 测试新配置
        debugLog('测试新配置...');
        const result = await cloudinary.api.ping();
        debugLog('Cloudinary 配置更新并测试成功');
        res.json({
            success: true,
            message: 'Cloudinary 配置已更新',
            config: { cloud_name: 'dyzgmkuu6' }
        });
    } catch (error) {
        debugLog(`Cloudinary 配置更新失败: ${error.message}`);
        debugLog(`错误详情: ${JSON.stringify(error)}`);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.error || error.message
        });
    }
});

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

// 启动服务器
app.listen(PORT, () => {
    debugLog(`服务器运行在 http://localhost:${PORT}`);
});

// 导出app实例
module.exports = app;