# 电子衣橱小程序

这是一个已经切到“接口驱动”结构的原生微信小程序项目。

当前已实现：

- 首页：天气、今日推荐、衣橱额度、快捷入口
- 拍照入橱：拍照/相册 -> 处理中 -> 结果确认 -> 保存
- 我的衣橱：搜索、类型/颜色/季节筛选、单品详情
- 搭配台：按槽位挑选单品并保存搭配
- 穿搭日历：查看计划并用今日推荐填充日期
- 我的：城市、天气同步、特权说明、接口运行模式说明

## 打开方式

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择：
   `/Users/mantou/Documents/trae_projects/Digital Wardrobe`
4. 把 [project.config.json](/Users/mantou/Documents/trae_projects/Digital Wardrobe/project.config.json) 里的 `appid` 从 `touristappid` 改成你自己的小程序 `AppID`。
5. 导入后直接编译运行。

## 当前运行模式

项目现在有两种运行模式，配置在 [config/env.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/config/env.js)：

- `useMockApi: true`
  走本地 mock 接口，便于你现在继续看流程
- `useMockApi: false`
  走真实 HTTP 接口，请同时配置 `apiBaseUrl`

默认保留 `mock`，但页面层已经不再直接依赖本地状态，而是通过接口服务层取数和发起动作。

## 本地后端开发服务

仓库内已经补了一个最小可跑的 Node 后端骨架，位置在：

- [server/package.json](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/package.json)
- [server/src/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/src/index.js)
- [server/src/server.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/server/src/server.js)

启动方式：

1. 进入后端目录
   `cd /Users/mantou/Documents/trae_projects/Digital Wardrobe/server`
2. 配置微信登录环境变量
   `export WECHAT_MINI_APP_SECRET=你的小程序AppSecret`
   可选：
   `export WECHAT_MINI_APP_ID=你的小程序AppID`
   如果不传 `WECHAT_MINI_APP_ID`，后端会默认读取 [project.config.json](/Users/mantou/Documents/trae_projects/Digital Wardrobe/project.config.json) 里的 `appid`
2. 启动服务
   `npm start`
3. 默认监听
   `http://127.0.0.1:3000`

接口契约文档见：

- [docs/api/miniprogram-v1-api.md](/Users/mantou/Documents/trae_projects/Digital Wardrobe/docs/api/miniprogram-v1-api.md)

联调前请把 [config/env.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/config/env.js) 改为：

```js
module.exports = {
  envName: 'dev',
  useMockApi: false,
  apiBaseUrl: 'http://127.0.0.1:3000',
  requestTimeout: 10000,
};
```

当前后端特性：

- 已实现小程序 V1 所需 9 个接口
- 默认使用 SQLite 持久化，数据库文件路径为 `server/data/app.db`
- 服务重启后，衣物、搭配、日历计划、推荐索引等状态会保留
- `POST /v1/auth/wechat/login` 已接入真实微信 `code2session`
- 后端按 `openid` 隔离用户数据，不再共用全局状态
- `GET /v1/app/bootstrap` 未登录时返回游客态，登录后返回用户态
- 已有契约测试覆盖游客态、登录、跨重启持久化和多用户隔离场景

## 接口层结构

- [utils/session.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/session.js)
  负责 `wx.login` 和 token 会话
- [utils/request.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/request.js)
  负责统一 `wx.request`
- [utils/store.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/store.js)
  负责页面调用的统一数据入口和动作方法
- [services/mock-backend.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/services/mock-backend.js)
  负责 mock 模式下的本地接口实现

## 默认真实接口约定

目前代码默认按下面这套接口约定去请求真实后端：

1. `POST /v1/auth/wechat/login`
   入参：`{ code }`
   返回：`{ token, user }`
2. `GET /v1/app/bootstrap`
   返回整页渲染所需聚合数据：
   `user / weather / garments / outfits / plans / savedOutfitCount / recommendationIndex / statusMessage`
3. `POST /v1/garments`
   新增入橱单品
4. `POST /v1/recommendations/today/refresh`
   换一套今日推荐
5. `POST /v1/recommendations/today/schedule`
   把当前推荐加入明天计划
6. `POST /v1/recommendations/today/mark-worn`
   把当前推荐标记为今天已穿
7. `POST /v1/plans/{date}/recommendation`
   把当前推荐写入指定日期
8. `POST /v1/outfits`
   保存手动搭配
9. `POST /v1/garments/{id}/mark-worn`
   标记单品今天穿过

说明：

- 如果你的真实后端返回格式是 `{ code: 0, data }` 或 `{ success: true, data }`，当前请求层都能兼容
- 如果 mutation 接口不直接返回完整 state，前端会自动重新请求 `bootstrap`

## 当前边界

- 目前只是“小程序真实接口版”，还没把后台管理端一起接进来
- 天气接口、图片上传、抠图服务、推荐引擎、管理员特权系统都还需要后端配合
- `mock` 模式仍然可用，目的是保证你现在能继续验证前端流程，不会因为后端没完成就无法开发

## 关键文件

- [config/env.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/config/env.js)
- [utils/store.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/store.js)
- [utils/request.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/request.js)
- [utils/session.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/utils/session.js)
- [pages/home/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/pages/home/index.js)
- [pages/capture/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/pages/capture/index.js)
- [pages/studio/index.js](/Users/mantou/Documents/trae_projects/Digital Wardrobe/pages/studio/index.js)
