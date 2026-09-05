# AppThen 扩展开发规范

这是 AppThen Workbench 外部扩展的详细规范。Agent 开发任务优先加载 `skills/appthen-extension/SKILL.md`，再按需查阅本文档；扩展开发应使用离线扩展工作区和稳定扩展契约 v1，不再使用旧的 `src/modules` 插件流程。

宿主或扩展变更的回归验收统一参考 [`docs/EXTENSION-RUNTIME-REGRESSION.md`](docs/EXTENSION-RUNTIME-REGRESSION.md)。

## 1. 快速开始

如果已经拿到工作区：

```bash
cd extension-workspace
pnpm install
pnpm doctor
pnpm dev
```

如果使用已发布的 CLI：

```bash
pnpm dlx @appthen/vibe-workspace init extension-workspace --template full
cd extension-workspace
pnpm install
pnpm dev
```

`pnpm install` 是首次准备依赖的步骤。依赖缓存准备好后，`dev`、`validate`、`test`、`build` 和 `pack` 不依赖 marketplace，可以离线完成。

如果同时修改 `@appthen/vibe-workspace` 本身，不要为了本地调试发布 npm。可以在 SDK 仓库运行 `pnpm run build:lib -- --watch`，然后从扩展工作区运行：

```bash
pnpm dev -- --package-root /path/to/vibe-workspace
```

`--package-root` 会让本地 Workbench、扩展构建、打包和模板运行时使用指定目录的 `dist`。例如：

```bash
pnpm dev -- --package-root /path/to/vibe-workspace
pnpm build -- --package-root /path/to/vibe-workspace
pnpm pack -- --package-root /path/to/vibe-workspace
```

只有要交付给其他开发者时才发布 npm。
调试 SDK 改动时必须先在该目录运行 `pnpm run build:lib`，再重启扩展 Workbench；如果默认端口被占用，要打开命令输出的实际端口，不要继续使用旧的 `5177` 页面。

SDK 的 `dist` 同时包含运行时代码和 `dist/vibe-workspace.css`。两者必须来自同一次构建；如果只更新了 JS 而继续使用旧 CSS，抽屉的响应式定位类可能缺失，表现为桌面抽屉残留在底部或右下角。`pnpm pack` 和 `pnpm publish` 会自动执行 `pnpm run build:lib`。

## 2. 工作区结构

```text
extension-workspace/
├── AGENTS.md
├── README.md
├── package.json
├── appthen-extension-workspace.json
├── extensions/
│   └── acme.example/
│       ├── manifest.json
│       └── src/index.tsx
└── themes/
```

一个工作区可以同时开发多个扩展。每个 `extensions/*/manifest.json` 都是一个独立扩展入口。

## 3. 标准命令

```bash
pnpm doctor       # 检查依赖、配置、扩展和标准脚本
pnpm dev          # 启动完全离线的本地 Workbench
pnpm validate     # 校验所有 Manifest 和扩展 ID
pnpm test         # 本地 smoke test：校验、构建、打包、入口和完整性
pnpm build        # 构建 UMD 运行时产物
pnpm pack         # 生成 .appthen-extension.json 包
```

可以通过扩展 ID 只操作一个扩展：

```bash
pnpm test -- acme.example
pnpm build -- acme.example
pnpm pack -- acme.example
```

## 4. Manifest v1

```json
{
  "id": "acme.example",
  "name": "Example Extension",
  "version": "0.1.0",
  "manifestVersion": 1,
  "apiVersion": "1",
  "main": "./src/index.tsx",
  "sourceType": "umd",
  "icon": "data:image/svg+xml,%3Csvg ...%3E%3C/svg%3E",
  "runtime": {
    "sidebarViewId": "sidebar.acme.example"
  },
  "mcp": {
    "enabled": true,
    "uiResources": [],
    "frontendTools": []
  }
}
```

稳定字段：

