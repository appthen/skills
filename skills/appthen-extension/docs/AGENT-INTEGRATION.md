# Agent 集成：把业务接给数字成员（人 ↔ agent ↔ 业务）

这是 [SKILL.md](../SKILL.md) 的配套规范：扩展做完界面之后，如何把**业务能力**接给会话里的数字成员（AI Agent），让用户在群聊里 @ 它即可查数据、发卡片、点开视图。

基线样例：`acme.customer-management`（CRM，sci-solution 工作区）——manifest、react 卡片组件、服务端 MCP（`sci-solution/server/src/modules/mcp`）都可以直接抄。

## 0. 心智模型

```
扩展 manifest 声明能力（capabilities.*）
   └─► 平台安装快照 ──► capabilityOverlay（按成员聚合）
          ├─► daemon：systemPrompt 自动追加「Extension Resources / Extension Cards / Extension Skills」段
          ├─► daemon：mcpServers 直连注入（含 toolApproval 审批声明）
          └─► 会话 UI：卡片渲染 / 资源 chip / openView 跳转
用户在会话 @ 数字成员 ──► agent 按提示词与工具干活 ──► 回卡 / 回资源链接 / 文字
```

你只负责：**声明能力 + 提供后端 MCP server + 写卡片组件（可选）+ 验收**。
提示词组装、工具注入、审批卡、凭证解引用全部由平台/daemon 自动完成——**不要手写给 agent 的提示词**。

## 1. 五张声明面速查（manifest.capabilities.*）

| 声明 | 干什么 | agent 侧怎么消费 | 关键约束 |
|---|---|---|---|
| `mcpServers[]` | 连你自己的业务 MCP server（读写业务数据） | daemon 直连；工具进 agent 工具列表；写工具可强制审批 | 需在该成员的**有效能力集**内；鉴权/租户由你的 server 自证 |
| `resources[]` | 业务对象资源（客户、订单、样品…） | ①@ 提及候选 ②会话内资源链接（chip → openView）③conversation-mcp `resources/read` | `openView.viewId` 必须是本扩展已注册的 Editor 视图 |
| `cardTemplates[]` | 消息卡片（react 组件卡 / adaptive-card） | agent 回发 `kind=card`；宿主把卡渲染进会话消息行 | react 组件必须是扩展入口**顶层导出** |
| `skills[]` | 领域技能（操作手册/口径），打包时固化 SKILL.md 内容 | 注入「Extension Skills」段，按需引用 | 内容是写给 agent 的，精炼、可执行 |
| `permissions[]` | 安装确认弹窗展示的能力说明 | —（面向人） | 与"成员有效能力集"是两回事 |

另外两条**前端轨**（按需，不要与上面混）：`mcp.frontendTools`（跑在扩展里的前端工具）与 `mcp.uiResources`（MCP Apps，工具结果渲染 UI）——见 §6。

## 2. 详细契约

### 2.1 mcpServers —— 让 agent 能读写业务数据（核心）

样例（CRM 摘录）：

```json
"capabilities": {
  "permissions": [
    { "name": "CRM 连接器", "description": "允许 daemon 直连本租户 CRM MCP server，读写客户数据；写工具需平台审批后执行" }
  ],
  "mcpServers": [
    {
      "serverId": "sci-crm-mcp",
      "label": "客户管理",
      "transport": "http",
      "url": "http://127.0.0.1:8002/mcp",
      "auth": "static-header",
      "headers": {
        "Authorization": "Bearer ${{secrets.crm.token}}",
        "X-Tenant-Id": "${{subject.tenantId}}"
      },
      "tools": ["crm_query_customers", "crm_get_customer", "crm_create_customer", "…"],
      "requiresConfirmationTools": ["crm_create_customer", "crm_update_customer", "crm_archive_customers"]
    }
  ]
}
```

要点：

- `serverId` 是注入 key 与审批配置的锚点；`url` / `headers` / `env` 的值可含 `${{ns.key}}` 占位符：
  - `${{secrets.*}}`：daemon 在调用前向平台 `credentials/resolve` 解引用（值只存密文、不进日志）。**默认档（`subjectRef`）凭证写在该成员的「创建者」主体名下**（工作台凭证管理；appId 用扩展 id）；写在该数字成员自己名下只有 `identityMode=self` 时才生效——与下方「调用身份三档」一致。
  - `${{subject.*}}`：平台侧解析（如 `subject.tenantId` 注入你的租户头）。
