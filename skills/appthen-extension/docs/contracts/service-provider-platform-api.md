<!-- 平台契约快照：只读，不要在此处直接改内容 -->
> **来源**：`nest-server/docs/service-provider-platform-api.md` ｜ **快照基线** `0a9e903`（2026-10-12）｜ **同步日期** 2026-11-01
> **权威版本以平台仓库为准**。发现与本快照不一致时：先以平台代码为准，再回来更新本快照与 [INDEX.md](../INDEX.md)。
> 本文件为什么内联在技能里：我们**不提供对外开放的文档系统**，第三方按技能目录离线阅读即可，不假设能访问平台仓库。

---
# 服务商（代运营）平台 API 契约

> **定位**：M2 §1「契约先行」的可对接规格。科研检测 LIMS SaaS 作为**代运营方**接入 AppThen 的凭证、授权、同步、安装、对账接口约定。
> **状态**：草案 v0.1（2026-09-09）。标注 ✅=现有已实现可复用 / ❌=待实现（对接前须落地）。
> **冻结纪律**：本文件冻结后 LIMS 对接方可开始对接；任何字段变更须走版本 bump 并通知对接方。

---

## 0. 概念与术语

| 术语 | 含义 |
|---|---|
| **代运营方（Provider）** | 科研检测 LIMS SaaS，在 AppThen 内是**一个普通租户**，同时持有代运营凭证 |
| `platformId` | 代运营凭证标识，**租户级长期凭证**（与该租户 AK/SK 同类，一次签发长期有效，非每次授权重建） |
| `operatorTenantId` | 代运营方自己的租户 ID（凭证归属方） |
| `targetTenantId` | 被代管的实验室租户 ID |
| `externalCorrelationId` | 对账锚：LIMS 侧机构/租户标识 ↔ AppThen `tenantId`，**必填** |
| `grant` | 一条授权记录：`{targetTenantId, operatorPlatformId?, scopes?, status, externalCorrelationId?}` |

**核心原则**：代运营是**关系**不是结构层级——删掉代运营实体，任何租户的数据边界语义不受影响。租户 = 团队 1:1 不变。

---

## 1. 鉴权模型

### 1.1 现有链路（✅ 已实现，直接复用）

```
POST /open-platform/tenant-apps          # 租户用户在控制台创建应用（JWT 守卫）
  → 返回 accessKey(ak_xxx) + accessSecret(sk_xxx，仅此一次明文)

POST /open-platform/token                # AK/SK 换 token（无守卫）
  { accessKey, accessSecret, actingSubjectId?, actingMode?, requestedScopes? }
  → { tokenType:'Bearer', accessToken, expiresIn:7200, tenantId, appId, scopes, actingMode }
```

实现要点（`open-platform.service.ts` 已验证）：
- `accessSecret` 以 **sha256 + timingSafeEqual** 校验，不明文存储
- `scopes = requestedScopes ∩ allowedScopes`（未传 requested 则给全部 allowed）
- JWT payload：`{tokenType:'tenant_app', tenantId, appId, scopes, actingSubjectId, actingMode}`，有效期 **2h**
- `allowedActingModes` 默认 `['self','subject']`

### 1.2 ⚠️ 现有模型的缺口（代运营必须解决）

**现有 app 是单租户绑定**：`app.tenantId` 固定，token 内 `tenantId` 恒等于凭证归属方自己的租户。
但代运营要操作的是**其他租户**（多个实验室）。因此新增：

- `actingMode: 'platform'`（代运营模式），token 内携带 `platformId` + `operatorTenantId`
- 每次代运营调用须显式传 `targetTenantId`；服务端校验 **该 platformId 是否持有针对该 targetTenantId 的 active grant 且含对应 scope**，否则 403
- 现有 `allowedScopes` 扩展 `platform:*` 族（见 §2）

> 这样**不动**现有单租户语义（老调用方零感知），代运营走新增的 `platform` actingMode。

