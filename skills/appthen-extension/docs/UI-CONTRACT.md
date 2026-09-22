# AppThen Workbench UI 契约

扩展 UI 的公共组件、模板和验证标准。与 [`PLUGIN_DEV.md`](PLUGIN_DEV.md) 的 v1 契约配套；Workbench Kit 提供可运行示例。

## 1. 控件尺寸体系（强制）

工作台是 VS Code 式密集 UI，控件高度分三层，平台默认档已对齐第二层：

| 层 | 高度 | 适用 |
| --- | --- | --- |
| 平台 Chrome | `h-7`（28px） | 页签栏、账户菜单、设置齿轮等宿主框架元素（扩展不要仿制） |
| **内容区控件（默认档）** | **`h-8`（32px）** | Button（default/sm=28/icon）、Input、Select 触发器，文本 13-14px |
| 显式大控件 | `lg` → `h-10`（40px） | 仅在表单主操作等确有需要时通过 `size="lg"` 显式传入 |

规则（vibe-workspace `src/components/ui/*` 已按此实现）：

1. **扩展一律吃平台默认档，禁止在扩展 CSS 里写全局控件高度覆盖**（例如 `.page .kit-button { height: N }`）。历史上这类覆盖是"有的大有的小"的根源。需要不同尺寸时用组件的 `size` prop 显式传。
2. 允许组件级 scoped 样式（BEM 私有前缀 class，如 `.crm-viewtoggle__btn`）；分段控件等特殊部件可以小于默认档但不低于 24px。
3. 不要改 `html` 的 font-size（rem 基准固定 16px）；不要在扩展里引入第二套 Tailwind 配置。
4. shadcn 上游的 `h-10`（40px）是网页/门户尺度，不要假设控件默认是 40px，也不要为对齐旧稿把默认档改回去。

## 2. 主题变量

- **扩展不得定义任何主题 token（硬规则，零例外）**。扩展 CSS/TSX 的 `:root` 或任何选择器中不得出现 `--ck-*`、`--portal-*`、shadcn（`--background`/`--primary`…）或任何 `--xxx-*` 颜色变量的**定义**。宿主运行时已提供全套（shadcn 语义层 + 19 个 `--portal-*` 调色板 + `--ck-*` 几何/语义全集）；`acme.service-project` 全程 0 个 token 定义即为实证。历史上 CRM 曾以"补全 SDK 组件所需 `--ck-*` 全集"为由写出 133 行桥接 CSS——那是重复病不是补洞，SDK 组件的 token 由宿主注入，扩展不存在"缺 token"问题。
- 消费方式：shadcn 语义类（`bg-background`/`text-foreground`/`bg-muted`/`text-muted-foreground`…，SDK 构建产物已含）优先；`--portal-*` 调色板（bg/card/ink/body/sub/fill/border(-hover)/primary(-hover,-light)/success/warning/danger 等）用 Tailwind 任意值消费（`bg-[var(--portal-success)]`）；浅色底/悬停底用 `color-mix(in srgb, var(--portal-danger) 16%, var(--portal-card))` 由语义色派生，不发明新变量名。
- 优先使用 shadcn 语义层（`--foreground` / `--card` / `--border` / `--muted-foreground`）和 `--portal-*` 层；它们随主题正确联动。
- ⚠️ **分层优先级陷阱**：扩展自有 CSS 是**未分层**（unlayered）的，而 Tailwind 工具类在 `@layer utilities`
  里 —— 未分层规则优先级**高于**任何 `@layer`。因此当同一个属性既有扩展类（如 `.sp-sec__empty { padding: … }`）
  又补了 Tailwind 原子类（`px-3 py-2`）时，**原子类会静默失效**。
  规则：扩展类已管辖的属性（padding / font-size / border-radius…）要改就用**修饰类**
  （`.sp-sec__empty--inset`），不要指望用 Tailwind 原子类覆盖；反过来，元素上没有任何扩展类时用 Tailwind 原子类是安全且推荐的。
  （把 TSX 里的 `style={{...}}` 收敛掉时最容易踩这个坑。）
