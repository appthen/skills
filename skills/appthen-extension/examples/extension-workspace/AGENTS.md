# AppThen Extension Agent Guide

这是 AppThen 扩展工作区。完整执行入口是仓库根目录的 `skills/appthen-extension/SKILL.md`；除非任务明确要求修改宿主，否则只修改本目录中的扩展、Manifest、主题和文档。

## 工作流

```bash
pnpm install
pnpm doctor
pnpm dev
pnpm validate
pnpm test
pnpm pack
```

`pnpm test` 是本地 smoke test，会验证 Manifest、Bundle、Package、运行时入口和完整性信息，不会上传服务端。

## 扩展契约

- 使用 `manifestVersion: 1`、`apiVersion: "1"`、`sourceType: "umd"`。
- 入口导出 `activate(ctx)`，并为所有注册和订阅返回清理函数。
- 使用 `ctx.capabilities.registerSidebarView` 注册侧边栏。
- 使用 `ctx.capabilities.registerEditorView` 和 `ctx.views.openEditor` 打开主区域页面。
- 编辑器视图必须提供稳定 `routeKey`，参数必须可序列化。
- 使用 `ctx.links` 生成分享链接，不要手工拼接 URL。
- 使用 `ctx.runtime` 和 `ctx.auth` 获取租户、工作台和当前操作者。

## 禁止事项

- 外部扩展不要使用 `registerMainView` 或 `mainView.open`。
- 不要依赖 `extensionRegistry`、`eventBus`、`workspaceEditorService` 等宿主内部 API。
- 不要使用旧的 `open` 查询参数。
- 不要把完整业务页面塞进侧边栏，完整页面使用编辑器页签。
- 桌面多栏页面在移动端不要简单纵向堆叠，应采用“导航抽屉 -> 列表 -> 全屏详情”。
- Workbench 移动断点是 `<768px`；侧边浮层在移动端从底部打开，详情和完整业务页面使用主区域页签或全屏详情。
- 关闭移动浮层时只隐藏，不销毁扩展视图；不要通过监听 `scroll` 事件记录滚动位置，优先依赖持续挂载保留状态。
- 基础 UI 从 `@appthen/vibe-workspace/ui` 引入 `Workbench` 前缀组件；Dialog 和 Drawer 也可以从该入口引入，旧扩展可继续使用 `@appthen/vibe-workspace/overlay` 兼容入口。
- 面向企业协作的扩展优先使用 `@appthen/vibe-workspace/coding-kit` 中的 `Coding*` primitives/patterns，并引入 SDK `styles.css`；不要复制 Coding Kit 的业务页面源码。
- `WorkbenchDrawerContent side="right"` 已默认适配为移动端底部抽屉，可用 `mobileSide` 显式覆盖。
- 不要给 `WorkbenchDrawerContent` 添加 `fixed`、`absolute`、`bottom-*`、`right-*`、`top-*`、`left-*` 或 `translate-*` 定位类；定位和响应式切换由宿主组件负责。
- 如果修改了 SDK 的 overlay 或样式，扩展调试前先在 SDK 目录运行 `pnpm run build:lib`，确保 `dist/vibe-workspace.css` 与 `dist` 中的运行时代码同步。
- 抽屉内容区使用 `min-h-0 flex-1 overflow-y-auto`，表单和操作区使用显式 `gap`，输入控件限制 `min-width: 0; max-width: 100%`。
- 控件高度吃平台默认档（Button/Input 默认 32px，平台 Chrome 28px）；不要在扩展 CSS 里写全局高度覆盖，特殊尺寸用 `size="sm"/"lg"` 显式传。完整尺度体系见 SDK 技能的 `docs/UI-CONTRACT.md`。
- 不要在代码或提交记录中写入访问 Token。

## 完成标准

- `pnpm doctor`、`pnpm validate`、`pnpm test`、`pnpm pack` 全部通过。
- 扩展可以在离线 Workbench 中打开和热更新。
- 同一资源重复打开不会产生重复页签。
- 分享链接可以恢复扩展和资源状态。
- 移动端已检查手机和窄平板宽度。

发布 CDN 和安装到租户属于在线操作，需要服务端地址、租户 ID 和短期 Token。发布后还需要在工作台配置中挂载扩展并设置权限。