- `id`：全局稳定扩展 ID，建议使用反向域名格式。
- `version`：用于发布和安装版本识别。
- `main`：源码开发时指向入口；`build` 后会自动改成 bundle 入口。
- `manifestVersion` / `apiVersion`：当前都必须分别是 `1` 和 `"1"`。
- `sourceType`：当前稳定运行时使用 `umd`。
- `runtime.sidebarViewId`：声明扩展侧边栏视图；它同时也是活动栏入口的唯一来源——未声明该字段的扩展不会出现在活动栏，`installed` 只表示挂载、不产生入口。
- `runtime.autoActivate`：只用于必须在 Workbench 启动时注册的扩展能力，普通扩展不要开启；纯能力型扩展（无模块首页，见 §5「能力型扩展」）必须开启它，否则挂载后没有任何激活触发点，能力不会生效。
- `accessPolicy`：声明扩展自身的访问策略，会与租户和工作台策略合并。
- `icon`：侧边栏和移动端导航图标。v1 使用小型 `data:image/svg+xml` 或 HTTPS 图片 URL；暂不支持从扩展包引用相对路径静态资源。

图标建议使用不超过 32x32 的单色或双色 SVG data URL。需要多文件图片、字体或本地资源目录时，先上传到可信 CDN，再把 HTTPS URL 写入 Manifest；这样不会引入未定义的资源打包和 CDN 路径问题。

## 5.1 工作台主题

主题属于 Workbench 配置，不属于扩展激活副作用。离线工作区可以在 `themes/*.json` 定义主题，并在 `appthen-extension-workspace.json` 指定默认主题：

```json
{
  "devWorkbench": {
    "theme": "acme.sales"
  }
}
```

`pnpm dev` 会自动加载 `themes/` 下的 JSON。主题可通过 `extends` 继承 `vercel`、`dracula` 等内置主题；设置菜单中的主题替换会写入浏览器 localStorage，刷新后仍会保留。修改主题文件后重启 `pnpm dev` 以重新载入。

## 5. 编写扩展

入口使用 `activate(ctx)`，并返回清理函数：

```tsx
import type { PluginContext } from '@appthen/vibe-workspace/plugins/base';

function Sidebar() {
  return <div>Extension sidebar</div>;
}

export function activate(ctx: PluginContext) {
  return ctx.capabilities.registerSidebarView({
    id: 'sidebar.acme.example',
    title: 'Example Extension',
    component: Sidebar,
  });
}
```