- `index.css :root` 中的 `--border-light`、`--text-primary`、`--accent-*`、`--hover-*` 是旧仪表盘深色主题的遗留硬编码：`--border-light` 运行时已由 themeService 派生自当前主题 `panel.border`，其余仍是深色值，**浅色主题下不要直接依赖**。
- 业务代码不得读取 `ctx.runtime.tenantId` 做分支；租户信息一律来自自有后端会话（shared/auth-client）。
- 自检门禁（新增扩展必跑）：
  ```bash
  # 1) 硬违规：定义了「色源」（RHS 含 #hex / rgb() / hsl()），扣除 §6 业务状态色白名单后必须为 0
  grep -rnE '^\s*--[a-z][a-z0-9-]*\s*:\s*(#|rgba?\(|hsla?\()' extensions/<extension-dir>/src
  # 2) 遗留变量：必须为 0
  grep -rnE 'var\(--vscode-|var\(--border-light|var\(--text-primary' extensions/<extension-dir>/src
  ```
- ⚠️ **判定口径是「是否引入新色源」，不是「有没有 `--x:` 这一行」。** 以下三类**不算违规**，不要为了凑
  "零定义"去删（删了反而丢信息）：
  - **别名**：RHS 走 `var(...)`，不引入新色源。例：`--reference-border: var(--border)`
  - **第三方库 API 变量**：库要求宿主注入、且值非颜色。例：`--jse-font-size: 13px`（vanilla-jsoneditor）、`--jse-theme-color: var(--primary)`
  - **业务状态色白名单**（§6.3）：语义 token 无等价项的状态色。例：`--pt-required`、`--fp-warn-ink`、`--fp-desc`
  纯数值别名（`--x-space-1: 4px` 这类）虽不违规，但若无引用即为死代码，应删。
- 同样口径适用于 **TS 侧兜底常量**：`getComputedStyle` 读 token 时的 fallback 若写死 `#c0392b`，
  那是换了地方的硬编码色。fallback 一律用 `currentColor` / `transparent`，与同函数其他项保持一致
  （实测反例：`read('--destructive', '#c0392b')` → 改 `read('--destructive', 'currentColor')`）。

## 3. 布局与断点

- Workbench 移动断点 `<768px`；侧边浮层移动端从底部打开，`WorkbenchDrawerContent side="right"` 已默认适配，只有确有需要时才用 `mobileSide` 覆盖。
- 抽屉内容区 `min-h-0 flex-1 overflow-y-auto`，标题和操作区 `shrink-0`。
- 表单字段组和按钮组显式 `gap-2` / `gap-3`；输入控件必须 `min-width: 0; max-width: 100%`。

## 4. 表单

- 复用 `workbench/shared/form-runtime`（32px 档，与平台默认一致）渲染动态表单，不要各扩展复制渲染器。
- 表单字段标签 13px、错误提示 12px；字段组之间用 `crm-fr__grid` 的 `gap: 14px 18px`。

## 5. 视觉质量与微交互基线（吸收自 Anthropic Frontend Design 技能，已按平台语境裁剪）

交付前必须逐条通过的硬清单：

- **可交互必有反馈**：所有可点击元素（卡片、行、chip、入口块）必须有稳定 hover 态（背景/边框/色相变化 + `cursor: pointer`）；hover 不用 scale/位移等会改变布局的变换。
- **微交互时长**：140~300ms 的 CSS transition（背景/边框/透明度/阴影）；入场动画用 staggered reveal 且只播一次，禁止常驻动画。
- **对比度**：正文与关键数字对底色 ≥ 4.5:1；muted 文字只承载辅助信息，不承载状态；浅色/深色主题都要过一遍。同色调浅底上的同色调文字另见 §6.4 的混色规则（原色调直接当字色只有 ~2.9:1）。
- **色彩层级（不得整屏灰）**：合规清理只保证"没有错的颜色"，不保证"有用的颜色"。交付前自查：把界面所有颜色去掉后层级是否仍成立（结构 OK）；把界面看成**一整块灰色**时是否只剩灰阶（则色彩体系缺失）。状态 / 度量 / 关键数字必须有语义色锚点，做法见 §6.4 色调范式。
- **数字排版**：所有指标数字 `font-variant-numeric: tabular-nums`；单位缩小一档。
- **图标**：一律 SVG 图标库（lucide），禁止 emoji 当图标。图标不是可选装饰，是**识别加速器**——凡是"一列同构元素靠文字才能区分"的位置都必须配图标：KPI 卡的标签前、小节标题、列表行前缀、统计卡、面板头、表单分组标题、页面标题、动作按钮。
  - **尺寸随宿主字号走**，不单独放大：卡片标签 12 / 小节标题 13 / 行前缀 13 / 面板与表单分组 14 / 页面标题 16 / 按钮内 13。
  - **图标与文字同色调**（`color: var(--sp-tone)` 或继承），不上第二种颜色，否则变成花。
  - **同一视图内，同一 icon 不得表达两种语义**（如 `CircleCheck` 既当"已启用"又当"已配置"）——语义不同的同级状态换形状，不换色调。跨视图重复无妨。
  - 判据：一个 11~13px 的文字标签在四张同构卡片里区分度天然低，**文字相同结构时靠图标认、不靠读**。
