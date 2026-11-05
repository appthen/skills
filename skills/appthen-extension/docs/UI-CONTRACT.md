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
5. **同排控件高度一致（硬约束，2026-11-05 内容运营扩展实证）**：同一行 / 同一工具条内的 Input、Select、Button 高度必须相同——默认全部 32px。组件的 `sm` 档是 28px，**只允许在同排所有控件统一为 28px 时整排使用**，禁止 28px 与 32px 混排（`SimpleSelect size="sm"` 并排 `Input h-8` 会差 4px，用户一眼可见）。筛排/工具条的判定方法：数一遍该 flex 行内每个交互控件的实际高度，全部相等才算过。
6. ~~已知缺口：`SimpleSelect` 触发器默认 36px 与 Input 32px 不一致~~ **已修复**：SDK 0.1.12+ 的 SimpleSelect 默认档为 `h-8 text-sm`（32px），与 Input 一致；`sm` 档为 `h-7 text-xs`（28px），按上一条规则整排使用。

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
- **视图根节点必须自己撑满高度并自己滚**（主面板与编辑器都一样）：

  ```tsx
  <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4 [&>*]:shrink-0">…</div>
  ```

  宿主给扩展的容器是**确定高度 + `overflow: hidden`**（`.appthen-extension-frame` 内层 `absolute inset-0`）。扩展不接管滚动，超出部分就被直接裁掉，连滚动条都不会出现。两个必踩的坑：

  | 写法 | 实际结果 | 实测 |
  | --- | --- | --- |
  | `min-h-full` | **无效**。父级是 block + `height:auto` 时 `100%` 解析为 `auto`，内容自然撑高后被宿主裁掉 | 内容 1195px / 容器 868px，**被裁 327px 且无滚动条** |
  | 只加 `overflow-y-auto`、不加 `[&>*]:shrink-0` | flex 子项默认 `flex-shrink:1`，空间不足时**被压扁而不是溢出**，表现为「既没有滚动条也没有溢出」，表格被挤矮 | 640px 视口下 `scrollHeight == clientHeight == 568` |

  验证方式不是看截图，而是读数值：`scrollHeight > clientHeight + 8`，且 `scrollTop` 能设到大于 0。

- 需要「表头/筛选固定、只有表格滚」时，根用 `flex h-full min-h-0 flex-col`，滚动交给表格容器 `min-h-0 flex-1 overflow-auto`，其余子项 `shrink-0`。
- 表单字段组和按钮组显式 `gap-2` / `gap-3`；输入控件必须 `min-width: 0; max-width: 100%`。
- **页签行（胶囊 `TabsList`）不得贴死相邻分隔线（硬约束，2026-11-05 内容运营扩展实证）**：胶囊是整块灰底，贴 border 就变成"两条线挤在一起"，用户一眼可见。配方（CRM 与内容运营两次实测收敛）：

  ```tsx
  // 容器：页签上下各留 12px 呼吸；分隔线到下方内容也是 12px —— 三段同一节奏
  <div className="flex flex-col gap-2 border-b border-border px-4 pb-3 pt-3">…<TabsList>…</div>
  // 内容区顶部对齐：contentClassName="gap-3 px-4 pb-4 pt-3"（pt-3 = 12px，勿用 p-4 的 16px）
  ```

  反例即本次事故：容器 `pb-0`（下划线页签时代的贴边写法，胶囊形态下直接贴死）。自查方法：量「分隔线→胶囊」与「胶囊→下一节」两个实际间距，必须相等（或有意不对称并有理由）。

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

> 

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
- [ ] 每节过了 §7.7 四问（谓词 / 动作必过，增量 / 命中加分）
- [ ] 列表要么是应用主体，要么 ≤1/3 首屏且 ≤320px
- [ ] 降到 30% 抽屉高度仍成立
- [ ] 无占位按钮、无"敬请期待"、无点了没反应的 tile
- [ ] 移动端未分写第二套视图

