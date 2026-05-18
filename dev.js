const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORT_FILE = path.join(process.cwd(), '.wsx-port');
const DEFAULT_PORT = 3000;

// 查找可用端口
function findAvailablePort(startPort) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            server.once('close', () => resolve(startPort));
            server.close();
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

// 检查端口是否有响应
function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            resolve(false);
        });
        socket.connect(port, '127.0.0.1');
    });
}

// 启动后端服务
async function startBackend(port) {
    console.log(`🚀 启动后端服务 (端口 ${port})...`);

    const backend = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, WSX_PORT: String(port) }
    });

    backend.stdout.on('data', (data) => {
        process.stdout.write(data);
    });

    backend.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    return new Promise((resolve) => {
        backend.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('服务器已启动')) {
                resolve(backend);
            }
        });
        // 超时保护
        setTimeout(() => resolve(backend), 3000);
    });
}

// 启动前端开发服务器
function startFrontend() {
    console.log('🚀 启动前端开发服务器...');
    console.log('💡 访问 http://localhost:5173 使用编辑器');
    console.log('');

    const frontend = spawn('npm', ['run', 'dev'], {
        cwd: path.join(process.cwd(), 'frontend'),
        stdio: 'inherit'
    });

    return frontend;
}

// 主函数
async function main() {
    console.log('📝 wsx 开发环境启动器\n');

    // 清理旧的端口文件
    if (fs.existsSync(PORT_FILE)) {
        fs.unlinkSync(PORT_FILE);
    }

    // 查找可用端口
    const port = await findAvailablePort(DEFAULT_PORT);
    console.log(`⚡ 使用端口 ${port} 启动服务\n`);

    // 写入端口文件供 Vite 读取
    fs.writeFileSync(PORT_FILE, String(port));

    // 启动后端
    await startBackend(port);

    // 等待后端就绪
    await new Promise(r => setTimeout(r, 500));

    // 启动前端
    startFrontend();
}

main().catch(console.error);
