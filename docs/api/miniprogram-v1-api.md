# 电子衣橱小程序接口文档（V1）

更新日期：2026-04-20

## 1. 文档范围

这份文档只覆盖当前小程序前端已经接入的接口，不包含后台管理端、图片上传、抠图服务、天气源同步、特权管理后台。

当前前端是“聚合读接口 + 动作接口”的结构：

- 页面数据统一从 `GET /v1/app/bootstrap` 读取
- 页面动作通过单独的 mutation 接口提交
- 当前前端不依赖独立的“列表分页接口 / 详情接口 / 搜索接口”

## 2. 接口数量统计

| 模块 | 数量 | 接口 |
| --- | ---: | --- |
| 鉴权 | 1 | `POST /v1/auth/wechat/login` |
| 启动聚合 | 1 | `GET /v1/app/bootstrap` |
| 衣物 | 2 | `POST /v1/garments`、`POST /v1/garments/{id}/mark-worn` |
| 推荐 | 3 | `POST /v1/recommendations/today/refresh`、`POST /v1/recommendations/today/schedule`、`POST /v1/recommendations/today/mark-worn` |
| 日历计划 | 1 | `POST /v1/plans/{date}/recommendation` |
| 搭配 | 1 | `POST /v1/outfits` |
| 合计 | 9 | 当前小程序 V1 核心接口总数 |

## 3. 通用约定

### 3.1 Base URL

- 测试 / 生产域名通过 `config/env.js` 的 `apiBaseUrl` 配置
- 接口统一使用 `/v1` 作为版本前缀

### 3.2 认证方式

- `GET /v1/app/bootstrap` 支持游客态调用：不带 `Authorization` 时返回游客数据
- 除 `POST /v1/auth/wechat/login` 和游客态 `GET /v1/app/bootstrap` 外，其余接口都需要 `Authorization: Bearer <token>`
- 小程序端通过 `wx.login` 获取 `code`，再调用登录接口换取业务 token
- 后端通过微信官方 `code2session` 获取 `openid / session_key`
- 系统以 `openid` 作为微信用户唯一标识

### 3.3 推荐响应格式

当前前端 `utils/request.js` 兼容以下几种成功格式：

```json
{ "code": 0, "message": "ok", "data": { } }
```

```json
{ "success": true, "message": "ok", "data": { } }
```

```json
{ "data": { } }
```

```json
{ ...rawObject }
```

为减少歧义，后端统一使用：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

### 3.4 错误格式

当前前端对非 2xx HTTP 会直接报 `HTTP xxx`，拿不到业务 message。

因此在当前联调阶段建议：

- 业务校验错误：优先返回 HTTP 200 + `code != 0` + `message`
- 鉴权失效 / 服务异常：返回标准 HTTP 401 / 403 / 500

示例：

```json
{
  "code": 40001,
  "message": "当前免费额度已满，请先由后台管理员开通特权。",
  "data": null
}
```

### 3.5 Mutation 返回规则

当前前端 mutation 结果兼容三种情况：

1. 直接返回完整状态树 `state`
2. 返回 `{ state: 完整状态树 }`
3. 不返回状态树，前端会自动重新请求 `GET /v1/app/bootstrap`

为了减少一次额外请求，建议所有 mutation 都返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "state": { }
  }
}
```

### 3.6 日期字段

- `plans[].date` 建议真实后端统一使用 `YYYY-MM-DD`
- 当前前端把 `date` 当作“业务主键字符串”使用，不依赖固定展示格式
- mock 里出现的 `04-10` 只是演示数据，不作为真实接口格式要求

## 4. 核心数据模型

### 4.1 User

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 用户 ID |
| `name` | string | 是 | 用户昵称 |
| `city` | string | 是 | 当前城市 |
| `weatherUpdatedAt` | string | 是 | 天气更新时间文本 |
| `commuteMode` | boolean | 是 | 是否通勤模式 |
| `preferenceSummary` | string | 是 | 推荐偏好说明 |
| `privilege.unlocked` | boolean | 是 | 是否开通特权 |
| `privilege.expiresAt` | string \| null | 是 | 特权到期时间 |
| `privilege.garmentLimit` | number | 是 | 免费衣物上限 |

### 4.2 Weather

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `city` | string | 是 | 城市名 |
| `minTemp` | number | 是 | 最低温 |
| `maxTemp` | number | 是 | 最高温 |
| `condition` | string | 是 | 天气描述 |
| `rainChance` | string | 是 | 降雨概率文本 |
| `wind` | string | 是 | 风力文本 |
| `summary` | string | 是 | 天气建议摘要 |

### 4.3 Garment

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 单品 ID |
| `name` | string | 是 | 单品名 |
| `type` | string | 是 | `外套 / 上装 / 下装 / 连衣裙 / 鞋子 / 包` |
| `subType` | string | 是 | 子类，例如“风衣”“短袖衬衫” |
| `color` | string | 是 | 颜色 |
| `season` | string[] | 是 | 可穿季节 |
| `warmthLevel` | number | 是 | 厚薄等级，当前前端按 1-4 理解 |
| `texture` | string | 是 | 材质 / 面料 |
| `scene` | string | 是 | 场景，当前主要为“通勤” |
| `lastWornAt` | string | 是 | 最近穿着时间文本 |
| `accent` | string | 是 | 展示用色值，例如 `#d9c8b4` |