### 7.7 主面板节次有效性四问（谓词 / 动作 / 增量 / 命中）

§7.2 三问判"主面板整体是否成立"，本节判**面板里每一节是否该存在**。逐节跑四问：

| # | 问题 | 不合格的样子 | 权重 |
|---|---|---|---|
| Q1 | **谓词**：这节数据自己的筛选条件是什么？ | 谓词是"全部"或"前 N 条"（等于工作区列表页的一个 tab / 一次 `slice`） | **必过** |
| Q2 | **动作**：看完这条，下一步点哪里？ | 点到的就是工作区列表/详情本身 —— **绕回原点的闭环** | **必过** |
| Q3 | **增量**：它展示的字段，工作区对应视图**没有**吗？（`F_面板 \ F_工作区`） | 差集为 **∅** —— 面板复刻了工作区已有的列 | 加分 |
| Q4 | **命中**：用户想找的那条，预期在第几条？ | 固定顺序 + 集合随业务增长 → 命中率 ≈ N/\|S\| → 0 | 加分 |

Q1/Q2 任一不过 → 该节**删除**，或改成"带筛选的跳转入口"（见下）。Q1/Q2 过、Q3 增量 >0 → 最强的节。

**判定核心：`S_面板 ⊂ S_工作区` 且面板无额外谓词 ⇒ 面板该节是列表页的劣化镜像，必删。**

- **反例（2026-09-22 实拍，`acme.service-project` 主面板「已启用项目」节）**：数据源是 `enabledList.list.slice(0, 5)`。Q1 谓词 = `status=ENABLED`（列表页快筛 chip 同一谓词）✗；Q2 点开行 → `openList({openProjectId})` 打开列表页 ✗；Q3 展示 {名称, 配置状态} 而列表页列 {名称, 分类, 状态, 检测参数, 下单方式, 排序}，差集 = ∅ ✗；Q4 固定前 5 条，命中率 = 5/已启用总数 ✗。**四问全灭，但它在面板上占了一屏。** 同一面板的「待配置检测参数」节则 Q1 = `¬hasParameterConfig`（强谓词 + 需人介入）✓ Q2 = 去配置 ✓ → 成立。**判定力全部来自 Q1/Q2，不是来自内容好看不好看。**
- **入口型内容的正确形态**：分类、目录、标签、分组这类"导航性"内容，正解是**可点击、带筛选条件跳走的入口**（点一下就把 `categoryId` 带到工作区列表），**不是**在主面板里复刻一份列表。判据同上 —— 面板复刻列表必然 Q3 差集为 ∅。
- **Q3 的实践价值**：把接口**已返回但前端未消费**的字段列出来，就是"零成本需求池"。面板的价值 = **字段增量 × 谓词强度**；两项都为零时，无论视觉做得多好都只是装饰。查法：领域类型定义 vs 面板/列表实际渲染的字段做差集。
- **Q4 的存在理由**：Q1 的谓词若本身**命中率高且集合自排序**（待办队列、异常项、超期项），哪怕只有 N 条也站得住 —— 因为用户的目标是"清空它"。反之"全部/已启用"的固定前 N 条命中率随业务增长趋近 0。
- ⚠️ **Q3 反用警告**：字段存在 ≠ 数据真实。做之前先验证该字段**有没有写入路径**（实体注释写"可手工维护"而没有任何写入接口 = 恒为默认值，展示出来就是假指标）。**先验证写路径，再设计 UI。**

---

## 8. 判定原则：硬约束 vs 建议

本节的 §9（字号）与 §10（体量）口径不同，先分清，否则规范会退化成审美警察。

**唯一判据：不遵守会不会坏？**

