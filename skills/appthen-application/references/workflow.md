# 工作流参考

## 输入信息

不要要求普通用户在需求里手写这些字段。优先从用户给出的命令、环境变量、当前工作目录、AppThen CLI 配置或已打开页面中提取：

- `server`：例如 `http://127.0.0.1:1626`。从 `~/.appthen/credentials.json` 的 `apiBaseUrl` 读取。
- `projectId`：AppThen 项目空间的底层 ID。从 `.appthen/space-config.json` 的 `projectId` 或 `spaceId` 读取。
- `tenantId`：从 `~/.appthen/credentials.json` 的 token JWT payload 中提取 `tenantId`，或从 space-config.json。
- `workspaceId` / `workspaceName`：终端 Agent 或协作会话需要时使用。
- `token`：只用于请求，不要在最终回复中复述。从 `~/.appthen/credentials.json` 的 `authToken` 读取。
- `route`：如果用户指定页面路由，必须保留；否则创建明确、短、无冲突的新 route。

## 用户自然入口

用户可以只描述要做什么：

```text
帮我做一个销售看板应用，能直接打开预览。
```

Agent 应转换成内部执行目标：

```text
在当前 AppThen 项目空间中新建或修改 TSX 页面，写入 VFS，等待自动 runtime build，返回 runner 链接。
```

只有在无法定位当前 AppThen 项目空间时，才追问项目空间；不要一开始就要求用户提供 `projectId`。

## 推荐操作顺序

1. 读取项目空间 manifest 或项目空间摘要，确认依赖、页面和 runtime build 状态。
   ```bash
   appthen project-manifest-read -p <projectId> --frame web --format summary
   ```
2. 读取 `/src/pages`，确认页面文件和 route 是否存在。
   ```bash
   appthen vfs-readdir -p <projectId> --path /src/pages --format summary
   ```
3. 读取目标页面源码，确认是否是 `@type Page`。
   ```bash
   appthen vfs-read -p <projectId> --path /src/pages/xxx.tsx
   ```
4. 如果页面需要新 npm 包，先读取依赖列表；缺少时执行 `appthen install <package[@version]> --project-id <projectId> --frame web`。
5. 回读依赖状态，确认安装结果为 `ready`，不要修改 `packages.web` 或内部 `assets`。
6. 按任务写入页面、组件或 util 文件。
7. 对待写入的 `.tsx` 文件先运行 `appthen check-tsx -f <file> --format json --exit-on-error`；不要用 Babel/tsc 作为 AppThen 规范裁决。
8. `check-tsx` 通过后，多行 TSX 优先写入临时文件后用 `appthen vfs-write -p <projectId> --file <file> --path /src/pages/xxx.tsx`，不要用 shell 内联 `--content` 传大段代码。
9. 完整读取写入响应：`success`、`isChanged`、`isNewFile`、转换结果、`validation`、`report` 和错误详情。
10. 任一写入或服务端校验失败时停止，不继续假定文件已更新；保留原始诊断用于修复。
11. 回读文件，确认源码和 route 元信息正确。
12. 查询目录或路由，确认新页面已进入项目空间路由。
    ```bash
    appthen vfs-readdir -p <projectId> --path /src/pages --format summary
    ```
13. 等待并查询 runtime build task。
    ```bash
    appthen runtime-build-task-list -p <projectId> --format summary
    ```
14. 校验 bundle 和 manifest 是否可访问。
    ```bash
    appthen runtime-artifact-verify -p <projectId> --format summary
    ```
15. 打开 runner 链接验证真实渲染。

## CLI 执行入口

本 Skill 只使用 AppThen CLI 作为执行入口，不让用户在多种协议之间选择。

CLI 必须遵守完整闭环：项目空间创建/选择、VFS 写入、自动构建、runner 验证。

**CLI 1.3.1 注意**：VFS 命令（`vfs-read`/`vfs-write`/`vfs-readdir`/`project-manifest-read`）必须显式传 `-p <projectId>`，不会自动从 space-config.json 解析。

## 写入结果判断

写入响应中至少确认：

- `success=true` 或等价成功字段。
- `isChanged=true`，或者明确知道为什么内容未变化。
- 新文件有 `isNewFile=true` 或等价字段。
- 返回的 entry 中包含 route / url 时，优先记录。

失败响应也必须检查，不得只看 CLI 的进程错误摘要。优先保留服务端返回的 `message`、`error`、`validation`、`report`、`details` 和字段级错误；这些信息用于区分源码不合规、codeToSchema 转换失败、依赖安装失败和 runtime build 失败。

新页面创建后如果 runner 报 `No route matched`，优先怀疑项目空间路由没有更新，而不是 runtime bundle 不存在。

## 最终输出格式

完成后输出：

- 修改了哪些 VFS 路径。
- 页面 route。
- 本地 runner 链接，例如 `http://localhost:5173/#/agent-demo`。
- runtime build 状态和 task/buildHash 摘要。
- 浏览器验证结果；如果没验证，说明缺哪一步。
