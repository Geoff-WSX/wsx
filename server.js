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
        .header { background: var(--bg-header); padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .header-left { display: flex; align-items: center; gap: 16px; }
        .header h1 { font-size: 1.2rem; color: var(--accent); }
        .note-name { color: var(--text-secondary); font-size: 0.9rem; }
        .toolbar { display: flex; align-items: center; gap: 4px; }
        .toolbar-btn { background: transparent; border: 1px solid transparent; color: var(--text-primary); padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 14px; font-family: inherit; }
        .toolbar-btn:hover { background: var(--bg-secondary); border-color: var(--border); }
        .toolbar-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
        .toolbar-sep { width: 1px; height: 20px; background: var(--border); margin: 0 8px; }
        .header-right { display: flex; align-items: center; gap: 12px; }
        .theme-toggle { background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .theme-toggle:hover { background: var(--accent); color: white; }
        .main-container { flex: 1; display: flex; overflow: hidden; }
        .editor-pane, .preview-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .pane-header { background: var(--bg-secondary); padding: 8px 16px; font-size: 0.8rem; color: var(--text-secondary); border-bottom: 1px solid var(--border); }
        .editor-wrapper { flex: 1; padding: 16px; background: var(--bg-editor); overflow: auto; }
        textarea { width: 100%; height: 100%; min-height: calc(100vh - 140px); background: transparent; border: none; color: var(--text-primary); font-size: 15px; line-height: 1.8; resize: none; font-family: monospace; }
        textarea:focus { outline: none; }
        .preview-wrapper { flex: 1; padding: 16px; background: var(--bg-primary); overflow: auto; }
        .preview-content { max-width: 800px; margin: 0 auto; line-height: 1.8; font-size: 15px; font-family: monospace; white-space: pre-wrap; word-wrap: break-word; }
        .preview-content .bold { font-weight: bold; }
        .preview-content .italic { font-style: italic; }
        .preview-content .strike { text-decoration: line-through; }
        .preview-content .underline { text-decoration: underline; }
        .preview-content .h1 { font-size: 2em; font-weight: bold; margin: 0.5em 0; display: block; }
        .preview-content .h2 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; display: block; }
        .preview-content .h3 { font-size: 1.25em; font-weight: bold; margin: 0.5em 0; display: block; }
        .preview-content .quote { border-left: 4px solid var(--accent); padding-left: 12px; color: var(--text-secondary); margin: 0.5em 0; display: block; }
        .preview-content .code { background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--accent); }
        .preview-content .url { color: var(--accent); text-decoration: underline; }
        .preview-content .line { display: block; margin: 0.25em 0; }
        .footer { background: var(--bg-secondary); padding: 8px 20px; font-size: 0.75rem; color: var(--text-muted); border-top: 1px solid var(--border); display: flex; justify-content: space-between; }
        .footer kbd { background: var(--bg-primary); padding: 2px 5px; border-radius: 3px; margin: 0 2px; border: 1px solid var(--border); font-family: inherit; }
        .save-status { display: flex; align-items: center; gap: 8px; }
        button { background: var(--accent); color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
        button:hover { background: var(--accent); filter: brightness(1.1); }
        button:disabled { background: var(--text-muted); cursor: not-allowed; }
        .status { color: var(--text-secondary); font-size: 0.9rem; }
        .status.saving { color: #f39c12; }
        .status.saved { color: #27ae60; }
        .status.error { color: #e74c3c; }
        .preview-content .highlight { background: #ffeb3b; padding: 2px 4px; border-radius: 3px; }
        .preview-content .code-block { background: var(--bg-secondary); padding: 12px 16px; border-radius: 6px; margin: 0.5em 0; overflow-x: auto; display: block; }
        .preview-content .code-block code { color: var(--accent); font-size: 14px; }
        .preview-content .ul-item { display: block; padding-left: 1.5em; }
        .preview-content .ul-marker { color: var(--accent); margin-right: 8px; }
        .preview-content .ol-item { display: block; padding-left: 1.5em; }
        .preview-content .ol-marker { color: var(--accent); margin-right: 8px; }
        .preview-content .task-item { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
        .preview-content .task-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
        .preview-content .hr-line { border: none; border-top: 2px solid var(--border); margin: 1em 0; }
        .preview-content .img { max-width: 100%; border-radius: 4px; margin: 0.5em 0; }
        .preview-content .table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .preview-content .table td, .preview-content .table th { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
        .preview-content .math { font-family: 'Times New Roman', serif; font-style: italic; color: var(--accent); }
        .preview-content .footnote { color: var(--accent); font-size: 0.8em; vertical-align: super; }
        .preview-content .toc { background: var(--bg-secondary); padding: 12px 16px; border-radius: 6px; margin: 0.5em 0; }
        .preview-content mark { background: #ffeb3b; color: #333; padding: 2px 4px; border-radius: 3px; }
        [data-theme="dark"] .preview-content mark { background: #5a4a00; color: #fff; }
        .toolbar { display: flex; }
        .toolbar.hide { display: none; }
        .toolbar-toggle { background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .toolbar-toggle:hover { background: var(--accent); color: white; }
        .edit-toggle { background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
        .edit-toggle:hover { background: var(--accent); color: white; }
        /* 编辑器默认隐藏，切换显示 */
        .editor-pane { display: none; }
        .editor-pane.show { display: flex; }
        .preview-pane { flex: 1; }
        .preview-content { display: block; }
        .preview-content.hidden { display: none; }
        .preview-editor { display: none; width: 100%; height: 100%; min-height: calc(100vh - 140px); background: var(--bg-editor); border: none; color: var(--text-primary); font-size: 15px; line-height: 1.8; resize: none; font-family: monospace; padding: 16px; box-sizing: border-box; }
        .preview-editor.show { display: block !important; }
        .preview-editor:focus { outline: none; }
        @media (max-width: 768px) { .main-container { flex-direction: column; } .preview-pane { display: none; } .toolbar { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <h1>📝 wsx</h1>
            <span class="note-name">${escapeHtml(name)}</span>
        </div>
        <button class="toolbar-toggle" id="toolbarToggle">⚙ 工具栏</button>
        <button class="edit-toggle" id="editToggle">✏️ 编辑</button>
        <div class="toolbar" id="toolbar">
            <button class="toolbar-btn" onclick="format('bold')" title="加粗"><b>B</b></button>
            <button class="toolbar-btn" onclick="format('italic')" title="斜体"><i>I</i></button>
            <button class="toolbar-btn" onclick="format('strike')" title="删除线"><s>S</s></button>
            <button class="toolbar-btn" onclick="format('underline')" title="下划线"><u>U</u></button>
            <button class="toolbar-btn" onclick="format('highlight')" title="高亮"><mark>H</mark></button>
            <div class="toolbar-sep"></div>
            <button class="toolbar-btn" onclick="format('h1')" title="一级标题">H1</button>
            <button class="toolbar-btn" onclick="format('h2')" title="二级标题">H2</button>
            <button class="toolbar-btn" onclick="format('h3')" title="三级标题">H3</button>
            <div class="toolbar-sep"></div>
            <button class="toolbar-btn" onclick="format('quote')" title="引用">❝</button>
            <button class="toolbar-btn" onclick="format('code')" title="行内代码">code</button>
            <button class="toolbar-btn" onclick="format('codeblock')" title="代码块">&lt;/&gt;</button>
            <div class="toolbar-sep"></div>
            <button class="toolbar-btn" onclick="format('ul')" title="无序列表">•</button>
            <button class="toolbar-btn" onclick="format('ol')" title="有序列表">1.</button>
            <button class="toolbar-btn" onclick="format('task')" title="任务列表">[ ]</button>
            <div class="toolbar-sep"></div>
            <button class="toolbar-btn" onclick="format('link')" title="链接">🔗</button>
            <button class="toolbar-btn" onclick="format('image')" title="图片">🖼</button>
            <button class="toolbar-btn" onclick="format('table')" title="表格">▦</button>
            <button class="toolbar-btn" onclick="format('hr')" title="水平线">—</button>
            <button class="toolbar-btn" onclick="format('math')" title="数学公式">∑</button>
        </div>
        <div class="header-right">
            <button class="theme-toggle" id="themeToggle">🌙 深色</button>
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
                <textarea id="previewEditor" class="preview-editor" placeholder="在这里直接编辑..."></textarea>
            </div>
        </div>
    </div>
    <div class="footer">
        <div>
            <kbd>Ctrl</kbd>+<kbd>S</kbd> 保存 |
            <kbd>Ctrl</kbd>+<kbd>B</kbd> 加粗 |
            <kbd>Ctrl</kbd>+<kbd>I</kbd> 斜体 |
            <kbd>Ctrl</kbd>+<kbd>U</kbd> 下划线
        </div>
        <div class="save-status">
            <span class="status" id="status">就绪</span>
        </div>
    </div>
    <script>
        const Parser = {
            formats: {
                bold: { start: '<b>', end: '</b>' },
                italic: { start: '<i>', end: '</i>' },
                strike: { start: '<s>', end: '</s>' },
                underline: { start: '<u>', end: '</u>' },
                highlight: { start: '<mark>', end: '</mark>' },
                code: { start: '<span class="code">', end: '</span>' },
                quote: { start: '<span class="quote">', end: '</span>' },
                h1: { start: '<span class="h1">', end: '</span>' },
                h2: { start: '<span class="h2">', end: '</span>' },
                h3: { start: '<span class="h3">', end: '</span>' }
            },
            parse(text) {
                if (!text) return '';
                let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                // 代码块处理
                html = this.parseCodeBlocks(html);

                const lines = html.split('\n');
                html = lines.map(line => {
                    if (line.startsWith('===')) return '<span class="h1 line">' + line.slice(4).trim() + '</span>';
                    if (line.startsWith('== ')) return '<span class="h2 line">' + line.slice(3).trim() + '</span>';
                    if (line.startsWith('= ')) return '<span class="h3 line">' + line.slice(2).trim() + '</span>';
                    if (line.startsWith('&gt;')) return '<span class="quote line">' + line.slice(5).trim() + '</span>';
                    // 无序列表
                    if (line.match(/^[\-\*] /)) {
                        const content = line.slice(2);
                        if (content.startsWith('[ ] ') || content.startsWith('[x] ') || content.startsWith('[X] ')) {
                            const checked = content.startsWith('[x] ') || content.startsWith('[X] ');
                            const itemContent = content.slice(4);
                            return '<span class="task-item line">' + (checked ? '<input type="checkbox" disabled checked>' : '<input type="checkbox" disabled>') + ' ' + this.parseInline(itemContent) + '</span>';
                        }
                        return '<span class="ul-item line"><span class="ul-marker">•</span> ' + this.parseInline(content) + '</span>';
                    }
                    // 有序列表
                    if (line.match(/^\d+\. /)) {
                        const match = line.match(/^(\d+)\. (.*)/);
                        return '<span class="ol-item line"><span class="ol-marker">' + match[1] + '.</span> ' + this.parseInline(match[2]) + '</span>';
                    }
                    // 水平线
                    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
                        return '<hr class="hr-line">';
                    }
                    // 表格行
                    if (line.startsWith('|') && line.endsWith('|')) {
                        return this.parseTableRow(line);
                    }
                    // 目录
                    if (line.trim() === '[TOC]') {
                        return '<div class="toc">[TOC]</div>';
                    }
                    return '<span class="line">' + this.parseInline(line) + '</span>';
                }).join('\n');
                return html;
            },
            parseCodeBlocks(text) {
                return text.replace(/\x60\x60\x60([\s\S]*?)\x60\x60\x60/g, (match, code) => {
                    return '<pre class="code-block"><code>' + code.trim() + '</code></pre>';
                });
            },
            parseTableRow(line) {
                const cells = line.split('|').filter((c, i) => i > 0 && i < line.split('|').length - 1);
                const isHeader = cells.some(c => c.trim().match(/^[\-\:]+$/));
                if (isHeader) return '';
                const row = cells.map(cell => '<td>' + this.parseInline(cell.trim()) + '</td>').join('');
                return '<table class="table"><tr>' + row + '</tr></table>';
            },
            parseInline(text) {
                text = text.replace(/\x60\x60([^\x60]+)\x60\x60/g, '<span class="code">$1</span>');
                text = text.replace(/==([^=]+)==/g, '<mark>$1</mark>');
                text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
                text = text.replace(/(?<![^*])\*([^*]+)\*(?![^*])/g, '<i>$1</i>');
                text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
                text = text.replace(/__([^_]+)__/g, '<u>$1</u>');
                text = text.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');
                text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="img">');
                text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="url" target="_blank">$1</a>');
                text = text.replace(/\[\^(\d+)\]/g, '<sup class="footnote">[$1]</sup>');
                return text;
            }
        };

        // 自动格式化模块
        const AutoFormat = {
            config: {
                indentHeadingMap: {
                    2: '== ',
                    4: '= '
                },
                chapterKeywords: [
                    /^第.+章/,
                    /^Chapter\s+\d+/i,
                    /^第\d+章/,
                    /^第[一二三四五六七八九十百千零〇]+章/
                ],
                codePatterns: {
                    python: [/^def\s+\w+/, /^class\s+\w+/, /^import\s+\w+/, /^from\s+\w+/, /^print\s*\(/, /^if\s+.+:/, /^for\s+.+:/, /^while\s+.+:/, /^elif\s+.+:/, /^else\s*:/, /^try\s*:/, /^except\s*.+:/, /^with\s+.+:/],
                    javascript: [/^function\s+\w+/, /^const\s+\w+\s*=/, /^let\s+\w+\s*=/, /^var\s+\w+\s*=/, /^\w+\s*=>\s*[{(]/, /^class\s+\w+/, /^import\s+.+from/, /^export\s+/, /^console\.\w+/, /^if\s*\(.+\)/, /^for\s*\(.+\)/, /^while\s*\(.+\)/, /^async\s+function/, /^await\s+/],
                    java: [/^public\s+class\s+/, /^private\s+class\s+/, /^protected\s+/, /^public\s+static\s+void\s+main/, /^System\.out\./, /^import\s+java\./, /^package\s+/, /^public\s+\w+\s*\(/, /^private\s+\w+\s*\(/],
                    c: [/^#include\s*</, /^#define\s+/, /^int\s+main\s*\(/, /^void\s+\w+\s*\(/, /^char\s+\w+\s*\[/, /^int\s+\w+\s*=/, /^float\s+\w+\s*=/, /^double\s+\w+\s*=/, /^struct\s+\w+/, /^typedef\s+/],
                    cpp: [/^#include\s*</, /^#include\s*"/, /^using\s+namespace\s+/, /^std::/, /^class\s+\w+\s*[:{]/, /^public:/, /^private:/, /^protected:/, /^virtual\s+\w+/],
                    go: [/^package\s+\w+/, /^func\s+\w+/, /^import\s+\(/, /^type\s+\w+\s+struct/, /^type\s+\w+\s+interface/, /^func\s*\(/, /^go\s+func/, /^defer\s+/],
                    rust: [/^fn\s+\w+/, /^let\s+mut\s+/, /^let\s+\w+\s*:/, /^impl\s+\w+/, /^struct\s+\w+/, /^enum\s+\w+/, /^pub\s+fn/, /^use\s+\w+::/, /^mod\s+\w+/, /^impl\s+\w+\s+for/],
                    sql: [/^SELECT\s+/i, /^FROM\s+/i, /^WHERE\s+/i, /^INSERT\s+INTO/i, /^UPDATE\s+\w+\s+SET/i, /^CREATE\s+TABLE/i, /^ALTER\s+TABLE/i, /^DROP\s+TABLE/i, /^JOIN\s+/i],
                    shell: [/^#!/, /^echo\s+/, /^export\s+\w+=/, /^if\s+\[\s+/, /^for\s+\w+\s+in/, /^while\s+/, /^\$\w+/, /^source\s+/]
                }
            },

            getIndent(line) {
                return line.match(/^(\s*)/)[1].length;
            },

            isFormatted(line) {
                const trimmed = line.trim();
                return trimmed.startsWith('===') || trimmed.startsWith('== ') || trimmed.startsWith('= ') || trimmed.startsWith('\x60\x60\x60') || trimmed.startsWith('> ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed);
            },

            detectHeadingByIndent(line) {
                const trimmed = line.trim();
                if (!trimmed || this.isFormatted(line)) return null;
                const indent = this.getIndent(line);
                const marker = this.config.indentHeadingMap[indent];
                if (marker) {
                    return { marker, content: line };
                }
                return null;
            },

            detectChapterKeyword(line) {
                const trimmed = line.trim();
                if (!trimmed || this.isFormatted(line)) return null;
                for (const pattern of this.config.chapterKeywords) {
                    if (pattern.test(trimmed)) {
                        return { marker: '=== ', content: line };
                    }
                }
                return null;
            },

            detectCodePattern(line) {
                const trimmed = line.trim();
                if (!trimmed || this.isFormatted(line)) return null;
                for (const [lang, patterns] of Object.entries(this.config.codePatterns)) {
                    for (const pattern of patterns) {
                        if (pattern.test(trimmed)) {
                            return { language: lang, line: trimmed };
                        }
                    }
                }
                return null;
            },

            getCurrentLine(textarea) {
                const pos = textarea.selectionStart;
                const text = textarea.value;
                const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
                const lineEnd = text.indexOf('\n', pos);
                return {
                    line: text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd),
                    lineStart,
                    lineEnd: lineEnd === -1 ? text.length : lineEnd
                };
            },

            applyHeading(textarea, lineStart, marker, content) {
                const text = textarea.value;
                const before = text.substring(0, lineStart);
                const after = text.substring(lineStart + content.length);
                textarea.value = before + marker + content + after;
                const newPos = lineStart + marker.length + content.length;
                textarea.selectionStart = textarea.selectionEnd = newPos;
            },

            applyCodeBlock(textarea, lineStart, lineEnd, language, line) {
                const text = textarea.value;
                const before = text.substring(0, lineStart);
                const after = text.substring(lineEnd);
                const codeBlock = '\x60\x60\x60' + language + '\n' + line.trim() + '\n\x60\x60\x60';
                textarea.value = before + codeBlock + after;
                textarea.selectionStart = textarea.selectionEnd = before.length + 4 + language.length + line.trim().length + 5;
            },

            checkAndFormat(textarea, trigger) {
                const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
                if (hasSelection) return;

                const { line, lineStart, lineEnd } = this.getCurrentLine(textarea);
                const trimmed = line.trim();

                if (!trimmed) return;
                if (this.isFormatted(line)) return;

                if (trigger === 'enter') {
                    const lineBeforeCursor = textarea.value.substring(textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1, textarea.selectionStart);
                    const trimmedBefore = lineBeforeCursor.trim();
                    if (!trimmedBefore) return;
                    if (this.isFormatted(lineBeforeCursor)) return;

                    const chapterResult = this.detectChapterKeyword(lineBeforeCursor);
                    if (chapterResult) {
                        const ls = textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
                        this.applyHeading(textarea, ls, chapterResult.marker, lineBeforeCursor);
                        return;
                    }

                    const indentResult = this.detectHeadingByIndent(lineBeforeCursor);
                    if (indentResult) {
                        const ls = textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
                        this.applyHeading(textarea, ls, indentResult.marker, lineBeforeCursor);
                    }
                    return;
                }

                if (trigger === 'space') {
                    const pos = textarea.selectionStart;
                    const lineStartPos = textarea.value.lastIndexOf('\n', pos - 1) + 1;
                    if (pos !== lineStartPos) return;

                    const indentResult = this.detectHeadingByIndent(line);
                    if (indentResult) {
                        this.applyHeading(textarea, lineStart, indentResult.marker, indentResult.content);
                    }
                    return;
                }

                const codeResult = this.detectCodePattern(line);
                if (codeResult) {
                    this.applyCodeBlock(textarea, lineStart, lineEnd, codeResult.language, line);
                    return;
                }

                const chapterResult = this.detectChapterKeyword(line);
                if (chapterResult) {
                    this.applyHeading(textarea, lineStart, chapterResult.marker, chapterResult.content);
                    return;
                }

                const indentResult = this.detectHeadingByIndent(line);
                if (indentResult) {
                    this.applyHeading(textarea, lineStart, indentResult.marker, indentResult.content);
                }
            },

            install(textarea) {
                textarea.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        setTimeout(() => this.checkAndFormat(textarea, 'enter'), 0);
                    }
                    if (e.key === ' ') {
                        const pos = textarea.selectionStart;
                        const lineStart = textarea.value.lastIndexOf('\n', pos - 1) + 1;
                        if (pos === lineStart) {
                            setTimeout(() => this.checkAndFormat(textarea, 'space'), 0);
                        }
                    }
                });

                textarea.addEventListener('input', () => {
                    this.checkAndFormat(textarea, 'input');
                });
            },

            getCursorPos(element) {
                const selection = window.getSelection();
                if (selection.rangeCount === 0) return 0;
                const range = selection.getRangeAt(0);
                const preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(element);
                preCaretRange.setEnd(range.startContainer, range.startOffset);
                return preCaretRange.toString().length;
            },

            getCurrentLineForContentEditable(element) {
                const pos = this.getCursorPos(element);
                const text = element.innerText;
                const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
                const lineEnd = text.indexOf('\n', pos);
                return {
                    line: text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd),
                    lineStart,
                    lineEnd: lineEnd === -1 ? text.length : lineEnd
                };
            },

            installPreview(preview, editor) {
                preview.addEventListener('keydown', (e) => {
                    this.handlePreviewKeydown(preview, editor, e);
                });

                preview.addEventListener('input', () => {
                    this.checkAndFormatForPreview(preview, editor, 'input');
                });
            },

            handlePreviewKeydown(preview, editor, e) {
                if (e.key === 'Enter') {
                    setTimeout(() => {
                        const cursorPos = this.getCursorPos(preview);
                        const textBeforeCursor = preview.innerText.substring(0, cursorPos);
                        const lastNewline = textBeforeCursor.lastIndexOf('\n');
                        const lineBeforeCursor = textBeforeCursor.substring(lastNewline + 1);
                        if (lineBeforeCursor.trim() && !this.isFormatted(lineBeforeCursor)) {
                            const chapterResult = this.detectChapterKeyword(lineBeforeCursor);
                            if (chapterResult) {
                                const newText = lineBeforeCursor.replace(lineBeforeCursor.trim(), chapterResult.marker + lineBeforeCursor.trim());
                                const fullText = preview.innerText;
                                const lineStartPos = lastNewline + 1;
                                const before = fullText.substring(0, lineStartPos);
                                const after = fullText.substring(lineStartPos + lineBeforeCursor.length);
                                editor.value = before + newText + after;
                                preview.innerHTML = Parser.parse(editor.value);
                                const newPos = lineStartPos + chapterResult.marker.length + lineBeforeCursor.trim().length;
                                this.setCursorPosition(preview, newPos);
                            }
                        }
                    }, 0);
                }
                if (e.key === ' ') {
                    const cursorPos = this.getCursorPos(preview);
                    const text = preview.innerText;
                    const lineStartPos = text.lastIndexOf('\n', cursorPos - 1) + 1;
                    if (cursorPos === lineStartPos) {
                        setTimeout(() => this.formatPreviewSpace(preview, editor, cursorPos), 0);
                    }
                }
            },

            formatPreviewSpace(preview, editor, cursorPos) {
                const text = preview.innerText;
                const lineStartPos = text.lastIndexOf('\n', cursorPos - 1) + 1;
                const lineEnd = text.indexOf('\n', cursorPos);
                const line = text.substring(lineStartPos, lineEnd === -1 ? text.length : lineEnd);
                const trimmed = line.trim();
                if (!trimmed || this.isFormatted(line)) return;

                const indentResult = this.detectHeadingByIndent(line);
                if (indentResult) {
                    const newText = indentResult.marker + trimmed;
                    const before = text.substring(0, lineStartPos);
                    const after = text.substring(lineStartPos + line.length);
                    editor.value = before + newText + after;
                    preview.innerHTML = Parser.parse(editor.value);
                    const newPos = lineStartPos + indentResult.marker.length + trimmed.length;
                    this.setCursorPosition(preview, newPos);
                }
            },

            checkAndFormatForPreview(preview, editor, trigger) {
                const hasSelection = window.getSelection().toString().length > 0;
                if (hasSelection) return;

                const { line, lineStart, lineEnd } = this.getCurrentLineForContentEditable(preview);
                const trimmed = line.trim();
                if (!trimmed) return;
                if (this.isFormatted(line)) return;

                if (trigger === 'enter') return;

                if (trigger === 'space') return;

                const codeResult = this.detectCodePattern(line);
                if (codeResult) {
                    const codeBlock = '\x60\x60\x60' + codeResult.language + '\n' + trimmed + '\n\x60\x60\x60';
                    const text = preview.innerText;
                    editor.value = text.substring(0, lineStart) + codeBlock + text.substring(lineStart + line.length);
                    preview.innerHTML = Parser.parse(editor.value);
                    const newPos = lineStart + 4 + codeResult.language.length + trimmed.length + 5;
                    this.setCursorPosition(preview, newPos);
                    return;
                }

                const chapterResult = this.detectChapterKeyword(line);
                if (chapterResult) {
                    const text = preview.innerText;
                    editor.value = text.substring(0, lineStart) + chapterResult.marker + trimmed + text.substring(lineStart + line.length);
                    preview.innerHTML = Parser.parse(editor.value);
                    const newPos = lineStart + chapterResult.marker.length + trimmed.length;
                    this.setCursorPosition(preview, newPos);
                }
            }
        };

        const noteName = '${escapeHtml(name)}';
        const noteContent = '${escapeHtml(content)}';
        let hasChanges = false, isSaving = false, showPreview = true;

        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        const status = document.getElementById('status');
        const themeToggle = document.getElementById('themeToggle');

        function loadTheme() {
            const theme = localStorage.getItem('wsx-theme') || 'light';
            if (theme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
                themeToggle.textContent = '☀️ 浅色';
            }
        }

        function toggleTheme() {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.body.removeAttribute('data-theme');
                localStorage.setItem('wsx-theme', 'light');
                themeToggle.textContent = '🌙 深色';
            } else {
                document.body.setAttribute('data-theme', 'dark');
                localStorage.setItem('wsx-theme', 'dark');
                themeToggle.textContent = '☀️ 浅色';
            }
        }

        function updatePreview() { preview.innerHTML = Parser.parse(editor.value); if (previewEditor) previewEditor.value = editor.value; }

        function togglePreview() { showPreview = !showPreview; document.querySelector('.preview-pane').style.display = showPreview ? 'flex' : 'none'; }

        function insertFormat(before, after) {
            const isTitleOrQuote = before === '=== ' || before === '== ' || before === '= ' || before === '> ';

            if (isTitleOrQuote) {
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                const text = editor.value;
                const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                let lineContent = text.substring(lineStart);
                let newPrefix = before;

                const prefixPatterns = [
                    { regex: /^=== /, length: 4 },
                    { regex: /^== /, length: 3 },
                    { regex: /^= /, length: 2 },
                    { regex: /^> /, length: 2 }
                ];

                let contentToUse = lineContent;
                let foundPrefix = '';
                for (const p of prefixPatterns) {
                    if (p.regex.test(contentToUse)) {
                        foundPrefix = newPrefix;
                        contentToUse = contentToUse.substring(p.length);
                        break;
                    }
                }

                // 如果点击相同的前缀，则取消效果
                if (foundPrefix === newPrefix && newPrefix !== '') {
                    editor.value = text.substring(0, lineStart) + contentToUse + text.substring(lineStart + lineContent.length);
                    editor.selectionStart = lineStart;
                    editor.selectionEnd = lineStart + contentToUse.length;
                } else {
                    const newLineText = newPrefix + contentToUse;
                    editor.value = text.substring(0, lineStart) + newLineText + text.substring(lineStart + lineContent.length);
                    editor.selectionStart = lineStart + newPrefix.length;
                    editor.selectionEnd = lineStart + newPrefix.length + contentToUse.length;
                }

                hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview();
                return;
            }

            // 查找匹配的 markerPattern
            const markerPatterns = {
                '<b>': { marker: '<b>', endMarker: '</b>' },
                '<i>': { marker: '<i>', endMarker: '</i>' },
                '<s>': { marker: '<s>', endMarker: '</s>' },
                '<u>': { marker: '<u>', endMarker: '</u>' },
                '<mark>': { marker: '<mark>', endMarker: '</mark>' },
                '<span class="code">': { marker: '<span class="code">', endMarker: '</span>' }
            };

            const pattern = markerPatterns[before];
            const start = editor.selectionStart, end = editor.selectionEnd;
            const selected = editor.value.substring(start, end);
            let useStart = before;
            let useEnd = after;
            let trimmed = selected.trim();

            if (pattern) {
                // 完整包裹（如 <b>hello</b>）：取消效果
                if (trimmed.startsWith(pattern.marker) && trimmed.endsWith(pattern.endMarker)) {
                    trimmed = trimmed.substring(pattern.marker.length, trimmed.length - pattern.endMarker.length);
                    useStart = '';
                    useEnd = '';
                }
                // 未闭合（如 <b>hello）：补全效果
                else if (trimmed.startsWith(pattern.marker)) {
                    useStart = pattern.marker;
                    useEnd = pattern.endMarker;
                    trimmed = trimmed.substring(pattern.marker.length);
                }
            }

            editor.value = editor.value.substring(0, start) + useStart + trimmed + useEnd + editor.value.substring(end);

            // 如果是添加/补全效果，选中包含标记的完整内容；如果是取消效果，只选中内容
            if (useStart !== '') {
                editor.selectionStart = start;
                editor.selectionEnd = start + useStart.length + trimmed.length + useEnd.length;
            } else {
                editor.selectionStart = start;
                editor.selectionEnd = start + trimmed.length;
            }
            editor.focus();
            hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview();
        }

        async function save() {
            if (isSaving || !hasChanges) return;
            isSaving = true;
            status.textContent = '保存中...'; status.className = 'status saving';
            try {
                const response = await fetch('/api/note/' + encodeURIComponent(noteName), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: editor.value })
                });
                if (!response.ok) throw new Error('保存失败');
                hasChanges = false;
                status.textContent = '已保存 ✓'; status.className = 'status saved';
            } catch (err) { status.textContent = '保存失败'; status.className = 'status error'; }
            finally { isSaving = false; }
        }

        function format(type) {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const text = editor.value;
            const selected = text.substring(start, end) || '文字';

            // 行级格式处理（标题、引用、代码块、水平线、列表）
            if (type === 'codeblock' || type === 'hr' || type === 'ul' || type === 'ol' || type === 'task' ||
                type === 'h1' || type === 'h2' || type === 'h3' || type === 'quote') {
                const map = {
                    codeblock: { marker: '\x60\x60\x60\n', endMarker: '\n\x60\x60\x60', regex: /^\x60\x60\x60\n/, endRegex: /\n\x60\x60\x60$/ },
                    hr: { marker: '---', endMarker: '', regex: /^---$/, endRegex: null },
                    ul: { marker: '- ', endMarker: '', regex: /^[\-\*] /, endRegex: null },
                    ol: { marker: '1. ', endMarker: '', regex: /^\d+\. /, endRegex: null },
                    task: { marker: '[ ] ', endMarker: '', regex: /^\[ \] /, endRegex: null },
                    h1: { marker: '=== ', endMarker: '', regex: /^=== /, endRegex: null },
                    h2: { marker: '== ', endMarker: '', regex: /^== /, endRegex: null },
                    h3: { marker: '= ', endMarker: '', regex: /^= /, endRegex: null },
                    quote: { marker: '> ', endMarker: '', regex: /^> /, endRegex: null }
                };
                const cfg = map[type];
                if (!cfg) return;

                // 代码块特殊处理：检测完整代码块结构
                if (type === 'codeblock') {
                    const codeBlockStart = text.lastIndexOf('\n\x60\x60\x60\n', start - 1);
                    const codeBlockEnd = text.indexOf('\n\x60\x60\x60', end);
                    if (codeBlockStart !== -1 && codeBlockEnd !== -1) {
                        // 取消代码块：移除标记
                        const before = text.substring(0, codeBlockStart + 1);
                        const codeContent = text.substring(codeBlockStart + 5, codeBlockEnd);
                        const after = text.substring(codeBlockEnd + 4);
                        editor.value = before + codeContent + after;
                        editor.selectionStart = editor.selectionEnd = codeBlockStart + 1;
                    } else {
                        // 添加代码块
                        const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                        editor.value = text.substring(0, lineStart) + '\x60\x60\x60\n' + selected + '\n\x60\x60\x60' + text.substring(end);
                        editor.selectionStart = lineStart + 4;
                        editor.selectionEnd = lineStart + 4 + selected.length;
                    }
                    editor.focus();
                    hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview();
                    return;
                }

                const lineStart = text.lastIndexOf('\n', start - 1) + 1;
                const lineContent = text.substring(lineStart);

                // 检测是否已存在该行级格式
                if (cfg.regex.test(lineContent)) {
                    // 取消：移除整行格式
                    const prefixLen = lineContent.match(cfg.regex)[0].length;
                    editor.value = text.substring(0, lineStart) + lineContent.substring(prefixLen) + text.substring(lineStart + lineContent.length);
                    editor.selectionStart = editor.selectionEnd = lineStart;
                } else {
                    editor.value = text.substring(0, lineStart) + cfg.marker + lineContent + text.substring(lineStart + lineContent.length);
                    editor.selectionStart = editor.selectionEnd = lineStart + cfg.marker.length + lineContent.length;
                }
                editor.focus();
                hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview();
                return;
            }

            // 包裹式格式处理
            const formatMap = {
                bold: ['**', '**'], italic: ['*', '*'], strike: ['~~', '~~'],
                underline: ['__', '__'], highlight: ['==', '=='],
                code: ['\x60', '\x60']
            };

            if (!formatMap[type]) return;

            const [before, after] = formatMap[type];
            let useBefore = before;
            let useAfter = after;
            let content = selected;

            // 行内代码特殊处理：检测光标前后是否有反引号
            if (type === 'code') {
                const beforeChar = start > 0 ? text[start - 1] : '';
                const afterChar = end < text.length ? text[end] : '';
                if (beforeChar === '\x60' || afterChar === '\x60') {
                    editor.focus();
                    return;
                }
                if (selected === '文字') {
                    content = '';
                }
            }

            // 检测是否完整包裹（只有当选中内容时才检测）
            if (selected && selected.trim()) {
                const trimmed = content.trim();
                // 检查是否已经被当前标记包裹
                if (trimmed.startsWith(before) && trimmed.endsWith(after)) {
                    // 取消效果：移除包裹
                    content = trimmed.substring(before.length, trimmed.length - after.length);
                    useBefore = '';
                    useAfter = '';
                } else {
                    // 添加效果：检查是否有其他包裹格式，有则先移除
                    const otherMarkers = ['**', '*', '~~', '__', '==', '\x60'];
                    for (const m of otherMarkers) {
                        if (m !== before && trimmed.startsWith(m) && trimmed.endsWith(m)) {
                            content = trimmed.substring(m.length, trimmed.length - m.length);
                            break;
                        }
                    }
                }
            } else {
                // 没有选中文本，只添加标记
                content = '';
            }

            editor.value = text.substring(0, start) + useBefore + content + useAfter + text.substring(end);

            // 设置选区
            if (useBefore !== '') {
                editor.selectionStart = start;
                editor.selectionEnd = start + useBefore.length + content.length + useAfter.length;
            } else {
                editor.selectionStart = start;
                editor.selectionEnd = start + content.length;
            }
            editor.focus();

            hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview();
        }

        editor.addEventListener('input', () => { hasChanges = true; status.textContent = '未保存'; status.className = 'status'; updatePreview(); });
        AutoFormat.install(editor);
        AutoFormat.installPreview(preview, editor);
        themeToggle.addEventListener('click', toggleTheme);

        // 预览区编辑
        const previewEditor = document.getElementById('previewEditor');
        const preview = document.getElementById('preview');
        if (previewEditor && preview) {
            previewEditor.addEventListener('input', () => {
                hasChanges = true; status.textContent = '未保存'; status.className = 'status';
                const selection = window.getSelection();
                let cursorOffset = 0;
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const preCaretRange = range.cloneRange();
                    preCaretRange.selectNodeContents(preview);
                    preCaretRange.setEnd(range.startContainer, range.startOffset);
                    cursorOffset = preCaretRange.toString().length;
                }
                editor.value = previewEditor.value;
                editor.selectionStart = editor.selectionEnd = Math.min(cursorOffset, editor.value.length);
                preview.innerHTML = Parser.parse(previewEditor.value);
                AutoFormat.checkAndFormat(editor, 'input');
            });
            previewEditor.addEventListener('blur', () => {
                previewEditor.classList.remove('show');
                preview.classList.remove('hidden');
                preview.innerHTML = Parser.parse(previewEditor.value);
            });
        }

        // 点击预览标题栏进入编辑模式
        const previewPaneHeader = document.querySelector('.preview-pane .pane-header');
        if (previewPaneHeader) {
            previewPaneHeader.style.cursor = 'pointer';
            previewPaneHeader.addEventListener('click', () => {
                if (previewEditor && preview) {
                    previewEditor.classList.add('show');
                    preview.classList.add('hidden');
                    previewEditor.value = editor.value;
                    previewEditor.focus();
                }
            });
        }

        // 工具栏切换
        const toolbarToggle = document.getElementById('toolbarToggle');
        const toolbar = document.getElementById('toolbar');
        if (toolbarToggle && toolbar) {
            toolbarToggle.addEventListener('click', () => {
                toolbar.classList.toggle('hide');
            });
        }

        // 编辑器切换
        const editToggle = document.getElementById('editToggle');
        const editorPane = document.querySelector('.editor-pane');
        if (editToggle && editorPane) {
            editToggle.addEventListener('click', () => {
                editorPane.classList.toggle('show');
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
                if (e.key.toLowerCase() === 'b') { e.preventDefault(); format('bold'); }
                if (e.key.toLowerCase() === 'i') { e.preventDefault(); format('italic'); }
                if (e.key.toLowerCase() === 'u') { e.preventDefault(); format('underline'); }
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