> **✅ 已实现（2026-09-09；2026-10-08 放宽 `pending`）**：`TenantIntegrationApp` 新增可选 `platformId`；
> `issueAppToken` 在 `actingMode:'platform'` 时校验凭证持有 `platformId`（否则 401），
> 并在 token 内携带 `platformId` + `operatorTenantId`；
> `assertPlatformGrant()` 实现三段校验（无 grant → `GRANT_NOT_FOUND`、
> **`revoked`** → `GRANT_INACTIVE`、scope 缺失 → `PLATFORM_SCOPE_DENIED`，均 403）。
> **`pending`（待认领）放行**——服务商需在租户认领前准备数据（同步成员等），
> 否则租户认领后仍是空壳；详见 §4.2 前置说明。测试 8 例全绿。

---

## 2. `platform-operate` scope 族

| scope | 能力 | 对应 API |
|---|---|---|
| `platform:tenant:create` | 代开通租户（pending） | §4.1 |
| `platform:tenant:read` | 查询/对账代管租户 | §4.5 |
| `platform:subject:sync` | 代同步成员（create-or-get 幂等） | §4.2 |
| `platform:workbench:install` | 代安装工作台到目标租户 | §4.3 |
| `platform:message:send` | 按标签圈人触达（通知/群发） | §4.2.2 |
| `platform:grant:toggle` | 启停某条授权 | §4.4 |

**纪律**：能力**枚举制**，不做"一定程度的控制"——逐项授权 + 逐项审计。

---

## 3. 数据模型（✅ 已落地，2026-09-09）

```
PlatformCredential（挂在 operatorTenantId 下，与 TenantIntegrationApp 同源或独立集合）
  platformId          string   # plat_xxx
  operatorTenantId    string   # SaaS 自己的租户
  accessKey / accessSecretHash # 与现有 AK/SK 同机制
  status              'active' | 'revoked'
  allowedScopes       string[] # platform:* 族子集
  ipWhitelist         string[]

PlatformGrant
  grantId             string
  platformId          string
  targetTenantId      string
  scopes              string[]  # 该租户被授予的 platform scope 子集
  status              'pending' | 'active' | 'revoked'
  externalCorrelationId  string  # 必填，对账锚
  createdAt / updatedAt
```

`externalCorrelationId` 同时写入目标租户记录，作为双向对账锚（防串租户）。

---

## 4. API 规格

统一前缀 `/open-platform/platform`，全部走 **`actingMode:'platform'` 的 app token**，均校验 grant。

### 4.1 代开通租户（✅ 2026-09-09 已实现）

> 实现说明：`platform:tenant:create` 是**凭证级** scope（开通时目标租户尚不存在，无 per-tenant
> grant 可查，由 token scopes 校验）；开通成功自动落 `PlatformGrant`（pending + 默认
> `platform:subject:sync`）并签发 **claimToken（7d）**。**幂等**：同 platformId +
> externalCorrelationId 重复开通返回已开通租户（created:false）。

```
POST /open-platform/platform/tenants
Authorization: Bearer <app token, actingMode=platform>
scope: platform:tenant:create

{
  "targetTenantId": "可选，不传则由服务端生成",
  "name": "XX 检测实验室",
  "externalCorrelationId": "lims_org_10086",   // 必填
  "adminHint": { "source": "lims", "externalKey": "user_001" }  // 可选，预留管理员
}
→ 201
{
  "tenantId": "tenant_xxx",
  "status": "pending",          // owner 缺位，待认领
  "externalCorrelationId": "lims_org_10086",
  "claimUrl": "https://<domain>/claim?token=..."   // 与域名入口同一链路
}
```

**语义**：创建的租户为 `pending`（owner 缺位），需经 §4.6 认领激活。

### 4.2 代同步成员（create-or-get 幂等）

> **✅ 内核已实现（2026-09-09）**：`POST /subject-directory/open/subjects/sync`
> （`SyncOpenRegisteredSubjectDto` + `SubjectDirectoryService.syncOpenSubject`），
> 走现有 `ActorAuthGuard` + tenant app token，**当前单租户场景立即可用**。
> 下方 platform 版是在此内核之上加 `targetTenantId` + grant 校验的跨租户封装，待 platform 层落地。
> 测试：`src/modules/subject-directory/subject-directory-sync.spec.ts` 5 例
> （首次创建 / 重复幂等 / 并发 duplicate key 回读 / subjectId 冲突 409 / 缺幂等键 400）。
> 现状：并发安全由已有的 `{tenantId, source, externalKey}` 唯一索引保证（应用层捕获 11000 后回读）。
>
> **✅ platform 版路由已实现（2026-09-09）**：`POST /open-platform/platform/subjects:sync`
> （`AppJwtAuthGuard` → 校验 `actingMode:'platform'` → `assertPlatformGrant('platform:subject:sync')`
> → 复用上述内核）。**跨租户代同步已打通**。
>
> **前置（2026-10-08 放宽）**：grant 存在且**未被解除**即可 —— **`pending`（租户尚未认领）亦可同步成员**。
> 这是代运营的核心场景：服务商开通后先把机构成员备好，租户认领后**立即可用**；
> 若要求 `active`，认领后是空壳、管理员还得等第二轮同步。仅 `revoked` 拒绝。

