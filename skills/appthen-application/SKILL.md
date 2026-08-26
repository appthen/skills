---
name: appthen-application
description: 当用户想在现有系统里"直接做一个页面/组件/内容页（手册、知识库、指南）"而不新建项目，或反馈"页面改完不更新/打不开/报错"时，使用本技能。典型用户说法："帮我做个 XX 页面""我要个填表单的界面""给系统加个列表页""做个产品手册页面""这个页面能直接做出来吗"。用户不用懂技术细节，做完能在浏览器直接打开使用。
---

# AppThen VFS 界面开发

## 目标

把 Agent 的交付方式固定为：

1. 读取 AppThen 项目空间现状。
2. 使用 AppThen CLI 校验待写入的 TSX，并写入远程 VFS 文件。
3. 读取 VFS 写入响应中的转换/规范诊断。
4. 依赖服务端自动完成 TSX 转换、路由更新和 runtime build。
5. 返回一个浏览器可以直接打开的 runner 链接。
6. 用真实 runner 结果作为最终证明。

当用户要求制作手册、知识库、指南或其他内容型页面时，交付目标还包括：

7. 把内容组织成可扫描、可检索、可操作的页面，而不是只堆叠长段落。
8. 至少提供目录/主题导航、当前主题状态和一个能降低重复查找成本的交互（例如搜索、筛选、收藏或复制）。
9. 在桌面和窄屏宽度检查标题、表格、按钮和长文本，确保内容不溢出或互相遮挡。

不要为验证页面新建本地 Vite、Webpack、Next.js 项目。AppThen 项目空间本身就是开发与运行环境。

## 术语

- **项目空间**：面向用户的产品语义。它不仅包含应用页面和组件，也可以承载文档、文件、媒体资源和后续协作上下文。
- **`projectId`**：当前后端、VFS、runtime build 的底层字段名。对 Agent 和接口保留，对用户表达时尽量说"项目空间"。
- **workspace**：更上层的协作/工作台语义；不要把它和底层 `projectId` 混成同一个词。

## CLI 参数速查（CLI 1.3.1+）

不同命令的项目空间参数标志不统一，统一用短选项 `-p <projectId>` 最安全：

| 命令 | 短选项 | 长选项 | 备注 |
|------|--------|--------|------|
| `vfs-read` | `-p` | `--id` | 不接受 `--project-id` |
| `vfs-write` | `-p` | `--id` | 不接受 `--project-id` |
| `vfs-readdir` | `-p` | `--id` | 不接受 `--project-id` |
| `project-manifest-read` | `-p` | `--id` | 不接受 `--project-id` |
| `project-dependency-list` | `-p` | `--project-id` 和 `--id` 均可 | 两个长选项都接受 |
| `install` | - | `--project-id` | 无短选项 `-p` |
| `uninstall` | - | `--project-id` | 无短选项 `-p` |
| `runtime-build-task-list` | `-p` | `--id` | |
| `runtime-build-task-get` | - | `--task-id` | 用任务 ID，不是 projectId |
| `runtime-artifact-verify` | `-p` | `--id` | |
| `workbench-space-list` | - | `--tenant-id`（必填） | |
| `workbench-space-template-list` | - | `--tenant-id`（必填） | |
| `workbench-space-create` | - | `--tenant-id`（必填） | |
| `init-space` | - | `--project-id` | 绑定目录到项目空间 |

**重要**：VFS 命令（`vfs-read`/`vfs-write`/`vfs-readdir`/`project-manifest-read`）在 CLI 1.3.1 中**不会**自动从 `.appthen/space-config.json` 或 `APPTHEN_PROJECT_ID` 环境变量解析 projectId。必须显式传 `-p <projectId>`。

`project-dependency-list` 和 `install`/`uninstall` 可能支持从 space-config.json 自动解析，但建议始终显式传参以确保稳定。

