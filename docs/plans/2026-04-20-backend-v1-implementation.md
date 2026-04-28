# Miniprogram V1 Backend Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为电子衣橱小程序补齐 V1 后端骨架，提供 9 个与当前前端完全对齐的接口。

**Architecture:** 使用纯 Node.js 内置 `http` 模块实现一个轻量 API 服务，进程内维护单用户内存态数据。状态初始值复用前端 mock 的 `createDefaultState`，接口返回格式统一为 `{ code, message, data }`。

**Tech Stack:** Node.js、内置 `http/url/assert/node:test`

---

### Task 1: 搭好测试入口

**Files:**
- Create: `server/package.json`
- Create: `server/test/api.test.js`

**Step 1: 写失败测试**

- 为登录、鉴权失败、bootstrap 成功写最小契约测试。

**Step 2: 跑测试确认失败**

Run: `cd server && npm test`

Expected: 因服务端实现文件不存在而失败。

### Task 2: 实现基础服务骨架

**Files:**
- Create: `server/src/state.js`
- Create: `server/src/server.js`
- Create: `server/src/index.js`

**Step 1: 实现内存态和基础路由**

- 支持 `POST /v1/auth/wechat/login`
- 支持 `GET /v1/app/bootstrap`
- 支持 Bearer 鉴权

**Step 2: 跑测试转绿**

Run: `cd server && npm test`

Expected: 现有基础测试通过。

### Task 3: 为全部 mutation 写失败测试

**Files:**
- Modify: `server/test/api.test.js`

**Step 1: 写失败测试**

- 覆盖衣物、推荐、计划、搭配 7 个 mutation
- 断言返回 `state` 且状态发生预期变化

**Step 2: 跑测试确认失败**

Run: `cd server && npm test`

Expected: 新增 mutation 测试失败。

### Task 4: 实现 7 个 mutation

**Files:**
- Modify: `server/src/state.js`
- Modify: `server/src/server.js`

**Step 1: 最小实现**

- `POST /v1/garments`
- `POST /v1/garments/{id}/mark-worn`
- `POST /v1/recommendations/today/refresh`
- `POST /v1/recommendations/today/schedule`
- `POST /v1/recommendations/today/mark-worn`
- `POST /v1/plans/{date}/recommendation`
- `POST /v1/outfits`

**Step 2: 跑测试转绿**

Run: `cd server && npm test`

Expected: 全部接口契约测试通过。

### Task 5: 收尾与可运行入口

**Files:**
- Modify: `README.md`

**Step 1: 补充启动方式**

- 写明如何启动后端、默认端口、如何把小程序切到真实接口模式

**Step 2: 最终验证**

Run: `cd server && npm test`

Expected: 全绿。

