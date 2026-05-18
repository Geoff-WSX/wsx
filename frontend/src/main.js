import './style.css'
import { Editor } from './editor.js'

const app = document.getElementById('app')
app.innerHTML = `
    <div class="error-overlay" id="errorOverlay"></div>

    <div class="header">
        <div class="header-left">
            <h1><span>📝</span>wsx</h1>
            <span class="note-name" id="noteNameDisplay"></span>
        </div>
        <div class="header-right">
            <button class="theme-toggle" id="themeToggle">🌙 深色模式</button>
        </div>
    </div>

    <div class="main-container">
        <div class="editor-pane">
            <div class="pane-header">✏️ 编辑</div>
            <div class="editor-wrapper">
                <textarea
                    id="editor"
                    placeholder="在这里开始写作，支持 Markdown 语法..."
                    spellcheck="false"
                ></textarea>
            </div>
        </div>

        <div class="preview-pane">
            <div class="pane-header">👁️ 预览</div>
            <div class="preview-wrapper">
                <div class="preview-content" id="preview"></div>
            </div>
        </div>
    </div>

    <div class="shortcuts">
        <kbd>Ctrl</kbd>+<kbd>S</kbd> 保存 | <kbd>Ctrl</kbd>+<kbd>B</kbd> 加粗 | <kbd>Ctrl</kbd>+<kbd>I</kbd> 斜体 | <kbd>Ctrl</kbd>+<kbd>P</kbd> 切换预览
    </div>

    <div class="toolbar">
        <button id="saveBtn">💾 保存</button>
        <span class="status" id="status">就绪</span>
    </div>
`

const editor = new Editor({
    elements: {
        editor: document.getElementById('editor'),
        preview: document.getElementById('preview'),
        status: document.getElementById('status'),
        noteNameDisplay: document.getElementById('noteNameDisplay'),
        saveBtn: document.getElementById('saveBtn'),
        errorOverlay: document.getElementById('errorOverlay'),
        themeToggle: document.getElementById('themeToggle')
    }
})

editor.init()

// 全局暴露保存函数
window.saveNote = () => editor.save()
window.toggleTheme = () => editor.toggleTheme()
