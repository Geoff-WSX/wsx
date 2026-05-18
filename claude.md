# wsx 笔记工具

## 项目概述

wsx 是一个简洁的命令行笔记工具，允许用户通过终端快速创建和管理个人笔记。

## 技术栈

### 后端
- Express.js - Web 服务器框架
- ws - WebSocket 库（用于实时通信）

### 前端
- 原生 HTML5 + CSS3 + JavaScript
- 无外部依赖，轻量快速

### 存储
- 本地文件系统
- 笔记存储位置：`~/.wsx/` 目录

## 本地运行

### 前提条件
- Node.js 16.0 或更高版本
- npm 包管理器

### 安装

```bash
# 1. 进入项目目录
cd wsx

# 2. 安装依赖
npm install

# 3. 全局链接（使 wsx 命令全局可用）
npm link
```

### 使用方法

```bash
# 创建并打开新笔记
wsx -n 我的第一篇笔记

# 打开已有笔记
wsx activate 我的第一篇笔记

# 删除笔记
wsx rm 我的第一篇笔记

# 列出所有笔记
wsx --list

# 显示帮助信息
wsx --version
```

## 主要文件说明

| 文件 | 说明 |
|------|------|
| `cli.js` | 命令行入口，处理参数、创建文件、启动服务 |
| `server.js` | Express 服务器，提供 API 和静态文件服务 |
| `public/editor.html` | 笔记编辑器前端页面 |

## API 接口

### 获取笔记
```
GET /api/note/:name
```

### 保存笔记
```
POST /api/note/:name
Content-Type: application/json

{"content": "笔记内容"}
```

## 安全措施

- ✅ 笔记名称验证（禁止路径穿越字符）
- ✅ 内容大小限制（最大 5MB）
- ✅ 路径规范化（防止符号链接攻击）