- **三态齐全**：空态（带下一步 CTA）、加载骨架、失败重试，缺一不可。

**适用边界**（该技能中被裁剪、工作台扩展不适用的部分）：

- "独特字体、避免系统字体"——字体由平台主题统一，扩展禁止自带字体；独特性来自构图与排版层级，不来自字体；
- "每个产品独立配色"——扩展禁止发明配色，颜色一律走主题 token，品牌个性由平台主题承载；
- "粗暴主义/极繁/复古未来等大胆美学方向"——工作台美学方向已锁定"专业密集 B2B"，差异化靠 §1.8 的构图推导，不靠美学流派。

> 该技能自带的检索工具（`scripts/search.py`，配色/字体/UX 数据集）可用于**平台主题与门户页**的设计调研；工作台扩展开发用不到。

## 6. 样式与组件技术路线（shadcn + Tailwind + SDK 组件边界）

扩展 UI 只允许一条技术路线：**SDK 组件 + Tailwind 语义原子类 + 业务件 cva 变体**。`acme.service-project` 是该路线的参照实现（WorkbenchDrawer/Dialog + 原子类 + 少量业务 CSS）。

### 6.1 组件三规则

1. **SDK 有 → 直接用**。`@appthen/vibe-workspace/{components,ui,overlay}` 已提供的组件（Button、Input、Alert、Skeleton、SimpleSelect、Checkbox、Switch、DropdownMenu、Pagination、WorkbenchDialog、WorkbenchDrawer 等），禁止在扩展内重写同功能组件——哪怕只差一个 className。
2. **SDK 缺 → 上提**。两个及以上扩展用得上的能力，先在 vibe-workspace 增补并随 SDK 发布，扩展不得复制私有实现；仅本扩展的业务语义件（KpiCard、状态 Badge、tone 卡片）才留在扩展内。
3. **业务语义件 → cva 变体**。b2b-ui-ux §1.2（KPI 卡四层结构）、§1.4（浅底深字 tag）、§1.6（tint 渐变卡公式）的视觉公式以 class-variance-authority variant 承载（如 `KpiCard tone="primary|success|warning|danger"`），不写成扩展 CSS 规则。

### 6.2 样式承载

- 颜色一律走主题（**实测 2026-09**，以构建产物为准）：shadcn 语义类（`bg-background`、`text-foreground`、`bg-muted`、`text-muted-foreground`、`bg-card`、`border-border`…）在 SDK CSS 中真实存在，优先用；`--portal-*` 调色板（success/warning/danger/primary/sub/fill 等 19 个变量）用 Tailwind 任意值消费（`bg-[var(--portal-success)]`、`text-[var(--portal-sub)]`）。**注意**：`bg-success`/`text-sub`/`bg-tier-vip` 这类从 `--portal-*` 派生的语义类在当前构建中**不存在**，不要写。
- 业务级别色没有专属 token（如 VIP/普通/潜在）：映射到语义色（实证先例 types.ts `LEVEL_DOT`：vip=warning、regular=sub、potential=primary），需要新语义色先提 SDK 采纳；不发明 hex，不新增 `--crm-*`/`--xxx-*` 私有 token，也**不得定义任何既有命名空间 token（§2 硬规则）**。
- **扩展不新增独立 `.css` 文件**（例外：reset、keyframes、滚动条、复杂伪元素等 Tailwind 长尾，且必须按业务域分文件）。
- 布局用原子类 + 既有断点（`<768px` 移动，见 §3）；容器宽度驱动的响应（如筛选栏常驻断点）用 ResizeObserver 判定容器宽度传 props，不用媒体查询猜测容器。
- **结构红线**（存量扩展同样适用）：单组件文件 > 300 行、或单组件 useState > 5 → 必须拆分（按状态域抽自定义 hook；Dialog/Drawer 开关状态收敛为单个 `dialog: { type, payload } | null`，禁止 N 个布尔并存）；CSS 按业务域分文件，禁止全扩展单文件。