| 类型 | 特征 | 门禁行为 |
| --- | --- | --- |
| **硬约束** | 会导致渲染错误、主题失效、内容被裁、功能不可用。例：字号 <12px 被浏览器强制放大但容器不撑开；`var(--vscode-*)` 掉主题；视图根不接管滚动导致内容被裁 | **阻断**（退出码 1） |
| **建议** | 只影响"看不看得惯 / 好不好维护"。例：CSS 行数、自定义类名数量、内联 style 数量、单文件行数、组件选型偏好 | **只提示**（退出码 0），加 `--strict` 才计失败 |

**为什么规模类不做硬约束**：这些数字能反映"有没有在设计系统上思考"，但**不能替人做审美判断**。刻意做高密度数据的扩展，本来就可能需要更多 CSS；把阈值卡死只会逼人把样式挪进 TSX 换个地方藏，而不是真正减少重复。

一句话判据：**"不遵守它，用户看到一个坏掉的界面，还是看到一个你不喜欢的界面？"** 前者是硬约束，后者只是建议。

## 9. 字号下限（硬约束）

**最小字号 12px。8 / 9 / 10 / 11px 一律禁止，不设"仅辅助文字"例外。**

理由不是审美，是渲染机制：

> Chrome / Chromium 在中文语言环境下**最小字号默认 12px**。低于 12px 的 `font-size`
> 不报错、不警告，而是**直接按 12px 渲染**；但元素的**行高、内边距、容器宽高仍按声明值计算**。
> 结果：容器按 8px 算高度，里面塞 12px 的字 → 文字溢出、裁切、压行。

因此"8px 小字"在作者机器上（英文 locale 或未开限制的浏览器）看起来很精致，
在用户的中文 Chrome 里是挤成一团。**这是最难自查的一类问题**，所以列为硬规则。

层级靠跳跃建立，不靠 1px 的微差：

| 用途 | 档位 |
| --- | --- |
| 辅助信息 / 表头 / 元数据 | `text-xs`（12px） |
| 正文 / 表格单元 / 表单值 | `text-sm`（14px） |
| 卡片标题 / 页面小标题 | `text-base`（16px） |
| 页面标题 / 关键数字 | `text-xl`（20px） |

11px 与 12px 之间不存在可感知的层级差异，写 11px 只是把字号压到渲染下限之下再被弹回来。

**验证（必跑）**：Playwright 默认 Chromium **没有**最小字号限制，8px 会真的渲染成 8px，
所以"截图看起来没问题"不构成证据。必须显式开启：

```js
const browser = await chromium.launch({ args: ['--blink-settings=minimumFontSize=12'] });
// 探针确认限制生效：给一个元素设 font-size:8px，读回应为 12px
```

在该限制下扫描文本节点，`<12px` 计数必须为 0。

**已知宿主缺口**：`StatusChip` 默认 `text-[11px]`，低于本条下限。使用处需覆盖
（如 `className="!text-xs"`），并按 §6.1 规则 2 把"chip 默认字号提到 12px"上提 SDK。

## 10. 样式体量预算（建议，不阻断）

**独立 CSS 行数是信号，不是红线。** 默认阈值 150 行（单扩展所有 `.css` 之和），可用 `--css-budget=` 调整。超出**不会**让门禁失败，它只是提示你回到下面这张归因表，逐行判断该由谁负责。

预算不是拍出来的数字，是从"该由谁负责"倒推的：

| 类别 | 归谁 | 是否该进 CSS |
| --- | --- | --- |
| 重建宿主已有组件（表格、标签页、徽章、分页） | SDK 组件 | **否** |
| 设计数值（字号、间距、圆角、宽高、颜色） | Tailwind 原子类 / 主题 token | **否** |
| 一次性元素样式（只服务一个元素的自造类名） | 就地写原子类，第二次出现才抽组件 | **否** |
| 响应式分支 | `@min-[...]` / `@max-[...]` 容器变体（注意 §2 分层陷阱，覆盖型要加 `!`） | **否** |
| 关系型布局：`conic-gradient`、`mask`、`nth-child` 重排、伪元素、多列 grid 模板 | — | **是** |
| 宿主能力缺口补丁（抽屉宽度、焦点环、token 对比度） | — | **是，但必须收敛成一处全局补丁** |
| reset / keyframes / 滚动条 | — | **是** |
| portal 逃逸（抽屉渲染在 body 下，容器查询查不到） | — | **是，用视口断点** |