如果 `vfs-read`、`vfs-write` 或 `vfs-readdir` 返回 `403 Project tenantId is required for VFS access`，这表示项目空间记录本身没有绑定租户，不能靠给 VFS 命令追加 `--tenant-id` 修复（这些命令不接受该参数）。立即停止页面读写和重复重试，报告项目空间需要迁移或改用已绑定租户的新项目空间；只有 `workbench-space-*` 命令使用 `--tenant-id`。

## 使用前提

普通用户不应该被要求理解 `projectId`、token、workspaceId。它们是运行上下文，不是产品需求的一部分。

用户可以这样表达：

- "帮我做一个销售看板应用，能直接打开预览。"
- "把当前页面改成一个类似 macOS 的 Web OS。"
- "新增一个 `/crm-dashboard` 页面，展示客户、商机和待办。"
- "做一个可以给客户演示的库存管理小应用。"

Agent 应先自动查找上下文；只有找不到项目空间或无权限时，才向用户要连接信息。

底层执行需要这些连接信息：

- CLI：`server`、`projectId`、可用 token，必要时还有 `workspaceId` 和 `workspaceName`。
- runner：本地通常是 `http://localhost:5173/#/<route>`；线上通常是 `<project>.run.appthen.com/#/<route>`。

如果没有 runner 地址，仍然可以完成 VFS 写入和构建验证，但最终输出要明确"缺少浏览器渲染证明"。

## 上下文发现顺序

不要第一步询问用户 `projectId`。按顺序尝试：

1. 读取当前 Agent 会话、AppThen CLI 配置或运行上下文中的 project/workspace。
2. 读取当前目录下的 AppThen workspace 配置（`.appthen/space-config.json`）获取 `projectId`。
3. 使用 AppThen CLI 的现有登录上下文；不要用 `cat` 或其它命令输出 `~/.appthen/credentials.json` 的原始内容。只有在确实需要诊断时，读取并输出脱敏后的 `apiBaseUrl`、token 是否存在和 `tenantId` 是否可用，不得输出 JWT、手机号或其它凭证字段。
4. 从用户已给出的 `appthen terminal-agent ...` 命令中提取参数。
5. 从当前打开的 runner/editor URL 推断 project 和 route。
6. 仍然无法确定时，只问一个业务化问题："要在哪个 AppThen 项目空间里创建这个应用？"

token 缺失或过期时，只说明"需要登录或授权当前项目空间"，不要在最终回复里输出 token。

如果当前没有可用项目空间，Agent 应自己判断是选择已有项目空间、克隆模板项目空间，还是创建新项目空间。详见 `references/project-context.md`。

CLI 已提供项目空间语义命令：

- `appthen workbench-space-list --tenant-id <tenantId>`：列出当前 tenant 下 Workbench 可见的项目空间。
- `appthen workbench-space-template-list --tenant-id <tenantId> --template-type web|app`：列出可克隆的项目空间模板。
- `appthen workbench-space-create --tenant-id <tenantId> --name <name> --template-id <templateId>`：从模板或源项目空间创建新项目空间，并验证它能被 Workbench 列表查到。

Agent 执行时只使用 AppThen CLI 这一条路径，不让用户选择其它执行入口。CLI 在调用项目空间能力前，应先进入目标 tenant 上下文，并携带服务端返回的兼容 `Client` 头。这个细节对用户无感；不要让用户直接理解或调用 `/editor/cloneProject`。

## 工作流

### 1. 先读项目空间，不要直接写

优先读取：

- 项目空间 manifest 或等价信息：依赖、页面、runtime builds。
  ```bash
  appthen project-manifest-read -p <projectId> --frame web --format summary
  ```
- `/src/pages` 目录：确认目标页面和路由。
  ```bash
  appthen vfs-readdir -p <projectId> --path /src/pages --format summary
  ```
- 目标页面源码：确认当前 `@type`、`@route`、`@frames`、`@clients`。
- 相关 util/component 文件：确认 import 真实存在。

如果任务是新建页面，先选择不会冲突的 route，例如 `/agent-demo`。

### 2. 写入 TSX 页面

新建 AppThen 页面时，文件必须包含页面元信息：