- **传输/鉴权首期形态受限**：平台当前只注入 `transport: "http"` + `auth: "none" | "static-header"`；`auth: "oauth"` 与 `transport: "stdio-proxy"` 会被跳过（不注入、不报错），按这两类声明会静默失效——接入前先确认形态。
- **你的 MCP server 必须自证安全**：自行校验 token、按租户头显式过滤；未配 token 建议 fail-closed（整体关闭 + 结构化错误，便于定位）。
- `requiresConfirmationTools`：即使会话是 auto-allow，被列出的工具也会**强制出审批卡**（用户在会话里点「允许/拒绝」）。
- **调用身份三档**（成员侧 `identityMode`，key 用注册表 id）：默认 `subjectRef`=成员创建者凭证；`self`=成员自己；`triggerer`=本次触发者。默认档下，把凭证写在与成员创建者一致的主体上最省心。
- **改 `mcpServers` 声明（url/headers/审批清单）或改凭证会自动生效**：两者的修订号已进 `configFingerprint`——下一条消息触发会话重建（N7 刷新链），无需手工清会话。注意**仅 `mcpServers` 与凭证进指纹**；`resources` / `cardTemplates` / `skills` 的声明改动不在此列（见 §5）。

后端实现建议（"人做的 AI 也做、行为一致"）：HTTP controller 与 MCP tools 调**同一份 service**；工具返回结构化错误而不是抛栈。

### 2.2 resources —— 业务对象（可 @、可点开、可读）

样例：

```json
"capabilities": {
  "resources": [
    {
      "resourceId": "acme.customer-management/customer",
      "uriTemplate": "crm://customers/{customerId}",
      "name": "客户",
      "description": "CRM 客户资源：可 @ 引用、消息可点开、agent 可经 resources/read 读取",
      "mimeType": "application/json",
      "cardTemplateId": "acme.customer-management/customer-card",
      "openView": { "viewId": "editor.acme.customer-management.list", "params": ["customerId"] },
      "sample": { "customerId": "1", "name": "示例机构客户" }
    }
  ]
}
```

要点：

- **三个消费面**：①@ 提及菜单（用 `name`）；②agent 回复里内联实例 URI → 会话渲染为可点资源 chip → 点击按 `openView` 跳扩展视图；③conversation-hub MCP 的 `resources/read` 读取——**当前返回声明里的 `sample`**；真实数据请走你自己的 MCP 工具（就地读真实数据属后续能力）。
- `openView.viewId` 必须是本扩展 `registerEditorView` 注册过的 id；`params` 列出"从 uriTemplate 取哪些参数传给页面"（参数以视图 props 传入，视图按需消费）。
- `cardTemplateId` 把资源绑定到一张卡（必须指向同 manifest 已声明的 `cardTemplates[].templateId`）——"资源出现即出绑定卡"的复用基础。
- `sample` 要有代表性（面板预览与兜底都会用它），**不要放敏感数据**。

### 2.3 cardTemplates —— 消息卡片

样例（react 轨道）：

```json
"capabilities": {
  "cardTemplates": [
    {
      "templateId": "acme.customer-management/customer-card",
      "format": "react",
      "version": "1.0.0",
      "componentId": "CustomerCard",
      "dataSchema": {
        "type": "object",
        "required": ["customerId", "name"],
        "properties": {
          "variant": { "type": "string", "enum": ["compact", "standard", "action"], "description": "卡片形态：compact 快速分享 / standard 默认 / action 有明确下一步时用" },
          "name": { "type": "string", "description": "客户名称（机构全称）" },
          "latestActivity": { "type": "string", "description": "最近跟进的业务语句，如『已发送方案，待确认预算』；无数据时如实写「暂无跟进」" }
        }
      }
    }
  ]
}
```

组件骨架（`src/components/CustomerCard.tsx` + 入口顶层导出）：

