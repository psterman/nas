const { contextBridge, ipcRenderer } = require('electron');

// 在window对象上暴露API
contextBridge.exposeInMainWorld('electronAPI', {
    // 选择文件夹
    selectFolder: () => ipcRenderer.invoke('select-folder')
}); 