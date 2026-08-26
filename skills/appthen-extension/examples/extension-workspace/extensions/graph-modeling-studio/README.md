# 关系图建模工作台（P3 扩展）

租户在 Workbench 里可视化定义 `graphmodel/v1` schema（节点类型 + 属性/索引、边类型 + 方向/基数），
点击「预览 DDL」或「应用建模」调用后端 `nest-server` 的 `/nebula-graph/models/{preview,apply}`。

- 多租户切换**不需要**扩展处理：`ctx.runtime.tenantId` 由宿主注入，后端从 token 推导并锁定专属 space。
- 后端地址走宿主同源机制：`window.__APPTHEN_API_BASE_URL__` → `import.meta.env.VITE_API_BASE_URL` → 相对路径。
- 鉴权：自动带 `Authorization: Bearer <ctx.auth.getAccessToken()>`。

## 目录
- `manifest.json` — 扩展声明（id `mengti.graph-modeling-studio`，apiVersion `1`）
- `src/index.tsx` — 入口：`activate(ctx)` 注册侧边栏 + 编辑器页签（建模画布）

## 本地开发（离线 Workbench，仅验证 UI）
在 examples 工作区根目录：
```bash
pnpm install        # 首次准备依赖（需可访问 npm）
pnpm dev            # 启动离线 Workbench，自动加载 extensions/* 含本扩展
```
打开后侧边栏出现「关系图建模」→「打开建模工作台」。

## 端到端测试（连真实后端）
要让「预览/应用」真正打到 `nest-server`，需让 Workbench 知道后端地址且会话已登录：

1. `nest-server` 已起（`NEBULA_*` 环境变量，默认 `127.0.0.1:9669` + `root/nebula`）。
2. 让扩展指向后端：在 examples 工作区根建 `.env`，写入
   ```
   VITE_API_BASE_URL=http://<nest-server 可达地址>:3000
   ```
   （dev Workbench 会用它作为 `import.meta.env.VITE_API_BASE_URL`；生产则由宿主 `window.__APPTHEN_API_BASE_URL__` 提供。）
3. 在**已登录**的 Workbench 中挂载本扩展（publish → install → mount，三步分离）。
4. 打开建模画布 →「加载示例」→「预览 DDL」应返回生成的 nGQL（不依赖 nebula-console 是否安装）；
   「应用建模」会在租户隔离 space 内执行（需服务器装好 `nebula-console` 或后续原生驱动）。

## 说明
- 本扩展位于 examples 开发工作区，便于快速验证；正式发布时走 `pnpm pack` → `pnpm publish -- --server <host> --tenant <id> --install-tenant`，再在目标 Workbench 挂载。
- 「预览 DDL」对应后端 `previewModel`：校验 + 生成 DDL + 语句守卫，**不执行**，适合无 Nebula 运行时时验证整条建模链（P1 规范 → P2 生成/守卫 → P3 UI）。