写法要求：**每写一行 CSS，必须能立刻说出它属于上面哪一行"是"的类别。**
说不出来，就说明它属于前三行"否"。

超出预算时的处理顺序（不要跳步）：

1. 换 SDK 已有组件
2. 换成原子类 / 语义 token
3. 能力确实缺失 → **上提 SDK**（一次），不在扩展里复制私有实现
4. 前三步都不适用 → 才写 CSS，且收敛在一处

**实证参照**：

- 反例→改造中 `acme.customer-management`：2044 行 → 1408 行 → **1286 行**。
  2026-11 的第一刀砍的是「同一个三段式骨架在 7 个页面里各复制一遍」：
  `.crm-page` / `__top` / `__head` / `__main` / `__foot` + `.crm-head-tools` +
  `.crm-page__head-actions` 共 97 行，改由 `ViewShell` + 常量原子类接管，
  7 个页面同步改完，**截图像素差异 0.042%**（且差异集中在 1px 抗锯齿，非布局位移）。
  另清掉 4 条死类。这说明**这类 CSS 删掉是无风险的**——删不掉的从来是"业务特有视觉"，不是骨架。
- 反例 `acme.lab-equipment-operations`（2026-11）：576 行单文件 CSS、129 个自定义类名、
  14 档字号（含 8/9/10px）。按本节四类重新划分后，**降到 76 行、4 个类名**，
  且视觉层级反而更清楚——被删掉的全是"否"那几行。
- 正例 `reference-crud`（examples 内）：**0 行 CSS、0 内联 style**，覆盖主面板 + 列表 + 抽屉 + 五态。

**一个比行数更早出现的信号：同一个骨架被复制到第 2 个页面。**

不必等到 CSS 超预算才动手。当你在第 2 个文件里粘贴 `.xxx-page` / `.xxx-page__head` 这套东西时，
答案就已经确定了——它是机械件（§11），该进 SDK 或有现成宿主组件。
`acme.customer-management` 的 97 行骨架 CSS 之所以存在，只是因为它在 7 个页面里被复制了 7 次；
单看任何一个页面，都会觉得"才 30 行，自己写更省事"。

**门禁（提交前必跑，退出码非 0 即不通过）**：

```bash
node scripts/audit-ui.mjs <扩展目录>
```

检查项：字号 <12px、CSS 超预算、自定义类名数量、内联 `style` 数量、`var(--vscode-*)`、
自定义色源、手搓宿主组件、单文件行数。脚本在 `skills/appthen-extension/scripts/`。

---

## 11. 什么该上提 SDK（判据）

**判据不是"用得多"，而是"有没有审美主张"。**

工作台是底座，要支撑家庭、办公、科研、实验室这些完全不同的场景。所以：

| 类型 | 特征 | 处理 |
| --- | --- | --- |
| **机械件** | 交互与可访问性有客观正确答案，视觉上没什么可说的。例：分页、加载指示、空态、表单字段的标签/必填关系、滚动容器、确认对话框 | **上提 SDK**，一次做好，所有扩展受益 |
| **表达件** | 承载场景身份、需要为不同业务重新设计。例：KPI 卡、统计图表、时间线、卡片风格、色调体系、品牌感强的徽章 | **不上提**，只在示例里演示写法，把设计权留给场景 |

### 为什么表达件不能给

给了 `Stat`，实验室工作台的指标卡和家庭工作台的指标卡就会长成一个样。那不是"标准化"，是**把审美外包出去了**——而且是最该由场景自己决定的那部分。

一个检验方法：**"这个组件如果所有人都在用，会不会让人一眼看出是同一个产品做的？"** 会 → 表达件，别上提。

### 一个容易搞反的情况