实际扩展通常会同时注册侧边栏和编辑器页签：

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
  key: 'members',
  props: { filter: 'active' },
});
```

### 能力型扩展（无模块首页）

有些扩展不提供业务首页，只向 Workbench 注册能力：画布节点类型、编辑器 provider、菜单贡献等（例如思维导图节点、流程画布节点）。这类扩展的形态是：

- manifest 不声明 `runtime.sidebarViewId`，因此不出现在活动栏、不占用入口，挂载后静默提供能力；
- 必须声明 `runtime.autoActivate: true`，否则没有可点击的入口，能力永远不会被激活；
- `activate` 里只注册能力，不注册侧边栏视图。

```json
{
  "id": "acme.canvas-nodes",
  "name": "Acme Canvas Nodes",
  "version": "0.1.0",
  "manifestVersion": 1,
  "apiVersion": "1",
  "main": "./src/index.tsx",
  "sourceType": "umd",
  "runtime": { "autoActivate": true }
}
```

有完整业务面的扩展不要用这个模式：模块主面板应注册为侧边栏视图（模块首页），否则用户没有任何途径进入模块。

## 6. 稳定 API

优先使用以下 API：

- `ctx.capabilities.registerSidebarView`
- `ctx.capabilities.registerEditorView`
- `ctx.capabilities.registerContribution`
- `ctx.capabilities.registerFrontendToolHandler`
- `ctx.views.openEditor`
- `ctx.views.closeEditor`
- `ctx.links.create`
- `ctx.links.createAbsolute`
- `ctx.links.open`
- `ctx.runtime`
- `ctx.auth`

不要依赖以下宿主内部 API：

- `extensionRegistry`
- `eventBus`
- `workspaceEditorService`
- view ID 字符串前缀推断
- 旧的 `open` 查询参数

外部扩展不应注册或打开 `mainView`。完整业务页面统一用编辑器页签承载。

## 7. 路由和页签

扩展视图必须使用稳定 `routeKey`。页签的 `props` 只能包含可序列化数据；同一个逻辑资源必须使用稳定 `key`，避免重复页签。

```tsx
const link = ctx.links.createAbsolute({
  extensionId: 'acme.example',
  viewId: 'members',
  extensionParams: { subjectId: 'subject-001' },
});
```

不要手工拼接租户 ID、工作台 ID、扩展 ID和查询参数。系统工作台和租户自定义工作台的 URL 结构由宿主处理。

## 8. 移动端和工作区布局

桌面端可使用“导航 + 列表 + 详情”的多栏工作区：

- 导航区负责视图、部门和分类。
- 列表区负责搜索、筛选和结果浏览。
- 详情区负责对象资料和对象级操作。

窄屏不要把多栏简单纵向堆叠：

- 扩展导航放进 Workbench 侧边抽屉。
- 主区域先展示列表。
- 点击对象后切换到全屏详情。
- 详情必须提供返回列表，返回后保留筛选、搜索和选中状态。
- Workbench 移动断点是 `<768px`，手机和窄平板都必须按移动规则验证。
- 工作台侧边浮层从底部打开，默认约占 `80%` 高度，可调整到 `30%` - `95%`。
- 浮层关闭时只隐藏，不卸载扩展视图；返回列表或重新打开面板时，应由组件自身保留滚动和局部状态。
- 不要监听 `scroll` 事件并把滚动位置同步到 React state；优先通过持续挂载实现恢复。

可运行参考在离线工作区 Workbench Kit 的“多栏工作区与移动端折叠规范”页签。

## 9. Dialog、Drawer 和沙箱

- Dialog 用于确认、创建、编辑和权限变更等聚焦任务。
- Drawer 用于详情、筛选、分享和配置等上下文任务。
- 优先从 `@appthen/vibe-workspace/overlay` 引入共享组件。
- 基础 UI 从 `@appthen/vibe-workspace/ui` 引入 `Workbench` 前缀组件；不要从 `src/components/ui` 或其他宿主内部路径导入。
- 面向 Coding 风格的企业协作扩展可从 `@appthen/vibe-workspace/coding-kit` 引入 `Coding*` primitives/patterns，并同时引入 `@appthen/vibe-workspace/styles.css`，在业务根节点使用 `.coding-kit`。
- 公共组件、模板和验证标准以 [`docs/UI-CONTRACT.md`](docs/UI-CONTRACT.md) 为准，Workbench Kit 负责提供可运行示例。
- `WorkbenchDrawerContent side="right"` 在桌面端从右侧打开，在移动端默认切换为底部半屏；只有确有需要时才通过 `mobileSide` 覆盖方向。
- 抽屉内容区使用 `min-h-0 flex-1 overflow-y-auto`，标题和操作区保持 `shrink-0`，避免内容挤出边界。
- 表单字段组和操作按钮组必须显式使用 `gap-2` / `gap-3` / `gap-4`；不要依赖相邻元素默认产生间距。
- 输入、选择器和按钮必须具备 `min-width: 0`、`max-width: 100%` 等收缩约束，不能溢出弹窗或抽屉。
- 复杂完整页面使用编辑器页签，不要塞进 Dialog 或侧边栏。
- `remoteHtml` 和 iframe sandbox 仍是实验性能力，不属于稳定 v1 默认模式。

### UI/UX Review Checklist

其他 agent 复盘已有扩展时，至少逐项检查：

1. 桌面、窄平板和手机是否分别验证过，而不是只缩放桌面截图。
2. 多栏页面是否遵循“导航抽屉 -> 列表 -> 全屏详情”，没有把详情追加到列表底部。
3. 返回列表后筛选、搜索、选中项和滚动位置是否保持；禁止用高频 `scroll` 监听实现。
4. Dialog/Drawer 是否使用共享 Overlay，标题、内容滚动区、Footer 是否有稳定布局。
5. 表单控件和按钮是否有明确间距，长文本和输入框是否不会溢出。
6. 同一资源重复打开是否只产生一个稳定页签，路由能否恢复扩展和资源状态。
7. 侧边栏图标、主题、空状态、加载状态和错误状态是否符合 Workbench token。

## 10. 发布、安装和挂载

这三个动作是不同的：

1. **发布**：上传 CDN 并更新租户扩展记录。
2. **安装**：把某个版本加入租户扩展池。
3. **挂载**：在具体 Workbench 配置中选择扩展，并配置可用范围和权限。

默认发布不会自动安装和挂载：

```bash
APPTHEN_TOKEN="..." pnpm run publish -- \
  --server http://127.0.0.1:1626 \
  --tenant "tenant-id" \
  --tag dev
