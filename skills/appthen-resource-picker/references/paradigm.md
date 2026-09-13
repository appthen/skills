# 资源选择器范式详解

## 职责边界

```
ResourcePickerField（表单控件）
  - 静态回显已选值：单选显示一行（媒体+主文本+次文本），多选显示 chips（最多 maxVisibleChips 个，超出 +N）
  - 唯一交互：点击（或 Enter/Space）打开抽屉；chips 上的 × 移除单项；单选可「清除选择」
  - aria：role="button" + aria-haspopup="dialog" + aria-label

ResourcePickerDrawer（抽屉）
  - 搜索（300ms 防抖）+ 筛选（chips/select）+ 分页 + 草稿态 + 确定栏
  - 单选：点行 → onConfirm([item]) → 关闭
  - 多选：点行/checkbox → 草稿 chips 实时预览（头部）→ 底部「确定」统一提交
  - maxCount：草稿满额后未选行禁用（checkbox disabled + 行 opacity），底部显示「最多可选 N 项」

ResourceAdapter<T>（业务接入点）
  - 数据：fetch（分页查询契约 ResourcePickerQuery → ResourcePage）
  - 展示：getId/getPrimary/getSecondary/getMeta/renderMedia/renderBadge
  - 规则：isDisabled（boolean | 原因字符串）、filters
  - 形态：layout 'list' | 'grid'、pageSize、drawerWidth
```

## 为什么这样设计（决策记录）

1. **表单控件静态化**：下拉内嵌列表在数据量大、需要筛选/禁选原因/多选草稿时体验崩溃；把选择挪进全屏抽屉后，控件只承担「展示已选 + 发起选择」，复杂度被隔离进一个可复用组件。
2. **adapter 而非 props 散传**：新资源 = 一个对象。组件不 import 任何业务类型，跨扩展拷贝零改动。
3. **抽屉内草稿态**：多选不能边选边改外部状态（会触发外层表单重渲染甚至请求风暴），抽屉内暂存、确定才提交，同时头部 chips 给实时预览。
4. **历史数据可检索是一等需求**：运营经常要给「已结束的活动/已归档的产品」补录关联，因此 filters 必须含状态枚举，默认「全部」。
5. **图标色块代替图片**：renderMedia 用 PickerMediaTile（id 稳定推导色相 + lucide 图标），避免图片资源管理与加载失败问题；有真实图时换成 <img> 即可。

## Dialog 内嵌套注意事项（实战经验）

- Field 放在 WorkbenchDialog 里完全可用（marketing 发券弹窗实证）。Dialog(modal) → Field → Drawer 逐层覆盖，z-index 由 SDK overlay 管理，不要手动设 z。
- 两个 Field（如选券 + 选人）各自持有独立抽屉 open state，互不干扰。
- preset 场景（列表页「发券」按钮携带资源 id 打开弹窗）：在 Dialog 组件里用 `useEffect` 调详情接口回填 value 数组，避免该资源不在第一页时无法回显；`open=false` 时重置全部本地 state。
- maxCount 与后端约束保持一致并在 hint 文案中暴露（如「已选 N 人，单次最多 500 人」）。

## 常见坑

| 坑 | 对策 |
| --- | --- |
| 扩展 CSS 手写与 SDK overlay 同名的工具类（动效/限高/定位） | 禁止。SDK Sheet 桌面覆盖类部分带 `!` 部分不带，扩展侧同名全局规则会按注入顺序（dev HMR 后排在 SDK CSS 之后）压过它，症状随构建漂移、反复复发（曾致抽屉从底部弹出/不贴底）。动效与布局修正一律反馈 SDK 侧修复 |
| Tailwind v4 不生成插值类名 | 抽屉宽度必须用 `WIDTH_CLASS` 那样的完整字面量档位 + `!` 后缀覆盖 SDK `w-full` |
| 搜索每次击键都请求 | keywordInput 与 keyword 分离，300ms 防抖后置 keyword 并回第一页 |
| 禁选只置灰无原因 | isDisabled 返回字符串；行内渲染红色小字 + title，aria-disabled |
| fetch 错误后无法恢复 | 内部 tick state，错误分支提供「重试」按钮 |
| 列表 loading 抖动 | loading 时渲染 5 条 h-12 animate-pulse 骨架（aria-busy） |
| 分页文案缺失 | 底部常驻「共 N 条」，多页时显示「第 x / y 页」+ 上一页/下一页（aria-label） |

## 验证清单（接入后逐项走查）

- [ ] 单选：点行立即回显到表单，抽屉关闭；再打开时该行选中态正确
- [ ] 单选清除：控件上「清除选择」后回到 placeholder
- [ ] 多选：勾选 → 头部 chips 实时预览 → 确定 → 控件回显 chips；chips × 移除生效
- [ ] 多选草稿不外泄：取消/关闭抽屉不改动表单值
- [ ] maxCount：选满后未选行禁用，底部红字「最多可选 N 项」；控件 hint 同步
- [ ] 搜索：输入防抖、回第一页、空结果有引导文案
- [ ] 筛选：状态 chips 切换正确；**已结束/已归档数据可被检索**
- [ ] 禁选：原因文案展示、点击无效（单选不确认、多选不进草稿）
- [ ] 键盘：控件可 Tab 聚焦、Enter/Space 打开抽屉
- [ ] 分页：翻页数据正确、禁用态正确
- [ ] Dialog 内嵌套：打开/关闭/再打开无残留遮罩（SDK 动画卸载由平台负责）
