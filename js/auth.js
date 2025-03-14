// 用户认证相关功能
function login(username, password) { console.log('尝试登录:', username); return Promise.resolve(true); }
function logout() { console.log('用户登出'); }
function isLoggedIn() { return true; }
function getCurrentUser() { return { username: 'admin', role: 'administrator' }; }

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token') || null;
        this.user = null;
        this.userInfoElement = document.getElementById('user-info');

        // 检测当前环境并设置API基础URL
        this.apiBaseUrl = this.getApiBaseUrl();
        console.log(`AuthManager初始化，API基础URL: ${this.apiBaseUrl || '(相对路径)'}`);

        // 从存储中加载认证信息
        this.loadAuthFromStorage();

        // 显示用户信息
        this.updateUserInfo();

        console.log('AuthManager初始化完成');
    }

    // 检测当前环境并返回适当的API基础URL
    getApiBaseUrl() {
        const currentUrl = window.location.href;
        console.log(`当前页面URL: ${currentUrl}`);

        // 如果当前在localhost:3000，使用相对路径
        if (currentUrl.includes('localhost:3000')) {
            console.log('检测到Node.js服务器环境');
            return '';
        }

        // 如果在127.0.0.1:5500 (VS Code Live Server)，使用localhost:3000
        if (currentUrl.includes('127.0.0.1:5500') || currentUrl.includes('localhost:5500')) {
            console.log('检测到Live Server环境，API请求将转发到Node.js服务器');
            return 'http://localhost:3000';
        }

        // 默认情况下使用相对路径
        console.log('使用默认API路径');
        return '';
    }

    // 从存储中加载认证信息
    loadAuthFromStorage() {
        // 优先从会话存储中加载
        this.token = sessionStorage.getItem('auth_token');
        const userJson = sessionStorage.getItem('user');

        // 如果会话存储中没有，尝试从本地存储中加载
        if (!this.token) {
            this.token = localStorage.getItem('auth_token');
            const localUserJson = localStorage.getItem('user');

            if (localUserJson) {
                try {
                    this.user = JSON.parse(localUserJson);
                } catch (error) {
                    console.error('解析用户数据失败:', error);
                    this.user = null;
                }
            }
        } else if (userJson) {
            try {
                this.user = JSON.parse(userJson);
            } catch (error) {
                console.error('解析用户数据失败:', error);
                this.user = null;
            }
        }

        // 如果有令牌，验证其有效性
        if (this.token) {
            this.validateToken();
        }
    }

    // 验证令牌有效性
    async validateToken() {
        if (!this.token) {
            console.log('没有令牌可验证');
            return { success: false, error: '未登录' };
        }

        try {
            console.log('验证令牌');

            // 构建完整的API URL
            const url = `${this.apiBaseUrl}/api/validate-token`;
            console.log(`验证令牌请求URL: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/json'
                }
            });

            console.log(`验证令牌响应状态: ${response.status}`);

            // 检查响应状态
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('令牌无效或已过期');
                    this.logout();
                    return { success: false, error: '会话已过期，请重新登录' };
                }

                const errorMessage = `服务器返回错误(${response.status}): ${response.statusText}`;
                console.error(errorMessage);
                return { success: false, error: errorMessage };
            }

            // 读取响应文本
            const text = await response.text();

            // 解析JSON响应
            let data;
            try {
                if (text.trim()) {
                    data = JSON.parse(text);
                } else {
                    console.error('验证令牌响应为空');
                    return { success: false, error: '服务器返回空响应' };
                }
            } catch (e) {
                console.error(`解析响应失败: ${e.message}`);
                return { success: false, error: '服务器响应格式错误' };
            }

            // 处理验证结果
            if (data.success) {
                console.log('令牌有效');

                // 更新用户信息
                if (data.user) {
                    this.user = data.user;
                    console.log(`已更新用户信息: ${data.user.username}`);
                }

                return { success: true, user: data.user };
            } else {
                console.error(`验证令牌失败: ${data.error || '未知错误'}`);
                this.logout();
                return { success: false, error: data.error || '会话已过期，请重新登录' };
            }
        } catch (error) {
            console.error(`验证令牌过程中发生错误: ${error.message}`);
            return { success: false, error: `验证令牌过程中发生错误: ${error.message}` };
        }
    }

    // 保存认证信息到存储
    saveAuthToStorage(remember) {
        console.log('保存认证信息, remember:', remember);
        if (remember) {
            // 保存到本地存储（持久）
            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
        } else {
            // 保存到会话存储（临时）
            sessionStorage.setItem('auth_token', this.token);
            sessionStorage.setItem('user', JSON.stringify(this.user));
        }
    }

    // 清除认证信息
    clearAuth() {
        console.log('清除认证信息');
        this.token = null;
        this.user = null;

        // 清除存储
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user');

        // 更新用户信息显示
        this.updateUserInfo();
    }

    // 更新用户信息显示
    updateUserInfo() {
        if (!this.userInfoElement) {
            console.log('未找到用户信息元素');
            return;
        }

        if (this.user) {
            console.log('显示已登录用户信息:', this.user.username);
            this.userInfoElement.innerHTML = `
                <div class="user-dropdown">
                    <div class="user-dropdown-toggle">
                        <span class="user-avatar">${this.user.username.charAt(0).toUpperCase()}</span>
                        <span class="user-name">${this.user.username}</span>
                        <span class="dropdown-arrow"></span>
                    </div>
                    <div class="user-dropdown-menu">
                        <a href="#" class="dropdown-item" id="profile-link">个人资料</a>
                        <a href="#" class="dropdown-item" id="logout-link">退出登录</a>
                    </div>
                </div>
            `;

            // 添加事件监听器
            document.getElementById('logout-link').addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });

            document.getElementById('profile-link').addEventListener('click', (e) => {
                e.preventDefault();
                // 显示个人资料页面
                alert('个人资料功能正在开发中');
            });

            // 切换下拉菜单
            const toggle = document.querySelector('.user-dropdown-toggle');
            toggle.addEventListener('click', () => {
                document.querySelector('.user-dropdown').classList.toggle('active');
            });

            // 点击外部关闭下拉菜单
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.user-dropdown')) {
                    document.querySelector('.user-dropdown').classList.remove('active');
                }
            });
        } else {
            console.log('显示未登录状态');
            this.userInfoElement.innerHTML = `
                <a href="login.html" class="login-link">登录</a>
            `;
        }
    }

    // 获取认证令牌
    getToken() {
        return this.token;
    }

    // 获取当前用户
    getCurrentUser() {
        return this.user;
    }

    // 检查用户是否已登录
    isLoggedIn() {
        return !!this.token && !!this.user;
    }

    // 检查用户是否是管理员
    isAdmin() {
        return this.isLoggedIn() && this.user.role === 'admin';
    }

    // 登录
    async login(username, password, remember = false) {
        try {
            console.log(`尝试登录: 用户名=${username}, 记住我=${remember}`);

            // 构建完整的API URL
            const url = `${this.apiBaseUrl}/api/login`;
            console.log(`登录请求URL: ${url}`);

            const startTime = new Date().getTime();
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password, remember })
            });
            const endTime = new Date().getTime();
            console.log(`登录请求耗时: ${endTime - startTime}ms`);

            console.log(`登录响应状态: ${response.status}`);

            // 检查响应状态
            if (!response.ok) {
                const errorMessage = `服务器返回错误(${response.status}): ${response.statusText}`;
                console.error(errorMessage);
                return { success: false, error: errorMessage };
            }

            // 读取响应文本
            const text = await response.text();
            console.log(`登录响应文本长度: ${text.length}`);

            // 解析JSON响应
            let data;
            try {
                if (text.trim()) {
                    data = JSON.parse(text);
                    console.log('登录响应数据已解析');
                } else {
                    console.error('登录响应为空');
                    return { success: false, error: '服务器返回空响应' };
                }
            } catch (e) {
                console.error(`解析响应失败: ${e.message}`);
                return { success: false, error: '服务器响应格式错误' };
            }

            // 处理登录结果
            if (data.success) {
                console.log('登录成功');

                // 保存令牌和用户信息
                if (data.token) {
                    this.token = data.token;
                    localStorage.setItem('token', data.token);
                    console.log('已保存认证令牌');
                }

                if (data.user) {
                    this.user = data.user;
                    console.log(`已保存用户信息: ${data.user.username}`);
                }

                return { success: true, user: data.user };
            } else {
                console.error(`登录失败: ${data.error || '未知错误'}`);
                return { success: false, error: data.error || '登录失败，请检查用户名和密码' };
            }
        } catch (error) {
            console.error(`登录过程中发生错误: ${error.message}`);
            return { success: false, error: `登录过程中发生错误: ${error.message}` };
        }
    }

    // 注册
    async register(username, password, email) {
        try {
            console.log(`尝试注册: 用户名=${username}, 邮箱=${email}`);

            // 构建完整的API URL
            const url = `${this.apiBaseUrl}/api/register`;
            console.log(`注册请求URL: ${url}`);

            const startTime = new Date().getTime();
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username, password, email })
            });
            const endTime = new Date().getTime();
            console.log(`注册请求耗时: ${endTime - startTime}ms`);

            console.log(`注册响应状态: ${response.status}`);

            // 检查响应状态
            if (!response.ok) {
                const errorMessage = `服务器返回错误(${response.status}): ${response.statusText}`;
                console.error(errorMessage);
                return { success: false, error: errorMessage };
            }

            // 读取响应文本
            const text = await response.text();
            console.log(`注册响应文本长度: ${text.length}`);

            // 解析JSON响应
            let data;
            try {
                if (text.trim()) {
                    data = JSON.parse(text);
                    console.log('注册响应数据已解析');
                } else {
                    console.error('注册响应为空');
                    return { success: false, error: '服务器返回空响应' };
                }
            } catch (e) {
                console.error(`解析响应失败: ${e.message}`);
                return { success: false, error: '服务器响应格式错误' };
            }

            // 处理注册结果
            if (data.success) {
                console.log('注册成功');
                return { success: true, message: data.message || '注册成功，请登录' };
            } else {
                console.error(`注册失败: ${data.error || '未知错误'}`);
                return { success: false, error: data.error || '注册失败，请稍后重试' };
            }
        } catch (error) {
            console.error(`注册过程中发生错误: ${error.message}`);
            return { success: false, error: `注册过程中发生错误: ${error.message}` };
        }
    }

    // 退出登录
    logout() {
        this.clearAuth();

        // 重定向到登录页面
        window.location.href = 'login.html';
    }

    // 检查页面访问权限
    checkPageAccess() {
        // 获取当前页面路径
        const currentPath = window.location.pathname;
        console.log('检查页面访问权限:', currentPath);

        // 登录页面不需要检查
        if (currentPath.includes('login.html')) {
            // 如果已登录，重定向到首页
            if (this.isLoggedIn()) {
                console.log('用户已登录，重定向到首页');
                window.location.href = '/';
            }
            return;
        }

        // 管理员页面检查
        if (currentPath.includes('admin.html')) {
            if (!this.isLoggedIn()) {
                // 未登录，重定向到登录页面
                console.log('用户未登录，重定向到登录页面');
                window.location.href = 'login.html';
                return;
            }

            if (!this.isAdmin()) {
                // 不是管理员，重定向到首页
                console.log('用户不是管理员，重定向到首页');
                alert('您没有权限访问管理页面');
                window.location.href = '/';
                return;
            }
        }

        // 其他页面检查是否登录
        if (!this.isLoggedIn()) {
            // 未登录，重定向到登录页面
            console.log('用户未登录，重定向到登录页面');
            window.location.href = 'login.html';
        }
    }
}

// 创建全局认证管理器实例
const auth = new AuthManager();

// 检查页面访问权限
auth.checkPageAccess();