```
POST /open-platform/platform/subjects:sync
scope: platform:subject:sync

{
  "targetTenantId": "6a87446f38cb1f2a6b048865",
  "classId": "class_lims_member",             // 须为 external 类（⚠️ 字段名是 classId，非 subjectClassId）
  "displayName": "张三",                       // ⚠️ 顶层字段，不放在 profile 里
  "identityLabel": "用户前台",                  // 可选：行内短标签，区分同一个人的多个身份（见 §4.2.4）
  "externalIdentity": { "source": "lims", "externalKey": "user_001" },  // 幂等键
  "loginIdentifiers": [{ "provider": "phone", "value": "13900000099" }], // 登录标识（见 §4.2.3）
  "tags": ["lims:type:app", "lims:role:member"],
  "updateOnMatch": true,
  "profile": { "limsUserId": "10086" },       // 自由字段，仅作属性，不参与登录
  "searchableMeta": { "limsOrgId": "lims_org_10086" }
}
→ 200
{ "subjectId": "subject_xxx", "created": false, "externalCorrelationId": "lims_org_10086" }
```

**幂等语义（关键）**：
- 幂等键 = `externalIdentity.{source, externalKey}`
- 服务端**原子**执行 find-then-create：先 `findSubjectByExternalIdentity`，命中则返回（`created:false`），未命中则创建（`created:true`）
- 并发同一 externalKey 只产生一个 Subject（须加唯一索引：`{tenantId, source, externalKey}`）
- 重复调用结果一致，LIMS 侧可安全重试

> 现有 `open/subjects` 是纯 create（非幂等），`GET open/subjects/by-external-identity` 是查询（✅ 已有）。本接口在其之上封装原子 create-or-get。

### 4.2.1 tags（标签）语义与推荐姿势（2026-09-10 与 LIMS 对齐）

`tags` 随 syncSubject **一次携带落库**（`Subject.tags: string[]`，索引 `{tenantId, tags}` 支撑按标签圈人）：

- **新建**：tags 直接落库。
- **命中已存在**：默认 `updateOnMatch:false` 不更新任何字段；传 `updateOnMatch:true` 时，**传入的字段整体覆盖（含 tags 数组）、未传入的字段保留**。
  > ⚠️ **2026-10-09 修正**：该开关此前通过 HTTP 路由**没有真正转发**（被当成 Subject 上的普通字段），
  > 导致"命中已存在主体时覆盖字段"**从未生效**。现已修正，`updateOnMatch` 按上述语义生效。
- **推荐姿势（"事件时一次推全"）**：每次成员事件推 `tags: [该成员当前全量标签]` + `updateOnMatch: true`——标签维护跟随成员事件，**无需独立打标接口**。
- **标签命名规范**（防与 AppThen 内部语义冲突，**务必带来源前缀**）：
  `lims:role:<role>` / `lims:dept:<deptId>` / `lims:type:admin|app`（区分后台用户与 App 用户）等。部门/团队关系一期不做实时同步，直接以此类 tag 预留圈人维度。
- `subjectId` **建议不传**：由 AppThen 生成并随响应返回，LIMS 侧落库映射；`externalKey`（如 `admin_user_123`）才是稳定锚。传入 subjectId 时与已绑定主体不一致会 409。

### 4.2.3 登录标识 `loginIdentifiers`（2026-10-09 新增 · 软要求）

**它解决什么**：同步进来的成员默认只是"通讯录里的人"——在 IM 里能被 @、能被圈人，但**这个人自己拿手机号登录 AppThen 时对不上号**（平台不知道"这个成员"就是"登录的你"），于是在"切换团队/选择身份"里**列不出来**。

