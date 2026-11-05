---
name: appthen-extension
description: 当用户想在 AppThen 工作台里"加一个功能、工具、面板、小插件"，想把已有界面/能力打包成可安装、可发布的扩展，或要把业务模块接给数字成员（连接器、领域资源、消息卡片、领域技能；连接器即 MCP 协议的远端服务）时，使用本技能。典型用户说法："帮我在工作台里加个 XX 功能""做一个侧边栏工具""把这个功能做成能安装的扩展""让 agent 能查/操作我们模块的数据"。用户不需要懂代码或文件结构，交付即可安装、可发布的功能。
---

# AppThen Extension Development

Use this skill to take an AppThen Workbench extension from local development through a verifiable package and deployment flow. The canonical detailed specification is [PLUGIN_DEV.md](docs/PLUGIN_DEV.md); the runnable reference workspace is [examples/extension-workspace](examples/extension-workspace).

**Unsure which document to read? Start from [docs/INDEX.md](docs/INDEX.md)** — a scene → document routing table. AppThen does not run an external docs site, so every document a third-party team needs (including platform contract snapshots) lives inside this skill directory.

## First Decision

Determine the ownership boundary before editing:

- External extension work: modify the extension workspace, its manifest, themes, and extension docs.
- Workbench host bug: modify `src/workbench`, `src/core`, shared UI, or host services only when the task explicitly concerns the platform.
- AppThen VFS application work: use `skills/appthen-application` or `skills/skill-cli-app-dev`; do not use this skill.

Read these files when needed:

- [PLUGIN_DEV.md](docs/PLUGIN_DEV.md): stable v1 contract and release rules.
- [examples/extension-workspace/AGENTS.md](examples/extension-workspace/AGENTS.md): agent-specific guardrails.
- [examples/extension-workspace/README.md](examples/extension-workspace/README.md): local workspace usage.
- `src/extension-dev`: workspace discovery, validation, build, pack, and publish behavior.
- `src/extension-cli`: CLI command behavior and flags.
- `src/extension-dev-workbench`: offline Workbench host behavior.

## Reference Loading

按场景渐进加载参考资料，不要把所有参考资料当成默认硬性模板：

- **不确定该读哪篇、或要把技能交给第三方团队时，先读 [docs/INDEX.md](docs/INDEX.md)**：场景 → 文档 → 平台契约快照的路由表。我们**不提供对外开放的文档系统**，所以必需的契约以只读快照形式内联在 `docs/contracts/`，链路在技能目录内自洽闭环。
- **扩展要读写自有业务后端（自有登录 / 权限 / 多身份切换）时，先读 [docs/BACKEND-INTEGRATION.md](docs/BACKEND-INTEGRATION.md)**：先判形态（平台能力 / 用户身份透传 / 服务商代运营），再走 `ctx.auth.getAccessToken()` → 自有后端 `POST …/sso/exchange` → `GET /identity/me` 验真的链路；含多身份切换、CORS、安全红线与最小验收清单。**不要自己验平台 token 的签名，平台也没有 JWKS / introspect。**
- **接到"把某业务系统／模块做成扩展"的需求时，先读 [docs/PRE-DEV-INTERROGATION.md](docs/PRE-DEV-INTERROGATION.md) 并跑完立项前拷问审查**：先读业务文档 → **后端代码**（实体/字段注释/枚举/**索引**/DTO）→ 现有前端 → 平台契约，再用五个拷问（该不该存在 / 有没有意义 / 缺什么 / 是不是真的 / 代价多大）产出**质疑 · 缺口 · 增量**三张清单，按 A/B/C 成本分级。**每一条意见必须带证据（文件／行号／字段名），禁止打钩式评审。** 未通过审查不得进入界面设计。
- **要把扩展接给数字成员（人 ↔ agent ↔ 业务：连接器 / 领域资源 / 消息卡片 / 领域技能（连接器 = MCP 协议的远端服务））时，先读 [docs/AGENT-INTEGRATION.md](docs/AGENT-INTEGRATION.md)**：五张声明面、平台自动组装（提示词/工具/审批/凭证全部自动，不要手写提示词）、端到端验收剧本与实测坑清单。
- 实现 UI 前，读取通用质量基线 [ui-design-quality.md](references/ui-design-quality.md)。
- 实现 UI 前，先读 [docs/UI-CONTRACT.md](docs/UI-CONTRACT.md)：控件尺寸体系（默认 32px 档）、主题变量使用和布局断点是强制契约；§5 视觉质量与微交互基线（含「色彩层级：不得整屏灰」门禁）、§6 样式与组件技术路线（shadcn + Tailwind + SDK 组件边界、cva 变体、结构红线、**§6.4 色调范式 —— 合规之后怎么把颜色真正用起来**）、**§7 容器语义与首屏价值（主面板＝模块 App 首页、判定式三问、槽位制、列表判据、移动端三档）**、**§9 字号下限（12px 硬约束，8/9/10/11px 一律禁止）**、**§10 样式体量预算（建议项，不阻断；给出允许写 CSS 的四类归因）**、**§12 列表：Table 在窄容器必须退化成 card list（`<Table cardMode>` + `TableCell label`）**（先读 §8 的「硬约束 vs 建议」判定原则） 全部是强制契约。
- 当扩展明显属于企业管理、运营后台、专业工作台或数据密集型 B2B 场景时，再读取 [references/b2b-ui-ux.md](references/b2b-ui-ux.md)。
- **用户显式点名使用 B2B 规范/后台风格时视为强匹配**：读取后结构范式与视觉表达（KPI 统计卡、状态 tag、图表套路、主色贯穿）都要落实，实现后对照其自检清单检查，不要降级成"只保证结构可用"。
- **写/改 manifest.json 的 icon 字段时，读 [references/extension-icon-spec.md](references/extension-icon-spec.md)**：viewBox 24、图形占画布 ≥75%、currentColor、无背景块。平台构建时会自动规范化（统一编码/去背景块/收紧 viewBox），但按规范产出可以零警告通过。
- 用户未点名但场景匹配时，采用结构范式并至少做到视觉色彩层级（状态有色、数字有排版），同时说明采用了 B2B 风格；匹配度不确定时向用户询问风格定位（专业管理工作台 / 数据驾驶舱 / 轻量品牌页）。
- 当需求只是小游戏、创作、媒体、画布或其他非办公场景时，不要加载 B2B 参考，除非用户明确希望采用该方向。
- B2B 参考的结构范式是骨架，视觉表达（references/b2b-ui-ux.md 第 1 节）决定"长什么样"——两者缺一，产出就会退化成黑白灰的素页面。
- 不要为了执行参考资源而额外安装浏览器、截图工具或其他工具；验证工具只在已有时推荐使用。

