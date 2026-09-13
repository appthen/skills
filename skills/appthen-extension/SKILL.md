---
name: appthen-extension
description: 当用户想在 AppThen 工作台里"加一个功能、工具、面板、小插件"，或想把已有界面/能力打包成可安装、可发布的扩展时，使用本技能。典型用户说法："帮我在工作台里加个 XX 功能""做一个侧边栏工具""把这个功能做成能安装的扩展"。用户不需要懂代码或文件结构，交付即可安装、可发布的功能。
---

# AppThen Extension Development

Use this skill to take an AppThen Workbench extension from local development through a verifiable package and deployment flow. The canonical detailed specification is [PLUGIN_DEV.md](docs/PLUGIN_DEV.md); the runnable reference workspace is [examples/extension-workspace](examples/extension-workspace).

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

- 实现 UI 前，读取通用质量基线 [ui-design-quality.md](../appthen-application/references/ui-design-quality.md)。
- 实现 UI 前，先读 [docs/UI-CONTRACT.md](docs/UI-CONTRACT.md)：控件尺寸体系（默认 32px 档）、主题变量使用和布局断点是强制契约。
- 当扩展明显属于企业管理、运营后台、专业工作台或数据密集型 B2B 场景时，再读取 [references/b2b-ui-ux.md](references/b2b-ui-ux.md)。
- **用户显式点名使用 B2B 规范/后台风格时视为强匹配**：读取后结构范式与视觉表达（KPI 统计卡、状态 tag、图表套路、主色贯穿）都要落实，实现后对照其自检清单检查，不要降级成"只保证结构可用"。
- 用户未点名但场景匹配时，采用结构范式并至少做到视觉色彩层级（状态有色、数字有排版），同时说明采用了 B2B 风格；匹配度不确定时向用户询问风格定位（专业管理工作台 / 数据驾驶舱 / 轻量品牌页）。
- 当需求只是小游戏、创作、媒体、画布或其他非办公场景时，不要加载 B2B 参考，除非用户明确希望采用该方向。
- B2B 参考的结构范式是骨架，视觉表达（references/b2b-ui-ux.md 第 1 节）决定"长什么样"——两者缺一，产出就会退化成黑白灰的素页面。
- 不要为了执行参考资源而额外安装浏览器、截图工具或其他工具；验证工具只在已有时推荐使用。

## Standard Workflow

### 1. Prepare the workspace

Use the existing workspace when possible. A workspace can contain multiple independent extensions:

```text
extension-workspace/
├── appthen-extension-workspace.json
├── extensions/<extension-id>/manifest.json
├── extensions/<extension-id>/src/index.tsx
└── themes/*.json
```

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

即使禁止参考已有扩展，扩展 UI 也必须认真考虑产品级视觉与交互。**写 UI 前**先读 [ui-design-quality.md](../appthen-application/references/ui-design-quality.md)，**提交前**用下方清单自检。清单用于避免低质量默认产物，不要求所有扩展复刻同一套风格；业务、用户和 Agent 的设计判断优先。

**实现默认路径**——把这个项目当普通 `shadcn + Tailwind` 项目来写，优先使用共享组件和 Tailwind utility classes；同时必须遵守下方的主题联动规则。

- ✅ 优先使用 Tailwind utility classes 配合 shadcn 语义类:`bg-background` / `text-foreground` / `bg-primary` / `text-primary-foreground` / `bg-card` / `border-border` / `bg-muted` / `text-muted-foreground` / `bg-accent` / `text-destructive`
- ✅ 优先直接 import 共享元件:`Button / Input / Select / Badge / Card / Dialog / Drawer / Sheet / Toast / Tooltip / Table / Tabs / EmptyState`
- ✅ 业务专属 CSS 可以使用，适合复杂动画、伪元素、特殊排版、第三方画布或确实难以表达的定制视觉；不要为了形式主义把所有 CSS 强行改成 utility classes
- ❌ **不要** `#0f766e` / `rgba(...)` / `var(--vscode-*)` 等任何颜色值
- ❌ **不要** 手写 styled `<button>` / `<input>` / `<select>`，除非业务交互确实无法由共享元件表达

