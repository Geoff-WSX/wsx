const express = require('express');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const NOTES_DIR = path.join(process.env.HOME, '.wsx');
const PORT = process.env.WSX_PORT || 3000;

// 尝试查找可用端口
function findAvailablePort(startPort) {
    const net = require('net');
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

async function startServer() {
    const actualPort = await findAvailablePort(PORT);
    if (actualPort !== PORT) {
        console.log(`⚠️  端口 ${PORT} 已被占用，使用端口 ${actualPort}`);
    }

    const server = app.listen(actualPort, () => {
        console.log(`🚀 wsx 服务器已启动: http://localhost:${actualPort}`);
        console.log(`📁 笔记目录: ${NOTES_DIR}`);
        console.log(`💡 访问 http://localhost:${actualPort}/editor.html 打开编辑器`);
    });

    // 将实际端口保存到文件供 Vite 代理读取
    const portFile = path.join(process.cwd(), '.wsx-port');
    fs.writeFileSync(portFile, String(actualPort));

    // 将实际端口保存到全局供 cli.js 读取
    process.env.WSX_ACTUAL_PORT = actualPort;

    return server;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 防止路径穿越攻击 - 验证笔记名称
function validateNoteName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: '笔记名称不能为空' };
    }

    // 禁止路径穿越字符
    if (name.includes('..') || name.includes('/') || name.includes('\\') || name.includes('\0')) {
        return { valid: false, error: '笔记名称包含非法字符' };
    }

    // 长度限制
    if (name.length > 255) {
        return { valid: false, error: '笔记名称过长' };
    }

    // 允许中文、英文、数字、下划线和中划线
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/;
    if (!validPattern.test(name)) {
        return { valid: false, error: '笔记名称只能包含中文、英文、数字、下划线和中划线' };
    }

    return { valid: true };
}

// 获取笔记内容
app.get('/api/note/:name', (req, res) => {
    const { valid, error } = validateNoteName(req.params.name);
    if (!valid) {
        return res.status(400).json({ error });
    }

    const filePath = path.join(NOTES_DIR, req.params.name + '.html');

    // 确保在笔记目录内（防止符号链接攻击）
    if (!filePath.startsWith(NOTES_DIR)) {
        return res.status(403).json({ error: '禁止访问' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '笔记不存在' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // 简单提取body内容
        const match = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const bodyContent = match ? match[1] : '';
        // 提取textarea中的内容
        const textareaMatch = bodyContent.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i);
        const textContent = textareaMatch ? textareaMatch[1] : '';

        res.json({ content: textContent });
    } catch (err) {
        res.status(500).json({ error: '读取失败' });
    }
});

// 保存笔记
app.post('/api/note/:name', (req, res) => {
    const { valid, error } = validateNoteName(req.params.name);
    if (!valid) {
        return res.status(400).json({ error });
    }

    if (!req.body || typeof req.body.content !== 'string') {
        return res.status(400).json({ error: '内容无效' });
    }

    // 限制内容大小（5MB）
    if (req.body.content.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: '内容过大' });
    }

    const filePath = path.join(NOTES_DIR, req.params.name + '.html');

    // 确保在笔记目录内
    if (!filePath.startsWith(NOTES_DIR)) {
        return res.status(403).json({ error: '禁止访问' });
    }

    // 确保目录存在
    if (!fs.existsSync(NOTES_DIR)) {
        fs.mkdirSync(NOTES_DIR, { recursive: true });
    }

    try {
        // 读取现有模板，替换内容
        let template;
        if (fs.existsSync(filePath)) {
            template = fs.readFileSync(filePath, 'utf-8');
            // 替换textarea内容
            template = template.replace(/<textarea[^>]*>[\s\S]*?<\/textarea>/i,
                `<textarea id="editor">${escapeHtml(req.body.content)}</textarea>`);
        } else {
            // 使用默认模板
            template = getDefaultTemplate(req.params.name, req.body.content);
        }

        fs.writeFileSync(filePath, template, 'utf-8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: '保存失败' });
    }
});

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getDefaultTemplate(name, content) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(name)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .header {
            background: #16213e;
            padding: 20px 30px;
            border-bottom: 1px solid #0f3460;
        }
        .header h1 { font-size: 1.5rem; color: #e94560; }
        .container { flex: 1; padding: 30px; }
        textarea {
            width: 100%;
            height: calc(100vh - 180px);
            background: #16213e;
            border: 1px solid #0f3460;
            border-radius: 8px;
            color: #eee;
            padding: 20px;
            font-size: 16px;
            resize: none;
        }
        textarea:focus { outline: none; border-color: #e94560; }
        .toolbar {
            background: #16213e;
            padding: 15px 30px;
            display: flex;
            gap: 10px;
            border-top: 1px solid #0f3460;
        }
        button {
            background: #e94560;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
        }
        button:hover { background: #ff6b6b; }
        .status { color: #888; margin-left: auto; align-self: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📝 ${escapeHtml(name)}</h1>
    </div>
    <div class="container">
        <textarea id="editor">${escapeHtml(content)}</textarea>
    </div>
    <div class="toolbar">
        <button onclick="saveNote()">💾 保存</button>
        <span class="status" id="status">已保存</span>
    </div>
    <script>
        const noteName = decodeURIComponent(location.search.split('note=')[1] || '');
        let hasChanges = false;

        const editor = document.getElementById('editor');
        const status = document.getElementById('status');

        editor.addEventListener('input', () => {
            hasChanges = true;
            status.textContent = '未保存';
        });

        async function saveNote() {
            try {
                const response = await fetch('/api/note/' + encodeURIComponent(noteName), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: editor.value })
                });
                if (response.ok) {
                    hasChanges = false;
                    status.textContent = '已保存 ✓';
                } else {
                    status.textContent = '保存失败';
                }
            } catch (err) {
                status.textContent = '网络错误';
            }
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveNote();
            }
        });
    </script>
</body>
</html>`;
}

// WebSocket 服务器 - 实时同步
startServer().then((server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('📡 客户端已连接');

        ws.on('close', () => {
            console.log('📴 客户端已断开');
        });
    });
});

// 确保笔记目录存在
if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
}
