# wsx 笔记工具

简洁的命令行笔记工具，让你在终端中轻松创建和管理笔记。

## 功能特性

- 📝 **创建笔记** - 一键创建 Markdown 笔记
- 🌐 **内置编辑器** - 左右分栏：编辑 + 实时预览
- 🎨 **主题切换** - 默认白色，支持深色模式
- 💾 **自动保存** - Ctrl+S 快捷键保存
- 🔒 **安全防护** - 服务器端验证，防止路径穿越攻击

## 安装

```bash
git clone https://github.com/Geoff-WSX/wsx.git
cd wsx
npm install
npm link
```

## 使用方法

```bash
wsx -n <笔记名>      # 创建并打开新笔记
wsx activate <笔记名>  # 打开已有笔记
wsx rm <笔记名>      # 删除笔记
wsx --list           # 列出所有笔记
wsx --version        # 查看版本
wsx --help           # 显示帮助
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存笔记 |
| `Ctrl+B` | 加粗 `**text**` |
| `Ctrl+I` | 斜体 `*text*` |
| `Ctrl+P` | 切换预览窗格 |

## 项目结构

```
wsx/
├── cli.js          # 命令行入口
├── server.js       # Express 服务器
├── public/
│   └── editor.html # 笔记编辑器页面
├── package.json
└── README.md
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/note/:name` | 获取笔记内容 |
| POST | `/api/note/:name` | 保存笔记内容 |

## 安全说明

- 笔记名称经过严格验证，禁止非法字符
- 服务器端校验路径，防止目录遍历攻击
- 内容大小限制在 5MB 以内
