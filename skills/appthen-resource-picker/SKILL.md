---
name: appthen-resource-picker
description: 用「静态表单控件 + 抽屉资源列表」范式为任意业务资源（用户、优惠券、产品、订单等）快速制造单选/多选选择器。Invoke when 用户要在表单里选择业务资源、要做一个资源选择器/选人/选券/选品组件，或出现新业务资源需要接入选择能力时使用。
---

# AppThen 资源选择器范式（Resource Picker）

本技能把「表单控件只做静态回显，实际选择通过右侧抽屉打开资源列表完成」这一范式沉淀为三份可拷贝的组件模板与一份适配器模板。新增一种资源的选择能力 = 写一个 adapter 对象，组件零改动。

## 何时使用

- 表单/弹窗中需要选择某种业务资源（单选或多选）：选用户、选优惠券、选产品、选订单……
- 需要搜索、状态筛选（含「已结束 / 已归档」历史数据检索）、禁选原因展示、已选 chips 回显。
- 之前的做法是把选择列表塞进下拉或弹窗内列表，体验差、复用难——改用本范式。

不要用于：纯文本联想输入（autocomplete）、页面主列表浏览（那是列表页的职责）、树形层级选择（需另行扩展 adapter）。

## 核心范式（30 秒理解）

```
表单控件（ResourcePickerField）          抽屉（ResourcePickerDrawer）
┌──────────────────────────────┐  点击   ┌────────────────────────────┐
│ [图标] 已选资源名 ×  [添加 ▾] │ ──────▶ │ 搜索框 + 状态筛选 chips      │
└──────────────────────────────┘         │ ──────────────────────────  │
  只回显，不内置下拉                       │ ☑ 资源行（图标/徽标/禁选原因） │
                                         │ ☐ 资源行                     │
                                         │ ──────────────────────────  │
                                         │ 共 N 条 · 分页   已选 2 清空  │
                                         │                取消  确定    │
                                         └────────────────────────────┘
```

- **单选**：点击行/卡片立即确认并关闭抽屉。
- **多选**：行内勾选进草稿（chips 实时预览），底部「确定」统一提交；`maxCount` 超限后未选行禁用并提示。
- **禁选**：adapter.isDisabled 返回字符串即禁选并展示原因（如「该券不支持卖家发放」「账号已禁用」）。
- **历史数据可检索**：filters 中必须包含状态枚举（全部/进行中/已结束/已归档），保证已结束数据可被搜到。

## 安装（拷贝即用）

把 [templates/](templates) 下三个文件拷入扩展 `src/components/picker/`：

| 文件 | 职责 | 依赖 |
| --- | --- | --- |
| [templates/types.ts](templates/types.ts) | `ResourceAdapter<T>` 契约 | 无 |
| [templates/ResourcePickerDrawer.tsx](templates/ResourcePickerDrawer.tsx) | 抽屉：搜索/筛选/分页/草稿/确定 | `@appthen/vibe-workspace`（overlay + components）、`lucide-react` |
| [templates/ResourcePickerField.tsx](templates/ResourcePickerField.tsx) | 表单控件：静态回显 + 触发抽屉 | 同上 |

依赖均为扩展标准依赖，无需额外安装。Tailwind v4 只扫描源码静态类名，抽屉宽度档位已在 Drawer 内用完整字面量处理（`WIDTH_CLASS`），不要改成插值模板。

## 接入一个新资源（标准流程）

1. **定义 adapter**：参照 [templates/adapter-template.tsx](templates/adapter-template.tsx) 写一个 `ResourceAdapter<你的类型>` 对象——字段映射（getPrimary/getSecondary/getMeta）、媒体色块（renderMedia + PickerMediaTile，图标或 id 推导色相）、状态徽标（renderBadge）。
2. **禁选规则**：`isDisabled` 返回 `true`（无原因）或字符串（禁选原因文案）。业务约束（如库存为 0、账号禁用、状态不符）都应在这里表达并给中文原因。
3. **筛选声明**：`filters` 至少给状态枚举（variant: 'chips' 适合 ≤5 个枚举，'select' 适合更多）；**必须保证已结束/已归档数据可通过筛选检索**。
4. **接到表单**：Dialog/表单里放 `<ResourcePickerField adapter={...} value={...} onChange={...} />`；多选加 `multiple` 与 `maxCount`（如发券选人上限 500）。
5. **验证**：走查单选点行确认、多选草稿+确定、搜索防抖、禁选原因、已结束筛选、超限提示、表单回显与移除。

详细设计决策与交互细节（键盘可达性、Dialog 内嵌套、宽度档位、常见坑）见 [references/paradigm.md](references/paradigm.md)——实现前先读一遍。

## 参考实现（开发工作区内）

- `workbench/extensions/acme.resource-picker-demo`：独立范例扩展，mock 数据 + 带图标/色块的选择器，单选、多选、状态筛选、表单回显全量走查过。
- `workbench/extensions/acme.marketing`（`src/components/GrantDialog.tsx` + `src/components/picker/marketingAdapters.tsx`）：实战接入——发券弹窗选券（单选，点行即确认）+ 选用户（多选，500 上限），真实后端 API。

## 设计红线（不要破坏）

1. Field 永远保持静态——不要往里加搜索框、下拉、虚拟列表；选择行为只发生在抽屉里。
2. 新资源的差异只允许出现在 adapter 中；若组件需要改动才能接上新资源，先停下来检查是否误用（极少数情况确实需要扩展组件，此时应同步更新本技能模板）。
3. 抽屉选项是 `role="option"` 的 button，禁选必须 `aria-disabled` + 原因文案（title + 行内文字），不要只置灰。
4. 金额类元信息显示在 `getMeta`（右侧等宽数字），不要拼进 getSecondary。