`loginIdentifiers` 就是把这件事显式声明出来：**这个主体，用这个标识登录时，就是他。**

```
"loginIdentifiers": [{ "provider": "phone", "value": "13900000099" }]
```

**语义要点**（照做，避免返工）：

| 规则 | 说明 |
|---|---|
**软要求，不是硬必填** | 不传**不算错**，只是该主体"不可登录、列不出来"。**刻意如此**：第三方系统里存在没有手机号的账号（纯后台账号），硬拒会让整批同步失败。 |
**带上才可用** | 带上即可登录；**补上后重推一次即生效**（无需删了重建）。 |
**与 `updateOnMatch` 正交** | 传 `loginIdentifiers` 就补绑，**不受** `updateOnMatch` 影响（后者只管 displayName/tags 等字段覆盖）。 |
**不传 ≠ 解绑** | 缺席不代表移除，避免同步端漏字段把登录能力误摘。 |
**允许"一标识多主体"** | 同一手机号可同时挂在多个主体上（例如第三方系统里同一人同时是「用户前台」与「员工后台」）。平台**如实挂载、不自行归并**——谁是谁由你声明。登录时平台会把候选列出来让用户**自己选**。 |
**系统内首次挂载者为「主」** | 该标识在本团队**首次**被挂载的那个主体为"主身份"，作为登录时的默认选择（不是"最后登录者为主"）。 |
**一次同步一个主体** | 一个主体 = 一次调用。同一个人有 N 个身份就调 N 次，用 `externalKey` 区分（如 `user_123` / `admin_123`）。 |

**字段级校验**：`provider` 目前仅支持 `phone`（其他值直接 400 `unsupported login identifier provider`，**不静默忽略**——否则你会以为传了、到登录才发现没用）。`value` 非空、≤128 字符。

### 4.2.4 身份标签 `identityLabel`（2026-10-12 新增 · 可选）

**它解决什么**：同一个人在同一团队有多个身份时（见 §4.2.3「一标识多主体」），工作台的「切换身份」需要让用户**一眼分清**哪行是哪个身份。默认只能用 `displayName` + 角色，而同一个人的两个身份常常**连名字都一样**（都是「黄磊」），区分不出来。

`identityLabel` 让你（第三方）声明这个身份的**短标签**：

```
"identityLabel": "员工后台"
```

```
{
  "targetTenantId": "6aa70d9b9d91875e0ce18106",
  "classId": "class_lims_admin",
  "displayName": "黄磊",
  "identityLabel": "员工后台",                  // ← 新增：行内短标签
  "externalIdentity": { "source": "lims", "externalKey": "admin_user_9" },
  "loginIdentifiers": [{ "provider": "phone", "value": "13800000003" }],
  "updateOnMatch": true
}
```

**语义要点**：

| 规则 | 说明 |
|---|---|
**平台只提供字段，不发明语义** | 值**原样展示**——不翻译、不判定、不造词。界面上不会出现「默认」「需验证」这类平台自造的状态。 |
**可选** | 不传不算错；不传时界面回退显示**角色**（`member` / `admin` / `owner`）。 |
**属内容字段** | 与 `displayName` / `tags` 同规则：**新建时落库**；命中已存在主体时**仅在 `updateOnMatch: true` 下覆盖**，不传则保持原值（不会被清空）。 |
**建议 ≤ 4 个字** | 它是**行内**标签位（面板宽 280px）。接口上限 **64 字符**，超出返回 400（防止把整段说明文字塞进来）。 |
**不是圈人维度** | 圈人/触达请继续用 `tags`（§4.2.1）。`identityLabel` **只用于展示**。 |

**推荐用法**：身份标签**跟外部账号走**——`admin_*` 传「员工后台」、`user_*` 传「用户前台」，一个身份一次同步带上即可。

### 4.2.2 按标签/条件触达（✅ 2026-09-10 已实现，声明式，scope `platform:message:send`）

标签的终局价值是**按维度触达**。**设计原则：调用方无 subjectId 概念**——发送者/收件人都是声明式的
（`{source, externalKey, displayName, avatarUrl?}`），服务端 lazily create-or-get
（幂等键 = externalIdentity，与成员同步同一内核，同一 id 只建一次）：