### 6.4 色调范式（`--sp-tone`）—— 合规之后怎么把颜色真正用起来

> 背景：`acme.service-project` 在完成合规清理（去掉违规色、统一圆角字号）后仍被判定"太素、像黑白电视"。
> 根因不是违规，是**合规 ≠ 有色彩体系**：清理只保证"没有错的颜色"，不保证"有用的颜色"。本节补上后者。

- **颜色承载语义，不做装饰**。约定的语义映射：
  绿=就绪可用 / 琥珀=待处理需介入 / 红=破坏性 / 蓝=主体量与主操作 / 灰=归档与无状态。
  反例警示：给"分类目录"这种**无状态度量**上色会让 KPI 区四个数看起来同级同质——该中性就必须中性。
  "颜色不够用"时不要硬凑：只有 4 个色相家族（primary/success/warning/danger），
  分类色（categorical，如入口分组）与状态色（status）**不得混用同一屏**，否则语义冲突。

- **色调范式**：一个元素只声明一个局部变量 `--sp-tone`，其余属性全部由它派生：

  ```css
  .sp-kpi__cell { --sp-tone: var(--primary);
    border: 1px solid color-mix(in srgb, var(--sp-tone) 24%, transparent);
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--sp-tone) 14%, var(--card)) 0%,
      color-mix(in srgb, var(--sp-tone) 4%, var(--card)) 100%); }
  .sp-kpi__cell--success { --sp-tone: var(--portal-success); }
  ```
  换色调只改一个类，不会出现"边框改了底色没改"的漏改。`--sp-tone: var(--portal-x)` 是
  **`var()` 别名**，不引入新色源，不违反 §2。

- **对比度规则（同色调浅底上写同色调文字，最容易糊）**：
  | 用途 | 写法 |
  |---|---|
  | 非文字图形（圆点 / 竖条） | 直接用 `var(--sp-tone)` |
  | 大号数字（20px，压在同色调 14% 浅底） | `color-mix(in srgb, var(--sp-tone) 82%, var(--foreground))` |
  | 小号文字（≤13px） | `color-mix(in srgb, var(--sp-tone) 75%, var(--foreground))` |

  实测：`--portal-warning`（浅色主题 `#b98216`）直接当数字色时，与它自己的 14% 浅底只有 **2.9:1**，
  不达 3:1。混入 `--foreground` 后浅色主题自动压暗、深色主题自动提亮，**一套写法两个主题都达标，
  无需任何 `[data-theme]` 分支**。

- **`--portal-*` 键的可用范围**：只使用明暗两套默认集都存在的键（`bg/card/fill/border/border-hover/
  sidebar/sidebar-border/title/body/sub/disabled/primary/primary-light/primary-hover/success/
  warning/danger/danger-bg/shadow/ink`）。`tier-vip`/`tier-regular`/`tier-potential` **只存在于
  dark 默认集**，light 主题下是空值，用了会静默失效（证据：SDK `Workbench-*.js` 的
  `DefaultLightPortalColors` 无这三个键）。`--portal-info` 亦不在默认集中。

- **别用共享 variant 表达业务状态**：`badgeVariants` 只有 `default/secondary/destructive/outline`
  四个**通用**槽位，且 `outline` 连底色都没有（只有 `text-foreground`，无 `background`）。
  用 `outline` 表达"已启用"，列表里就变成**一整列灰字**——这正是"黑白电视"的直接来源之一。
  正确做法：基座仍用 `<Badge variant="outline">` 拿圆角/内距/字号，配色由扩展类接管
  （扩展 CSS 未分层 → 稳压 `@layer utilities`，无需 `!important`）：

  ```tsx
  <Badge variant="outline" className={`sp-pill sp-pill--${tone}`}>
    <i className="sp-pill__dot" aria-hidden="true" />{label}
  </Badge>
  ```

- **消灭"假编码"**：旧实现里"规则动作分布"画了 5 个**同色**圆点做图例 —— 颜色不区分任何东西的
  图例等于没有图例。要么让颜色真的分组（动作作用域：表单域 / 样品 / 计价 → 蓝 / 绿 / 琥珀），
  要么去掉圆点改用 chip 底色承载。同类自查：任何"图例 / 色标 / 分面"都必须能回答"这个颜色在区分什么"。