### 4.4 Outfit

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 是 | 搭配 ID |
| `name` | string | 是 | 搭配名称 |
| `label` | string | 是 | 概要标签 |
| `garmentIds` | string[] | 是 | 组成该搭配的衣物 ID |
| `reason` | string | 是 | 推荐理由 |
| `weatherFit` | string | 是 | 场景 / 天气适配描述 |
| `note` | string | 是 | 补充说明 |

### 4.5 Plan

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `date` | string | 是 | 日期主键，建议 `YYYY-MM-DD` |
| `label` | string | 是 | 展示标签，例如“今天 / 明天 / 周六” |
| `status` | string | 是 | 当前状态，例如“已安排 / 待确认 / 需重选” |
| `outfitId` | string \| null | 是 | 对应搭配 ID |
| `weather` | string | 是 | 当日天气描述 |

### 4.6 Bootstrap State

```json
{
  "user": {},
  "weather": {},
  "garments": [],
  "outfits": [],
  "plans": [],
  "savedOutfitCount": 14,
  "recommendationIndex": 0,
  "statusMessage": "当前为非特权模式，衣橱免费额度 10 件；如需解除上限，请联系后台管理员开通特权。"
}
```

## 5. 页面与接口映射

| 页面 | 读取接口 | 动作接口 |
| --- | --- | --- |
| 首页 `home` | `GET /v1/app/bootstrap` | 无 |
| 今日推荐 `recommendation` | `GET /v1/app/bootstrap` | `POST /v1/recommendations/today/refresh`、`POST /v1/recommendations/today/schedule`、`POST /v1/recommendations/today/mark-worn` |
| 拍照入橱 `capture` | `GET /v1/app/bootstrap` | `POST /v1/garments` |
| 我的衣橱 `closet` | `GET /v1/app/bootstrap` | 无 |
| 单品详情 `garment-detail` | `GET /v1/app/bootstrap` | `POST /v1/garments/{id}/mark-worn` |
| 搭配台 `studio` | `GET /v1/app/bootstrap` | `POST /v1/outfits` |
| 穿搭日历 `calendar` | `GET /v1/app/bootstrap` | `POST /v1/plans/{date}/recommendation` |
| 我的 `profile` | `GET /v1/app/bootstrap` | 无 |

结论：当前前端只需要一个聚合读取接口，不需要单独的衣橱列表、单品详情、搭配列表接口。

## 6. 接口定义

### 6.1 微信登录

`POST /v1/auth/wechat/login`

用途：用小程序 `wx.login` 返回的 `code` 调用微信官方 `code2session`，再换业务 token。

请求体：

```json
{
  "code": "wx-login-code"
}
```

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "token": "jwt-or-session-token",
    "user": {
      "id": "user-xiaomei",
      "name": "小美"
    }
  }
}
```

说明：

- 后端调用微信官方接口：
  `GET https://api.weixin.qq.com/sns/jscode2session?appid=APPID&secret=SECRET&js_code=JS_CODE&grant_type=authorization_code`
- 微信官方返回核心字段包括：`openid`、`session_key`、可选 `unionid`
- 业务侧必须以 `openid` 识别用户，不得再用固定假用户
- `user` 这里只返回最基础字段，小程序完整展示信息仍以 `bootstrap` 为准

### 6.2 获取启动聚合数据

`GET /v1/app/bootstrap`

用途：小程序页面统一读取当前业务状态。

请求头：

```http
Authorization: Bearer <token>
```

游客态说明：

- 请求不带 `Authorization` 时，后端返回游客态数据
- 游客态可浏览页面，但不能执行保存/更新类接口
- 游客态下 `data.user.isGuest = true`

