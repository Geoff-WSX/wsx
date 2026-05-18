# wsx 笔记工具

简洁的命令行笔记工具，让你在终端中轻松创建和管理笔记。

## 功能特性

- 📝 **创建笔记** - 一键创建带默认模板的 HTML 笔记
- 🌐 **内置编辑器** - 简洁美观的中文界面编辑器
- 💾 **自动保存** - 支持 Ctrl+S 快捷键保存
- 🔒 **安全防护** - 服务器端验证，防止路径穿越攻击
- 🎨 **Markdown 支持** - 可创建 Markdown 格式笔记

## 技术栈

- **后端**: Express.js + WebSocket
- **前端**: 原生 HTML/CSS/JavaScript
- **存储**: 本地文件系统（`~/.wsx` 目录）

## 本地运行

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <你的仓库地址>
   cd wsx
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **全局链接**（使 `wsx` 命令全局可用）
   ```bash
   npm link
   ```

### 使用方法

```bash
# 创建并打开新笔记
wsx -n 我的笔记

# 打开已有笔记
wsx activate 我的笔记

# 删除笔记
wsx rm 我的笔记

# 列出所有笔记
wsx --list

# 查看版本
wsx --version

# 显示帮助
wsx --help
```

## 发布到 npm

如果你想将 wsx 发布到 npm 让其他人可以使用：

```bash
# 1. 登录 npm 账号
npm login

# 2. 发布包（需要先在 npm 上创建包）
npm publish

# 3. 发布后，其他人可以通过以下命令安装使用：
npm install -g wsx
wsx -n 我的笔记
```

**注意**：wsx 是 Node.js 项目，应发布到 **npm**（Node.js 包管理器），而非 pip（Python 包管理器）。

## 项目结构

```
wsx/
├── cli.js          # 命令行入口
├── server.js       # Express 服务器
├── public/
│   └── editor.html # 笔记编辑器页面
├── package.json    # 项目配置
└── README.md       # 说明文档
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/note/:name` | 获取笔记内容 |
| POST | `/api/note/:name` | 保存笔记内容 |

## 笔记存储

所有笔记保存在 `~/.wsx` 目录下的 HTML 文件中。

## 安全说明

- 笔记名称经过严格验证，禁止非法字符
- 服务器端校验路径，防止目录遍历攻击
- 内容大小限制在 5MB 以内