```tsx
/**
 * @type Page
 * @route /agent-demo
 * @frames web
 * @clients web
 */
```

写入规则：

- 真实保存使用 `preview=false` 或等价参数。
- 如果只想让编辑器预览合并结果，才使用 `preview=true`。
- 创建新页面后必须确认项目空间路由已更新，而不仅是文件写入成功。
- 修改 util 或 runtime component 后，必须确认页面使用的是最新构建产物。
- 多行 TSX 优先写入临时文件后用 `appthen vfs-write -p <projectId> --file <file> --path /src/pages/xxx.tsx`，不要用 shell 内联 `--content` 传大段代码。

### Web UI 默认规范

当页面目标是 `@frames web` 时：

- 默认使用原生 HTML 元素和 Tailwind CSS：`div`、`section`、`span`、`p`、`img`、`button` 等。
- 不要默认导入或使用 `@appthen/react` 的 `View`、`Text`、`Image`。
- 优先使用 `className` 表达布局、间距、颜色、边框、响应式和状态样式。
- `space-x-*`、`space-y-*` 依赖兄弟选择器，必须保留为 `className`，不要改写成父节点的 inline style。
- 仅在样式值必须由运行时数据决定时使用内联 `style`。
- 图标优先使用已安装的 `lucide-react`（`import { Flask, Microscope } from 'lucide-react'`）；表格、表单、弹窗等复杂业务控件按需使用项目已有的 `antd` / `@appthen/antd`。

当目标是 `@frames app`，或用户明确要求 Web/App 跨平台复用时，才考虑使用 `@appthen/react` 原子组件。

### 内容型页面与手册规范

对手册、知识库、指南和 SOP 页面，默认采用“导航 + 主内容 + 快速操作”的信息架构：

- 顶部提供页面名称、更新时间/适用范围等上下文，以及搜索或筛选入口。
- 侧栏或横向目录展示主题分组；当前主题必须有明确的激活状态，并支持点击切换。
- 主内容优先使用短段落、步骤、规则表、示例和可复制的行动清单；每个主题都有清晰的标题层级。
- 关键信息用状态标签、边框、图标或强调色区分，但避免把整页做成装饰性卡片墙。
- 搜索、复制、收藏、展开/收起等操作必须有真实状态反馈；不能只放一个没有行为的装饰按钮。
- 中文内容使用自然、具体的产品文案，避免生成“这里可以……”式占位说明。

手册页默认使用稳定的本地静态数据和页面内状态，不为一次性展示引入后端接口；如果内容需要多人维护，再单独设计数据来源。

### LC Document 根组件硬约束

页面根类 `Document` 不允许定义 `constructor`。不要写 `constructor(props)`、`super(props)` 或在构造函数中初始化 state；这会被 TSX → LC Document 转换器拒绝，导致 VFS 写入失败。

使用类字段初始化状态，并直接定义生命周期方法：

```tsx
class IState {
  activeTab: string;
  rows: any[];
}

class Document extends React.Component<IProps, IState> {
  state = {
    activeTab: 'overview',
    rows: [],
  };

  componentDidMount() {
    // 初始化逻辑
  }
}
```

注意：不要写 `state = new IState()`；不要给 `IState` 字段写数组或对象字面量默认值；`render()` 内的局部 `const/let` 不要写 TypeScript 类型注解，例如不要写 `const rows: Row[] = []`。

页面 `import` 与 `Document` 根类之间不要声明或依赖模块级 `const`、`let`、`var`、`function` 或运行时副作用；当前转换器可能丢失这些声明。共享数据和工具函数请放入 `/src/data/*.ts` 或 `/src/utils/*.ts` 后通过 import 使用，页面方法请定义为 `Document` 的 class method 并显式使用 `this.methodName()`。

当前转换器支持 `Document` 类方法返回 JSX。不要因为旧规则或 `check-tsx` 的 "只有 render() 方法可以包含 JSX" 规则而禁止类方法 JSX，也不要把页面主体改成 `data-native` 等绕过标记；写入前必须用实际 CLI/VFS 结果验证该能力。

