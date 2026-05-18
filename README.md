# wsx 笔记工具

简洁的命令行笔记工具，让你在终端中轻松创建和管理笔记。

## 功能特性

- 📝 **创建笔记** - 一键创建 Markdown 笔记
- 🌐 **内置编辑器** - 左右分栏：编辑 + 实时预览
- 🎨 **主题切换** - 默认白色，支持深色模式
- 💾 **自动保存** - Ctrl+S 快捷键保存
- 🔒 **安全防护** - 服务器端验证，防止路径穿越攻击
- 🔄 **前端代理** - Vite 开发服务器，自动代理 API 请求
- 🚀 **反向代理** - 支持 nginx 一键部署

## 技术栈

- **后端**: Express.js + WebSocket
- **前端**: Vite + 原生 JavaScript
- **代理**: Vite Dev Proxy / nginx 反向代理
- **存储**: 本地文件系统（`~/.wsx` 目录）

## 本地运行

### 方式一：CLI 启动（推荐）

```bash
git clone https://github.com/Geoff-WSX/wsx.git
cd wsx
npm install
npm link

# 创建并打开笔记
wsx -n 我的笔记
```

### 方式二：前端代理开发

```bash
cd wsx
npm install
cd frontend && npm install && npm run dev
```

然后在另一个终端启动后端：
```bash
npm run server
```

访问 `http://localhost:5173`

### 方式三：Docker 部署

```bash
cd wsx
docker-compose up -d
```

访问 `http://localhost`

## 命令行用法

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

## Markdown 支持

```markdown
# 标题 1
## 标题 2
### 标题 3

**加粗文字**
*斜体文字*
***加粗斜体***
~~删除线~~

> 引用块

`行内代码`
​```代码块​```

[链接](url)

- 无序列表
1. 有序列表

| 表格 | 表头 |
|------|------|
| 内容 | 单元格 |

---
```

## 项目结构

```
wsx/
├── cli.js              # 命令行入口
├── server.js           # Express 服务器
├── public/             # 静态文件（备用）
│   └── editor.html
├── frontend/           # Vite 前端项目
│   ├── src/
│   │   ├── main.js    # 入口文件
│   │   ├── editor.js   # 编辑器模块
│   │   └── style.css   # 样式文件
│   ├── index.html
│   ├── vite.config.js  # Vite 配置（含代理）
│   └── package.json
├── nginx/              # nginx 配置
│   ├── wsx.conf       # 开发环境配置
│   └── wsx.prod.conf  # 生产环境配置
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/note/:name` | 获取笔记内容 |
| POST | `/api/note/:name` | 保存笔记内容 |

## 部署说明

### nginx 部署

1. 复制 `nginx/wsx.conf` 到 nginx 配置目录
2. 修改端口和路径
3. `nginx -s reload`

### Docker 部署

```bash
docker-compose up -d
# 访问 http://localhost
```

### 生产环境

```bash
npm run build:frontend
npm run server
# 前端构建产物在 frontend/dist/
```