某个能力"用得多，但每次接入都要改" —— 这说明它是**被误当成机械件的表达件**。正确做法不是把它抽成组件再塞一堆 props，而是只给**骨架**、不给**皮肤**：

- 给：`Pagination`（总数/页码/上下页/每页条数这套逻辑与 a11y）
- 不给：`<StatCard tone="primary" value={10} trend="+2" />`（这是某一个产品的视觉决定）

**但要拆开的是交互态和形态**（2026-11 CRM 实战教训）：同一个页签，形态（下划线 vs 胶囊）可以留给场景，
交互态（focus ring、键盘导航、`data-state`、disabled）**永远是机械件，必须交给组件**——
手写 className 再全也补不齐行为态，而"点击效果不全"用户一眼就能看出来。
所以当宿主组件自带完整交互时，"保形态"的代价是丢交互，这个代价通常不值得；
真要保形态，也要按组件标准把 focus-visible / 键盘 / data-state 补齐。

### 当前已上提的机械件（2026-11）

`ViewShell`（撑满+滚动）、`FormField`/`FormGrid`（字段组）、`Pagination`、`Spinner`、`Skeleton`、`EmptyState`、`SimpleSelect`、`StatusChip`（语义色 + dot，形态由主题决定）、`Tabs`/`TabsList`/`TabsTrigger`（含 icon gap）。

**明确不上提**：`Stat`/KPI 卡、`ProgressRing`、`Timeline`、任何"卡片视觉模板"。

### CSS → 原子类迁移的四个坑（2026-11 CRM 实战，全部踩过并验证）

改手写 CSS 为 Tailwind 时，这四类回归占实战事故的绝大多数。每条都是实测命中过才写进来：

1. **line-height（最高频，单日三次命中）**：`text-sm`/`text-xs` 自带 20px/16px 行高，而手写 CSS 的
   `font-size:14px/12px` 通常**无 line-height 声明**（继承 normal ≈17px/20px）。
   只换字号不控行高 → 元素高 2-4px → 整段内容平移 → 像素 diff 从 0.01% 跳到 5.5%。
   **规则：凡原 CSS 无 line-height 声明的文字，原子类必须显式 `leading-[normal]`。**
2. **间距叠加**：容器 `gap` 与子元素自带 `margin` 是**相加**的。手写时代两层各写一点
   （panel mt-16 + 容器 gap-16 = 实际 32px），迁移时只翻译声明值就会原样带走叠加。
   **规则：改任何间距前，先把相邻元素的 padding/margin/gap 加出"实际合成值"；
   上下必须对称或有明确理由；改完截图实测，"改了"不等于"对了"。**
3. **沿视觉列扫到底**：head、页签行、内容区共用同一条左缘，水平 padding 必须一致。
   只按组件改到头、不按视觉列检查，会留下 4px 级错位（用户一眼就能看出来）。
   换组件形态时（下划线 → 胶囊）原贴边假设全部失效，呼吸空间要重新给。
4. **反向检查悬空类**：删 CSS 用前缀匹配会误伤后代选择器（`.a--x .b {}` 随 `.a--x` 一起被删，
   但 `.b` 还活着）。删完必跑：**TSX 在用的每个自定义类必须仍有定义**，否则就是悬空。
   顺带能抓出"动态拼类名但变体从未定义过"的死代码（`crm-opp-status--${x}` 这类）。

### 迁移顺序与验收（可复制给同事）

1. `wc -l` + audit-ui 拿基线三个数（CSS 行数 / 自定义类名 / 视觉声明）
2. 按 §10 归因表分类，**只删"否"的行**；遇到"同一骨架第 2 次被复制"立即停手改组件
3. 换组件优先做 **API 兼容封装**：内部换成宿主实现、props 签名不动，调用点零改动
   （样板：`TabStrip` 从手写下划线演进为宿主 `Tabs` 的轻封装，3 个调用点零改动）
