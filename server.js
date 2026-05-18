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
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f5f5f5;
            --bg-header: #f0f0f0;
            --bg-editor: #ffffff;
            --text-primary: #333333;
            --text-secondary: #666666;
            --text-muted: #999999;
            --accent: #e94560;
            --border: #dddddd;
        }
        [data-theme="dark"] {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --bg-header: #16213e;
            --bg-editor: #16213e;
            --text-primary: #eeeeee;
            --text-secondary: #aaaaaa;
            --text-muted: #555555;
            --border: #0f3460;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; display: flex; flex-direction: column; }
        .header { background: var(--bg-header); padding: 15px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .header h1 { font-size: 1.3rem; color: var(--accent); }
        .note-name { color: var(--text-secondary); font-size: 0.9rem; }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .theme-toggle { background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .theme-toggle:hover { background: var(--accent); color: white; }
        .main-container { flex: 1; display: flex; overflow: hidden; }
        .editor-pane, .preview-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .pane-header { background: var(--bg-secondary); padding: 10px 20px; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--border); font-weight: 500; }
        .editor-wrapper { flex: 1; padding: 20px; background: var(--bg-editor); overflow: auto; }
        textarea { width: 100%; height: 100%; min-height: calc(100vh - 180px); background: transparent; border: none; color: var(--text-primary); font-size: 16px; line-height: 1.8; resize: none; font-family: monospace; }
        textarea:focus { outline: none; }
        .preview-wrapper { flex: 1; padding: 20px; background: var(--bg-primary); overflow: auto; }
        .preview-content { max-width: 800px; margin: 0 auto; line-height: 1.8; font-size: 16px; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; }
        .toolbar { background: var(--bg-header); padding: 12px 24px; display: flex; align-items: center; gap: 12px; border-top: 1px solid var(--border); }
        button { background: var(--accent); color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        button:hover { background: var(--accent); filter: brightness(1.1); }
        button:disabled { background: var(--text-muted); cursor: not-allowed; }
        .status { color: var(--text-secondary); font-size: 0.9rem; margin-left: auto; }
        .status.saving { color: #f39c12; }
        .status.saved { color: #27ae60; }
        .status.error { color: #e74c3c; }
        .shortcuts { background: var(--bg-secondary); padding: 8px 20px; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border); }
        .shortcuts kbd { background: var(--bg-primary); padding: 2px 6px; border-radius: 4px; margin: 0 2px; border: 1px solid var(--border); }
        @media (max-width: 768px) { .main-container { flex-direction: column; } .preview-pane { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <h1>📝 wsx</h1>
            <span class="note-name">${escapeHtml(name)}</span>
        </div>
        <div class="header-right">
            <button class="theme-toggle" id="themeToggle">🌙 深色模式</button>
        </div>
    </div>
    <div class="main-container">
        <div class="editor-pane">
            <div class="pane-header">✏️ 编辑</div>
            <div class="editor-wrapper">
                <textarea id="editor" placeholder="在这里开始写作..."></textarea>
            </div>
        </div>
        <div class="preview-pane">
            <div class="pane-header">👁️ 预览</div>
            <div class="preview-wrapper">
                <div class="preview-content" id="preview"></div>
            </div>
        </div>
    </div>
    <div class="shortcuts"><kbd>Ctrl</kbd>+<kbd>S</kbd> 保存 | <kbd>Ctrl</kbd>+<kbd>P</kbd> 切换预览</div>
    <div class="toolbar">
        <button id="saveBtn">💾 保存</button>
        <span class="status" id="status">就绪</span>
    </div>
    <script>
        const noteName = '${escapeHtml(name)}';
        const noteContent = '${escapeHtml(content)}';
        let hasChanges = false, isSaving = false, showPreview = true;

        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        const status = document.getElementById('status');
        const saveBtn = document.getElementById('saveBtn');
        const themeToggle = document.getElementById('themeToggle');

        function loadTheme() {
            const theme = localStorage.getItem('wsx-theme') || 'light';
            if (theme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.textContent = '☀️ 浅色模式';
            }
        }

        function toggleTheme() {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('wsx-theme', 'light');
                themeToggle.textContent = '🌙 深色模式';
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('wsx-theme', 'dark');
                themeToggle.textContent = '☀️ 浅色模式';
            }
        }

        function updatePreview() {
            preview.textContent = editor.value;
        }

        function togglePreview() {
            showPreview = !showPreview;
            document.querySelector('.preview-pane').style.display = showPreview ? 'flex' : 'none';
        }

        async function save() {
            if (isSaving || !hasChanges) return;
            isSaving = true;
            saveBtn.disabled = true;
            status.textContent = '保存中...';
            status.className = 'status saving';
            try {
                const response = await fetch('/api/note/' + encodeURIComponent(noteName), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: editor.value })
                });
                if (!response.ok) throw new Error('保存失败');
                hasChanges = false;
                status.textContent = '已保存 ✓';
                status.className = 'status saved';
            } catch (err) {
                status.textContent = '保存失败';
                status.className = 'status error';
            } finally {
                isSaving = false;
                saveBtn.disabled = false;
            }
        }

        editor.addEventListener('input', () => { hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview(); });
        saveBtn.addEventListener('click', save);
        themeToggle.addEventListener('click', toggleTheme);
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
                if (e.key.toLowerCase() === 'p') { e.preventDefault(); togglePreview(); }
            }
        });
        window.addEventListener('beforeunload', (e) => { if (hasChanges) { e.preventDefault(); e.returnValue = ''; } });

        loadTheme();
        if (noteContent) { editor.value = noteContent; updatePreview(); }
        document.title = noteName;
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
