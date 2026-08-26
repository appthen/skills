# 项目空间上下文与模板选择

## 原则

用户只需要描述要做的应用或内容空间，不需要先理解项目空间 ID、模板 ID 或 token。

AppThen 早期以低代码应用开发为主，底层字段和接口仍大量使用 `project` / `projectId`。现在产品语义升级为“项目空间”：同一个空间不仅放应用页面和组件，也可以放文档、文件、媒体和协作上下文。Skill 对用户说“项目空间”，对接口仍使用 `projectId`。

Agent 要把“我要做一个应用”转换成下面三种起手方式之一：

1. 使用当前项目空间：适合用户正在某个项目空间或 runner/editor 中继续开发。
2. 选择已有项目空间：适合用户说“在某个已有应用里改”或上下文里有多个候选项目空间。
3. 克隆模板项目空间：适合用户说“新建一个应用”或当前没有项目空间。

只有三种方式都无法自动判断时，才追问用户。

## 当前已有后端能力

### 查询项目空间列表

当前已有接口：

```text
POST /editor/get
```

常用参数：

```json
{
  "currentPage": 1,
  "pageSize": 50,
  "keywords": "",
  "isDeleted": false,
  "queryList": true
}
```

用途：

- 列出用户/团队可见项目空间。
- 根据关键词查找已有项目空间。
- 给 Agent 做“选择已有项目空间”的候选集。

注意：

- Skill 不要把 `teamId` 暴露为业务参数。
- `teamId` 在当前 `/editor/get` 实现里是强过滤条件，不是上下文提示。
- `listWorkbenchSpaces({ tenantId })` 这类 wrapper 应先进入目标 tenant 上下文，再由 wrapper 内部决定是否使用 select 后的兼容 `default_team_id`。
- 如果产品语义是“当前 tenant 的项目空间”，wrapper 可以内部使用 `default_team_id`，以匹配 Workbench 当前列表行为。
- 如果产品语义是“我可见的所有项目空间”，wrapper 可以省略 `teamId`，依赖后端成员/团队权限过滤。
- 无论哪种策略，Agent 都不应该直接选择或拼接 legacy `teamId`。

### 查询项目空间模板

当前已有接口：

```text
POST /editor/get
```

常用参数：

```json
{
  "currentPage": 1,
  "pageSize": 50,
  "isTemplate": 1,
  "templateType": "web",
  "templateTab": "base",
  "queryList": true
}
```

用途：

- 列出可克隆的 AppThen 项目空间模板。
- `templateType=web` 适合网页/管理后台/看板。
- `templateType=app` 适合移动应用、小程序、H5。

注意：当前服务端对 `templateTab` 的过滤逻辑可能没有真正生效，Agent 不要强依赖它；可以在返回结果里用 `templateTags` 自己筛选。

### 克隆模板或项目空间

当前已有接口：

```text
POST /editor/cloneProject
```

从模板创建：

```json
{
  "templateId": "<templateProjectId>"
}
```

从已有项目空间复制：

```json
{
  "projectId": "<sourceProjectId>"
}
```

差异：

- `templateId` 表示从模板起一个新项目空间。
- `projectId` 表示复制一个已有项目空间，标题通常会带“副本”语义。

### 更新项目空间元数据

当前已有接口：

```text
POST /editor/save
```

常用参数：

```json
{
  "_id": "<newProjectId>",
  "title": "销售看板",
  "description": "Agent 创建的销售运营看板"
}
```

用途：

- 克隆后把“未命名”改成用户业务语义名称。
- 补充描述，方便后续项目空间列表识别。

## 不要混用的模板能力

`GET /material/templates` 返回的是 zip starter 模板，例如 Vite、Taro、backend-fastify。

它适合传统代码工程初始化，不适合作为 AppThen VFS 页面开发的项目空间模板入口。做“写 TSX 得 runner 链接”的应用开发时，优先使用 `/editor/get` 的 `isTemplate=1` 项目空间模板。

## Agent 决策树

### 用户在当前项目空间里继续开发

用户说：

```text
把当前页面改成销售看板。
```

处理：

1. 从 AppThen CLI 配置、session 或 URL 读取当前 `projectId`。
2. 读取 `/src/pages` 和 manifest。
3. 修改目标页面。
4. 返回 runner 链接。

### 用户指定已有项目

