@echo off
echo 正在启动 Web NAS 服务器...

:: 设置 Cloudinary 环境变量
set CLOUDINARY_API_KEY=355121145328855
set CLOUDINARY_API_SECRET=wGcHBoxzsQPWkzOGNtId2i28SbU

:: 创建必要的目录
if not exist "storage" mkdir storage
if not exist "data" mkdir data

:: 启动服务器
node server.js

pause 