- **行内操作要按后果着色**：启用=绿、停用=琥珀（可逆降级）、删除=红（不可恢复）。
  三个操作全是同一款灰 outline 时，使用者要靠读字才知道哪个点下去有后果。
  共享 `Button` 的 `destructive` variant 是**实心红块**，表格行内太重，用 `variant="outline"` +
  扩展类 `sp-btn-danger`（`color: color-mix(destructive 78%, foreground)`）。

- **提交前自检**：把 UI 截图去色后如果层级还成立，说明结构没问题；把 UI 截图**看成一整块灰色**，
  说明色彩体系缺失——回到本节。

### 6.3 案例记录

- **反例 `acme.customer-management`（CRM）**：自 CordysCRM 参考实现移植，带来 2044 行单文件 CSS 与 7 个自建基础组件（Select/Checkbox/Switch/Badge/Pagination/DropdownMenu/Controls，其中 5 个与 SDK 职责重叠）；更以"补全 SDK 组件所需 `--ck-*` 全集"为由自建 133 行 token 桥（83 个 `--ck-*` + 23 个 shadcn 定义）。**终审结论（2026-09）**：桥是重复病不是补洞——宿主运行时已提供全套 token（service-project 0 个定义即为实证），桥已整块删除并清零全部自定义定义；桥外引用的 `--portal-danger-bg`/`--portal-tier-*` 等 SDK 不存在的变量改用 color-mix 派生与语义映射。教训：判断"缺 token"前先 grep 宿主/SDK 构建产物，别信扩展自己的桥。正确路径是组件能力上提 SDK（一次）、缺色提 SDK（一次），而不是每个扩展各自吸收基建。存量迁移顺序：home → list → detail/其他域，迁移时同步完成状态域拆分与 Dialog 状态收敛。
- **正例 `acme.service-project`**：SDK 组件 + Tailwind 原子类 + 抽屉滚动布局（§3 `min-h-0 flex-1 overflow-y-auto` 契约）即出自该扩展的返工教训。**更正（2026-09-22 复核，v0 结论有两处失准）**：
  - ~~"11 个 token 定义"~~ 是旧版 `audit-extensions.cjs` 的判定口径过宽（把 `var()` 别名也计入）。按现行口径（§2「是否引入新色源」）实测 `tokDefs=33 / tokDefsColored=0` —— 33 个定义**全部是 `var()` 别名**（如 `--sp-tone: var(--portal-primary)`），**色源定义 0 个，不构成 §2 违规**；`hardColors=9` 全部落在 `designer/designer.css` 与 `form-preview/form-preview.css`（业务状态色，§6.3 白名单项）。
  - 仍然成立的是**体量**问题：87.7KB / 3811 行 CSS 偏大，`designer.css` 单文件即占大半，应按业务域拆分迁移。
  - 它的正例身份覆盖"组件选择 + 抽屉布局 + 色调范式（§6.4）"，**不包括 CSS 单文件承载方式**。

---

## 7. 容器语义与首屏价值（主面板 / 工作区）

> 本节是**强制契约**。它约束"首页是否成立"，**不约束首页长什么样**——场景自由度必须保住。

### 7.1 容器语义

| 容器 | 语义 | 承担什么 |
|---|---|---|
| **主面板**（Sidebar view，`runtime.sidebarViewId`） | **模块的 App 首页**（模块驾驶舱） | 模块的当前状态、需优先关注的内容、直达动作 |
| **工作区**（Editor view） | 常规业务页面 | 列表、筛选、排序、分页、批量操作、表单、详情等持续作业面 |
| Dialog | 短流程、确认、少量字段 | — |
| Drawer | 单条记录详情、上下文辅助编辑、筛选条件 | — |

**扩展 = 模块**：一个扩展就是一个模块，模块主入口就是主面板。**任何扩展的主面板都必须按 App 首页设计，没有例外类别。**

**最常见的错法**：把主面板当成"入口侧边菜单"——只放几个按钮/一段说明，点击后打开某某列表。这就是不合格。

### 7.2 首屏价值判定式（三问，形态无关，必须全过）