### 5.1 Tailwind 与主题系统联动（必须遵守）

Tailwind 只是样式写法，不会自动让扩展适配 Workbench 主题。所有会随主题变化的界面颜色，必须引用 `vibe-workspace` 提供的 shadcn 语义 CSS 变量或对应 Tailwind 语义类；不要在扩展里重新建立一套颜色主题。

- ✅ 页面底色使用 `bg-background`，正文使用 `text-foreground`，卡片使用 `bg-card text-card-foreground`，边框使用 `border-border`
- ✅ 次要信息使用 `text-muted-foreground`，弱背景使用 `bg-muted`，悬停或选中使用 `bg-accent`，主要动作使用 `bg-primary text-primary-foreground`
- ✅ 语义状态优先使用共享 `Badge` 的 `variant`；需要业务状态色时，将状态映射到语义 token，不要直接写颜色值
- ✅ 业务专属 CSS 使用 `var(--background)`、`var(--foreground)`、`var(--primary)` 等语义变量；复杂组件可通过 `hsl(var(--...))` 或现有主题变量接入
- ✅ 主题相关 class 必须是完整静态 class，例如 `bg-primary`、`text-muted-foreground`；不要用字符串拼接生成 Tailwind class，避免编译器无法扫描
- ⚠️ 数据可视化、品牌色、游戏棋子或创作画布等确实不属于全局 UI 语义的颜色，可以使用业务色，但要集中定义、说明用途，并确保页面基础层和交互控件仍跟随主题
- ❌ 不要使用 `dark:bg-*` 代替主题系统；Workbench 主题不一定只有亮色和暗色，主题切换也不一定通过 `.dark` 完成
- ❌ 不要直接使用 `--vscode-*`、`--portal-*` 或扩展自行创建的全局颜色变量作为普通 UI 颜色来源
- ❌ 不要写 `bg-[${color}]`、`text-${status}-500` 或 `className={condition ? 'bg-blue-500' : 'bg-red-500'}` 这类不可控的动态颜色 class；使用静态映射对象或语义 variant

**主题验收**(推荐执行，不应阻塞开发):

1. 推荐在至少两个实际 Workbench 主题下检查同一页面，最好覆盖一个浅色和一个深色主题；若项目提供多个品牌主题，可再抽查一个非默认主题。
2. 推荐切换主题后检查页面底色、正文、次要文本、边框、卡片、输入框、按钮、悬停态、选中态、Dialog、Drawer、Toast、空状态和错误状态，确认没有旧主题颜色残留或低对比度文本。
3. 有现成浏览器调试或截图工具时，优先使用实际主题切换验证；不要为了完成本技能而额外安装工具。没有浏览器工具时，至少通过源码检查语义 token、静态 class 和主题变量使用情况。
4. 检查生成 CSS 是否包含扩展使用的 Tailwind class；动态 class 使用静态映射，不能因为扫描不到而在某主题下显示成无样式元素。该项可通过现有构建命令或源码检查完成。

**28 件 components/ui 元件**(必须熟悉):Button / Input / Textarea / Select / Checkbox / Switch / RadioGroup / Dialog / Drawer / Badge / DotBadge / Card / Alert / EmptyState / Progress / Skeleton / Separator / SimpleSelect / Accordion / Avatar / Breadcrumb / Command / ScrollArea / Sheet / Table / Tabs / Toast / Tooltip。

**状态徽章映射**(不许用 `rgba` 背景):
- 待处理 → `<Badge variant="outline">`
- 处理中 → `<Badge variant="secondary">`
- 已完成 → `<Badge variant="default">`
- 失败 → `<Badge variant="destructive">`