```
POST /open-platform/platform/messages:send
scope: platform:message:send

{
  "targetTenantId": "tenant_xxx",
  "notify": {
    "classId": "class_lims_member",      // 本次触达涉及的外部主体类
    "sender": { "source": "lims", "externalKey": "kf_001", "displayName": "客服小王" },
    "typeId": "type_lims_notify",        // 通知会话类型（不存在则自动创建）
    "kind": "text",
    "content": { "text": "明日 22:00 系统维护" }
  },
  // 收件人二选一：
  "selector": { "tags": ["lims:role:admin", "lims:type:app"] },                          // 标签圈人（交集）
  "receive": { "source": "wechat", "externalKey": "wx_123", "displayName": "微信用户" }  // 单点声明
}
→ { "matched": 37, "delivered": 36, "failed": [{ "subjectId": "...", "reason": "..." }] }
```

**语义**：lazy sender/receiver（声明即建，幂等）→ 对每个收件人 **create-or-get 1:1 通知会话**
（确定性 `platform-notify-<subjectId>`，复用不重建）→ 落消息 → 送达统计；单失败不中断整体。
**零预建**：外部主体类（classId）、通知会话类型（typeId）、sender / receiver 全部声明式 lazily
自动创建——三方不需要预先在 AppThen 建任何数据。
**两条触达路径**：① `selector` 标签圈人——运营触达；② `receive` 单点声明——如微信公众号客服消息迁移
（客服 = sender 声明、微信用户 = receive 声明，全部 lazily 建主体，三方本地只维护 id/昵称/头像，
声明式定义可进代码仓库由 agent + skills 维护，无需人工预建主体）。
**语音播报**：走 `kind` 扩展（渲染层解释），契约不变。
SDK：`lab.notify(request, notify)`（`@appthen/sdk-node`）。

### 4.3 代安装工作台（❌ 待实现）

```
POST /open-platform/platform/workbench-installs
scope: platform:workbench:install

{
  "targetTenantId": "tenant_xxx",
  "resourceId": "workbench_lims_detection",   // 市场资源（distribution: entitlement）
  "versionPin": "1.2.0",                       // 可省略=最新
  "externalCorrelationId": "lims_org_10086"    // 必填，落入安装实例 metadata
}
→ 202
{ "installId": "inst_xxx", "status": "installing", "versionPin": "1.2.0" }
```

**语义**：按工作台携带清单实例化（ConversationType / SubjectClass / 数字成员 / 工作空间），克隆器 **sanitize 三层全扫**重写指向发布方租户的 runtime/Provider/daemon 引用。属**安装语义**，不写 grant 记录。

### 4.4 启停授权（✅ 2026-09-09 已实现）

```
POST /open-platform/platform/grants/{grantId}/toggle
scope: platform:grant:toggle
{ "status": "active" | "revoked" }
→ 200 { "grantId": "...", "status": "revoked", "revokedAt": "..." }
```

### 4.5 对账查询（✅ 2026-09-09 已实现）

```
GET /open-platform/platform/tenants:resolve?externalCorrelationId=lims_org_10086
scope: platform:tenant:read
→ 200 { "tenantId": "tenant_xxx", "status": "active", "grants": [...] }
```

对账锚双向校验：LIMS 机构 ID ↔ AppThen tenantId，防串租户。

### 4.6 认领激活（✅ API 已实现 2026-09-09；登录侧 UI 集成待接）

```
POST /open-platform/platform/tenants/{tenantId}/claim
# 由管理员经域名/邀请首登调用（走用户 JWT，非 app token）
{ "claimToken": "..." }
→ 200 { "tenantId": "tenant_xxx", "status": "active" }
```

代开通租户 `pending → active`，owner 落位。与域名绑定入口是同一条链路的两端。

#### 4.6.1 重发认领凭证（✅ 2026-10-08 已实现）

```
POST /open-platform/platform/tenants/{tenantId}/claim-token   # 平台 token（actingMode=platform）
→ 200 { "tenantId": "...", "status": "pending", "claimToken": "...",
        "expiresIn": "7d", "claimEpoch": 1, "reissued": true }
```

**为什么有**：`claimToken` 是 7 天有效的 JWT，而 §4.1 的幂等命中分支**不返回**新 token——
服务商把 token 转交租户后若 7 天内未认领，原本没有补救路径（联调中由 LIMS 侧提出）。

