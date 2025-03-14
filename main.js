const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const server = require('./server');

// 全局变量，用于存储Electron应用实例
global.electronApp = {
    mainWindow: null
};

// 创建主窗口
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 存储主窗口引用
    global.electronApp.mainWindow = mainWindow;

    // 加载应用
    mainWindow.loadURL('http://localhost:3000');

    // 开发环境下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // 窗口关闭时清除引用
    mainWindow.on('closed', () => {
        global.electronApp.mainWindow = null;
    });
}

// 应用准备就绪时创建窗口
app.whenReady().then(() => {
    // 启动Express服务器
    const PORT = 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        createWindow();
    });

    // macOS下点击dock图标时重新创建窗口
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 处理IPC消息
ipcMain.handle('select-folder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(global.electronApp.mainWindow, {
        properties: ['openDirectory'],
        title: '选择要共享的文件夹'
    });

    if (result.canceled) {
        return { canceled: true };
    }

    return { path: result.filePaths[0] };
}); 