4. 每刀独立提交、像素比对验收（阈值 <0.1% 通过，>0.5% 必有布局位移），并用
   `--blink-settings=minimumFontSize=12` 复现中文最小字号
5. 同一扩展内按"骨架 → 页签 → 徽章 → 弹层 → 空态 → 布局"推进，一屏一屏改

---

## 12. 列表：表格在窄容器里必须变成卡片列表

**规则：列表页只要用了 `Table`，窄容器下就必须退化为 card list，不许靠横向滚动。**

"窄容器"指**表格可用宽度 ≤ 640px**（不是浏览器视口宽度）。分屏时面板可能只有 360px 而视口有 1600px，用视口断点会把桌面表格硬塞进窄面板。

### 为什么是硬要求

横向滚动的表格在手机上有三个问题：首屏看不到"这条是什么"，手指横滑与页面纵向滚动打架，表格一长就没人愿意滑。这跟她/他喜不喜欢卡片样式无关，是**读不出来**。

### 怎么写

```tsx
<Table cardMode>
  <TableHeader>
    <TableRow>
      <TableHead className="w-10" />
      <TableHead>设备信息</TableHead>
      <TableHead>所在位置</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((row) => (
      <TableRow key={row.id}>
        <TableCell cardHidden>…勾选…</TableCell>
        <TableCell cardTitle>…主信息…</TableCell>
        <TableCell label="所在位置">{row.location}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

| API | 作用 |
| --- | --- |
| `<Table cardMode>` | 开启窄容器折叠。包裹层成为容器查询作用域 |
| `<TableCell label="字段名">` | 卡片里显示"字段名 → 值"；桌面表格里不显示 |
| `<TableCell cardTitle>` | 卡片标题行：整行宽、不带字段名（给主信息列） |
| `<TableCell cardHidden>` | 卡片里隐藏（勾选列、行操作这类冗余列） |

### 职责边界（接 §11）

- **SDK 给机制**：行→卡片、字段名位置、隐藏列、断点判定、`thead` 保留在 DOM 里供读屏。
- **扩展给视觉**：卡片的内边距、分隔线、背景、圆角全部可用 `className` 覆盖。想做成带边框的独立卡片还是分隔线列表，由业务决定。

所以：**不要为了样式统一去改 SDK 的这套 CSS**，用 `className` 覆盖；反过来也**不要自己写 `nth-child` 重排**。

> 覆盖时注意分层：扩展的 CSS 若未写 `@layer`，会压过 `@layer utilities`（见 §2）。SDK 这套卡片规则同样未分层，所以用工具类覆盖要加 `!`，例如 `className="@max-[640px]:!border-b-0"`。

### 反例：`nth-child` 重排

早期实现是在媒体查询里给每个 `td` 写 `grid-column` / `grid-row`：

```css
.leo-table td:nth-child(2) { display: flex; grid-column: 1; grid-row: 1 / span 2; }
.leo-table td:nth-child(3) { display: block; grid-column: 2; grid-row: 1; text-align: right; }
/* …共 30 行，且列顺序一变就全错 */
```

这段有 30 行、跟列顺序强耦合、增删一列就崩，而且它假定了"第 2 列是主信息"这种业务语义——换个数据表就不成立。

### 验证（必跑）

在窄面板下量，不要只看截图：

```js
// 表格 display 变成 block、min-width 归零、字段名可见、页面无横向溢出
const t = document.querySelector('.appthen-table-card table');
const labels = [...document.querySelectorAll('[data-table-label]')].filter(
  (el) => getComputedStyle(el).display !== 'none',
).length;
// 期望：getComputedStyle(t).display === 'block'
//       getComputedStyle(t).minWidth === '0px'
//       labels > 0
//       document.documentElement.scrollWidth === clientWidth
```

### 门禁

`node scripts/audit-ui.mjs` 的 `TABLE_NO_CARD_LIST`（建议级）：`<Table>` 未开 `cardMode`，或开了但没有 `label`，都会提示。