用户说：

```text
在“客户运营台”里加一个库存页面。
```

处理：

1. 用 `/editor/get` 按 `keywords=客户运营台` 查项目。
2. 如果唯一匹配，直接使用该项目空间。
3. 如果多个匹配，只让用户选择项目空间名称，不让用户填 ID。
4. 写入新页面并返回链接。

### 用户要新建应用

用户说：

```text
帮我做一个库存管理应用，能打开预览。
```

处理：

1. 用 `/editor/get` 查询 `isTemplate=1, templateType=web`。
2. 优先选择空白/基础模板：标题含“空白/blank”或 `templateTags` 包含 `base`。
3. 调用 `/editor/cloneProject`，传 `templateId`。
4. 调用 `/editor/save` 更新项目标题和描述。
5. 写入 `/src/pages/<route>.tsx`。
6. 等待 runtime build。
7. 返回 runner 链接。

### 用户明确要复制已有应用或项目空间

用户说：

```text
复制“销售驾驶舱”，然后改成给华东区用。
```

处理：

1. 用 `/editor/get` 查找“销售驾驶舱”。
2. 调用 `/editor/cloneProject`，传 `projectId`。
3. 调用 `/editor/save` 更新标题。
4. 在副本上继续改页面。

## CLI 语义封装

当前后端能力已经存在，Agent 不应长期直接拼 `/editor/get`、`/editor/cloneProject`、`/editor/save` 的细节。本 Skill 只使用 AppThen CLI 这一条稳定路径：

- `workbench-space-list` / `listWorkbenchSpaces`：列出当前 tenant 下 Workbench 可见的项目空间。
- `workbench-space-template-list` / `listWorkbenchSpaceTemplates`：列出 AppThen 项目空间模板。
- `workbench-space-create` / `createWorkbenchSpace`：从模板或源项目空间创建 Workbench 项目空间，并做列表可见性验收。
- `selectWorkbenchSpace`：把当前 Agent 会话绑定到某项目空间。

调用前提：

1. 先通过登录态或等价 wrapper 进入目标 tenant 上下文。
2. 后续 CLI 请求使用 tenant-scoped token。
3. 对旧 `/editor/*` 兼容链路，CLI 内部必须携带 select 后生成的 `Client` 兼容头。
4. 如果缺少兼容上下文，Agent 应自动重新进入 tenant 上下文，而不是让用户填写 `teamId`。

### CLI 命令示例

列出项目空间：

```bash
appthen workbench-space-list \
  --tenant-id <tenantId> \
  --keywords "客户运营台" \
  --format summary
```

列出 web 模板：

```bash
appthen workbench-space-template-list \
  --tenant-id <tenantId> \
  --template-type web \
  --format summary
```

从模板创建项目空间：

```bash
appthen workbench-space-create \
  --tenant-id <tenantId> \
  --name "销售看板应用" \
  --description "Agent 创建的销售运营看板" \
  --template-id <templateProjectId> \
  --format summary
```

从已有项目空间复制：

```bash
appthen workbench-space-create \
  --tenant-id <tenantId> \
  --name "华东区销售驾驶舱" \
  --source-project-id <sourceProjectId> \
  --format summary
```

Agent 可以从配置、登录态或用户已给出的命令中推断 `tenantId`。只有无法定位目标 tenant 或项目空间时，才询问用户；不要把 `teamId`、`roleId` 暴露给用户。

## 创建后的可见性验收

`cloneProject` 成功不等于项目空间创建成功。对 Agent/CLI 来说，创建闭环必须继续验证：

1. `/editor/cloneProject` 返回新 `projectId`。
2. `/editor/save` 已把 `title/description` 更新为用户输入。
3. 用同一 tenant 上下文调用项目空间列表。
4. 列表结果中能看到新 `projectId`。

如果第 4 步失败，不能把结果交付给用户。优先排查：

- CLI 是否先进入目标 tenant 上下文。
- CLI 后续请求是否使用了 select 后的新 token。
- CLI 后续请求是否带了旧 `/editor/*` 需要的 `Client` 兼容头。
- Workbench/CLI 的列表查询是否错误地把 legacy `teamId` 暴露成业务过滤条件。

用户真正关心的是“我在工作台里能看到这个项目空间并继续开发”，不是“底层 clone 接口返回成功”。
