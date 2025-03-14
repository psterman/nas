const express = require('express');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// 浏览文件夹（Electron模式下使用）
router.get('/browse-folder', isAuthenticated, (req, res) => {
    // 这个API在Electron环境中使用，Web环境中使用browse-folder-web
    res.json({
        success: false,
        error: '此API仅在桌面应用中可用'
    });
});

module.exports = router; 