- **授权**：要求该 `platformId` 对该 `tenantId` 存在 grant 且**未被解除**（`status !== 'revoked'`）——
  **刻意允许 `pending`**（重发的目标场景正是"租户尚未认领"；若要求 `active` 会死锁：
  pending → 需重发 → 要求 active → 拒）；**不额外校验 scope**（现存 grant 的 scopes 可能不含
  `platform:tenant:create`，而重发属开通链路的补救动作）。
- **重发即作废**：`claimEpoch` 递增并写入新 token，**旧 token 立即失效**
  （认领校验比对 epoch；无该字段的旧版 token 视为 0，与未重发过的租户兼容）。
- **状态约束**：仅 `pending` 可重发；已认领 → 409 `TENANT_ALREADY_CLAIMED`。
- **留痕**：`metadata.claimTokenReissuedAt` / `claimTokenReissueCount`。
- SDK：`lab.reissueClaimToken()`（`@appthen/sdk-node`）。

### 4.7 租户侧解除授权（⏳ 待实现 · 微信 unauthorized 对应物）

> 模型来源：本模型与微信第三方平台**同构**（2026-09-09 拍板）。授权是双向信任——
> 认领激活（≈扫码授权）给实验室管理员保留了"解除授权"的对等权利。

```
POST /subject-directory/tenants/current/platform-grants/{grantId}/revoke
# 走用户 JWT（目标租户管理员）
→ 200 { "grantId": "...", "status": "revoked" }
```

语义：仅目标租户管理员可解除**本租户**的代运营 grant；解除后该 platformId 对本租户的
全部 platform API 立即 403（`GRANT_INACTIVE`）。

---

## 5. 错误码

| code | HTTP | 含义 |
|---|---|---|
| `INVALID_CREDENTIAL` | 401 | accessKey/accessSecret 无效或已 revoke |
| `PLATFORM_SCOPE_DENIED` | 403 | 凭证未持有所请求的 platform scope |
| `GRANT_NOT_FOUND` | 403 | 该 platformId 对 targetTenantId 无 grant |
| `GRANT_INACTIVE` | 403 | grant 已被**解除**（`revoked`）——**`pending` 不再拒绝**（2026-10-08 放宽） |
| ~~`TENANT_PENDING_CLAIM`~~ | — | **已退役（2026-10-08）**：原语义"租户待认领，不可安装/同步成员"。放宽后代运营准备动作（同步成员等）对 `pending` 租户**放行**，该错误码不再返回（保留定义仅为兼容既有解析） |
| `CORRELATION_MISMATCH` | 409 | externalCorrelationId 与已记录不一致（防串租户） |
| `IDEMPOTENCY_CONFLICT` | 409 | 同一 externalKey 对应不同主体 |

**幂等建议**：所有写接口支持 `Idempotency-Key` 头，重放返回首次结果。

---

## 6. 审计（❌ 待实现）

每次代运营调用写事件（逐项授权 → 逐项审计）：

```
platform_operate_events {
  platformId, operatorTenantId, targetTenantId,
  action, scope, requestId, idempotencyKey,
  result: 'success' | 'denied' | 'error',
  reasonCode?, at
}
```

### 6.1 授权事件通知 SaaS（⏳ 待实现 · 依赖 Webhook 对外缺口）

| 事件 | 触发 | 对应微信语义 |
|---|---|---|
| `platform.tenant.provisioned` | §4.1 代开通 | — |
| `platform.grant.authorized` | §4.6 认领激活 | authorized |
| `platform.grant.revoked` | §4.4 启停 / §4.7 租户侧解除 | unauthorized |

投递目标：开通时登记的 SaaS 回调地址；失败重试策略与签名校验随 launch map
「Webhook 对外」缺口一并设计。

---

## 7. 状态机

```
租户：  (代开通) pending ──认领──▶ active ──吊销──▶ revoked
grant： (授权)   active  ──toggle──▶ revoked ──toggle──▶ active
凭证：  (签发)   active  ───────────▶ revoked（永久）
```

---

## 8. 与现有实现的关系

