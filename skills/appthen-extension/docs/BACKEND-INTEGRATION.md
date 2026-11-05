| 服务商 API（形态 C） | 上游 `nest-server/docs/service-provider-platform-api.md` → 本目录 [contracts/service-provider-platform-api.md](contracts/service-provider-platform-api.md) 快照 |# 对接自有后端（扩展 ↔ 你的服务端）

> 适用：扩展要读写**你自己**的业务后端（LIMS / ERP / CRM / 工单…），而不只是展示平台数据。
> 一句话结论：**平台侧不需要任何改造**。扩展用 `ctx.auth.getAccessToken()` 取到平台 token → 你的后端拿它调一次 `GET /identity/me` 验真 → 换成你自己的会话。
> **不需要 JWKS、不需要共享密钥、不需要 introspect 端点。**

配套：身份契约原文 [contracts/identity-tenant-contract.md](contracts/identity-tenant-contract.md) ｜ 文档索引 [INDEX.md](INDEX.md)

---

## 1. 先选形态（三种，别混）

| 形态 | 鉴权主体 | 你要写的 | 典型场景 | 本文覆盖 |
|---|---|---|---|---|
| **A 只用平台能力** | 平台 | 不写后端 | 面板展示平台数据；业务数据以「连接器」暴露给数字成员 | ✗ → 见 [SKILL.md](../SKILL.md) §2.5、[AGENT-INTEGRATION.md](AGENT-INTEGRATION.md) |
| **B 用户身份透传（最常见）** | 你的后端（信任来源 = 平台 token） | 一个换票接口 + 一次 `/identity/me` | 员工登录工作台后，用**自己的权限**直接看业务数据 | ✅ |
| **C 服务商代运营（机器身份）** | 平台（AK/SK → platform token） | `@appthen/sdk-node` | 你的 SaaS 后台侧批量为租户开通、同步成员、发通知 | ✗ → 见 `appthen-platform-sdk` 技能 + [contracts/service-provider-platform-api.md](../docs/contracts/service-provider-platform-api.md) |

**B 与 C 不要混用**：B 的 token 代表「**某个人**在某个租户下」；C 的 token 代表「**你的服务商身份**被某个租户授权」。把 C 的 `accessSecret` 放进前端 = 事故。

---

## 2. 六条事实（先读，避免用错）

1. **token 是 JWT，但不要自己解它来做鉴权决定。** 它由平台签发，`tenantId` / `subjectId` 在 claims 里；claim 集合平台可调整。需要身份事实就去问 `/identity/me`。
2. **平台没有 JWKS，也没有 introspect。** 验真的唯一正门是 `GET /identity/me`（`Authorization: Bearer <token>`）。
3. **`/identity/me` 的返回形状（3 个顶层键，不要臆造第 4 个）：**

   ```ts
   {
     identity: IdentityContext;      // 见下
     tenantScoped: boolean;          // token 是否带 tenantId
     subjectContext: {               // 租户级主体上下文；非租户 token 时为 null
       subject: unknown;
       subjectClass: unknown;
       memberships: unknown[];
       organizationNodeIds: string[];
     } | null;
   }
   ```

   `IdentityContext` 字段（`src/modules/identity/identity.types.ts`）：

   ```ts
   {
     authType: 'user' | 'tenant_app' | 'agent_node';
     source: 'web' | 'cli' | 'sdk' | 'agent';
     tenantId?: string; subjectId?: string; principalId?: string;
     user?: { userId?: string; name?: string; phone?: string; avatar?: string;
              identityProvider?: string; casdoorUserId?: string };
     app?: { appId: string; scopes: string[]; actingSubjectId?: string | null;
             actingMode?: 'self' | 'subject' | string };
     roles?: string[]; permissions?: string[];
     compat?: { userId?: number; teamId?: number; roleId?: number };
     tokenClaims?: Record<string, any>;   // /identity/me 已剥离，不要依赖
   }
   ```

4. **`agent_node` token 在当前阶段不受支持**，你的后端要显式拒绝（不要因为「解出来有 tenantId」就放行）。
5. **token 里已经没有 `phone` / `casdoorUserId`**（2026-10-22 起按 PII 移除）。别指望从 token 拿手机号；需要就查 `/identity/me` 或你自己的映射表。
6. **token 存在浏览器 localStorage，且平台允许安装第三方扩展** ⇒ 它**不是秘密**。任何密钥都不能放在扩展侧。

