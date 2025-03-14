class SharedManager {
    constructor() {
        this.currentPath = '/';
        this.sharedFolders = [];
        this.currentSharedFolder = null;

        // 文件夹浏览器相关
        this.folderBrowserModal = document.getElementById('folder-browser-modal');
        this.folderList = document.getElementById('folder-list');
        this.folderCurrentPath = document.getElementById('folder-current-path');
        this.folderLoading = document.getElementById('folder-loading');
        this.currentBrowsePath = '';
        this.selectedFolder = '';

        // DOM 元素
        this.sharedFoldersContainer = document.getElementById('my-shared-folders');
        this.sharedFileListBody = document.getElementById('shared-file-list-body');
        this.sharedCurrentPath = document.getElementById('shared-current-path');
        this.addShareBtn = document.getElementById('add-share-btn');
        this.addShareModal = document.getElementById('add-share-modal');
        this.addShareForm = document.getElementById('add-share-form');
        this.saveShareBtn = document.getElementById('save-share-btn');
        this.cancelShareBtn = document.getElementById('cancel-share-btn');
        this.closeModalBtn = document.querySelector('.close-btn');
        this.sharePublicCheckbox = document.getElementById('share-public');
        this.shareUsersGroup = document.getElementById('share-users-group');
        this.searchInput = document.getElementById('shared-search-input');
        this.searchBtn = document.getElementById('shared-search-btn');

        this.initEventListeners();
        this.loadSharedFolders();
    }

    initEventListeners() {
        // 添加共享文件夹按钮
        this.addShareBtn.addEventListener('click', () => this.openAddShareModal());

        // 关闭模态框
        this.closeModalBtn.addEventListener('click', () => this.closeAddShareModal());
        this.cancelShareBtn.addEventListener('click', () => this.closeAddShareModal());

        // 保存共享文件夹
        this.saveShareBtn.addEventListener('click', () => this.saveSharedFolder());

        // 公开共享切换
        this.sharePublicCheckbox.addEventListener('change', () => {
            this.shareUsersGroup.style.display = this.sharePublicCheckbox.checked ? 'none' : 'block';
        });

        // 浏览按钮
        document.getElementById('browse-btn').addEventListener('click', () => this.browseLocalFolder());

        // 文件夹浏览器事件
        document.getElementById('close-browser-btn').addEventListener('click', () => this.closeFolderBrowser());
        document.getElementById('cancel-browser-btn').addEventListener('click', () => this.closeFolderBrowser());
        document.getElementById('select-folder-btn').addEventListener('click', () => this.selectCurrentFolder());

        // 文件夹路径导航点击
        this.folderCurrentPath.addEventListener('click', (e) => {
            if (e.target.classList.contains('path-item')) {
                const path = e.target.dataset.path;
                this.browseFolderPath(path);
            }
        });

        // 搜索
        this.searchBtn.addEventListener('click', () => this.searchSharedFiles());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchSharedFiles();
            }
        });

        // 路径导航点击
        this.sharedCurrentPath.addEventListener('click', (e) => {
            if (e.target.classList.contains('path-item')) {
                const path = e.target.dataset.path;
                this.navigateTo(path);
            }
        });
    }

    // 打开文件夹浏览器
    openFolderBrowser() {
        this.folderBrowserModal.classList.add('active');
        this.selectedFolder = '';
        this.loadAvailableFolders();
    }

    // 关闭文件夹浏览器
    closeFolderBrowser() {
        this.folderBrowserModal.classList.remove('active');
    }

    // 加载可用的文件夹
    async loadAvailableFolders() {
        this.folderLoading.style.display = 'block';
        this.folderList.innerHTML = '';

        try {
            const response = await fetch('/api/available-folders', {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load available folders');
            }

            const data = await response.json();

            if (data.success) {
                this.renderFolderList(data.folders);
                this.updateFolderPathNavigation('/');
                this.currentBrowsePath = '/';
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error loading available folders:', error);
            this.folderList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"></div>
                    <div class="empty-state-title">加载失败</div>
                    <div class="empty-state-text">无法加载可用文件夹，请稍后重试。</div>
                </div>
            `;
        } finally {
            this.folderLoading.style.display = 'none';
        }
    }

    // 浏览指定路径的文件夹
    async browseFolderPath(folderPath) {
        if (folderPath === '/') {
            this.loadAvailableFolders();
            return;
        }

        this.folderLoading.style.display = 'block';
        this.folderList.innerHTML = '';

        try {
            const response = await fetch(`/api/list-subfolders?folderPath=${encodeURIComponent(folderPath)}`, {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load subfolders');
            }

            const data = await response.json();

            if (data.success) {
                this.renderFolderList(data.subfolders);
                this.updateFolderPathNavigation(folderPath);
                this.currentBrowsePath = folderPath;
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error browsing folder path:', error);
            this.folderList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"></div>
                    <div class="empty-state-title">访问失败</div>
                    <div class="empty-state-text">无法访问此文件夹，可能没有权限或文件夹不存在。</div>
                </div>
            `;
        } finally {
            this.folderLoading.style.display = 'none';
        }
    }

    // 渲染文件夹列表
    renderFolderList(folders) {
        if (folders.length === 0) {
            this.folderList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"></div>
                    <div class="empty-state-title">文件夹为空</div>
                    <div class="empty-state-text">此文件夹不包含任何子文件夹。</div>
                </div>
            `;
            return;
        }

        let html = '';
        folders.forEach(folder => {
            const isSelected = folder.path === this.selectedFolder;
            const iconClass = folder.path.endsWith(':\\') ? 'drive-icon' : 'folder-icon';

            html += `
                <div class="folder-item ${isSelected ? 'selected' : ''}" 
                     data-path="${folder.path}" 
                     onclick="sharedManager.handleFolderClick('${folder.path}')">
                    <div class="${iconClass}"></div>
                    <div class="folder-info">
                        <div class="folder-name">${folder.name}</div>
                        <div class="folder-path">${folder.path}</div>
                    </div>
                </div>
            `;
        });

        this.folderList.innerHTML = html;
    }

    // 处理文件夹点击
    handleFolderClick(folderPath) {
        // 双击处理 - 进入文件夹
        if (this.lastClickedFolder === folderPath && Date.now() - this.lastClickTime < 300) {
            this.browseFolderPath(folderPath);
        }
        // 单击处理 - 选择文件夹
        else {
            this.selectedFolder = folderPath;

            // 更新选中状态
            document.querySelectorAll('.folder-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.path === folderPath);
            });
        }

        this.lastClickedFolder = folderPath;
        this.lastClickTime = Date.now();
    }

    // 选择当前文件夹
    selectCurrentFolder() {
        if (this.selectedFolder) {
            document.getElementById('share-path').value = this.selectedFolder;
            this.closeFolderBrowser();
        } else {
            alert('请选择一个文件夹');
        }
    }

    // 更新文件夹路径导航
    updateFolderPathNavigation(folderPath) {
        if (folderPath === '/') {
            this.folderCurrentPath.innerHTML = '<span class="path-item" data-path="/">可用文件夹</span>';
            return;
        }

        let html = '<span class="path-item" data-path="/">可用文件夹</span>';

        // Windows路径处理
        if (folderPath.includes(':\\')) {
            const parts = folderPath.split('\\').filter(part => part);
            let currentPath = parts[0] + ':\\';

            html += `<span class="path-item" data-path="${currentPath}">${parts[0]}:</span>`;

            for (let i = 1; i < parts.length; i++) {
                currentPath += parts[i] + '\\';
                html += `<span class="path-item" data-path="${currentPath}">${parts[i]}</span>`;
            }
        }
        // Unix路径处理
        else {
            const parts = folderPath.split('/').filter(part => part);
            let currentPath = '/';

            for (let i = 0; i < parts.length; i++) {
                currentPath += parts[i] + '/';
                html += `<span class="path-item" data-path="${currentPath}">${parts[i]}</span>`;
            }
        }

        this.folderCurrentPath.innerHTML = html;
    }

    // 加载共享文件夹列表
    async loadSharedFolders() {
        try {
            this.sharedFoldersContainer.innerHTML = '<div class="loading-indicator">加载中...</div>';

            const response = await fetch('/api/shared-folders', {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load shared folders');
            }

            const data = await response.json();
            this.sharedFolders = data.folders || [];

            this.renderSharedFolders();
        } catch (error) {
            console.error('Error loading shared folders:', error);
            this.showEmptyState('加载失败', '无法加载共享文件夹，请稍后重试。', true);
        }
    }

    // 渲染共享文件夹列表
    renderSharedFolders() {
        if (this.sharedFolders.length === 0) {
            this.showEmptyState('没有共享文件夹', '点击"添加共享文件夹"按钮来共享您的本地文件夹。');
            return;
        }

        let html = '';
        this.sharedFolders.forEach(folder => {
            html += `
                <div class="shared-folder-card" data-id="${folder.id}" onclick="sharedManager.openSharedFolder('${folder.id}')">
                    <div class="shared-folder-icon"></div>
                    <div class="shared-folder-name">${folder.name}</div>
                    <div class="shared-folder-path">${folder.path}</div>
                    <div class="shared-folder-access">
                        <span class="access-badge access-${folder.access}">${folder.access === 'read' ? '只读' : '读写'}</span>
                        ${folder.isPublic ? '<span class="access-badge">公开</span>' : ''}
                    </div>
                </div>
            `;
        });

        this.sharedFoldersContainer.innerHTML = html;
    }

    // 显示空状态
    showEmptyState(title, message, isError = false) {
        this.sharedFoldersContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"></div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-text">${message}</div>
                ${!isError ? `<button class="btn btn-primary" onclick="sharedManager.openAddShareModal()">添加共享文件夹</button>` : ''}
            </div>
        `;
    }

    // 打开添加共享文件夹模态框
    openAddShareModal() {
        // 重置表单
        this.addShareForm.reset();
        this.shareUsersGroup.style.display = 'block';

        // 加载用户列表
        this.loadUsers();

        // 显示模态框
        this.addShareModal.classList.add('active');
    }

    // 关闭添加共享文件夹模态框
    closeAddShareModal() {
        this.addShareModal.classList.remove('active');
    }

    // 加载用户列表
    async loadUsers() {
        const usersList = document.getElementById('share-users-list');
        usersList.innerHTML = '<div class="loading-indicator">加载用户列表...</div>';

        try {
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load users');
            }

            const data = await response.json();
            const users = data.users || [];

            if (users.length === 0) {
                usersList.innerHTML = '<div class="empty-state">没有其他用户</div>';
                return;
            }

            let html = '';
            users.forEach(user => {
                if (user.id !== auth.getCurrentUser().id) {
                    html += `
                        <div class="user-select-item">
                            <label>
                                <input type="checkbox" name="share-user" value="${user.id}">
                                <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                                <div class="user-info">
                                    <div class="user-name">${user.username}</div>
                                    <div class="user-role">${user.role}</div>
                                </div>
                            </label>
                        </div>
                    `;
                }
            });

            usersList.innerHTML = html;
        } catch (error) {
            console.error('Error loading users:', error);
            usersList.innerHTML = '<div class="empty-state">加载用户失败</div>';
        }
    }

    // 保存共享文件夹
    async saveSharedFolder() {
        const name = document.getElementById('share-name').value;
        const path = document.getElementById('share-path').value;
        const access = document.getElementById('share-access').value;
        const isPublic = this.sharePublicCheckbox.checked;

        // 验证输入
        if (!name.trim()) {
            alert('请输入共享名称');
            return;
        }

        if (!path.trim()) {
            alert('请输入本地路径');
            return;
        }

        // 获取选中的用户
        const selectedUsers = [];
        if (!isPublic) {
            document.querySelectorAll('input[name="share-user"]:checked').forEach(checkbox => {
                selectedUsers.push(checkbox.value);
            });
        }

        // 准备请求数据
        const sharedFolder = {
            name,
            path,
            access,
            isPublic,
            users: selectedUsers
        };

        try {
            this.saveShareBtn.disabled = true;
            this.saveShareBtn.innerHTML = '保存中...';

            const response = await fetch('/api/shared-folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.getToken()}`
                },
                body: JSON.stringify(sharedFolder)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '保存失败');
            }

            const data = await response.json();

            // 添加到共享文件夹列表
            this.sharedFolders.push(data.folder);
            this.renderSharedFolders();

            // 关闭模态框
            this.closeAddShareModal();

            // 显示成功消息
            alert('共享文件夹添加成功！');
        } catch (error) {
            console.error('Error saving shared folder:', error);
            alert('保存失败：' + error.message);
        } finally {
            this.saveShareBtn.disabled = false;
            this.saveShareBtn.innerHTML = '保存';
        }
    }

    // 打开共享文件夹
    async openSharedFolder(folderId) {
        this.currentSharedFolder = this.sharedFolders.find(folder => folder.id === folderId);
        this.currentPath = '/';
        this.loadSharedFiles();
    }

    // 加载共享文件
    async loadSharedFiles() {
        if (!this.currentSharedFolder) {
            return;
        }

        try {
            this.sharedFileListBody.innerHTML = '<tr><td colspan="5"><div class="loading-indicator">加载中...</div></td></tr>';

            // 更新路径导航
            this.updatePathNavigation();

            const response = await fetch(`/api/shared-folders/${this.currentSharedFolder.id}/files?path=${encodeURIComponent(this.currentPath)}`, {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load files');
            }

            const data = await response.json();
            const files = data.files || [];

            this.renderSharedFiles(files);
        } catch (error) {
            console.error('Error loading shared files:', error);
            this.sharedFileListBody.innerHTML = '<tr><td colspan="5"><div class="empty-state">加载失败，请稍后重试</div></td></tr>';
        }
    }

    // 渲染共享文件列表
    renderSharedFiles(files) {
        if (files.length === 0) {
            this.sharedFileListBody.innerHTML = '<tr><td colspan="5"><div class="empty-state">此文件夹为空</div></td></tr>';
            return;
        }

        let html = '';
        files.forEach(file => {
            const isFolder = file.type === 'folder';
            const fileIcon = this.getFileIconClass(file.type);
            const fileSize = isFolder ? '-' : this.formatFileSize(file.size);
            const modifiedDate = new Date(file.modifiedTime).toLocaleString();

            html += `
                <tr>
                    <td>
                        <div class="file-name" ${isFolder ? `onclick="sharedManager.navigateTo('${this.currentPath}${file.name}/')"` : ''}>
                            <span class="file-icon ${fileIcon}"></span>
                            <span>${file.name}</span>
                        </div>
                    </td>
                    <td>${fileSize}</td>
                    <td>${modifiedDate}</td>
                    <td>${file.owner}</td>
                    <td>
                        <div class="file-actions">
                            ${!isFolder ? `
                                <button class="action-btn" onclick="sharedManager.downloadFile('${file.id}')" title="下载">
                                    <span class="icon download-icon"></span>
                                </button>
                            ` : ''}
                            <button class="action-btn" onclick="sharedManager.showFileOptions('${file.id}')" title="更多选项">
                                <span class="icon more-icon"></span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        this.sharedFileListBody.innerHTML = html;
    }

    // 更新路径导航
    updatePathNavigation() {
        const pathParts = this.currentPath.split('/').filter(part => part);
        let html = `<span class="path-item" data-path="/">${this.currentSharedFolder.name}</span>`;

        let currentPath = '/';
        pathParts.forEach(part => {
            currentPath += part + '/';
            html += `<span class="path-item" data-path="${currentPath}">${part}</span>`;
        });

        this.sharedCurrentPath.innerHTML = html;
    }

    // 导航到指定路径
    navigateTo(path) {
        this.currentPath = path;
        this.loadSharedFiles();
    }

    // 下载文件
    async downloadFile(fileId) {
        try {
            const response = await fetch(`/api/shared-folders/${this.currentSharedFolder.id}/files/${fileId}/download`, {
                headers: {
                    'Authorization': `Bearer ${auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            // 获取文件名
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'download';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }

            // 创建下载链接
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('下载失败，请稍后重试');
        }
    }

    // 显示文件操作选项
    showFileOptions(fileId) {
        // 这里可以实现一个上下文菜单或模态框，显示更多文件操作选项
        // 如重命名、删除、移动等
        alert('文件操作功能正在开发中');
    }

    // 搜索共享文件
    searchSharedFiles() {
        const query = this.searchInput.value.trim();
        if (!query || !this.currentSharedFolder) {
            return;
        }

        // 发送搜索请求
        fetch(`/api/shared-folders/${this.currentSharedFolder.id}/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${auth.getToken()}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Search failed');
                }
                return response.json();
            })
            .then(data => {
                const files = data.files || [];
                this.renderSharedFiles(files);
            })
            .catch(error => {
                console.error('Error searching files:', error);
                alert('搜索失败，请稍后重试');
            });
    }

    // 获取文件图标类
    getFileIconClass(fileType) {
        switch (fileType) {
            case 'folder':
                return 'folder-icon';
            case 'image':
                return 'image';
            case 'document':
                return 'document';
            case 'video':
                return 'video';
            case 'audio':
                return 'audio';
            case 'archive':
                return 'archive';
            case 'code':
                return 'code';
            default:
                return 'default';
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 浏览本地文件夹
    async browseLocalFolder() {
        // 显示加载状态
        const browseBtn = document.getElementById('browse-btn');
        const originalText = browseBtn.textContent;
        browseBtn.disabled = true;
        browseBtn.textContent = '选择中...';

        try {
            // 检查是否在Electron环境中
            if (window.electronAPI) {
                // 使用Electron的原生文件选择对话框
                const result = await window.electronAPI.selectFolder();
                if (!result.canceled && result.path) {
                    document.getElementById('share-path').value = result.path;
                }
            } else {
                // 在Web环境中使用自定义文件浏览器
                this.openFolderBrowser();
            }
        } catch (error) {
            console.error('浏览文件夹错误:', error);
            alert('无法打开文件选择器，请确保应用有权限访问本地文件系统。');
        } finally {
            // 恢复按钮状态
            browseBtn.disabled = false;
            browseBtn.textContent = originalText;
        }
    }
}

// 初始化共享管理器
const sharedManager = new SharedManager(); 