```

发布并安装到租户扩展池：

```bash
APPTHEN_TOKEN="..." pnpm run publish -- \
  --server http://127.0.0.1:1626 \
  --tenant "tenant-id" \
  --install-tenant \
  --tag dev
```

`--workbench` 是单工作台隔离的兼容路径，默认租户流程不要使用。Token 只通过环境变量或安全凭证注入，不要写入代码、Manifest、README 或提交记录。

## 11. Definition of Done

提交扩展前必须满足：

- `pnpm doctor` 通过。
- `pnpm validate` 通过且无重复扩展 ID。
- `pnpm test` 通过。
- `pnpm pack` 生成包并包含运行时入口和 integrity。
- 离线 Workbench 可以加载侧边栏和编辑器视图。
- 同一资源重复打开不会产生重复页签。
- 分享链接可以恢复扩展和资源状态。
- 手机和窄平板布局已验证。
- 发布、租户安装、工作台挂载和权限配置已经明确区分。

## 12. 排查

### `appthen-extension: command not found`

通常是工作区尚未安装依赖：

```bash
pnpm install
pnpm doctor
```

### CORS 或 API 请求失败

离线 Workbench 不会自动代理任意业务 API。确认开发服务地址、CORS、认证 Token 和当前租户上下文；不要把本地 API 地址硬编码进扩展。

### 扩展能发布但工作台看不到

检查是否已经安装到租户扩展池，并在目标 Workbench 的应用配置中挂载扩展。发布记录、租户安装和工作台挂载不是同一个动作。

### 扩展按钮闪烁或重复请求

确认扩展没有在每次组件渲染时重复注册能力，`activate` 只注册一次，切换 Workbench 面板时复用已有实例。

### 本地调试加入后扩展面板空白或无入口

本地调试（`pnpm serve` → 扩展管理「本地调试」→ 加入工作台）依赖 serve 清单透传 manifest 的 `runtime` 字段。两种情况会出现空白或无入口：

- 声明是旧清单时期加入的，缺少 `runtime`：在「本地调试」面板中移除后重新加入，声明即带上最新 `runtime`；
- 扩展本身是能力型扩展（无 `sidebarViewId`），本就不该有入口：属于预期行为，见 §5「能力型扩展」。

### 修改 manifest 后 serve 不生效

`pnpm serve` 的 watch 只监听源码变更，不监听 `manifest.json`。修改 manifest（尤其是 `runtime` 字段）后必须重启 serve，再到扩展管理「本地调试」中移除并重新加入该扩展，新声明才会反映更新后的 `runtime`。
