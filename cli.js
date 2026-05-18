#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const NOTES_DIR = path.join(process.env.HOME, '.wsx');
const VERSION = '1.0.0';

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新建笔记</title>
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
        .header p { color: #888; margin-top: 5px; }
        .container { flex: 1; padding: 30px; }
        textarea {
            width: 100%;
            height: calc(100vh - 200px);
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
            font-size: 14px;
        }
        button:hover { background: #ff6b6b; }
        .status { color: #888; margin-left: auto; align-self: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📝 欢迎使用 wsx 笔记</h1>
        <p>开始书写你的想法吧！使用 Ctrl+S 保存。</p>
    </div>
    <div class="container">
        <textarea id="editor" placeholder="在这里开始写作..."></textarea>
    </div>
    <div class="toolbar">
        <button onclick="saveNote()">💾 保存</button>
        <span class="status" id="status">未保存</span>
    </div>
    <script>
        const noteName = decodeURIComponent(location.search.split('note=')[1] || '未命名');
        document.title = noteName;
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
                    setTimeout(() => status.textContent = '已保存', 2000);
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

        fetch('/api/note/' + encodeURIComponent(noteName))
            .then(r => r.json())
            .then(data => { if (data.content) editor.value = data.content; })
            .catch(() => {});
    </script>
</body>
</html>`;

function ensureNotesDir() {
    if (!fs.existsSync(NOTES_DIR)) {
        fs.mkdirSync(NOTES_DIR, { recursive: true });
        console.log('📁 已创建笔记目录:', NOTES_DIR);
    }
}

function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
}

function getNotePath(name) {
    const fileName = sanitizeFileName(name) + '.html';
    return path.join(NOTES_DIR, fileName);
}

function noteExists(name) {
    return fs.existsSync(getNotePath(name));
}

function createNote(name, template = DEFAULT_TEMPLATE) {
    ensureNotesDir();
    const filePath = getNotePath(name);

    if (fs.existsSync(filePath)) {
        console.log('📄 笔记已存在:', name);
        return filePath;
    }

    fs.writeFileSync(filePath, template);
    console.log('✨ 已创建笔记:', name);
    return filePath;
}

function deleteNote(name) {
    ensureNotesDir();
    const filePath = getNotePath(name);

    if (!fs.existsSync(filePath)) {
        console.log('❌ 笔记不存在:', name);
        return false;
    }

    fs.unlinkSync(filePath);
    console.log('🗑️  已删除笔记:', name);
    return true;
}

function openBrowser(url) {
    const platform = process.platform;
    let cmd;

    if (platform === 'darwin') cmd = 'open';
    else if (platform === 'win32') cmd = 'start';
    else cmd = 'xdg-open';

    spawn(cmd, [url], { detached: true, stdio: 'ignore' });
}

function startServer() {
    const serverPath = path.join(__dirname, 'server.js');
    const server = spawn('node', [serverPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
    });

    server.stdout.on('data', (data) => {
        process.stdout.write(data);
        const match = data.toString().match(/使用端口 (\d+)/);
        if (match) {
            process.env.WSX_ACTUAL_PORT = match[1];
        }
    });

    server.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    server.on('error', (err) => {
        console.error('服务器启动失败:', err.message);
        process.exit(1);
    });

    return server;
}

function getMarkdownTemplate(name) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
            padding: 40px;
        }
        .editor {
            max-width: 800px;
            margin: 0 auto;
            background: #16213e;
            border-radius: 12px;
            padding: 30px;
            min-height: calc(100vh - 80px);
        }
        textarea {
            width: 100%;
            height: calc(100vh - 180px);
            background: transparent;
            border: none;
            color: #eee;
            font-size: 16px;
            line-height: 1.8;
            resize: none;
        }
        textarea:focus { outline: none; }
    </style>
</head>
<body>
    <div class="editor">
        <textarea id="editor" placeholder="开始写作..."></textarea>
    </div>
    <script>
        const noteName = decodeURIComponent(location.search.split('note=')[1] || '未命名');
        document.title = noteName;

        async function save() {
            const content = document.getElementById('editor').value;
            await fetch('/api/note/' + encodeURIComponent(noteName), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
        }

        document.getElementById('editor').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); }
        });

        fetch('/api/note/' + encodeURIComponent(noteName))
            .then(r => r.json())
            .then(data => { if (data.content) document.getElementById('editor').value = data.content; });
    </script>
</body>
</html>`;
}

// 主程序
const args = process.argv.slice(2);
const cmd = args[0];
const subCmd = args[1];

// 启动服务器并打开笔记
function launchNote(name, createIfNotExist = false) {
    if (createIfNotExist) {
        const template = args.includes('--md') ? getMarkdownTemplate(name) : DEFAULT_TEMPLATE;
        createNote(name, template);
    } else if (!noteExists(name)) {
        console.log('❌ 笔记不存在:', name);
        console.log('   使用 wsx -n ' + name + ' 创建笔记');
        return;
    }
    console.log('🚀 启动服务器...');
    startServer();
    setTimeout(() => {
        const port = process.env.WSX_ACTUAL_PORT || '3000';
        openBrowser(`http://localhost:${port}/editor.html?note=` + encodeURIComponent(name));
    }, 2000);
}

// 解析命令
if (cmd === '-n' && subCmd) {
    launchNote(subCmd, true);
} else if (cmd === 'activate' && subCmd) {
    launchNote(subCmd, false);
} else if (cmd === 'rm' && subCmd) {
    deleteNote(subCmd);
} else if (cmd === '--list') {
    ensureNotesDir();
    const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.html'));
    if (files.length === 0) {
        console.log('📭 暂无笔记');
    } else {
        console.log('📚 笔记列表:');
        files.forEach(f => console.log('  -', path.basename(f, '.html')));
    }
} else if (cmd === '--version') {
    console.log('wsx v' + VERSION);
} else if (cmd === '--help' || !cmd) {
    console.log(`
📝 wsx - 简洁的命令行笔记工具 v${VERSION}

用法:
  wsx -n <笔记名>      创建并打开新笔记
  wsx activate <笔记名>  打开已有笔记
  wsx rm <笔记名>      删除笔记
  wsx --list           列出所有笔记
  wsx --version        显示版本号
  wsx --help           显示帮助

示例:
  wsx -n 我的第一篇笔记      创建并打开
  wsx activate 我的第一篇笔记  打开已存在的笔记
  wsx rm 我的第一篇笔记      删除笔记
    `);
} else {
    console.log(`❌ 未知命令: ${cmd}`);
    console.log('   使用 wsx --help 查看帮助');
}
