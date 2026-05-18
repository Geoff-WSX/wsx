// Markdown 解析器
export const MarkdownParser = {
    parse(text) {
        if (!text) return '';

        let html = text
            // 转义 HTML 特殊字符
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

            // 代码块
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')

            // 行内代码
            .replace(/`([^`]+)`/g, '<code>$1</code>')

            // 标题
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')

            // 加粗和斜体
            .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            .replace(/_(.+?)_/g, '<em>$1</em>')

            // 删除线
            .replace(/~~(.+?)~~/g, '<del>$1</del>')

            // 链接
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

            // 引用
            .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

            // 水平线
            .replace(/^---$/gm, '<hr>')
            .replace(/^\*\*\*$/gm, '<hr>')

            // 表格
            .replace(/^\|(.+)\|$/gm, (match) => {
                const cells = match.split('|').slice(1, -1);
                return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
            });

        // 包裹在段落中
        html = '<p>' + html + '</p>';

        // 清理空段落
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>(<h[1-3]>)/g, '$1');
        html = html.replace(/(<\/h[1-3]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<pre>)/g, '$1');
        html = html.replace(/(<\/pre>)<\/p>/g, '$1');
        html = html.replace(/<p>(<blockquote>)/g, '$1');
        html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
        html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
        html = html.replace(/<p>(<table>)/g, '$1');
        html = html.replace(/(<\/table>)<\/p>/g, '$1');
        html = html.replace(/<p>(<tr>)/g, '$1');
        html = html.replace(/(<\/tr>)<\/p>/g, '$1');

        return html;
    }
}

// 编辑器主模块
export class Editor {
    constructor(elements) {
        this.noteName = '';
        this.hasChanges = false;
        this.isSaving = false;
        this.showPreview = true;
        this.elements = elements;
    }

    init() {
        this.noteName = this.getNoteNameFromUrl();
        this.elements.noteNameDisplay.textContent = this.noteName || '新建笔记';
        document.title = this.noteName || 'wsx 笔记编辑器';

        this.loadTheme();
        this.bindEvents();
        this.loadNote();
    }

    getNoteNameFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('note') ? decodeURIComponent(params.get('note')) : '';
    }

    loadTheme() {
        const theme = localStorage.getItem('wsx-theme') || 'light';
        if (theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            this.elements.themeToggle.textContent = '☀️ 浅色模式';
        }
    }

    toggleTheme() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('wsx-theme', 'light');
            this.elements.themeToggle.textContent = '🌙 深色模式';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('wsx-theme', 'dark');
            this.elements.themeToggle.textContent = '☀️ 浅色模式';
        }
    }

    bindEvents() {
        this.elements.editor.addEventListener('input', () => {
            this.hasChanges = true;
            this.setStatus('未保存', '');
            this.updatePreview();
        });

        this.elements.saveBtn.addEventListener('click', () => this.save());

        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.save();
                        break;
                    case 'b':
                        e.preventDefault();
                        this.wrapSelection('**', '**');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.wrapSelection('*', '*');
                        break;
                    case 'p':
                        e.preventDefault();
                        this.togglePreview();
                        break;
                }
            }
        });

        window.addEventListener('beforeunload', (e) => {
            if (this.hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    updatePreview() {
        const content = this.elements.editor.value;
        this.elements.preview.innerHTML = MarkdownParser.parse(content);
    }

    togglePreview() {
        const previewPane = document.querySelector('.preview-pane');
        this.showPreview = !this.showPreview;
        previewPane.style.display = this.showPreview ? 'flex' : 'none';
    }

    async loadNote() {
        if (!this.noteName) {
            this.setStatus('新建笔记', '');
            this.updatePreview();
            return;
        }

        try {
            const response = await fetch(`/api/note/${encodeURIComponent(this.noteName)}`);

            if (!response.ok) {
                if (response.status === 404) {
                    this.setStatus('新建笔记', '');
                    this.updatePreview();
                    return;
                }
                throw new Error('加载失败');
            }

            const data = await response.json();

            if (data.content) {
                this.elements.editor.value = data.content;
                this.updatePreview();
            }

            this.setStatus('已加载', 'saved');
        } catch (err) {
            this.showError('加载失败: ' + err.message);
            this.setStatus('加载失败', 'error');
        }
    }

    async save() {
        if (this.isSaving || !this.hasChanges) return;

        this.isSaving = true;
        this.elements.saveBtn.disabled = true;
        this.setStatus('保存中...', 'saving');

        try {
            const response = await fetch(`/api/note/${encodeURIComponent(this.noteName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: this.elements.editor.value })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '保存失败');
            }

            this.hasChanges = false;
            this.setStatus('已保存 ✓', 'saved');

            setTimeout(() => {
                if (this.elements.status.textContent === '已保存 ✓') {
                    this.setStatus('已保存', 'saved');
                }
            }, 2000);
        } catch (err) {
            this.showError('保存失败: ' + err.message);
            this.setStatus('保存失败', 'error');
        } finally {
            this.isSaving = false;
            this.elements.saveBtn.disabled = false;
        }
    }

    wrapSelection(before, after) {
        const editor = this.elements.editor;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const selected = text.substring(start, end);

        editor.value = text.substring(0, start) + before + selected + after + text.substring(end);
        editor.selectionStart = start + before.length;
        editor.selectionEnd = end + before.length;
        editor.focus();

        this.hasChanges = true;
        this.setStatus('未保存', '');
        this.updatePreview();
    }

    setStatus(text, className) {
        this.elements.status.textContent = text;
        this.elements.status.className = 'status ' + className;
    }

    showError(message) {
        this.elements.errorOverlay.textContent = message;
        this.elements.errorOverlay.classList.add('show');
        setTimeout(() => {
            this.elements.errorOverlay.classList.remove('show');
        }, 3000);
    }
}
