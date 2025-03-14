// 主应用JavaScript文件
document.addEventListener('DOMContentLoaded', function () { if (!isLoggedIn()) { window.location.href = 'login.html'; return; } const user = getCurrentUser(); console.log('当前用户:', user); });
function updateUserInfo() { const userInfo = document.getElementById('user-info'); if (!userInfo) return; const user = getCurrentUser(); if (user) { userInfo.innerHTML = 用户: <strong></strong> [] < a href = '#' id = 'logout-link' > 登出</a >; document.getElementById('logout-link').addEventListener('click', function (e) { e.preventDefault(); logout(); window.location.href = 'login.html'; }); } }
document.addEventListener('DOMContentLoaded', function () { updateUserInfo(); });
