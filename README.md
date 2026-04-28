# Digital Wardrobe

电子衣橱微信小程序。目标不是做一个静态展示 Demo，而是把拍照入橱、衣橱管理、日常搭配、穿搭计划和后端联调这几条主链路先跑通，再逐步补齐图片服务、推荐引擎和后台管理能力。

当前仓库已经进入接口驱动阶段。前端页面不再直接依赖散落的本地状态，而是统一通过服务层读取聚合数据和提交动作。仓库里同时保留了 mock 模式和真实接口模式，方便继续做界面开发，也方便切到本地后端联调。

## 当前版本

当前开发分支版本定义为 `V1.1-dev`，更新时间为 `2026-04-28`。

这个版本对应的状态是，小程序主流程已经可跑，Node 本地后端骨架已经接入，真实微信登录、用户隔离和 SQLite 持久化已经落地，适合继续做接口联调和下一轮产品细化。

### 版本分层

`V1.0`
小程序前端主链路跑通，包含首页、拍照入橱、我的衣橱、搭配台、穿搭日历、今日推荐、个人中心。

`V1.1-dev`
前端切到接口驱动结构，补齐本地后端骨架与 9 个核心接口，支持微信登录、游客态 bootstrap、推荐动作、衣物保存、搭配保存、日历写入、多用户隔离和服务重启后状态保留。

### 当前已实现

- 首页天气摘要、今日推荐、衣橱额度和快捷入口
- 拍照入橱与相册入橱流程，含识别结果确认与保存
- 衣橱检索、类型筛选、颜色筛选、季节筛选、单品详情
- 搭配台按槽位选衣并保存搭配
- 穿搭日历查看计划，并把推荐写入指定日期
- 我的页面展示城市、天气同步、特权说明、接口运行模式
- 小程序端统一请求层、会话层、状态入口
- 本地 Node 后端、SQLite 持久化、真实 `code2session` 登录链路

## 产品结构

当前小程序包含 8 个页面：

- `pages/home` 首页
- `pages/recommendation` 今日推荐
- `pages/capture` 拍照入橱
- `pages/closet` 我的衣橱
- `pages/garment-detail` 单品详情
- `pages/studio` 搭配台
- `pages/calendar` 穿搭日历
- `pages/profile` 个人中心

前端核心数据入口集中在：

- [utils/store.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/store.js)
- [utils/request.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/request.js)
- [utils/session.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/session.js)

真实接口契约文档在：

- [docs/api/miniprogram-v1-api.md](/Users/mantou/Documents/trae_projects/Digital Wardrobe/docs/api/miniprogram-v1-api.md)

## 运行方式

### 小程序打开方式

用微信开发者工具导入项目目录：

`/Users/mantou/Documents/trae_projects/Digital Wardrobe`

当前 [project.config.json](/Users/mantou/Documents/trae_projects/Digital Wardrobe/project.config.json) 已包含一个小程序 `AppID`。如果需要切到你自己的小程序环境，直接替换这里的 `appid` 即可。

### 前端运行模式

配置文件在 [config/env.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/config/env.js)。

`useMockApi: true`
页面走本地 mock 接口，适合继续调界面和交互。

`useMockApi: false`
页面走真实 HTTP 接口，适合联调本地后端或远端服务。

当前仓库默认配置为真实接口模式：

```js
module.exports = {
  envName: 'dev',
  useMockApi: false,
  apiBaseUrl: 'http://127.0.0.1:3000',
  requestTimeout: 10000,
};
```

### 本地后端启动

后端目录：

`/Users/mantou/Documents/trae_projects/Digital Wardrobe/server`

先准备环境变量。可以参考 [server/.env.example](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/.env.example)，本地私密配置放在 `server/.env.local`，不要提交。

启动方式：

```bash
cd /Users/mantou/Documents/trae_projects/Digital Wardrobe/server
export WECHAT_MINI_APP_SECRET=你的小程序AppSecret
export WECHAT_MINI_APP_ID=你的小程序AppID
npm start
```

默认监听地址：

`http://127.0.0.1:3000`

当前后端能力包括：

- 小程序 V1 所需 9 个接口
- `POST /v1/auth/wechat/login` 真实接入微信 `code2session`
- `GET /v1/app/bootstrap` 支持游客态和登录态
- 其余动作接口统一走 Bearer Token
- 以 `openid` 隔离用户数据
- 默认使用 SQLite 持久化，数据库文件为 `server/data/app.db`
- 服务重启后衣物、搭配、计划和推荐状态可保留

## 当前边界

现在这套代码已经适合继续联调，但还不是完整生产版。下面这些能力仍在下一阶段：

- 图片上传和正式素材存储
- 抠图与衣物识别服务
- 基于天气、历史穿着和库存的推荐引擎升级
- 管理员后台和特权系统
- 更细粒度的衣物编辑、删除和统计分析

## 开发计划

当前建议按三个阶段推进。

### Phase 2

把小程序从可联调版本推进到可持续迭代版本。重点是补齐图片上传、衣物编辑删除、推荐理由结构化、错误处理和接口返回规范，顺手把测试覆盖从契约层扩到核心状态流转。

### Phase 3

把推荐逻辑从演示型推荐升级为规则引擎或轻量智能推荐。这里会引入天气权重、场景偏好、最近穿着间隔、颜色与品类约束，让推荐结果从能用变成更可信。

### Phase 4

补齐后台管理端和运营能力，包括用户特权管理、库存治理、推荐策略配置、日志与观测、素材服务和部署流程。到这一阶段，项目才算从本地产品原型过渡到可交付系统。

## 版本记录

`2026-04-09`
完成小程序页面骨架与主要交互流。

`2026-04-20`
完成 V1 后端实现，补齐 9 个核心接口与联调文档。

`2026-04-28`
整理仓库版本控制、补齐环境示例文件，更新项目文档为当前开发状态。

## 关键文件

- [app.json](/Users/mantou/Documents/trae_projects/Digital Wardrobe/app.json)
- [config/env.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/config/env.js)
- [utils/store.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/store.js)
- [utils/request.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/request.js)
- [utils/session.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/session.js)
- [pages/home/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/pages/home/index.js)
- [pages/capture/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/pages/capture/index.js)
- [pages/studio/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/pages/studio/index.js)
- [server/src/server.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/src/server.js)
- [server/src/state.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/src/state.js)
- [server/test/api.test.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/test/api.test.js)
