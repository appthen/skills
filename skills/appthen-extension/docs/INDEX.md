# 文档索引（唯一入口）

> **为什么有这张表**：AppThen **不提供对外开放的文档系统**。第三方拿到的是这个技能目录本身，所以「去哪读什么」必须能在目录内自洽闭环——本表就是那条链路。
>
> 用法：先在 §1 找到你的场景 → 按顺序打开对应文件（全部在本目录内，离线可用）→ 遇到契约级事实（字段 / 路由 / 错误码）时翻 §2 的快照。

---

## 1. 场景 → 该读哪篇

| 你的场景 | 顺序阅读 | 读完你应该能做对的事 |
|---|---|---|
| **完全没接触过，先了解这是什么** | [../SKILL.md](../SKILL.md) → [PLUGIN_DEV.md](PLUGIN_DEV.md) §1–§4 | 知道扩展是什么形态、工作区长什么样、能跑起一个最小扩展 |
| **从零起一个扩展工作区** | [PLUGIN_DEV.md](PLUGIN_DEV.md) §1–§3 ↔ [../examples/extension-workspace/README.md](../examples/extension-workspace/README.md) | `init` 出工作区，`doctor`/`dev` 跑通，知道每个脚本与命令的边界 |
| **把某个业务系统/模块做成扩展** | [PRE-DEV-INTERROGATION.md](PRE-DEV-INTERROGATION.md) → [UI-CONTRACT.md](UI-CONTRACT.md) §7 → [PLUGIN_DEV.md](PLUGIN_DEV.md) §5–§7 | 先出三张清单（质疑/缺口/增量）并带证据，再决定界面，不会做成「入口菜单页」 |
| **列表 / 表格要适配手机和分屏** | [UI-CONTRACT.md](UI-CONTRACT.md) §12 → 范式示例 [../examples/extension-workspace/extensions/reference-crud](../examples/extension-workspace/extensions/reference-crud) | 窄容器下表格退化成卡片列表（`<Table cardMode>` + `TableCell label/cardTitle/cardHidden`），不写 `nth-child` 重排，不靠横向滚动 |
| **写界面 / 排版 / 控件 / 主题** | [UI-CONTRACT.md](UI-CONTRACT.md) → [../references/b2b-ui-ux.md](../references/b2b-ui-ux.md) → [ui-design-quality.md](../references/ui-design-quality.md) → 范式示例 [../examples/extension-workspace/extensions/reference-crud](../examples/extension-workspace/extensions/reference-crud) | 控件尺寸、间距、主题 token、移动端折叠、首屏价值判定全过；字号 ≥12px（§9 硬约束）、CSS 体量是建议信号（§10 归因表）、列表用 Table 必须带 card list（§12） |
| **想知道自己写的 CSS 是不是太多、字号是不是太小** | 直接跑 `node scripts/audit-ui.mjs <扩展目录>`，再回 [UI-CONTRACT.md](UI-CONTRACT.md) §8/§10 看每行该归谁 | 门禁退出码为 0；CSS 超预算或出现 <12px 字号时，知道该换组件、换原子类还是上提 SDK |
| **把业务接给数字成员（AI 能查/能操作）** | [AGENT-INTEGRATION.md](AGENT-INTEGRATION.md) | 五张声明面（连接器/资源/卡片/领域技能/权限）写对，知道平台会自动注入、不要手写提示词 |
| **扩展要读你自己的后端数据（员工身份透传）** | [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) | 换票链路、`/identity/me` 验真、多身份切换、CORS 与安全红线 |
| **你的 SaaS 要批量为租户开通/同步成员/发通知** | `appthen-platform-sdk` 技能（随 `@appthen/sdk-node` 包分发：`node_modules/@appthen/sdk-node/skills/appthen-platform-sdk/SKILL.md`）→ [contracts/service-provider-platform-api.md](contracts/service-provider-platform-api.md) | 分清「用户身份」与「服务商身份」，不会把 AK/SK 放进前端 |
| **发布 / 审核 / 安装 / 挂载** | [PLUGIN_DEV.md](PLUGIN_DEV.md) §10 → [../SKILL.md](../SKILL.md) §7 | 明白这是**五道门不代表一个动作**；改字节必须升版本；审核方要先约好 |
| **发布返回 200 但市场里看不到** | [PLUGIN_DEV.md](PLUGIN_DEV.md) §10 第 2–3 步 | 检查是否走了 listing 正门、`resourceId === appId`、是否还停在 `draft` |
| **审核永远 403** | [PLUGIN_DEV.md](PLUGIN_DEV.md) §10 白名单段 + [../SKILL.md](../SKILL.md) §7 | 白名单逐字匹配 `providerAccountKey`；用 `admin-status` 自检 `reason=configured` |
| **本地调试面板空白 / 改了 manifest 不生效** | [PLUGIN_DEV.md](PLUGIN_DEV.md) §12 | 知道 serve 不监听 manifest、要移除后重新加入；能力型扩展本就无入口 |
| **图标怎么做** | [../references/extension-icon-spec.md](../references/extension-icon-spec.md) | viewBox 24、图形占画布 ≥75%、currentColor、无背景块 |
| **要给接手的人交接** | [../examples/extension-workspace/AGENTS.md](../examples/extension-workspace/AGENTS.md) | 四条工作纪律 + 禁止清单（宿主内部 API、手拼 URL、弹窗塞整页） |