## Standard Workflow

### 0. Interrogate before designing（立项前拷问审查，不可跳过）

只要任务的输入是"一个已有的业务系统／业务模块"，在写第一行前端代码之前跑一次
[docs/PRE-DEV-INTERROGATION.md](docs/PRE-DEV-INTERROGATION.md)：

1. **先读，读完再提问**：业务文档（想要什么）→ **后端代码**（事实是什么：实体／字段注释／枚举／索引／DTO／校验）→ 现有前端（已做到哪）→ 平台契约（底线）。
2. **五个拷问，逐条带证据**：该不该存在（谓词）／有没有意义（下一个动作）／缺什么（字段·模型·接口·写路径）／是不是真的（**写入路径**）／代价多大（只增不改能否解决）。
3. **产出三张清单**：质疑清单（交需求方确认）· 缺口清单 · 增量清单（后两张按成本分级）。
4. **成本分级定"不过分"**：A 档（数据已存在且接口已返回，只是没消费）进本次；B 档（需新增只读聚合接口）记账排期；C 档（需改数据模型／有口径争议）**不进本次**，先出定义文档。
5. **角色边界**：我们管"能不能／值不值／代价多大"，**产品意义由业务方判**。出证据、出选项、给建议，不替对方拍板。

⚠️ 纪律：**无证据的意见不进报告**；**没有写入路径的字段不许进 UI**（先验证谁写、何时写、历史数据怎么办）。
未通过审查（缺口未识别／写路径未验／C 档混进本次）**不得进入界面设计**。

### 1. Prepare the workspace

Use the existing workspace when possible. A workspace can contain multiple independent extensions:

```text
extension-workspace/
├── appthen-extension-workspace.json
├── extensions/<extension-id>/manifest.json
├── extensions/<extension-id>/src/index.tsx
└── themes/*.json
```

Create a fresh workspace without cloning any repository:

```bash
pnpm dlx @appthen/vibe-workspace init extension-workspace --template full   # 5 runnable examples
pnpm dlx @appthen/vibe-workspace init extension-workspace --template basic  # empty skeleton
```