---

## 3. 端到端链路（B 形态，7 步）

```text
①  用户在工作台登录（手机号 / casdoor）→ 平台签发 token（带 tenantId + subjectId）
        │
②  扩展被激活，ctx.auth.getAccessToken() 拿到该 token
        │
③  扩展 POST {你的后端}/app/appthen/sso/exchange   body: { appThenToken }
        │
④  你的后端带 Bearer 调 GET {平台}/identity/me
        │       ├─ 401/403 / authType==='agent_node' → 拒绝（统一报「凭证无效或已过期」）
        │       └─ 200 → 拿到 identity.tenantId + identity.subjectId
        │
⑤  你的后端查映射表 appthen_subject_mapping（唯一键：appthenTenantId + subjectId）
        │       ├─ 命中 → 用对应本地 userId
        │       └─ 未命中 → 首次登录：按 email/手机号匹配或新建本地账号并写映射
        │
⑥  你的后端签发**自己的**会话（自有 JWT / cookie），返回 { realm, token, refreshToken }
        │
⑦  扩展 applyLogin(realm, token, refreshToken) → 之后所有业务请求带自有 token
```

关键点：**你的后端只消费「平台已验证过的身份」，自己不再验证平台 token 的签名**。这就是为什么不需要 JWKS：一次 HTTPS 调用即验真，且平台侧零改造。

---

## 4. 扩展侧最少实现

```tsx
import type { PluginContext } from '@appthen/vibe-workspace/plugins/base';

function setupWorkbenchSso(ctx: PluginContext) {
  let disposed = false;
  let generation = 0;
  let currentToken: string | null = null;

  const sync = async () => {
    if (disposed) return;
    const wbToken = ctx.auth.getAccessToken();
    if (!wbToken) return;                 // 未登录：等下一次 actor 变化
    if (wbToken === currentToken) return; // 同一枚 token 不重复换票
    const gen = ++generation;
    currentToken = wbToken;
    const res = await fetch(`${YOUR_BACKEND}/app/appthen/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appThenToken: wbToken }),
    });
    if (disposed || gen !== generation) return;
    if (!res.ok) return;                  // TODO: 落审计日志，不要弹给用户看拓扑
    const body = await res.json();
    applyLogin(body.realm, body.token, body.refreshToken);  // 你的会话落地
  };

  const off = ctx.auth.subscribeActor(() => void sync());
  void sync();
  return () => { disposed = true; generation++; off(); };
}

