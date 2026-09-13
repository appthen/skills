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

- 优先使用 shadcn 语义层（`--foreground` / `--card` / `--border` / `--muted-foreground`）和 `--portal-*` 层；它们随主题正确联动。
- `index.css :root` 中的 `--border-light`、`--text-primary`、`--accent-*`、`--hover-*` 是旧仪表盘深色主题的遗留硬编码：`--border-light` 运行时已由 themeService 派生自当前主题 `panel.border`，其余仍是深色值，**浅色主题下不要直接依赖**。
- 业务代码不得读取 `ctx.runtime.tenantId` 做分支；租户信息一律来自自有后端会话（shared/auth-client）。

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
- **对比度**：正文与关键数字对底色 ≥ 4.5:1；muted 文字只承载辅助信息，不承载状态；浅色/深色主题都要过一遍。
- **数字排版**：所有指标数字 `font-variant-numeric: tabular-nums`；单位缩小一档。
- **图标**：一律 SVG 图标库（lucide），禁止 emoji 当图标。
- **三态齐全**：空态（带下一步 CTA）、加载骨架、失败重试，缺一不可。

**适用边界**（该技能中被裁剪、工作台扩展不适用的部分）：

- "独特字体、避免系统字体"——字体由平台主题统一，扩展禁止自带字体；独特性来自构图与排版层级，不来自字体；
- "每个产品独立配色"——扩展禁止发明配色，颜色一律走主题 token，品牌个性由平台主题承载；
- "粗暴主义/极繁/复古未来等大胆美学方向"——工作台美学方向已锁定"专业密集 B2B"，差异化靠 §1.8 的构图推导，不靠美学流派。

> 该技能自带的检索工具（`scripts/search.py`，配色/字体/UX 数据集）可用于**平台主题与门户页**的设计调研；工作台扩展开发用不到。
