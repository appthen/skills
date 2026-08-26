# Runtime 验证标准

## 强证明顺序

证据强度从弱到强：

1. VFS 写入成功。
2. VFS 回读源码正确。
3. route 或文件 entry 已进入项目空间。
4. runtime build task 存在。
5. runtime build task 状态为 `succeeded`。
6. bundle 和 manifest HTTP 状态为 `200`。
7. runner 页面真实显示最新内容。

如果能做第 7 步，前 6 步都只是中间证据。

## runtime build

写入后查询目标 documentPath 对应的最新构建任务。确认：

- `documentPath` 是本次页面。
- `frame=web`。
- `client=web` 或符合当前项目空间配置。
- `status=succeeded`。
- `buildHash` 是新值。
- `reason` 与本次触发原因一致。

## artifact

优先校验静态发布地址：

- `runtime.bundle.js`
- `runtime.manifest.json`

HTTP 状态必须是 `200`。不要把旧 raw artifact 接口作为首选判断。

## runner

本地调试常用链接：

```text
http://localhost:5173/#/<route>
```

验证内容：

- 页面没有 `No route matched`。
- 页面显示本次写入的关键标题、文案或数据。
- 控制台没有阻塞渲染的错误。
- 修改 util 后，页面消费的是最新 util 结果。

如果 runner 使用写死 projectId，用户需要把本地 runner 切到目标 projectId；Skill 执行者要明确记录这个前提。
