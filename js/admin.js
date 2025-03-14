class AdminManager {
    constructor() {
        this.users = [];
        this.logs = [];
        this.currentUserId = null;
        this.confirmCallback = null;

        this.initEventListeners();
        this.loadDashboard();
    }

    initEventListeners() {
        // 用户表单提交
        const userForm = document.getElementById('user-form');
        if (userForm) {
            userForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUserSubmit();
            });
        }

        // 日志筛选器
        const logType = document.getElementById('log-type');
        const logDate = document.getElementById('log-date');
        if (logType && logDate) {
            logType.addEventListener('change', () => this.filterLogs());
            logDate.addEventListener('change', () => this.filterLogs());
        }
    }

    async loadDashboard() {
        await Promise.all([
            this.loadStats(),
            this.loadUsers(),
            this.loadLogs()
        ]);
    }

    // 加载统计数据
    async loadStats() {
        try {
            const response = await fetch('/api/admin/stats');
            if (response.ok) {
                const stats = await response.json();
                this.updateStats(stats);
            }
        } catch (error) {
            console.error('加载统计数据失败:', error);
            this.showError('加载统计数据失败');
        }
    }

    // 更新统计数据显示
    updateStats(stats) {
        document.getElementById('total-users').textContent = stats.totalUsers;
        document.getElementById('active-users').textContent = stats.activeUsers;
        document.getElementById('storage-usage').textContent = this.formatStorage(stats.storageUsage);
    }

    // 加载用户列表
    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users');
            if (response.ok) {
                this.users = await response.json();
                this.renderUsers();
            }
        } catch (error) {
            console.error('加载用户列表失败:', error);
            this.showError('加载用户列表失败');
        }
    }

    // 渲染用户列表
    renderUsers() {
        const tbody = document.getElementById('users-list');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-username">${this.escapeHtml(user.username)}</td>
                <td class="col-role">${user.role === 'admin' ? '管理员' : '普通用户'}</td>
                <td class="col-storage">${this.formatStorage(user.storageUsed)} / ${this.formatStorage(user.storageLimit)}</td>
                <td class="col-status">
                    <span class="status-badge ${user.enabled ? 'status-active' : 'status-inactive'}">
                        ${user.enabled ? '启用' : '禁用'}
                    </span>
                </td>
                <td class="col-lastlogin">${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '从未登录'}</td>
                <td class="col-actions">
                    <button class="btn" onclick="adminManager.editUser('${user.id}')">编辑</button>
                    <button class="btn btn-danger" onclick="adminManager.deleteUser('${user.id}')">删除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 加载系统日志
    async loadLogs() {
        try {
            const response = await fetch('/api/admin/logs');
            if (response.ok) {
                this.logs = await response.json();
                this.renderLogs();
            }
        } catch (error) {
            console.error('加载系统日志失败:', error);
            this.showError('加载系统日志失败');
        }
    }

    // 渲染系统日志
    renderLogs(logs = this.logs) {
        const tbody = document.getElementById('logs-list');
        if (!tbody) return;

        tbody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="col-time">${new Date(log.time).toLocaleString()}</td>
                <td class="col-type">${this.getLogTypeText(log.type)}</td>
                <td class="col-user">${this.escapeHtml(log.username)}</td>
                <td class="col-action">${this.escapeHtml(log.action)}</td>
                <td class="col-details">${this.escapeHtml(log.details)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 筛选日志
    filterLogs() {
        const type = document.getElementById('log-type').value;
        const date = document.getElementById('log-date').value;

        let filteredLogs = this.logs;

        if (type !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.type === type);
        }

        if (date) {
            const selectedDate = new Date(date).toDateString();
            filteredLogs = filteredLogs.filter(log =>
                new Date(log.time).toDateString() === selectedDate
            );
        }

        this.renderLogs(filteredLogs);
    }

    // 显示添加用户对话框
    showAddUserDialog() {
        this.currentUserId = null;
        document.getElementById('dialog-title').textContent = '添加用户';
        document.getElementById('user-form').reset();
        document.getElementById('password').required = true;
        document.getElementById('user-dialog').style.display = 'flex';
    }

    // 编辑用户
    async editUser(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`);
            if (response.ok) {
                const user = await response.json();
                this.currentUserId = userId;
                document.getElementById('dialog-title').textContent = '编辑用户';
                document.getElementById('username').value = user.username;
                document.getElementById('password').required = false;
                document.getElementById('role').value = user.role;
                document.getElementById('storage-limit').value = user.storageLimit / (1024 * 1024 * 1024); // 转换为GB
                document.getElementById('user-enabled').checked = user.enabled;
                document.getElementById('user-dialog').style.display = 'flex';
            }
        } catch (error) {
            console.error('加载用户详情失败:', error);
            this.showError('加载用户详情失败');
        }
    }

    // 删除用户
    deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.showConfirmDialog(
            `确定要删除用户 "${user.username}" 吗？此操作不可恢复。`,
            async () => {
                try {
                    const response = await fetch(`/api/admin/users/${userId}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        await this.loadUsers();
                        this.showSuccess('用户已删除');
                    }
                } catch (error) {
                    console.error('删除用户失败:', error);
                    this.showError('删除用户失败');
                }
            }
        );
    }

    // 处理用户表单提交
    async handleUserSubmit() {
        const formData = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            role: document.getElementById('role').value,
            storageLimit: document.getElementById('storage-limit').value * 1024 * 1024 * 1024, // 转换为字节
            enabled: document.getElementById('user-enabled').checked
        };

        try {
            const url = this.currentUserId
                ? `/api/admin/users/${this.currentUserId}`
                : '/api/admin/users';

            const response = await fetch(url, {
                method: this.currentUserId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.closeDialog();
                await this.loadUsers();
                this.showSuccess(this.currentUserId ? '用户已更新' : '用户已创建');
            }
        } catch (error) {
            console.error('保存用户失败:', error);
            this.showError('保存用户失败');
        }
    }

    // 显示确认对话框
    showConfirmDialog(message, callback) {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-dialog').style.display = 'flex';
        this.confirmCallback = callback;

        document.getElementById('confirm-action').onclick = () => {
            this.closeConfirmDialog();
            if (this.confirmCallback) {
                this.confirmCallback();
            }
        };
    }

    // 关闭对话框
    closeDialog() {
        document.getElementById('user-dialog').style.display = 'none';
    }

    // 关闭确认对话框
    closeConfirmDialog() {
        document.getElementById('confirm-dialog').style.display = 'none';
    }

    // 工具方法：格式化存储大小
    formatStorage(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    // 工具方法：获取日志类型文本
    getLogTypeText(type) {
        const types = {
            login: '登录',
            user: '用户操作',
            system: '系统'
        };
        return types[type] || type;
    }

    // 工具方法：HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
}

// 初始化管理器
const adminManager = new AdminManager();