### 3. 写入前校验与服务端诊断

TSX 写入必须遵循以下顺序：

1. 将待写内容保存到临时 `.tsx` 文件，运行 `appthen check-tsx -f <file> --format json --exit-on-error`。
2. `check-tsx` 失败时停止写入，先修复报告中的问题。不要用通用 Babel parser、`tsc` 或临时 Vite 项目替代 AppThen 校验。
3. `check-tsx` 通过后执行 `appthen vfs-write -p <projectId> --file <file> --path /src/pages/xxx.tsx`；服务端 VFS 的转换和规范结果是最终裁决。
4. 必须完整检查写入响应中的 `success`、`data.isChanged`、`data.isNewFile`，以及 `error`、`message`、`validation`、`report`、`details` 等字段。
5. HTTP 失败、`success=false`、转换失败或响应包含规范错误时立即停止，不进入 runtime build 或 runner 验证；把服务端原始诊断带入修复过程，不要只报告"写入失败"。
6. 对 `.ts` 数据/工具模块不强行套用页面 TSX 规则，但仍要检查 VFS 响应和后续 runtime build。

`appthen check-tsx` 是写入前的快速反馈，不是服务端转换器的替代品。CLI 1.3.1 的 `check-tsx` 包含一条 "只有 render() 方法可以包含 JSX" 规则，但服务端 VFS 转换器实际支持 `Document` 类方法返回 JSX。如果 CLI checker 与当前服务端已支持能力冲突（例如类方法 JSX），记录具体 checker 规则并以服务端 VFS 结果为准，不要为了通过旧 checker 改写正常源码。

### 4. 等待自动构建

写入 TSX 页面、runtime component 或被页面依赖的 util 后，优先等待自动 runtime build。

不要默认手动 enqueue。只有当自动构建没有触发，并且已经确认路径、文件类型和写入结果正确时，才把手动触发作为排障动作。

查询构建状态：
```bash
appthen runtime-build-task-list -p <projectId> --format summary
```

对于有交互的页面，构建成功后还要验证至少一条关键用户路径：例如输入关键词后列表收敛、切换主题后内容更新、点击复制后出现成功反馈。验证应使用真实 runner DOM/浏览器行为，不用 Node 伪 DOM 代替。

### 5. 验证闭环

按强度从弱到强收集证据：

1. VFS 写入成功。
2. VFS 回读源码正确。
3. 新页面在目录或路由列表中出现。
4. runtime build task 状态为 `succeeded`。
5. bundle 和 manifest HTTP 状态为 `200`。
   ```bash
   appthen runtime-artifact-verify -p <projectId> --format summary
   ```
6. runner 链接能打开，页面渲染出本次改动的关键内容。

最终回复优先给用户 runner 链接，而不是只给 bundle 或 manifest 链接。

## UI 视觉质量基线(强约束)

> VFS 写入和 runtime build 跑通 ≠ 页面"好看"。每个扩展页面交付前必须满足以下视觉质量基线。
> 详细方法和案例: `references/ui-design-quality.md`。

### ★ 目标定位:奇点是"手段",大厂级视觉+UX 才是"成功标准"

本基线的真正目标,**不是**"0 硬编码色值 / 0 vscode-*"本身——那是"奇点"工作要消除的干扰(主题系统曾让 AI 创作变成手撸),只是让 AI 不被 token 海洋淹没的**前提条件**。

真正的成功标准是:**交付"大厂级"产品 UI——视觉上像 Linear / Vercel / Stripe / Notion 这类现代 SaaS 产品,交互上具备可预期、有反馈、可达、容错的 UX。**

- **奇点 / 去硬编码 / 去 vscode-*** = 手段(消除创作负担,让 AI 像写普通 shadcn 项目一样轻松)
- **大厂级视觉 + 大厂级 UX** = 交付目标("5 条核心原则"是手段,"大厂级成功标准"才是验收)

具体大厂级验收清单见 `references/ui-design-quality.md` §0.1。