```tsx
// 入口：export { CustomerCard } from './components/CustomerCard';
export function CustomerCard({ data, onAction, context }: {
  data: Record<string, any>;
  onAction?: (action: unknown) => void;
  context?: Record<string, any>;
}) {
  return (
    <div>
      {/* 卡本体：只画内容；外壳（会话消息行容器）由宿主接管 */}
      <button onClick={() => onAction?.({ type: 'Action.Submit', data: { action: 'open', customerId: data.customerId } })}>
        查看客户
      </button>
    </div>
  );
}
```

规则：

- **react 组件必须是扩展入口的顶层导出**：`export { CustomerCard } from './components/CustomerCard';`——宿主按 `sourceExtensionId + componentId` 解析，深层导出找不到。
- 组件契约 `{ data, onAction, context }`；`onAction` 提交 `{ type:'Action.Submit', data:{…} }`。渲染壳（会话流里的消息行容器）由宿主接管，组件只画卡本体。
- **`dataSchema` 是写给 agent 的填充说明**：字段 `description` 要直接指导填值，并写明空值降级原则（**如实降级为「— / 未安排」等占位，禁止编造**）。平台会把模板 + dataSchema 自动拼进 agent 的 systemPrompt「Extension Cards」段。
- agent 回发契约（平台已自动教）：`hub.sendMessage` content = `{ kind:'card', cardTemplate:{ templateId, data } }`。
- 卡内动作（`Action.Submit`）当前分发给**扩展注册的前端工具 handler**（`mcp.frontendTools[].handlerRef` + `ctx.capabilities.registerFrontendToolHandler`）；未注册 handler 时动作会被静默忽略（`handled:false`，无网络请求、无报错）。消费方只看 `frontendTools` 是否注册：`frontendTools` 为空即无消费方，而 `mcp.enabled:false` 本身**不会**自动禁用前端工具，别把它当成平台侧闸门。需要点卡有反馈时：注册 handler，或把动作目的做成资源 `openView`（平台原生消费在推进中，落地前不要依赖）。
- adaptive-card 轨道：`format:"adaptive-card"` + 内联 `template` JSON，适合轻量卡；对复杂度/美观度要求高时优先 react + 共享组件体系。

### 2.4 skills —— 领域技能

```json
"capabilities": {
  "skills": [
    { "skillId": "acme.crm/playbook", "name": "CRM 客户运营口径", "description": "客户等级/状态口径与跟进话术", "artifactPath": "skills/playbook" }
  ]
}
```

- `artifactPath` 指向扩展包内 SKILL.md 所在目录；**`content` 不用手写**——打包时由 extension-dev 从 `artifactPath/SKILL.md` 读取注入，随安装快照固化。
- agent 侧注入为 systemPrompt「Extension Skills」段（标题 + 正文）。写"怎么干"的口径、术语表、禁用事项。

### 2.5 permissions —— 能力说明

- 安装确认弹窗向用户展示；平台注册为 `extension:<appId>:invoke` 权限点并自动授权，管理员可收紧。
- 注意这是**面向人**的说明；"成员能不能用某条连接器"由有效能力集闸门（注册表启用 ∩ 未被 `disabledCapabilityIds` 收权）决定。

## 3. 平台自动组装（你不需要做的事）

| 环节 | 平台行为 |
|---|---|
| overlay 聚合 | resources/cards **始终注入**；skills 需成员侧开启扩展工具授权（`grants.callExtensionTool`）；mcpServers 需在该成员的有效能力集内 |
| 提示词 | daemon 自动拼「Extension Resources」「Extension Cards」「Extension Skills」三段 |
| MCP 注入 | mcpServers 直连注入 + `requiresConfirmationTools` → 审批卡 |
| 凭证 | daemon 调用前解引用 `${{secrets.*}}`；凭证主体白名单随会话 runtime token 签发 |
| 身份 | `identityMode` 在 dispatch 时解析成具体 subject |

推论：**你的 `description` / `dataSchema` / SKILL.md 就是写给 agent 的文档**——写清楚"这是什么、何时用、怎么填"，比写给人看的文案更重要。

## 4. 端到端验收剧本（必须全绿才叫"接通"）