成功响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {},
    "weather": {},
    "garments": [],
    "outfits": [],
    "plans": [],
    "savedOutfitCount": 14,
    "recommendationIndex": 0,
    "statusMessage": "当前为非特权模式，衣橱免费额度 10 件；如需解除上限，请联系后台管理员开通特权。"
  }
}
```

说明：

- 当前所有页面都依赖这份聚合数据
- `recommendationIndex` 用于确定“当前推荐”在 `outfits` 中的索引
- `outfits` 中引用的 `garmentIds` 必须都能在 `garments` 里找到，否则前端会把这套搭配视为不可用

### 6.3 新增入橱单品

`POST /v1/garments`

用途：拍照 / 相册识别确认后保存单品。

请求体：

```json
{
  "name": "雾蓝衬衫",
  "type": "上装",
  "subType": "长袖衬衫",
  "color": "雾蓝",
  "season": ["春", "秋"],
  "warmthLevel": 2,
  "texture": "棉感",
  "scene": "通勤",
  "accent": "#9db4cf"
}
```

推荐响应：

```json
{
  "code": 0,
  "message": "保存成功",
  "data": {
    "state": {}
  }
}
```

校验建议：

- 免费用户超过 `user.privilege.garmentLimit` 时拒绝保存
- `type` 必须落在前端支持的类型集合内
- `season` 至少一个值
- `warmthLevel` 建议限制在 1-4

### 6.4 标记单品今天穿过

`POST /v1/garments/{id}/mark-worn`

用途：单品详情页点击“今天穿过”。

路径参数：

- `id`：衣物 ID

请求体：无

推荐响应：

```json
{
  "code": 0,
  "message": "已标记",
  "data": {
    "state": {}
  }
}
```

业务效果：

- 对应 garment 的 `lastWornAt` 更新为“今天”或后端等价语义
- 推荐逻辑后续可据此避开重复穿着

### 6.5 换一套今日推荐

`POST /v1/recommendations/today/refresh`

用途：今日推荐页“换一套”。

请求体：无

推荐响应：

```json
{
  "code": 0,
  "message": "已更新推荐",
  "data": {
    "state": {}
  }
}
```

业务效果：

- 更新 `recommendationIndex`
- 或由后端直接算出新的当前推荐，再反映到返回的 `state`

### 6.6 将当前推荐加入明天计划

`POST /v1/recommendations/today/schedule`

用途：今日推荐页“加入明天计划”。

请求体：

```json
{
  "target": "tomorrow"
}
```

推荐响应：

```json
{
  "code": 0,
  "message": "已加入明天计划",
  "data": {
    "state": {}
  }
}
```

业务效果：

- 将当前推荐写入“明天”这条 plan
- 若后端没有预建“明天”记录，也可以在此时自动补建

### 6.7 标记当前推荐为今日已穿

`POST /v1/recommendations/today/mark-worn`

用途：今日推荐页“今天已穿这套”。

请求体：无

推荐响应：

```json
{
  "code": 0,
  "message": "已标记今日穿搭",
  "data": {
    "state": {}
  }
}
```

业务效果：

- 将当前推荐所关联的所有 garment 标记为今天已穿

### 6.8 用当前推荐填充指定日期

`POST /v1/plans/{date}/recommendation`

用途：日历页把当前推荐写入所选日期。

路径参数：

- `date`：目标日期，建议 `YYYY-MM-DD`

请求体：无

推荐响应：

```json
{
  "code": 0,
  "message": "计划已更新",
  "data": {
    "state": {}
  }
}
```

业务效果：

- 将当前推荐写入该日期的 `plan.outfitId`
- 若该日期 plan 不存在，可由后端补建

### 6.9 保存手动搭配

`POST /v1/outfits`

用途：搭配台保存当前搭配。

请求体：

```json
{
  "slots": {
    "outer": "g-001",
    "upper": "g-005",
    "bottom": "g-006",
    "shoes": "g-007",
    "bag": "g-008"
  }
}
```

字段说明：

- `slots` 允许 value 为 `null`
- 当前前端槽位固定为：`outer / upper / bottom / shoes / bag`
- 当 `upper` 为“连衣裙”时，`bottom` 可能为 `null`
- 当前 mock 允许“至少一个槽位有值”就保存，真实后端可按业务收紧

推荐响应：

```json
{
  "code": 0,
  "message": "搭配已保存",
  "data": {
    "state": {}
  }
}
```

业务效果：

- 新增一条 `outfit`
- 更新 `savedOutfitCount`

## 7. 本轮不做的接口

以下能力在前端文案里已经出现，但当前真实接口版本不纳入本轮开发：

- 图片上传接口
- 抠图 / 识别接口
- 第三方天气拉取接口
- 特权开通 / 延长 / 撤销后台接口
- 后台管理端查询接口

这些能力后续可以拆到 V2。

## 8. 推荐开发顺序

建议开发顺序：

1. `POST /v1/auth/wechat/login`
2. `GET /v1/app/bootstrap`
3. `POST /v1/recommendations/today/refresh`
4. `POST /v1/recommendations/today/schedule`
5. `POST /v1/recommendations/today/mark-worn`
6. `POST /v1/garments`
7. `POST /v1/garments/{id}/mark-worn`
8. `POST /v1/outfits`
9. `POST /v1/plans/{date}/recommendation`

原因：

- 登录 + bootstrap 一通，前端所有页面就能先跑起来
- 推荐相关接口最早影响首页、推荐页、日历页
- 衣物和搭配相关 mutation 在后面补齐