Workspace scripts cover the daily loop only (`doctor` / `dev` / `validate` / `test` / `build` / `pack` / `publish`). The CLI also has `serve` (serve build output over HTTP for the online Workbench's local-debug override), `publish --official [--assemble]` (platform-level), `install <package-file>` (offline package install), and `assembly list|add|set|remove` (official assembly list). See [PLUGIN_DEV.md §3](docs/PLUGIN_DEV.md) for the full command surface — do not assume the scripts are the whole CLI. `serve` is **not** `dev`: `dev` starts an offline Workbench, `serve` only emits artifacts for pointing the online Workbench at your machine.

Run the standard checks from the extension workspace:

```bash
pnpm install
pnpm doctor
pnpm dev
```

The dev Workbench is offline. It loads every `extensions/*/manifest.json`, watches manifest changes, and uses Vite HMR for source changes. If the SDK itself is being changed, build the SDK first and use its local package root:

```bash
pnpm run build:lib
pnpm dev -- --package-root /path/to/vibe-workspace
```

The SDK build produces both the runtime modules and `dist/vibe-workspace.css`.
Keep them from different builds out of the same local or published package;
otherwise responsive overlay classes can be present in JavaScript but missing
from CSS. Extensions must use `WorkbenchDrawerContent` for drawer positioning
and must not add custom `fixed`, `bottom-*`, `right-*`, `translate-*`, or
similar positioning classes to it.

Use the actual port printed by Vite when the default port is occupied.

### 2. Check the manifest

The stable manifest baseline is:

```json
{
  "id": "acme.example",
  "name": "Example Extension",
  "version": "0.1.0",
  "manifestVersion": 1,
  "apiVersion": "1",
  "main": "./src/index.tsx",
  "sourceType": "umd",
  "runtime": {
    "sidebarViewId": "sidebar.acme.example"
  }
}
```

Rules:

- Use a globally stable reverse-domain ID.
- Export `activate(ctx)` from the entry module.
- Return cleanup functions from registrations and subscriptions.
- Use small SVG data URLs or HTTPS image URLs for icons; do not assume relative package assets are available at runtime.
- Keep `runtime.autoActivate` off unless the extension must register a startup capability.
- The activity-bar entry comes only from `runtime.sidebarViewId`; an installed extension without it stays invisible by design. Capability-only extensions (canvas nodes, editor providers, no home surface) must set `runtime.autoActivate: true` so they activate without an entry.
- Treat `manifestVersion: 1`, `apiVersion: "1"`, and `sourceType: "umd"` as the current stable contract.

### 2.5 Agent 能力声明（把业务接给数字成员）

manifest 的 `capabilities` 块描述"这个扩展能给数字成员（agent）什么"，五个面：

- `mcpServers[]`：连你自己的业务 MCP server（agent 读写业务数据；写工具可声明强制审批）；
- `resources[]`：业务对象资源（@ 引用 / 会话内可点链接 / 可读）；
- `cardTemplates[]`：消息卡片（react 组件卡优先；组件必须扩展入口顶层导出）；
- `skills[]`：领域技能（打包时从 `artifactPath` 注入 SKILL.md 内容）；
- `permissions[]`：安装确认展示的能力说明。

装扩展后平台自动完成：声明聚合 → systemPrompt 追加「Extension Resources / Extension Cards / Extension Skills」段 → mcpServers 直连注入 + 审批卡 → `${{secrets.*}}` 调用前解引用。**不要手写给 agent 的提示词。**

完整字段、可抄样例与端到端验收剧本（"提示词自查 → MCP 取数 → 回卡 → 回资源点开"，含实测坑清单）见 [docs/AGENT-INTEGRATION.md](docs/AGENT-INTEGRATION.md)。

### 3. Register capabilities

Use public APIs only:

- `ctx.capabilities.registerSidebarView`
- `ctx.capabilities.registerEditorView`
- `ctx.capabilities.registerContribution`
- `ctx.capabilities.registerFrontendToolHandler`
- `ctx.capabilities.setSidebarBadge`
- `ctx.capabilities.setEditorTabBadge`
- `ctx.views.openEditor` / `ctx.views.closeEditor`
- `ctx.links.create` / `ctx.links.open`
- `ctx.runtime` and `ctx.auth`

Do not use these host internals from an external extension:

- `extensionRegistry`
- `eventBus`
- `workspaceEditorService`
- manual view ID prefix inference
- the legacy `open` query parameter
- `registerMainView` or `mainView.open`

Complete business surfaces belong in the extension's module home surface. In the current Workbench contract this is commonly registered as a Sidebar view; treat it as the module's mobile-app-like home page, not as a narrow navigation rail.

### 4. Make views routeable

Every Editor view needs a stable `routeKey`. Props used for restoration must be primitive or otherwise explicitly serializable. Use a stable `key` for one logical resource so repeated clicks do not create duplicate tabs:

```tsx
ctx.capabilities.registerEditorView({
  id: 'editor.acme.example.members',
  routeKey: 'members',
  title: 'Members',
  component: MembersView,
});

ctx.views.openEditor({
  viewId: 'editor.acme.example.members',
  title: 'Members',
  key: `members:${teamId}`,
  props: { teamId, filter: 'active' },
});
```

Use `ctx.links` to create and open shareable links. Do not hand-build tenant, workbench, extension, or query segments. Verify that a copied URL restores the extension, view, resource, and selected project/space after a hard refresh.

### 5. Apply UI and mobile rules

- Use shared dialogs and drawers from `@appthen/vibe-workspace/overlay` when they fit; custom presentation is allowed when the business interaction genuinely needs it.
- Give field groups and action groups explicit `gap-2`, `gap-3`, or `gap-4`; adjacent elements do not get reliable spacing automatically.
- Use `min-width: 0` and `max-width: 100%` on inputs and flexible columns.
- Treat mobile as a first-class use case for office extensions. Adapt information density and interaction structure instead of merely shrinking desktop CSS.
- When a shared drawer/sheet primitive provides responsive side or bottom behavior, use that capability rather than reimplementing viewport positioning in every extension.
- Preserve mounted view state when moving between the module home, lists, filters, and detail surfaces; avoid high-frequency scroll listeners solely to restore context.
- Validate desktop, narrow tablet, and phone widths. Check loading, empty, error, overflow, long-label, and dense-data states.
- Choose the visual form by business meaning and audience. A card list may improve scanability and touch interaction on smaller screens; a table may provide the most professional information density and comparison efficiency on desktop. A hybrid is often useful, but it is a recommendation, not a mandatory template.

Themes belong to Workbench configuration. For offline development, define them in `themes/*.json` and select the default in `appthen-extension-workspace.json`; do not change the theme as an activation side effect.

### 5.5 UI/UX Quality Baseline（质量基线，不是视觉模板）

即使禁止参考已有扩展，扩展 UI 也必须认真考虑产品级视觉与交互。**写 UI 前**先读 [ui-design-quality.md](references/ui-design-quality.md)，**提交前**用下方清单自检。清单用于避免低质量默认产物，不要求所有扩展复刻同一套风格；业务、用户和 Agent 的设计判断优先。

**实现默认路径**——把这个项目当普通 `shadcn + Tailwind` 项目来写，优先使用共享组件和 Tailwind utility classes；同时必须遵守下方的主题联动规则。

**唯一范式**：`examples/extension-workspace/extensions/reference-crud`（**0 行 CSS、0 内联 style**，覆盖主面板 + 列表 + 详情抽屉 + 五态）。
同目录下 `graph-modeling-studio`、`workbench-kit` 是**历史遗留**，违反现行契约（大量 `var(--vscode-*)` 与内联样式、11px 字号），**不得作为范式照抄**。

- ✅ 优先使用 Tailwind utility classes 配合 shadcn 语义类:`bg-background` / `text-foreground` / `bg-primary` / `text-primary-foreground` / `bg-card` / `border-border` / `bg-muted` / `text-muted-foreground` / `bg-accent` / `text-destructive`
- ✅ 优先直接 import 共享元件:`Button / Input / Select / Badge / Card / Dialog / Drawer / Sheet / Toast / Tooltip / Table / Tabs / EmptyState`
- ✅ 业务专属 CSS 可以使用，**但受 UI-CONTRACT §9 的 150 行预算约束**，且只限于四类：关系型布局（`conic-gradient` / 伪元素 / `nth-child` 重排）、宿主能力缺口补丁（收敛成一处）、reset / keyframes / 滚动条、portal 逃逸。判据不是"有没有更难表达的视觉"，而是"**每行 CSS 能否说清归属**"——说不清就说明它本该是组件或原子类。不要为了形式主义把 CSS 强行改成工具类，也不要以"业务专属"为名把设计数值（字号/间距/圆角/宽高）搬进 CSS。
- ✅ 字号只用 12 / 14 / 16 / 20 四档（`text-xs / text-sm / text-base / text-xl`）。**12px 是硬下限**，见 UI-CONTRACT §8
- ✅ 提交前必跑门禁：`node scripts/audit-ui.mjs <扩展目录>`，退出码非 0 不通过（字号 <12px、CSS 超预算、自定义色源、旧 token、手搓宿主组件都会被检出）
- ❌ **不要** `#0f766e` / `rgba(...)` / `var(--vscode-*)` 等任何颜色值
- ❌ **不要** 手写 styled `<button>` / `<input>` / `<select>` / `<table>` / `role="tablist"`，除非业务交互确实无法由共享元件表达

### 5.1 Tailwind 与主题系统联动（必须遵守）

Tailwind 只是样式写法，不会自动让扩展适配 Workbench 主题。所有会随主题变化的界面颜色，必须引用 `vibe-workspace` 提供的 shadcn 语义 CSS 变量或对应 Tailwind 语义类；不要在扩展里重新建立一套颜色主题。

- ✅ 页面底色使用 `bg-background`，正文使用 `text-foreground`，卡片使用 `bg-card text-card-foreground`，边框使用 `border-border`
- ✅ 次要信息使用 `text-muted-foreground`，弱背景使用 `bg-muted`，悬停或选中使用 `bg-accent`，主要动作使用 `bg-primary text-primary-foreground`
- ✅ 业务状态色走**色调范式**（UI-CONTRACT §6.4）：`--sp-tone: var(--portal-xxx)` 局部变量 + `color-mix` 派生边框/底/字色，`var()` 别名不算违规；不要直接把状态塞进共享 `Badge` 的通用 `variant`（`outline` 没底色、`secondary` 只有灰底 → 状态列会变成一排灰字）
- ✅ 业务专属 CSS 使用 `var(--background)`、`var(--foreground)`、`var(--primary)` 等语义变量；复杂组件可通过 `hsl(var(--...))` 或现有主题变量接入
- ✅ 主题相关 class 必须是完整静态 class，例如 `bg-primary`、`text-muted-foreground`；不要用字符串拼接生成 Tailwind class，避免编译器无法扫描
- ⚠️ 数据可视化、品牌色、游戏棋子或创作画布等确实不属于全局 UI 语义的颜色，可以使用业务色，但要集中定义、说明用途，并确保页面基础层和交互控件仍跟随主题
- ❌ 不要使用 `dark:bg-*` 代替主题系统；Workbench 主题不一定只有亮色和暗色，主题切换也不一定通过 `.dark` 完成
- ❌ 不要使用 `--vscode-*` 等宿主遗留变量；不要**定义/覆盖**任何主题 token（`--ck-*`、`--portal-*`、shadcn 变量一律只消费不定义，详见 UI-CONTRACT §2 硬规则）；`--portal-*` 调色板按 UI-CONTRACT §6.2 用任意值消费是合法路径
- ❌ 不要写 `bg-[${color}]`、`text-${status}-500` 或 `className={condition ? 'bg-blue-500' : 'bg-red-500'}` 这类不可控的动态颜色 class；使用静态映射对象或语义 variant

**主题验收**(推荐执行，不应阻塞开发):

1. 推荐在至少两个实际 Workbench 主题下检查同一页面，最好覆盖一个浅色和一个深色主题；若项目提供多个品牌主题，可再抽查一个非默认主题。
2. 推荐切换主题后检查页面底色、正文、次要文本、边框、卡片、输入框、按钮、悬停态、选中态、Dialog、Drawer、Toast、空状态和错误状态，确认没有旧主题颜色残留或低对比度文本。
3. 有现成浏览器调试或截图工具时，优先使用实际主题切换验证；不要为了完成本技能而额外安装工具。没有浏览器工具时，至少通过源码检查语义 token、静态 class 和主题变量使用情况。
4. 检查生成 CSS 是否包含扩展使用的 Tailwind class；动态 class 使用静态映射，不能因为扫描不到而在某主题下显示成无样式元素。该项可通过现有构建命令或源码检查完成。

**28 件 components/ui 元件**(必须熟悉):Button / Input / Textarea / Select / Checkbox / Switch / RadioGroup / Dialog / Drawer / Badge / DotBadge / Card / Alert / EmptyState / Progress / Skeleton / Separator / SimpleSelect / Accordion / Avatar / Breadcrumb / Command / ScrollArea / Sheet / Table / Tabs / Toast / Tooltip。

**状态徽章映射**(不许用 `rgba` 背景；**先读 UI-CONTRACT §6.4**)：

⚠️ 旧版本节让"待处理 → `<Badge variant="outline">`"，**这是错的**：`badgeVariants` 只有
default / secondary / destructive / outline 四个**通用**槽位，其中 `outline` 连底色都没有
（只有 `text-foreground`，无 `background`），`secondary` 只有一层灰底 —— 照抄的结果是
状态列变成**一排灰字**（"黑白电视"的直接来源）。

正确做法：**色调范式**。基座仍用共享 Badge（拿圆角/内距/字号），配色由扩展类按语义色调接管：

| 状态 | 色调 | 用法 |
|---|---|---|
| 就绪 / 已启用 / 成功 | success 绿 | `<Badge variant="outline" className="sp-pill sp-pill--success">` |
| 待处理 / 草稿 / 警告 | warning 琥珀 | `… sp-pill--warning` |
| 失败 / 危险 | danger 红 | `… sp-pill--danger` |
| 归档 / 已停用 / 无状态 | neutral 灰 | `… sp-pill--neutral` |
| 默认 / 主体量 | primary 蓝 | `… sp-pill--primary` |

`variant="default|destructive"` 是**实心块**，只适合极少数强提示位；表格 / 列表里的状态一律走
上面的浅底深字丸（`background: color-mix(tone 13%, var(--card))` + `color: color-mix(tone 75%, var(--foreground))`）。
带一枚 6px 圆点可让一列状态**可扫读**（形状先于文字被人眼捕获）。

**反 "AI 味" 铁律**(任一命中立刻改):
- ❌ 极光渐变光斑 + 玻璃拟态 (`backdrop-blur`) — AI 生成界面最典型套路
- ❌ 全堆 `rounded-2xl` "圆圆润润" — 收紧到 `rounded-md`(6px) / `rounded-lg`(8px)
- ❌ 靠彩色渐变 blob 撑场面 — 质感应来自排版层级、留白、1px hairline
- ❌ 移动端 `hidden` 直接砍掉整块 — 同一套结构小屏舒适堆叠,或收进卡片头部

**产品质量检查清单**(提交前逐条):
- [ ] **视觉**: 默认优先采用 `shadcn + Tailwind` 和语义化 utility classes，颜色、排版、间距、圆角、图标和层级形成一致且符合业务的视觉语言；确有业务理由时允许使用定制 CSS；避免默认模板感和纯装饰堆砌
- [ ] **色彩层级（不得整屏灰）**: 合规清理只保证"没有错的颜色"，不保证"有用的颜色"。逐项确认：状态有语义色（绿/琥珀/红）、关键数字有色调锚点、行内危险操作与普通操作可区分；把界面看成一整块灰色时若只剩灰阶，说明色彩体系缺失 → 按 UI-CONTRACT §6.4 补色调范式。同时反向自查：无状态度量（如"分类目录"计数）**不要**上色，颜色一律承载语义
- [ ] **UX**: 首屏价值明确、即时反馈、表单失焦校验、空/错/边界态都有 (EmptyState + CTA、可重试、A11y 键盘 + focus ring)、危险操作 Dialog 二次确认、上下文保留(路由可分享)；小游戏、创作、媒体等非办公扩展按自身玩法或创作流程验收，不套用后台数据页面模板
- [ ] **多端**: 需要多端使用的扩展明确考虑不同设备的任务差异、信息密度、触控、列表呈现和容器切换；办公类尤其需要检查桌面与移动端，不以“桌面布局缩小后不溢出”作为唯一验收标准
- [ ] **量化自检**:
  ```bash
  grep -cE "#[0-9a-fA-F]{3,6}|rgba\(" <file>     # 硬编码色值: 应为 0
  grep -c "vscode-" <file>                       # vscode-* 引用: 应为 0
  ```

### 5.6 信息架构与容器选择（产品原则，不是模板）

**先读 UI-CONTRACT §7（强制契约）**：扩展 = 模块，主面板 = 模块的 App 首页，工作区 = 常规业务页面；首屏价值判定式三问必须全过。下面的表帮助判断容器，不替代 §7。

| 容器 | 更适合承载 | 需要警惕 |
| --- | --- | --- |
| 模块主面板（当前通常注册为 Sidebar view） | 模块当前状态（真实数据/进度）、需优先关注的内容、直达动作 | 退化成"点击这里打开某某"的入口页；把 B 端 KPI 模板套到所有场景 |
| Editor 主面板 | 可持续浏览的列表、搜索、筛选、排序、分页、批量操作、数据对比和统计 | 不要把所有内容都强行拆成 Editor；主面板本身就是模块的第一工作台 |
| Dialog | 确认、警告、删除、短流程、少量字段编辑，用户需要立刻完成或取消 | 长详情、长表单、多步骤流程不适合 Dialog |
| Drawer | 单条记录详情、上下文辅助编辑、筛选条件，以及不打断当前任务的中等复杂操作 | 不要让 Drawer 变成完整业务主页或跨步骤主流程 |

产品判断:

- 模块主面板应像一个移动 App 的首页或 Tab 页面：用户打开后直接得到核心状态、关键数据、入口和下一步行动。它可以包含部分列表，不是只能放导航。
- 主面板的信息取舍由业务价值决定：数据概览、菜单入口、数据摘要、待办和部分结果集可以组合；不要为了“结构纯粹”牺牲首屏价值。
- Sidebar、Editor、Drawer 是当前工作台的承载方式，不要把这些名称误解成固定的视觉模板。Agent 应先判断用户是在浏览模块首页、持续处理数据，还是临时查看上下文。
- 单条记录详情通常适合 Drawer，并尽量保留原列表的筛选、排序、滚动和选中上下文；但如果详情本身是独立的长期工作流，可以升级为 Editor。
- 新建/编辑表单字段少、步骤单一时可用 Dialog；字段较多但仍依赖当前列表上下文时可用 Drawer；多步骤或长期编辑时可用独立 Editor。这里是推荐分流，不是机械规则。
- 宽屏可以选择高信息密度的表格，方便专业用户比较和批量处理；窄屏可以选择卡片列表、分组列表或其他更适合触控和扫描的结构。卡片和表格并存是常见解，但不是强制要求。
- 筛选、批量操作、状态摘要和快捷入口应服务于主任务。筛选在宽屏可常驻，在窄屏可收进 Drawer；批量操作通常留在主面板，不要让用户逐条打开详情完成批量工作。
- 共享组件是推荐的默认路径，不是禁止定制。优先使用 `vibe-workspace` 提供的基础能力；当业务需要独特交互或视觉表达时允许扩展封装和定制，但不要无理由复制已有基础能力。
- 焦点管理、Esc/遮罩关闭、响应式 Drawer/Sheet、Portal、基础可访问性和状态保留等通用能力，优先由 `vibe-workspace` 提供。扩展只补业务状态和内容；若 SDK 尚未具备，应记录为平台能力缺口，而不是每个扩展各自发明一套行为。

反例验收:

- 主面板只有一个按钮或一段“请点击进入”的说明，没有模块核心数据或有效入口，判定首屏价值不足。
- 为了复刻某个样例而强制所有业务使用卡片、表格、右侧 Drawer 或固定布局，判定规范被误用。
- 点击详情后列表状态丢失，或详情操作导致用户离开当前任务且无法返回原位置，判定上下文设计不足。
- 两个扩展都重复实现同一基础能力时，先检查 SDK 是否已有可复用能力；若已有，应优先复用；若没有，再决定是否补 SDK 或做业务定制。

**chrome headless 截图建议**(有现成浏览器工具时，多主题/多尺寸):
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --hide-scrollbars --window-size=1440,900 \
  --virtual-time-budget=6000 \
  --screenshot=/tmp/page-desktop.png \
  "http://localhost:5180/<route>?theme=appthen-light"
# 再换 ?theme=marmos-dark / ?theme=vercel,以及窄窗口 375x812
```

**举一反三**(推荐): 发现一个主题或尺寸下存在问题时，有现成验证条件就抽查其他主题、类似页面和相关状态，扩大检查范围并修正共性问题；没有现成浏览器或截图工具时，不要求额外安装。

### 6. Validate the full lifecycle

当 `manifest.json` 和扩展源码已经完成时，先进入快速验证，再进入完整生命周期验证。优先使用工作区已有的 `pnpm`、系统 shell 和现有脚本，不要为了量化自检额外安装工具。

**快速验证顺序**:

1. 先运行 `pnpm doctor`，确认工作区依赖、扩展发现、manifest 基础结构和本地环境没有明显问题。
2. 再对本次扩展的 `manifest.json` 与全部 `.ts/.tsx` 源码执行量化自检，重点检查硬编码颜色、`vscode-*`/旧主题变量、不可扫描的动态 Tailwind class，以及明显的源码残留。
3. 量化自检通过后，再运行完整命令：

```bash
pnpm doctor

# 将 <extension-dir> 替换为本次扩展目录；也可直接检查整个 extensions 目录
find extensions/<extension-dir> -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name 'manifest.json' \) -print0 \\
  | xargs -0 grep -nE '#[0-9a-fA-F]{3,8}|rgba\\(|var\\(--vscode-|var\\(--border-light|dark:bg-|dark:text-'
