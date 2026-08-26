# AppThen 扩展开发工作区示例

这个目录是离线开发扩展的起手式工作区。先安装一次依赖，之后开发、调试、构建和打包都不依赖 marketplace。

```bash
pnpm install
pnpm doctor
pnpm dev
```

其中包含以下本地示例扩展：

- `acme.workbench-kit`：标准 Workbench 扩展起手式，展示侧边栏视图、编辑器页签、前端工具、贡献点、UI 资源、主题契约，以及基于 `@appthen/vibe-workspace/coding-kit` 的 Coding 协作模板。
- `acme.remote-html-sandbox`：展示 `allow-scripts`、CSP 和宿主消息通信的实验性沙箱示例，用于评估后续隔离运行时，暂不建议作为生产扩展模式。

开发命令会启动离线 Workbench，并加载所有 `extensions/*/manifest.json`。Manifest 变化会重新生成本地 Workbench 入口，源码变化使用 Vite HMR。

打开侧边栏中的“远程 HTML 沙箱”可以查看 iframe 隔离边界。示例特意没有授予 `allow-same-origin`，该能力目前仍是实验性能力。

打开“工作台工具包”，点击“打开 Coding 协作模板”查看标准扩展页面。模板演示列表筛选、主区域详情、编辑抽屉、移动端返回和表单收缩；主题、弹窗与抽屉、多栏工作区等页签继续用于查看规范。示例只通过公开的 `@appthen/vibe-workspace/coding-kit`、`@appthen/vibe-workspace/overlay` 和 `@appthen/vibe-workspace/styles.css` 复用 SDK，不复制主项目私有 UI 实现。

本地验收：

```bash
pnpm validate
pnpm test
pnpm build
pnpm pack
```

发布只上传并更新租户扩展记录；要进入租户扩展池需要显式使用 `--install-tenant`，之后还要在工作台配置中挂载并设置权限。