export function activate(ctx: PluginContext) {
  const disposeSso = setupWorkbenchSso(ctx);
  const disposeView = ctx.capabilities.registerSidebarView({ /* ... */ });
  return () => { disposeSso(); disposeView(); };
}
```

**必须用 `ctx.auth.subscribeActor()`，不要只在激活时换一次票。** 工作台内可以切换身份（见 §6），只换一次会让用户切了身份还看到旧身份的数据。

可用的上下文 API（`PluginContext`）：

| API | 用途 | 注意 |
|---|---|---|
| `ctx.auth.getAccessToken()` | 取平台 token | 未登录时为 `null` |
| `ctx.auth.getActor()` | 当前 actor（tenantId / user / subject / membership） | 只用于 UI 展示与指纹，**不做鉴权** |
| `ctx.auth.subscribeActor(fn)` | actor 变化订阅 | 返回 disposer，必须清理 |
| `ctx.runtime.tenantId` / `workbenchId` / `teamId` | 运行时上下文 | `teamId` 是 legacy 数字 id，新代码不要当业务归属 |

---

## 5. 后端侧最少实现（以 cool-admin / Nest 风格为例）

```ts
// POST /app/appthen/sso/exchange
async exchange(body: { appThenToken?: string }) {
  const token = String(body?.appThenToken || '').trim();
  if (!token) throw new BadRequestException('缺少 AppThen 凭证');

  // ① 验真：平台是唯一权威
  const res = await fetch(`${APPTHEN_BASE_URL}/identity/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new UnauthorizedException('AppThen 凭证无效或已过期');

  const me = await res.json();
  const identity = me?.identity;
  if (identity?.authType === 'agent_node') throw new UnauthorizedException('AppThen 凭证无效或已过期');
  if (!me?.tenantScoped || !identity?.tenantId || !identity?.subjectId) {
    throw new UnauthorizedException('请先进入团队后再使用本系统');
  }

  // ② 映射：一个平台主体 → 一个本地身份
  const mapping = await this.mappingRepo.findOne({
    appthenTenantId: identity.tenantId,
    subjectId: identity.subjectId,
  });
  const localUser = mapping
    ? await this.loadLocalUser(mapping.kind, mapping.userId)
    : await this.provisionLocalUser(identity);   // 首次登录：建号 + 写映射

  // ③ 发**你自己的**会话（不是你转发平台 token）
  return this.issueOwnSession(localUser);       // { realm, token, refreshToken }
}
```

工程要求（照做能少踩坑）：

1. **错误统一**：对外只回「AppThen 凭证无效或已过期」，不要把「平台 502 / 租户不存在 / 映射缺失」原样回给浏览器 —— 会泄露内部拓扑。
2. **映射表加唯一约束**：`(appthenTenantId, subjectId)`。设计成「一个平台主体 → 一个本地身份」。
3. **不要把平台 token 当长期会话**：它 2h 过期；你自己的会话生命周期由你自己定。
4. **并发去重**：扩展侧可能因多次 `subscribeActor` 触发重复换票，后端要幂等（同一 token 重复换票返回同一会话即可）。
5. **数据库选型不影响契约**：文件型（SQLite）/ MySQL / PG 都能落这张映射表；注意自增主键语义（SQLite 与 MySQL 的 `bigint auto_increment` 行为不同，用业务唯一键做幂等，别依赖自增号）。

---

## 6. 多身份（一个手机号多个身份，且可切换）

平台支持「**同一账号在同一租户下有多个主体**」。第三方声明的短标签 `identityLabel`（如「用户前台 / 员工后台」）就是给这种情况用的，平台只透传、不翻译、不判定。

| 能力 | 路由 | 说明 |
|---|---|---|
| 列出可进入的团队 + 每个团队下的身份 | `POST /user/get-my-tenants` | 返回项含 `identities[]`：`subjectId / displayName / identityLabel / kind / classId / tags / providers / role / isPrimary / isDefault` |
| 选定身份进入（切换身份） | `POST /user/select-tenant-team`，body `{ tenantId, subjectId? }` | 返回**带 `tenantId` + `subjectId` 的新 token**；不传 `subjectId` 用确定性默认身份 |
| 仅切租户（不带身份选择） | `POST /identity/switch-tenant`，body `{ tenantId }` | 用该租户下的默认身份 |

默认身份的确定性排序：**绑手机号优先 → 主账号 → 创建最早 → `subjectId` 字典序**（`src/modules/user/user.service.ts#selectTenantTeam`）。不要自己写 `find(isPrimary) || [0]` —— 多身份且都没标 primary 时结果不确定。

切换身份失败会返回 `403 { code: 'IDENTITY_NOT_BOUND' }`：指定主体不属于当前账号，属于越权，正确拒绝即可。

### 落到你的后端要注意的两件事

1. **actor 变化就必须重新换票**：用户在工作台切换身份 → `ctx.auth.subscribeActor` 触发 → 用新 token 重新 exchange → 清掉旧会话（**两个 realm 都要登出**，不能只登一个）。
2. **映射唯一键的边界**：「一个人既是员工后台、又是用户前台」在平台上意味着**两个主体**（两个 `subjectId`）。如果你的映射表把 `(appthenTenantId, 本地userId)` 也设成唯一键，那么这两个身份必须映射到**两个本地账号**（例如 admin realm 的账号 + app realm 的账号），否则第二次会被唯一键挡住。
   参考实现（LIMS 样板）：`admin` 与 `app` 是两套独立 JWT（不同密钥、不同身份、不同生命周期），按 realm 隔离，而不是一个账号两种权限。

---

## 7. CORS 与网络

- **离线工作台不会代理任意业务 API**。你的后端必须显式允许工作台来源（含 `http://localhost:5177` 与线上工作台域名）。
- 不要把本地地址硬编码进扩展源码。用构建期环境变量 + 默认回落到同源相对路径。
- 预检请求要放行 `Authorization`、`Content-Type`；换票接口必须走 POST + `application/json`。
- 换票接口建议**不要求 cookie**（用 `appThenToken` 显式传递），可减少跨域凭据配置。

---

## 8. 安全红线（违反即事故）

1. **前端永不持有 AK/SK 或任何长期密钥**（那是形态 C 的东西，只在你的后端）。
2. **平台 token 不是秘密**：它在 localStorage、扩展可读。不要把它存进日志、URL、二维码、分享链接。
3. **不要用 `roles` / `permissions` 里的字符串做管理员判定**（外部字段语义不由你控制）。平台侧同样已放弃这种判定方式，改用「白名单 + 显式声明」。
4. **不要在浏览器里自助切换 `subjectId` 就越权**：切换必须走平台换票路由，服务端会校验「该主体是否绑定在当前账号」。
5. **不要把 `phone` / `casdoorUserId` 写进你签发的 JWT**：平台已因 PII 原因把它们从 token 移除，照抄旧做法会重犯同一个问题。

---

## 9. 最小验收清单（能过就算接上了）

- [ ] 未登录时扩展不发业务请求，不报错刷屏。
- [ ] 登录后扩展自动换票成功，业务列表返回**当前身份**的数据。
- [ ] **切换身份**后（工作台身份切换器切到另一个身份），扩展自动重换票，数据变成新身份的数据。
- [ ] 登出后旧会话被清理，业务接口返回 401 而不是继续用旧 token。
- [ ] 直接拿过期/伪造 token 调换票接口 → 返回 401 且**不泄露**平台内部错误细节。
- [ ] 用 `agent_node` 类型的 token 调换票接口 → 被拒绝。
- [ ] 同一 token 并发换票两次，结果幂等（不产生两条本地账号）。
- [ ] 跨域：从线上工作台域名访问你的后端无 CORS 报错。

---

## 10. 常见坑（都是真实踩过的）

| 症状 | 真因 | 处理 |
|---|---|---|
| 扩展面板空白 / 一直未登录 | 换票函数没拿到 `ctx.auth`（把 `auth` 拆开传丢上下文） | 显式把 `{ auth: ctx.auth }` 包一层传进去，别依赖 `this` |
| 切换身份后仍显示旧数据 | 只在 `activate` 时换了一次票 | 订阅 `ctx.auth.subscribeActor`，并比对指纹（`tenantId:subjectId`） |
| 首次登录 500「租户不存在」 | 把「未进入团队」当成「租户不存在」 | token 无 `tenantId` 时回 `tenant-scoped` 提示，引导先选团队 |
| 第二次登录被唯一键挡住 | 映射表把 `(tenantId, 本地userId)` 设了唯一键，但平台侧是同人两个主体 | 一个主体一个本地身份；多身份 = 多主体 = 多本地账号 |
| 审核/管理类接口永远 403 | 平台管理员白名单按 `providerAccountKey` **逐字**匹配 | 见 [PLUGIN_DEV.md](PLUGIN_DEV.md) §10 |
| 本地能跑、线上 401 | 线上换票接口 CORS 未放行 / baseUrl 仍指本机 | 用构建期环境变量，别硬编码 |

---

## 11. 平台代码位置（维护者用，第三方可跳过）

| 事实 | 位置 |
|---|---|
| `IdentityContext` 字段 | `src/modules/identity/identity.types.ts` |
| `/identity/me` 实现 | `src/modules/identity/identity.controller.ts`、`identity.service.ts#getMeFromToken` |
| 多身份构造与确定性排序 | `src/modules/user/user.service.ts#getMyTenantTeams` / `#selectTenantTeam` |
| 多身份路由 | `src/modules/user/user.controller.ts`（`/user/get-my-tenants`、`/user/select-tenant-team`） |
| 平台管理员判定（白名单逐字匹配） | `src/modules/subject-directory/guards/platform-admin.guard.ts` |
| 服务商 API（形态 C） | 上游 `nest-server/docs/service-provider-platform-api.md` → 本目录 [contracts/service-provider-platform-api.md](contracts/service-provider-platform-api.md) 快照 |

> 参考实现（可跑样板，非平台资产）：某 LIMS 工作台的 `shared/auth-client`（双 realm 会话）+ `extensions/acme.auth-center/src/workbenchSso.ts`（换票与身份指纹）+ 后端 `modules/appthen/{controller,service,entity}`。平台方内部可见；第三方按本文 §3–§6 自己实现即可，不必照抄其框架。