| # | 问题 | 不合格的样子 |
|---|---|---|
| Q1 | 首屏是否呈现**真实状态 / 数据 / 进度**（而非纯导航文字）？ | 只有"客户管理""订单管理"几个按钮 |
| Q2 | 首屏是否至少有**一个元素直达真实动作**（而非"进入某某页再操作"）？ | 一切都靠二次跳转 |
| Q3 | 是否**零假入口 / 零占位 / 零"敬请期待"**？ | tile 描述了一个功能，点了打开别的东西或什么都不发生 |

### 7.3 槽位制（结构松、责任紧）

主面板首屏 = **状态区 + 动作区**。两区的比例、数量、表现手法**全部不锁**，由场景决定：

| 场景 | 状态区可以是 | 动作区可以是 |
|---|---|---|
| B 端运营工作台 | KPI 数字、分布环、异常计数、待办队列 | 新建 / 推进 / 批量处理 |
| 学习型个人工作台 | 今日计划完成度、学习地图进度、连续打卡 | 继续学习第 N 章、新增计划 |
| 内容 / 资料型 | 最近访问、收藏、待整理计数 | 新建文档、导入资料 |
| 工具型 | 最近任务、配额/用量、连接状态 | 新建任务、重新连接 |

⚠️ **不要把 B 端的 KPI 卡 + 待办 + 快捷动作当成统一模板**。判定式只管"首页成立"，不复刻构图。

**动作区的位置契约（2026-09-22 用户实拍纠正）**：主操作**不得贴底**。

| 区域 | 承载什么 | 尺寸 | 反例 |
|---|---|---|---|
| 标题正下方（紧跟标识） | **主操作**：新建 / 创建 / 发起 —— 用户打开面板第一件想干的事 | `size="sm"`，等宽 1~2 列 | 做成 62px 高贴底 tile |
| 内容流（滚动区） | 状态、明细、待办 | — | — |
| **贴底区** | 只放**模块设置 / 配置维护**类（分类管理、字段字典、计价模板…） | 一行紧凑行 + 分隔线，视觉**轻于**上方 | 把「新建」放这里 |

理由是**视觉终点 ≠ 主操作**：贴底等于让人读完 KPI、翻完明细才看见"开始"。贴底区天然是"偶尔来一次"的配置面，主操作是"每次来都要用"的，位置必须相反。两者若同处贴底，用户会把主操作误读成设置项。

### 7.4 列表进主面板的判据

- **列表即应用主体**（收件箱、IM 会话列表、消息流、通知中心）→ 列表本身就是主面板主体，一等公民形态。
- **列表只是子功能** → 主面板**不得**放完整列表；只能放"需要优先关注的内容"（待处理订单、超期任务、异常项、待审核队列）。
- **优先关注区上限**：约占首屏 **1/3**，绝对高度 **≤320px**（对齐移动端抽屉 30% 档位）；超出即说明这是完整列表，必须收进工作区。
- 一句话：**主面板放"决策所需"，工作区放"作业所需"。**

### 7.5 移动端契约（代码实证 2026-09-22）

- 主面板在移动端**不以侧栏呈现**：底部 tabbar 承载模块入口，点击后以**可拖拽底部抽屉**渲染主面板，高度三档 **30% / 80%（默认）/ 95%** 视口高。
- **tab 上限 5 个主项 + 「更多」溢出** → 模块归属必须收敛，不能"一个业务域一个扩展"。
- **tab 标签字号 10px**，扩展名过长会被截断。
- **抽屉不卸载**（访问过即常驻挂载）→ 主面板必须容忍长期挂载：禁常驻动画、禁轮询、禁高频滚动监听。
- **30% 档不得成残骸**：降到最低档时，状态区仍要能表达"最关键的一个数 / 一个进度"，动作区至少保留一个主操作。
- **一套组件响应式双形态**（原子类断点 `<768px`），非特殊情况不分写移动端视图；确需分写时必须登记为平台能力缺口，而不是悄悄另起一套。

### 7.6 自检清单（提交前逐条）

- [ ] 主面板三问全过（有状态、有直达动作、零假入口）
- [ ] 主操作在标题下方、`sm` 档；贴底区只有模块设置项（§7.3 位置契约）
- [ ] 首屏不是"入口菜单页"
- [ ] 列表要么是应用主体，要么 ≤1/3 首屏且 ≤320px
- [ ] 降到 30% 抽屉高度仍成立
- [ ] 无占位按钮、无"敬请期待"、无点了没反应的 tile
- [ ] 移动端未分写第二套视图
