# 排障参考

## VFS 写入被根组件校验拦截

症状：写入 TSX 返回根组件或 constructor 相关错误，文件没有落盘。

原因：`Document` 根类包含了 `constructor`。LC Document 转换器不允许页面根组件定义 `constructor`，包括 `constructor(props)` 和 `super(props)`。

修复：删除 constructor，改用类字段初始化 state；初始化副作用放入 `componentDidMount()`。修复后重新使用非 preview 模式写入，并确认 `success=true`。

## VFS 写入返回规范或转换错误

`appthen check-tsx` 通过不等于服务端转换通过。服务端 VFS 会继续执行 TSX 规范检查和 codeToSchema；写入响应中的 `message`、`validation`、`report`、`details` 才是本次内容能否落盘的最终依据。

排查顺序：

1. 先保留完整响应，不要只看 `vfs-write failed` 的摘要。
2. 区分源码解析/规范错误、`codeToSchema` 转换错误、依赖安装错误和 runtime build 错误。
3. 只有 `success=true` 且 `data` 中的变更字段符合预期时，才回读 VFS 并等待构建。
4. 不要为了绕过转换器增加 `data-native` 或其他特殊标记；应修复转换器或更新与实际能力一致的校验规则。

## state 或 render 局部变量校验失败

检查以下三类写法：

- 不要写 `state = new IState()`；`Document.state` 必须是对象字面量。
- `IState` 只声明字段类型，不要写 `rows = []`、`filters = {}` 等数组或对象字面量默认值。
- `render()` 内的局部 `const/let` 不要写 `const rows: Row[]` 这类 TypeScript 类型注解。

运行时默认值放在 `Document.state = { ... }`，局部变量使用类型推断；需要复杂类型时放到独立模块或 `IState` / `IProps` 声明中。

## 写入成功但页面打不开

症状：runner 显示 `No route matched`。

优先检查：

1. TSX 是否有 `@type Page`。
2. TSX 是否有正确 `@route`。
3. VFS 写入是否是真实落盘，而不是 preview。
4. 项目空间路由或目录 entry 是否已经更新。
5. 必要时重新读取 `/src/pages` 或项目空间 router 字段。

## 构建成功但页面为空

优先检查 TSX 写法：

- 是否用 `this.renderX()` 返回主 JSX。
- 是否把大量主结构藏在动态表达式中。
- schema 回读后关键节点是否存在。

修复方向：把页面主体结构直接展开在 `render()` 的 JSX 中。

## util 没更新

症状：修改 util 文件后有推送、有构建，但 runner 仍显示旧结果。

检查顺序：

1. util 文件是否真的变化。
2. 页面是否 import 了正确路径。
3. 页面 `utilsMap` 是否引用该 util。
4. runtime build 是否针对当前页面重新生成。
5. manifest export key 是否包含目标函数。
6. runner 实际加载的 bundle URL 是否是最新 buildHash。
7. 浏览器缓存或全局 runtime slot 是否残留旧产物。

## import 不报错但无渲染

区分三层 key：

- 源码依赖层：`utilsMap`。
- 构建导出层：runtime manifest source/export key。
- 执行注入层：renderer 注入 key。

三层任一不一致，都可能出现 build 成功但页面没有内容。

## 自动构建没有触发

检查：

1. 写入响应是否 `isChanged=true`。
2. 文件路径是否属于页面、runtime component 或页面依赖。
3. 文件类型是否进入 runtime build 触发规则。
4. 查询最新 build task 的 documentPath 是否匹配。
5. 如果确认自动触发缺失，再考虑手动 enqueue，并把它记录为缺口。

## 不要使用的验证方式

- 不用临时 Vite/Webpack 工程证明 AppThen 页面可运行。
- 不用 Node 伪 DOM 替代 runner。
- 不用截图或静态 HTML 替代真实 VFS/runtime 链路。