---

## 2. 平台契约快照（只读，别在这里改）

这两份是平台仓库原文的**逐字快照**，为的是让第三方不用访问平台仓库也能看到字段级契约。

| 文件 | 讲什么 | 什么时候必读 | 平台权威源 |
|---|---|---|---|
| [contracts/identity-tenant-contract.md](contracts/identity-tenant-contract.md) | 身份与租户模型：`/identity/me`、`/identity/tenants`、`/identity/switch-tenant`、`subjectContext`、compat 字段边界 | 做 [BACKEND-INTEGRATION.md](BACKEND-INTEGRATION.md) 的形态 B 时 | `nest-server/docs/identity-tenant-contract.md` |
| [contracts/service-provider-platform-api.md](contracts/service-provider-platform-api.md) | 服务商（代运营）：AK/SK → platform token、scopes、grant 状态机、`loginIdentifiers`、`identityLabel`、错误码 | 做形态 C（`@appthen/sdk-node`）时 | `nest-server/docs/service-provider-platform-api.md` |

**快照纪律**：与平台实现不一致时，**以平台代码为准**，然后回来同时更新「快照 + 本表」。不要在快照里追加本仓自己的结论——结论写进上面那些「用法类」文档。

---

## 3. 本目录文件清单（一句话职责）

```text
skills/appthen-extension/
├── SKILL.md                       # 触发描述 + 主流程（先读这个）
├── docs/
│   ├── INDEX.md                   # ← 本文件：场景路由表
│   ├── PLUGIN_DEV.md              # 稳定契约 v1：工作区 / manifest / 命令 / 发布五道门
│   ├── UI-CONTRACT.md             # 视觉与容器强制契约（尺寸、间距、主题、首屏价值）
│   ├── AGENT-INTEGRATION.md       # 扩展 ↔ 数字成员：五张声明面 + 端到端验收
│   ├── PRE-DEV-INTERROGATION.md   # 立项前拷问审查：三张清单 + A/B/C 成本分级
│   ├── BACKEND-INTEGRATION.md     # 自有后端接入：换票 / 多身份 / CORS / 安全红线
│   └── contracts/                 # 平台契约只读快照（见 §2）
├── references/
│   ├── b2b-ui-ux.md               # B2B / 数据密集型场景的结构与视觉范式
│   └── extension-icon-spec.md     # 图标规范
└── examples/extension-workspace/  # 可跑样板工作区（含 AGENTS.md / README.md）
```

---

## 4. 覆盖边界的诚实说明

- **平台侧对外文档（`appthen-open-capabilities/collaboration-workbench/*`）落后于本技能**：那几篇仍写着 `export const plugin: AppThenPlugin` 对象导出与 `registerMainView`，而当前稳定契约是 `export activate(ctx)` + `ctx.capabilities.registerSidebarView/registerEditorView`，且**禁止**外部扩展使用 `registerMainView`。**以本技能为准**，不要照那几篇写代码。
- 本技能**不覆盖**：AppThen 应用引擎（VFS 页面/组件）→ 见 `appthen-application` 技能；平台内部实现 → 见平台仓库。
- 如果某条链在本目录内走不通（链接指向缺失文件、或与平台实现冲突），这属于**技能缺陷**，请按「场景 → 文件 → 结论」记一条反馈给平台方，不要自己脑补补丁。