前提：扩展已装进该租户（正式安装；开发期用扩展中心「本地调试」导入 dev-serve 产物，改 manifest 后需重启 serve 并"移除 → 重新加入"，见 PLUGIN_DEV §12）。

1. **声明进 overlay（提示词自查法）**：@ 数字成员问："你的 system prompt 里有没有 Extension Resources / Extension Cards 段？列出其中的 uriTemplate / templateId"。这是验证"声明 → 快照 → overlay → 提示词"最快的手段。
2. **MCP 取数**：@ 它"查一下 <某真实业务对象>"，确认 agent 调用你的工具拿到真实数据（首次可能要求你点「允许」审批）。
3. **回卡**：@ 它"用一张 <卡名> 把它的状态展示到会话里"——核对：模板/形态正确、字段来自真实数据、空字段如实降级、**未编造**。
4. **回资源 + 点开**：资源链接渲染为 chip；点击按 `openView` 打开扩展视图（视图能否取到数据取决于视图自身的取数链路）。
5. **失败即停**：任一步失败先按 §7 排查；**不要用注入假消息等方式伪装通过**——agent 拒绝编造数据是正确行为，不要教它绕过。

⚠️ 操作坑：会话里 **@ 必须用提及组件插入 chip**（手打文本 @ 不形成真实提及、不会触发调度）。

## 5. 生效与刷新语义（避免"我改了怎么没用"）

- **安装快照**：能力声明在"安装"时固化。改 manifest 后：正式环境重新发布 + 安装；开发期重启 serve 后在「本地调试」移除 → 重新加入。**dataSchema 等字段的刷新也走这条**（定向重装）。
- **自动重建（已实现）**：`mcpServers` 声明修订号 + 相关凭证修订号已进 `configFingerprint` ⇒ 改连接器 url/headers/审批清单或改凭证，**下一条消息自动重建会话生效**（N7 刷新链）。
- **尚未纳入（截至 2026-10-10）**：`resources` / `cardTemplates` 的声明修订号还没进指纹 ⇒ 新装/改卡对"已经存在的旧会话"的生效时机不确定；**验收新能力时新建会话最稳**。

## 6. 前端工具与 MCP Apps（另一条轨，按需）

- `mcp.frontendTools[]` + `ctx.capabilities.registerFrontendToolHandler`：跑在扩展 UI 内的工具（用户态、可复用 actions）；`appOnly` 标记"纯 UI 动作"。也是卡片 `Action.Submit` 的默认消费方。
- `mcp.uiResources[]` + `frontendTools[].ui.resourceUri`：MCP Apps——agent 调用工具后，宿主按 `ui://` 资源渲染工具结果 UI。
- 分工：**主路径是后端 MCP（agent 在后台干活）**；前端工具只用于必须发生在用户界面里的动作（打开页签、写剪贴板等）。

## 7. 常见坑（实测清单）

| 症状 | 先查 |
|---|---|
| agent 完全不知道卡片/资源/工具 | 扩展是否已安装且未被收权（有效能力集闸）；用 §4.1 自查法确认 overlay 段 |
| 手打 @ 没反应 | 必须用提及组件插入 chip |
| 第三方工具 401 / 403 | `secrets.*` 是否写进**正确主体**（默认档 = 成员创建者）；先直连你的 MCP server 自测（对齐 header 格式，勿猜 `Bearer` 前缀） |
| agent 查不到数据（"不存在或无权访问"） | 服务端数据域过滤：服务身份（操作者）与数据归属是否匹配——若按"本人/协作"过滤，用数据所有者当服务身份 |
| 改了 manifest 没生效 | 安装快照语义（§5）：重装/重加；mcpServers/凭证类改动等一条消息自动重建 |
| 点卡没反应 | 卡动作消费方是扩展注册的前端工具 handler：`frontendTools` 为空或未注册 handler 即静默无响应（CRM 现状 `frontendTools:[]`）；`mcp.enabled:false` 不是平台侧闸门，别误判（§2.3 末两条） |
| 不该做的事 | 把真实 token 写进 manifest/skill/日志；教 agent 编造数据"绕过"失败 |