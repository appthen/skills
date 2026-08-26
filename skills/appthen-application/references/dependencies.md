# 项目空间依赖管理

## Agent 使用方式

Agent 不修改 `/src/project.json` 或内部 `assets`，而是使用标准 npm 包语义。

### CLI 参数（CLI 1.3.1+）

不同命令的项目空间参数标志不统一，详见 SKILL.md 的 "CLI 参数速查" 表。核心要点：

- VFS 命令（`vfs-read`/`vfs-write`/`vfs-readdir`/`project-manifest-read`）：必须显式传 `-p <projectId>`，CLI 1.3.1 **不会**自动从 `.appthen/space-config.json` 或 `APPTHEN_PROJECT_ID` 环境变量解析。
- `project-dependency-list`：支持 `-p`、`--project-id`、`--id` 三种写法。
- `install`/`uninstall`：使用 `--project-id`，无短选项 `-p`。

**建议**：始终显式传 `-p <projectId>`（install/uninstall 传 `--project-id`），不要依赖自动解析。

刚创建或克隆项目空间后，可以绑定目录配置：

```bash
appthen init-space --project-id <projectId> --skip-prompts
```

`init-space` 生成 `.appthen/space-config.json`，但注意 CLI 1.3.1 的 VFS 命令仍需显式 `-p`。space-config.json 主要用于记录 projectId 供 Agent 读取。

安装依赖示例：

```bash
appthen install recharts@2.15.4 --project-id <projectId> --frame web
```

查询依赖列表：

```bash
appthen project-dependency-list -p <projectId> --frame web --format summary
```

卸载依赖：

```bash
appthen uninstall recharts --project-id <projectId> --frame web
```

## 真实安装模型

runtime build 会创建隔离 workspace，生成临时 `package.json`，然后执行：

```bash
pnpm install --ignore-workspace --ignore-scripts --no-frozen-lockfile
```

这不是用户项目根目录的 `pnpm install`：

- `project.assets` 是服务端内部资源投影，Agent 不直接操作；npm 依赖最终由 runtime build 安装并打进项目 bundle。
- `project.packages.web` 是兼容快照，Agent 不直接操作。
- 临时 `package.json` 由 runtime build 根据已安装依赖和源码依赖生成。

## 自动兜底

VFS 写入发现 npm 包 import 时，会复用显式 install 能力，不使用 npm 包白名单。registry 或构建失败返回结构化错误；未指定版本时使用 npm 的 `latest` 标签。

自动解析不是第二套协议，显式 install 和自动解析最终调用同一个后端依赖服务。

## 验证顺序

1. `project-dependency-list` 确认依赖状态为 `ready`。
2. 写入页面并回读源码，确认 import 和 `componentsMap`/`utilsMap` 正确。
3. 等待 runtime build task 为 `succeeded`。
4. 检查 runtime manifest 和 bundle 返回 `200`。
5. 打开 runner，确认真实页面渲染。
