# Digital Wardrobe

电子衣橱微信小程序。这个仓库当前的目标不是静态展示 Demo，而是把拍照入橱、衣橱管理、今日推荐、搭配保存、穿搭日历和本地后端联调跑成一条完整链路。

## 当前状态

当前开发版本是 `V1.1-dev`，更新时间是 `2026-04-29`。

这一版已经从前端页面原型推进到可联调原型。前端默认按接口驱动方式组织，页面统一通过聚合状态读取数据，再通过动作接口提交变更。仓库同时保留 mock 模式和真实接口模式，方便继续调界面，也方便连本地 Node 服务联调。

当前代码已经落地的能力包括：

- 8 个小程序页面全部接好主流程
- 微信登录、游客态 bootstrap、Bearer Token 会话
- 衣物图片上传、衣物保存、编辑、删除、标记已穿
- 搭配保存、今日推荐刷新、写入日历、标记今日已穿
- 和风天气接入、规则型推荐引擎、SQLite 持久化
- 健康检查、安全响应头、优雅关闭、Docker 部署文件
- 后端 `npm test` 当前 34 个测试全部通过

## 页面与目录

当前小程序包含 8 个页面：

- `pages/home` 首页
- `pages/recommendation` 今日推荐
- `pages/capture` 拍照入橱
- `pages/closet` 我的衣橱
- `pages/garment-detail` 单品详情
- `pages/studio` 搭配台
- `pages/calendar` 穿搭日历
- `pages/profile` 个人中心

前端核心状态与请求入口集中在：

- [utils/store.js](utils/store.js)
- [utils/request.js](utils/request.js)
- [utils/session.js](utils/session.js)
- [utils/network.js](utils/network.js)

后端代码在 [server/](server/) 目录，接口契约文档在 [docs/api/miniprogram-v1-api.md](docs/api/miniprogram-v1-api.md)。

## 本地运行

### 小程序打开方式

用微信开发者工具导入 `Digital Wardrobe` 目录即可。

默认使用 [project.config.json](project.config.json) 里的 `appid`。如果要切到你自己的小程序环境，直接替换这里的 `appid` 即可。

### 前端运行模式

配置文件在 [config/env.js](config/env.js)。

`useMockApi: true`
页面走本地 mock 数据，适合继续调界面和交互。

`useMockApi: false`
页面走真实 HTTP 接口，适合联调本地后端或远端服务。

当前开发环境默认走真实接口模式：

```js
module.exports = {
  envName: 'dev',
  useMockApi: false,
  apiBaseUrl: 'http://127.0.0.1:3000',
  requestTimeout: 10000,
};
```

### 本地后端启动

后端目录是 [server/](server/)。

先准备环境变量：

```bash
cd server
cp .env.example .env.local
```

把 `.env.local` 里的 `WECHAT_MINI_APP_ID` 和 `WECHAT_MINI_APP_SECRET` 换成你自己的值。如果要启用真实天气，再补上 `WEATHER_API_KEY`。启动脚本会自动读取 `.env.local`。

启动命令：

```bash
cd server
npm start
```

默认监听地址是 `http://127.0.0.1:3000`。

### 后端当前能力

当前本地后端已经包含 13 个小程序核心接口，覆盖登录、启动聚合、衣物 CRUD、图片上传、今日推荐、穿搭计划和搭配保存。

除此之外，当前后端还支持：

- `POST /v1/auth/wechat/login` 真实接入微信 `code2session`
- `GET /v1/app/bootstrap` 同时支持游客态和登录态
- 其余动作接口统一使用 `Authorization: Bearer <token>`
- 以 `openid` 隔离用户数据
- 默认使用 SQLite 持久化，数据库文件在 `server/data/app.db`
- 服务重启后衣物、搭配、计划和推荐状态仍可保留
- `GET /v1/health` 健康检查
- 图片流式访问和 `ETag` 缓存

## 当前边界

这套代码已经适合继续联调和产品细化，但还不是完整生产版。现在还没补完的部分主要有：

- 正式图片存储、CDN 和素材治理
- 抠图、衣物识别和更完整的拍照理解
- 更个性化的推荐策略，目前仍以规则引擎为主
- 前端自动化测试、CI 和更完整的发布流程
- 管理后台、特权系统和运营能力

## 下一步建议

如果继续往前推进，最值得先做的是这几件事：

- 把图片上传从本地文件夹切到正式对象存储
- 给拍照入橱接上识别和抠图服务
- 给前端补自动化测试，顺手把 CI 接起来
- 把推荐逻辑从规则可用推进到个性化可用

## 最近更新

`2026-04-09`
完成小程序页面骨架和主要交互流。

`2026-04-20`
完成首版本地后端，补齐登录、聚合读取和核心动作接口。

`2026-04-28`
整理仓库结构、环境示例和接口文档，前端切到接口驱动结构。

`2026-04-29`
补齐图片上传、衣物编辑删除、输入校验、天气接入、规则推荐、健康检查、基础安全响应头、优雅关闭、Docker 部署文件，以及前端 8 页的 loading / error / empty 状态。后端 `npm test` 当前 34 个测试全部通过。

## 关键文件

- [app.json](app.json)
- [config/env.js](config/env.js)
- [utils/store.js](utils/store.js)
- [utils/request.js](utils/request.js)
- [utils/session.js](utils/session.js)
- [pages/home/index.js](pages/home/index.js)
- [pages/capture/index.js](pages/capture/index.js)
- [pages/studio/index.js](pages/studio/index.js)
- [server/src/server.js](server/src/server.js)
- [server/src/state.js](server/src/state.js)
- [server/test/api.test.js](server/test/api.test.js)