**反 "AI 味" 铁律**(任一命中立刻改):
- ❌ 极光渐变光斑 + 玻璃拟态 (`backdrop-blur`) — AI 生成界面最典型套路
- ❌ 全堆 `rounded-2xl` "圆圆润润" — 收紧到 `rounded-md`(6px) / `rounded-lg`(8px)
- ❌ 靠彩色渐变 blob 撑场面 — 质感应来自排版层级、留白、1px hairline
- ❌ 移动端 `hidden` 直接砍掉整块 — 同一套结构小屏舒适堆叠,或收进卡片头部

**产品质量检查清单**(提交前逐条):
- [ ] **视觉**: 默认优先采用 `shadcn + Tailwind` 和语义化 utility classes，颜色、排版、间距、圆角、图标和层级形成一致且符合业务的视觉语言；确有业务理由时允许使用定制 CSS；避免默认模板感和纯装饰堆砌
- [ ] **UX**: 首屏价值明确、即时反馈、表单失焦校验、空/错/边界态都有 (EmptyState + CTA、可重试、A11y 键盘 + focus ring)、危险操作 Dialog 二次确认、上下文保留(路由可分享)；小游戏、创作、媒体等非办公扩展按自身玩法或创作流程验收，不套用后台数据页面模板
- [ ] **多端**: 需要多端使用的扩展明确考虑不同设备的任务差异、信息密度、触控、列表呈现和容器切换；办公类尤其需要检查桌面与移动端，不以“桌面布局缩小后不溢出”作为唯一验收标准
- [ ] **量化自检**:
  ```bash
  grep -cE "#[0-9a-fA-F]{3,6}|rgba\(" <file>     # 硬编码色值: 应为 0
  grep -c "vscode-" <file>                       # vscode-* 引用: 应为 0
  ```

### 5.6 信息架构与容器选择（产品原则，不是模板）

先理解模块的工作目标、用户频率、信息密度和设备场景，再决定容器。下面是帮助 Agent 做判断的产品原则，不要求所有扩展长成同一个样子。

| 容器 | 更适合承载 | 需要警惕 |
| --- | --- | --- |
| 模块主面板（当前通常注册为 Sidebar view） | 数据概览、菜单入口、数据摘要、待办、快捷动作，以及一部分最有价值的数据列表 | 不能退化成一个“点击这里打开某某某”的按钮页；打开后应立即给出模块最直接、最有价值的信息 |
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
find extensions/<extension-dir> -type f \( -name '*.ts' -o -name '*.tsx' -o -name 'manifest.json' \) -print0 \\
  | xargs -0 grep -nE '#[0-9a-fA-F]{3,8}|rgba\\(|var\\(--vscode-|var\\(--portal-|dark:bg-|dark:text-'

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

Keep these operations distinct:

1. **Publish** uploads the artifact and updates the tenant extension record.
2. **Install** adds a version to the tenant extension pool.
3. **Mount** enables the extension in a specific Workbench and configures availability and permissions.

Default publishing must not silently install or mount an extension. Online publishing requires a server, tenant context, and short-lived token. Never print tokens in source, logs, commits, or final responses.

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

- `pnpm doctor`, `pnpm validate`, `pnpm test`, `pnpm build`, and `pnpm pack` pass.
- The extension runs in the offline Workbench with HMR.
- Public APIs are used and all registrations have cleanup functions.
- Reopening the same resource does not create duplicate tabs.
- Copied URLs restore the extension and resource after refresh.
- Desktop, narrow tablet, and phone layouts were checked.
- Dialogs, drawers, forms, icons, themes, loading, empty, and error states follow the host contract.
- **Theme/Tailwind implementation checked** (§5.1): 使用语义主题 token，未用 `dark:` 冒充主题适配，动态 class 可被编译；有现成工具时推荐补充浅色、深色及必要的品牌主题切换验证，不因缺少工具阻塞交付。
- **UI/UX quality baseline checked** (§5.5): 产品视觉、交互、多端适配和状态验收已完成；没有把样例扩展当成唯一模板。
- Publish, install, and Workbench mounting were verified as separate steps.