### 5 条核心设计原则(每次写 UI 前核对)

1. **找"奇点"**:诊断主题/组件/状态系统契约是否加重了 UI 创作负担,不要逐屏改样式
2. **优先语义类**:禁止硬编码 `#xxx` / `rgba(...)`,用 `bg-primary text-primary-foreground` / `bg-emerald-500` / shadcn 语义类
3. **优先 components/ui 元件**:禁止手写带 inline styled button/input/select,优先用 `Button` / `Input` / `Select` / `Card` / `Badge` / `Table` / `Dialog` / `Drawer`
4. **状态徽章用 Badge variant**:用 `<Badge variant="default|secondary|outline|destructive">` 替代 rgba 半透明状态背景
5. **举一反三**:发现 bug 时问"是不是通用问题"(例:Vercel 按钮文字消失 → 硬编码 `onPrimary='#FFFFFF'` 是通用问题,所有浅色 primary 主题都会出错)

### ★ 心智模型(最重要)

**把这个项目当普通 shadcn 项目来写,忘记"主题系统"的存在。** 直接写 shadcn 语义类 + components/ui 元件,主题切换/颜色跟随会自动处理。**不要写 `--vscode-*`、不要写颜色值、不要手写样式** —— 这些是历史遗留。详细见 `references/ui-design-quality.md` 顶部「心智模型」一节。

### 提交前必跑的量化检查

```bash
# 1. 硬编码色值数(应为 0)
grep -cE "#[0-9a-fA-F]{3,6}|rgba\(" <file>

# 2. vscode-* 引用数(应为 0)
grep -c "vscode-" <file>

# 3. React.CSSProperties 内联样式对象数(应极少)
grep -c "React.CSSProperties" <file>
```

### 旧代码替换映射(仅改造含 vscode-* 的遗留代码时查,新代码不需要)
| 旧 | 新 | 用途 |
|---|---|---|
| `bg-vscode-panel` | `bg-popover` | 浮层面板 |
| `border-vscode-border` | `border-border` | 边框 |
| `text-vscode-text` | `text-foreground` | 主要文字 |
| `text-vscode-textDark` | `text-muted-foreground` | 次要文字 |
| `bg-vscode-itemActive` | `bg-accent` | 选中/激活态 |
| `bg-vscode-sidebar` | `bg-muted` | 默认背景 |
| `hover:bg-vscode-itemHover` | `hover:bg-muted` | hover 态 |
| `text-vscode-accent` | `text-primary` | 强调色 |

### 验证必做(在最终回复给用户 runner 链接之前)

- 用 chrome headless 截图当前页面(见 `references/ui-design-quality.md` §6)
- 若项目有主题系统,加 `?theme=<id>` 参数跑多主题截图
- 举一反三:发现一个 bug 就跑所有主题/类似屏,确认不是通用问题

## 关键约束

- 不把"写入成功"当作最终成功。
- 不把"runtime build 成功"当作最终成功。
- 不把 Node 伪 DOM 测试当作真实 runner 验证。
- 不创建临时前端工程来绕过 AppThen 运行链路。
- 不依赖旧 raw artifact；优先使用静态发布路径和 runner。
- 不在公开交付中暴露 token、内部任务卡、临时蓝图或本地绝对路径。
- 内容型页面不以“大段文字完整显示”为完成标准，必须验证导航和至少一项关键交互。

## 参考资料

按需读取，不要一次性加载全部：

- `references/workflow.md`：CLI 执行流程和输出格式。
- `references/project-context.md`：项目空间选择、模板列表、克隆模板和上下文缺失时的决策树。
- `references/dependencies.md`：项目空间依赖声明、UMD/ESM 配置和验证。
- `references/tsx-rules.md`：AppThen TSX 页面写法规则。
- `references/runtime-verification.md`：runtime build、artifact、runner 验证标准。
- `references/troubleshooting.md`：常见问题定位。
- `references/ui-design-quality.md`：UI 视觉与 UX 质量基线（大厂级验收清单、奇点心法、量化检查）。
