// 登录页面脚本
document.addEventListener('DOMContentLoaded', function () {
    console.log('login.js 加载完成');

    // 添加切换登录/注册表单的事件处理
    const toggleLogin = document.getElementById('toggle-login');
    const toggleRegister = document.getElementById('toggle-register');
    const loginContainer = document.querySelector('.login-container');

    if (toggleLogin && toggleRegister && loginContainer) {
        toggleLogin.addEventListener('click', function () {
            console.log('切换到登录表单');
            loginContainer.classList.remove('show-register');
            loginContainer.classList.add('show-login');
            toggleLogin.classList.add('active');
            toggleRegister.classList.remove('active');
        });

        toggleRegister.addEventListener('click', function () {
            console.log('切换到注册表单');
            loginContainer.classList.remove('show-login');
            loginContainer.classList.add('show-register');
            toggleRegister.classList.add('active');
            toggleLogin.classList.remove('active');
        });
    }
});