| 能力 | 现状 | 本契约定 |
|---|---|---|
| AK/SK 签发 + sha256 校验 | ✅ `open-platform.service.ts` | 复用，新增 `platformId` 维度 |
| token 2h + scopes 交集 | ✅ | 复用，新增 `actingMode:'platform'` |
| `open/subjects` 创建主体 | ✅ | 已在其上实现原子 create-or-get：**`POST open/subjects/sync`（✅ 2026-09-09 已实现，含 5 例单测）** |
| `open/subjects/by-external-identity` | ✅ | 作为幂等查询内核 |
| `open/external-identities` | ✅ | 复用 |
| 跨租户操作 | ✅ 2026-09-09 已实现 | `actingMode:'platform'`（token 带 `platformId`/`operatorTenantId`）+ `assertPlatformGrant` 关系校验 |
| `platform:*` scope 族 + grant 校验 | ✅ 2026-09-09 已实现 | `PlatformGrant` 集合（唯一索引 `{platformId, targetTenantId}`）+ 三段校验（`GRANT_NOT_FOUND`/`GRANT_INACTIVE`/`PLATFORM_SCOPE_DENIED`），7 例单测 |
| pending → 认领激活 | ✅ 2026-09-09 API 已实现 | §4.1/4.6（claimToken 7d；登录侧 UI 集成待接） |
| externalCorrelationId 对账 | ✅ 2026-09-09 已实现 | §4.1 幂等开通 + §4.5 resolve 查询 |
| 代安装工作台 | ❌ | §4.3（依赖工作台分发制 mkt-10 + 克隆 sanitize） |
| 审计事件 | ❌ | §6 |

---

## 9. 对接方（LIMS）最小实现清单

**推荐：`@appthen/sdk-node`**（SDK monorepo `packages/appthen-sdk`，2026-09-09 由
`@appthen/chat-hub-*` 改名——能力是平台级的，不绑定 IM 域；node 端 token 2h 生命周期、
并发刷新去重全部内置）：

```ts
import { createAppThenSdk } from '@appthen/sdk-node';

const sdk = createAppThenSdk({ baseUrl, accessKey, accessSecret });

// 1. 代开通（幂等，必传 externalCorrelationId）
const provisioned = await sdk.provisionTenant({ name: 'XX 检测实验室', externalCorrelationId: 'lims_org_10086' });
// provisioned.claimToken 交给实验室管理员走认领激活（§4.6）

// 2. 按租户组织调用（per-tenant client，自动带 targetTenantId）
const lab = sdk.platformTenant(provisioned.tenantId);
await lab.syncSubject({ classId, displayName: '张三', externalIdentity: { source: 'lims', externalKey: 'user_001' } });

// 3. 对账 / 启停
await sdk.resolveTenant('lims_org_10086');
await sdk.toggleGrant(grantId, 'revoked');
```

裸 HTTP 对接（不依赖 SDK）时的等价步骤：
1. 在 AppThen 租户控制台创建代运营凭证 → 留存 `accessKey` / `accessSecret`
2. 用 AK/SK 换 token（`actingMode:'platform'`），缓存至过期前刷新（2h）
3. 按机构调 §4.1 代开通租户，**必传 `externalCorrelationId`**（LIMS 机构 ID）
4. 人员变更调 §4.2 同步（`externalKey` = LIMS 用户 ID，可安全重试）
5. 需交付能力时调 §4.3 代安装工作台
6. 对账用 §4.5，异常看 `CORRELATION_MISMATCH`

---

## 10. 冻结检查清单（gate）

- [x] `platformId` 数据模型与凭证签发落地（2026-09-09：`TenantIntegrationApp.platformId` + platform token 签发）
- [x] `platform:*` scope 族 + grant 校验中间件（2026-09-09：`PlatformGrant` + `assertPlatformGrant`，7 例单测）
- [x] §4.2 create-or-get 原子性 + 唯一索引（2026-09-09：内核 + platform 路由已打通，索引为已有基建）
- [x] `externalCorrelationId` 落库与对账校验（2026-09-09：§4.1 幂等开通 + §4.5 resolve）
- [x] pending → 认领激活链路（2026-09-09：API 已实现，claimToken 7d；登录侧 UI 集成待接）
- [ ] 审计事件集合
- [ ] 错误码统一
- [ ] 联调用例（含幂等重放、串租户拒绝、无 grant 拒绝）
