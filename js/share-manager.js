class ShareManager {
    constructor() {
        this.shares = [];
        this.accessLogs = [];
        this.initEventListeners();
        this.loadShares();
        this.loadAccessLogs();
    }

    initEventListeners() {
        // 表单提交处理
        const shareForm = document.getElementById('share-form');
        if (shareForm) {
            shareForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveShare();
            });
        }

        // 初始化拖放功能
        this.initDragAndDrop();
    }

    // 加载共享列表
    async loadShares() {
        try {
            const response = await fetch('/api/shares');
            if (response.ok) {
                this.shares = await response.json();
                this.renderShares();
            }
        } catch (error) {
            console.error('加载共享列表失败:', error);
            this.showError('加载共享列表失败');
        }
    }

    // 加载访问记录
    async loadAccessLogs() {
        try {
            const response = await fetch('/api/access-logs');
            if (response.ok) {
                this.accessLogs = await response.json();
                this.renderAccessLogs();
            }
        } catch (error) {
            console.error('加载访问记录失败:', error);
        }
    }

    // 渲染共享列表
    renderShares() {
        const tbody = document.getElementById('share-list-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.shares.forEach(share => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-name">${this.escapeHtml(share.name)}</td>
                <td class="col-path">${this.escapeHtml(share.path)}</td>
                <td class="col-access">${share.access === 'read' ? '只读' : '读写'}</td>
                <td class="col-users">${this.escapeHtml(share.users.join(', '))}</td>
                <td class="col-actions">
                    <button class="btn-icon" onclick="shareManager.editShare('${share.id}')">
                        <span class="icon-edit"></span>
                    </button>
                    <button class="btn-icon" onclick="shareManager.deleteShare('${share.id}')">
                        <span class="icon-delete"></span>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 渲染访问记录
    renderAccessLogs() {
        const tbody = document.getElementById('access-list-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.accessLogs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-time">${new Date(log.time).toLocaleString()}</td>
                <td class="col-user">${this.escapeHtml(log.user)}</td>
                <td class="col-share">${this.escapeHtml(log.share)}</td>
                <td class="col-operation">${this.escapeHtml(log.operation)}</td>
                <td class="col-ip">${this.escapeHtml(log.ip)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 添加共享
    addShare() {
        document.getElementById('share-dialog').style.display = 'flex';
        document.getElementById('share-form').reset();
        this.loadUsers();
    }

    // 编辑共享
    async editShare(shareId) {
        try {
            const response = await fetch(`/api/shares/${shareId}`);
            if (response.ok) {
                const share = await response.json();
                document.getElementById('share-name').value = share.name;
                document.getElementById('local-path').value = share.path;
                document.getElementById('access-type').value = share.access;
                this.loadUsers(share.users);
                document.getElementById('share-dialog').style.display = 'flex';
            }
        } catch (error) {
            console.error('加载共享详情失败:', error);
            this.showError('加载共享详情失败');
        }
    }

    // 删除共享
    async deleteShare(shareId) {
        if (!confirm('确定要删除这个共享吗？')) return;

        try {
            const response = await fetch(`/api/shares/${shareId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                this.loadShares();
                this.showSuccess('共享已删除');
            }
        } catch (error) {
            console.error('删除共享失败:', error);
            this.showError('删除共享失败');
        }
    }

    // 保存共享
    async saveShare() {
        const formData = {
            name: document.getElementById('share-name').value,
            path: document.getElementById('local-path').value,
            access: document.getElementById('access-type').value,
            users: Array.from(document.querySelectorAll('#allowed-users input:checked')).map(input => input.value)
        };

        try {
            const response = await fetch('/api/shares', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.closeDialog();
                this.loadShares();
                this.showSuccess('共享保存成功');
            }
        } catch (error) {
            console.error('保存共享失败:', error);
            this.showError('保存共享失败');
        }
    }

    // 浏览本地路径
    async browsePath() {
        try {
            const response = await fetch('/api/browse-folders');
            if (response.ok) {
                const folders = await response.json();
                // 显示文件夹选择对话框
                this.showFolderDialog(folders);
            }
        } catch (error) {
            console.error('浏览文件夹失败:', error);
            this.showError('浏览文件夹失败');
        }
    }

    // 加载用户列表
    async loadUsers(selectedUsers = []) {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const users = await response.json();
                const container = document.getElementById('allowed-users');
                container.innerHTML = users.map(user => `
                    <label class="checkbox-label">
                        <input type="checkbox" value="${user.id}" ${selectedUsers.includes(user.id) ? 'checked' : ''}>
                        ${this.escapeHtml(user.name)}
                    </label>
                `).join('');
            }
        } catch (error) {
            console.error('加载用户列表失败:', error);
        }
    }

    // 关闭对话框
    closeDialog() {
        document.getElementById('share-dialog').style.display = 'none';
    }

    // 显示成功消息
    showSuccess(message) {
        // 实现消息提示
        alert(message); // 临时使用alert，后续可以改为更友好的提示
    }

    // 显示错误消息
    showError(message) {
        // 实现错误提示
        alert(message); // 临时使用alert，后续可以改为更友好的提示
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 初始化拖放功能
    initDragAndDrop() {
        const dropZone = document.querySelector('.share-container');
        if (!dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        dropZone.addEventListener('dragover', () => {
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            dropZone.classList.remove('drag-over');
            const items = e.dataTransfer.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].kind === 'file') {
                        const entry = items[i].webkitGetAsEntry();
                        if (entry && entry.isDirectory) {
                            this.handleDroppedFolder(entry);
                        }
                    }
                }
            }
        });
    }

    // 处理拖放的文件夹
    async handleDroppedFolder(entry) {
        const path = entry.fullPath;
        document.getElementById('local-path').value = path;
        document.getElementById('share-name').value = entry.name;
        document.getElementById('share-dialog').style.display = 'flex';
    }
}

// 初始化共享管理器
const shareManager = new ShareManager();