# 主题 token 定义硬门禁（应为 0，见 UI-CONTRACT §2）：
grep -rnE '^\s*--[a-z][a-z0-9-]*\s*:' extensions/<extension-dir>/src

pnpm validate
pnpm test
pnpm build
pnpm pack
```

量化自检命令的结果需要结合场景判断：基础 UI 的硬编码颜色和旧主题变量通常应为 0；品牌色、图表色、游戏或创作画布中的业务色可以保留，但应确认它们没有承担 Workbench 基础 UI 的主题职责。发现动态 Tailwind class 时，改为完整静态 class 或静态映射。

**环境坑（实测）**：

- 工作区脚本叫 `pack` 时，`pnpm pack` 会被 pnpm 内建 pack 劫持（对根 package.json 报
  `ERR_PNPM_PACKAGE_VERSION_NOT_FOUND`），必须用 `pnpm run pack`。
- `vibe-workspace/dist/extension-cli` 会被 vibe-workspace 的前端 `pnpm build`（vite build）
  覆盖掉；丢失时回到 vibe-workspace 跑 `pnpm run build:lib` 重建，再执行扩展工作区命令。
- `package.json` 里的 `test`/`validate` 等脚本同样建议经 `pnpm run <name>` 调用，避免内建命令抢占。
- **类型检查兜底配方**（CLI 不可用时的独立 tsc 校验，实测可行）：扩展通常没有自己的
  tsconfig.json，直调 tsc 会踩 `@types/react@19 + moduleResolution bundler` 的解析怪癖
  （TS7016/TS7026 级联上百条假错误）。解法：在扩展目录放临时 `tsconfig.check.json`——
  `moduleResolution: "Bundler"` + `jsx: "react-jsx"` + `strict` + `allowJs: true` + `checkJs: false`
  （后者让迁移来的 `.jsx` 不刷错误），`types: []`，并显式映射：
  `paths` 里 `react` / `react/jsx-runtime` / `react/jsx-dev-runtime` / `react-dom` / `react-dom/client`
  都要分别指到 `.pnpm/@types+react@19.2.18/node_modules/@types/react/**.d.ts`（**指到具体 .d.ts 文件**，
  不要只指目录），`baseUrl: "."`。
  ⚠️ **最容易踩的坑：路径基数是 tsconfig 所在目录，不是工作区根。** 扩展位于
  `<workbench>/extensions/<id>/`，所以到工作区 node_modules 要写 `../../node_modules/...`
  （只写 `../` 会静默落空 → `paths` 被忽略 → 又回到 TS7016 级联，极易误判成"配方失效"）。
  然后跑 `node <workbench>/node_modules/.bin/tsc -p tsconfig.check.json`。校验完删除临时配置。
  判据：**扩展自有 `.tsx` 无新增错误**即可；对未定型 `.jsx` 组件的属性推断报错
  （TS2322 `not assignable to 'never'`）与 `shared/` 里第三方库 API 报错属存量噪音，不算回归。

For a focused extension, pass its ID where supported. Treat these as separate evidence levels:

1. Manifest validation succeeds.
2. Local offline Workbench loads the extension and its views.
3. Source changes hot-update and manifest changes reload the entry.
4. Build output contains the declared runtime entry.
5. Package contains manifest, bundle, and integrity metadata.
6. The packaged extension can be installed and mounted in a real Workbench.
7. A real browser refresh restores the shared route and resource state.

Do not treat a successful TypeScript compile, static screenshot, or package creation alone as end-to-end success.

### 7. Publish, install, and mount separately

Keep these operations distinct — they are **five** gates, not one:

1. **Upload candidate** — `POST /marketplace/tenants/:tenantId/extensions/publish`. The server
   re-verifies every file (`sha256` + `size` + safe path) and the manifest **before** storing
   anything: a tampered package is rejected with `400` here, it never reaches a browser as an
   SRI mismatch.
2. **List it** — `POST /marketplace/tenants/:tenantId/extensions/:appId/listing`. The market entry
   is assembled **from the extension record**（入口地址 / 能力清单 / 凭证）, status `draft`.
3. **Submit + platform review** — `POST /marketplace/my/resources/:resourceId/submit`
   （扩展的 `resourceId` 就是 `appId`）→ `POST /marketplace/admin/review/:resourceId`.
   Only approval promotes the candidate to the **running** record (`version` / `umdConfig` /
   `manifest` / `integrity`). Uploading a new version does **not** change what users load.
   Review requires a **platform admin** (`APPTHEN_PLATFORM_ADMIN_USER_IDS`) — a tenant
   developer cannot self-approve, so plan for who reviews before you submit.
   ⚠️ The whitelist matches `providerAccountKey` **verbatim** (never the phone number itself).
   The guard looks up **all** active `casdoor` / `phone` accounts of the subject under
   `(tenantId, subjectId)` and intersects them with the whitelist. The same subject normally has
   two keys — `casdoor` stores `phone:<number>`, the phone channel stores the **bare number** —
   so **one `phone:<number>` entry is enough**; the bare number is only needed when a subject never
   used casdoor. Write both (`phone:18136000717,18136000717`) to cover both shapes; `*` allows all.
   Config changes require a restart and the decision is cached for 60s. Self-check with
   `GET /marketplace/platform/admin-status` — it must return
   `{"admin":true,"reason":"configured"}`（`reason:"claim"` only means the token carries the
   claim, **not** that the deployment whitelist works).
4. **Install** — `POST /marketplace/resources/:resourceId/install` adds a version to the tenant
   extension pool. Offline packages can skip the marketplace entirely:
   `appthen-extension install <package-file> --server <url> --tenant <tenantId>`.
5. **Mount** — enable it in a specific Workbench and configure availability and permissions.

Hard rules:

- Nothing is auto-installed or auto-mounted by publishing.
- Artifact URLs contain an **immutable version segment** (`.../<tag>/<version>/entry.js`) and are
  served with a one-year cache. **Changed bytes ⇒ bump `manifest.version`**; re-publishing the
  same version only refreshes new visitors while old caches keep serving stale bytes.
- Online publishing requires a server, tenant context, and short-lived token. Never print tokens
  in source, logs, commits, or final responses.

CLI mapping (tenant path is wrapped as `pnpm run publish`; the rest are not):

```bash
APPTHEN_TOKEN="..." pnpm run publish -- --server <url> --tenant <tenantId> [--install-tenant] [--tag dev]
APPTHEN_TOKEN="..." pnpm exec appthen-extension publish --server <url> --official [--assemble]   # platform-level, admin only
APPTHEN_TOKEN="..." pnpm exec appthen-extension install <package-file> --server <url> --tenant <tenantId>
pnpm exec appthen-extension assembly list|add <appId>|set <appId> --enabled <true|false>|remove <appId> --server <url>
```

⚠️ Use `pnpm run publish`, not `pnpm publish` — the latter is pnpm's own package-publishing command.

- `--official` publishes platform-wide (visible to all tenants); `--assemble` also adds it to the
  official assembly list so new tenants get it automatically. Assembled ≠ owned: once a tenant
  **materializes** (takes over) its install record, it stops following platform updates.
- Prefer `assembly set --enabled false` over `assembly remove` in production — reversible.

## Debugging Order

When an extension appears but does not work, inspect in this order:

1. Manifest discovery: was the extension found and is its ID stable?
2. Runtime load: is `activate(ctx)` called exactly once for the current Workbench scope?
3. Registration: are Sidebar/Editor contributions registered under the expected IDs?
4. Route restore: does the URL contain stable `routeKey`, `key`, and serializable props?
5. Context: are `ctx.runtime.tenantId`, workbench identity, actor, and access token available?
6. Data request: did the view mount, or did it return early because project/space context was missing?
7. UI contract: are gaps, overflow, mobile transitions, empty states, and errors handled?
8. Deployment: was the artifact published, installed, and mounted separately?

Use host logs such as activation, registration, route restoration, and runtime-context logs to distinguish “component did not mount” from “component mounted but skipped its request”.

## Completion Checklist

Before declaring an extension complete, confirm:

- **技能分发完整性已自检**（2026-11-05 事故教训：某落地器对含子目录的技能只落地了 SKILL.md，消费方 11 条引用全断且无报错）：`node scripts/verify-skill.mjs --root <技能目录>` 必须通过——技能内相对链接全部可解析、无跨技能相对引用（`../<其他技能>/…` 硬禁，共享内容拷贝进本技能）、`--manifest` 时文件清单与源一致。**分发技能给任何 agent/环境前必跑；安装后发现引用断链，优先怀疑落地丢树而不是文档写错。**
- **前置审查已通过**（PRE-DEV-INTERROGATION §7）：质疑／缺口／增量三张清单齐备且**每条带证据**；C 档项已排除并登记；字段写入路径已验证；需求方对 A 档范围明确点头。
- `pnpm doctor`, `pnpm validate`, `pnpm test`, `pnpm build`, and `pnpm pack` pass.
- The extension runs in the offline Workbench with HMR.
- Public APIs are used and all registrations have cleanup functions.
- Reopening the same resource does not create duplicate tabs.
- Copied URLs restore the extension and resource after refresh.
- Desktop, narrow tablet, and phone layouts were checked.
- **同排控件高度一致**（UI-CONTRACT §1 规则 6）：数一遍每个工具条/筛排 flex 行内每个交互控件的实际高度（Input/Select/Button），全部相等（默认 32px）才算过；`sm`（28px）只允许整排统一降档，禁止混排。
- **页签不贴线**（UI-CONTRACT §3）：胶囊 `TabsList` 与相邻分隔线、分隔线与下一节内容三个间距同一节奏（配方 12px），`pb-0` 贴边写法不合格。
- Dialogs, drawers, forms, icons, themes, loading, empty, and error states follow the host contract.
- **容器语义检查**（UI-CONTRACT §7）：主面板是模块 App 首页而非入口菜单页；首屏三问（有真实状态 / 有直达动作 / 零假入口）全过；**主面板每一节过了 §7.7 四问**（谓词 / 动作必过，增量 / 命中加分——固定前 N 条的"已启用项目"式镜像列表必删）；列表或为应用主体、或 ≤1/3 首屏且 ≤320px；降到移动端 30% 抽屉档位仍成立。
- **Theme/Tailwind implementation checked** (§5.1): 使用语义主题 token，未用 `dark:` 冒充主题适配，动态 class 可被编译；有现成工具时推荐补充浅色、深色及必要的品牌主题切换验证，不因缺少工具阻塞交付。
- **UI/UX quality baseline checked** (§5.5): 产品视觉、交互、多端适配和状态验收已完成；没有把样例扩展当成唯一模板。
- Publish, install, and Workbench mounting were verified as separate steps.
- **若扩展读写自有后端**：按 [BACKEND-INTEGRATION.md](docs/BACKEND-INTEGRATION.md) §9 跑完最小验收——未登录不发请求、换票成功、**切换身份后自动重换票**、登出清会话、伪造/过期 token 401 且不泄露拓扑、并发换票幂等；密钥（AK/SK、accessSecret）**不在扩展侧出现**。
- **若含 agent 能力面（`capabilities.*`）**：按 [AGENT-INTEGRATION.md](docs/AGENT-INTEGRATION.md) §4 跑通端到端剧本——提示词自查法确认 agent 看得到 templateId / uriTemplate，MCP 取到真实数据，回卡未编造，资源可点开；失败即停，不用注入假消息伪装通过。
