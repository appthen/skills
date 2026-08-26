# UI 视觉质量基线(强约束)

> 适用：所有用 AppThen VFS 写入的页面与组件。本文件定义 **审美基线**——和 SKILL.md 的"功能落地"配套使用。
>
> 设计目标：**让所有 AppThen 扩展页面的视觉质量,达到"奇点"工作(2026-08-13 主题架构收编)沉淀的设计系统水平**。

---

## ★ 心智模型(最重要,写 UI 前先记住这一条)

**把这个项目当普通 shadcn 项目来写,忘记"主题系统"的存在。**

- ✅ 直接写 shadcn 语义类:`bg-background` / `text-foreground` / `bg-primary` / `text-primary-foreground` / `bg-card` / `border-border` / `bg-muted` / `text-muted-foreground` / `bg-accent` / `text-destructive` 等
- ✅ 直接 import components/ui 元件:Button / Card / Input / Select / Badge / Switch / Table / Dialog / Drawer 等
- ✅ 主题切换、颜色跟随、深浅模式——**主题系统会自动处理,你不需要写任何一行 token 代码**
- ❌ **不要**写 `--vscode-*` 词汇(那些是历史遗留,新代码一律不碰)
- ❌ **不要**写任何颜色值(`#0f766e` / `rgba(...)` / `var(--...)`)
- ❌ **不要**手写 inline styled button/input/select

**为什么**:项目主题系统会自动把 shadcn 语义变量(`--background` / `--primary` / `--ring` …)注入到根节点。你只需要"消费"它们,不需要"生产"它们。**AI 创作时心智负担 ≈ 0**——和没有主题系统的 agent-client 一样轻松,而产出质量更高(因为主题统一)。

一句话记忆:**用语义类表达"意图"(这是背景、这是主按钮、这是次要文字),颜色交给主题。**

---

## 0.1 大厂级视觉与 UX 成功标准(验收清单)

> 奇点 / 去硬编码 / 去 vscode-* 只是**消除 AI 创作干扰的手段**(见上方心智模型)。
> 下面这份清单才是页面该被验收的**真实标准**——它决定页面是否"像大厂产品"。

### 视觉(Visual)
- [ ] **分层色彩,而非大块实色**:用 `bg-background / bg-card / bg-muted / bg-popover / border-border` 建立层级;阴影用极轻柔的 layered shadow + 1px hairline 边框,不靠重阴影堆砌。
- [ ] **排版层级与节奏**:标题 `font-semibold/700` + 紧凑行高(1.2–1.3),正文 `font-normal/500` + 舒适行高(1.5–1.6);小标签/大写标签加 `tracking-wide`;数字/ID/金额用 `font-mono tabular-nums`。
- [ ] **留白与密度(呼吸感)**:统一 8pt 网格,卡片 `p-6/p-8`,区块间距 `space-y-6/8`;克制密度,不拥挤(参考 Linear / Notion 的留白节奏)。
- [ ] **圆角与边界语言统一**:按钮 `rounded-md`(6px)、卡片 `rounded-lg/xl`(8–12px),不混用多档圆角;边框用低对比 `border-border` 而非深色描边。
- [ ] **状态可见性**:每个可交互元素都有 hover / active / focus-visible / disabled 态;`focus-visible` 用 2px ring + offset,transition 150–200ms 统一缓动。
- [ ] **图标一致性**:统一 `lucide-react`,stroke-width 1.5–2、尺寸 16/20/24、optical 对齐;不用 emoji 当图标。
- [ ] **暗色模式和谐**:暗色下用 tuned neutral(zinc/stone 系),主色提亮、文本用 `foreground` 而非纯白,阴影减弱以 border 替代。

### 交互(UX)
- [ ] **首屏价值明确 + 信息架构清晰**:导航层级 ≤ 3,当前位置有 Breadcrumb / 标题上下文,用户 3 秒内知道"这是什么、能做什么"。
- [ ] **操作反馈即时可预期**:点击后 loading / 乐观更新,结果用 toast 明确成功或失败,绝不静默;主操作有提交态防重复。
- [ ] **表单体验**:失焦/输入时实时校验,错误前置(红框 + 文案,且保留输入),focus 态明显;不吞输入、不靠 alert。
- [ ] **空 / 错 / 边界态**:无数据有 EmptyState(插画/文案/CTA),出错可恢复(重试/返回),权限不足有引导,绝不空白或裸 spinner。
- [ ] **可达性(A11y)**:键盘可达、tab 顺序合理、focus ring 清晰;对比度 ≥ 4.5:1;触控目标 ≥ 44px;关键控件有 ARIA label/role。
- [ ] **容错与撤销**:危险操作二次确认(Dialog),删除可撤销(toast + undo),不可逆动作有保护,不一步到位。
- [ ] **上下文保留**:返回不丢状态,列表筛选/分页记忆,关键视图 URL 可分享(路由参数)。
- [ ] **微交互细节**:tooltip 解释非常规控件,hover preview,复制按钮有反馈,拖拽有手柄——让界面"会呼吸"。

### ⚠ 反 "AI 味"(大厂 vs 生成式套路的边界)
用户明确:**大厂级 ≠ 生成式套路**。以下特征会立刻显得"AI 味",应主动规避:
- [ ] **不要极光渐变光斑 + 玻璃拟态**(colored blur blobs + `backdrop-blur` 毛玻璃)——这是当前 AI 生成界面最典型的套路,华丽但无主张。
- [ ] **不要圆角过度统一且偏大**(卡片/logo/图标全堆 `rounded-2xl`/`rounded-xl`)——整体"圆圆润润"缺主张。统一收紧到 6–8px(`rounded-md`/`rounded-lg`),大厂多为利落边角。
- [ ] **不要靠彩色渐变 blob 撑场面**——质感应来自排版层级、留白与 1px hairline 边框,而非装饰光晕。
- [ ] **移动端不能靠 `hidden` 直接砍掉整块**(如分屏左栏在窄屏消失 → 只剩孤零零卡片)。改为:同一套结构在小屏舒适堆叠,或把价值主张收进卡片头部。
- [ ] 默认审美基线可参照 **Linear(暗色锐利)/ Vercel(极简高对比)/ Stripe(清爽明亮)** 的克制语言,而非"好看就行"的通用生成风。

> 验收方法:chrome headless 截图(见 §6)+ 逐条对照以上清单。任一项不达标,回去改到全过。

---

## 0. 5 条核心设计原则

每次设计或改造前,先核对这 5 条:

### 原则 1 · 找"奇点"(架构杠杆)
不要逐屏改样式。先**诊断主题/组件/状态系统的契约是否加重了 UI 创作的负担**。
- 本项目的"奇点"已定位:**复杂主题系统(token 海洋 + 运行时 JS 变量重写)曾让 UI 创作变成"手撸"**——AI 被 `--vscode-*` token 淹没,产出碎片化。
- 解法(已生效):**shadcn 语义类 + components/ui 元件 = 唯一创作方式**,主题系统在后台自动注入,AI 不需要理解它(见上方"心智模型")。
- 遇到旧代码:机械替换即可(见 §4 映射表),不要重新设计契约。

### 原则 2 · 优先语义类,不要硬编码颜色
**禁止**使用 `#0f766e` / `rgba(245, 158, 11, 0.16)` 这类硬编码颜色值。改用:
- Tailwind 语义色:`bg-primary text-primary-foreground`(若项目有 shadcn 主题)
- Tailwind 状态色:`bg-emerald-500`(成功) / `bg-amber-500`(警告) / `bg-destructive`(失败)
- CSS 变量:`var(--portal-primary)` / `var(--ck-primary)`(项目自定义的 token)

### 原则 3 · 优先用 components/ui 元件,不要手写
**禁止**手写 `<button className="rounded-md bg-primary text-primary-foreground px-4 py-2">` 这类 inline styled button。改用:
- shadcn 风格的 components/ui:从 `@appthen/vibe-workspace/components` import(若项目接入)
- AppThen React 原子组件:`<View>` / `<Text>`(App 帧)
- 已安装的 antd / radix / chakra 等

每个项目必须搞清楚:项目空间里**有哪些 components/ui 元件可用**,再开始写 UI。

### 原则 4 · 状态徽章用 Badge variant,不要 rgba
**禁止**用 `rgba(245, 158, 11, 0.16)` 之类的半透明色作为状态背景。改用 shadcn Badge:
```tsx
<Badge variant="default">已完成</Badge>     // 主色
<Badge variant="secondary">处理中</Badge>   // 灰底
<Badge variant="outline">待处理</Badge>     // 边框
<Badge variant="destructive">失败</Badge>   // 危险
```

### 原则 5 · 举一反三:每次发现 bug 时问"是不是通用问题"
发现 Vercel 主题按钮文字消失 → 看到 `deriveShadcnSemanticVars` 硬编码 `onPrimary='#FFFFFF'` → 任何浅色 primary 主题都会出错 → 修通用算法(WCAG pickContrastColor)。**不要只修症状,要看是不是系统性问题**。

---

## 1. 颜色系统规范

### 1.1 禁止的写法
```tsx
// ❌ 硬编码颜色值
<div style={{ background: '#0f766e', color: 'white' }}>...</div>
<span style={{ background: 'rgba(245, 158, 11, 0.16)', color: '#b07c00' }}>...</span>
<div className="bg-[#1D5FAE] text-white">...</div>
```

### 1.2 推荐的写法
```tsx
// ✅ 语义类(若项目有主题系统)
<div className="bg-primary text-primary-foreground">...</div>
<span className="bg-amber-500/15 text-amber-700 dark:text-amber-300">...</span>

// ✅ Tailwind 状态色(Tailwind 内建)
<div className="bg-emerald-500 text-white">成功</div>
<div className="bg-destructive text-destructive-foreground">失败</div>
```

### 1.3 对比度自动计算
当主题/项目支持 shadcn `--primary-foreground`,**不要硬编码为白**。需根据背景亮度自动选择对比色(WCAG 相对亮度算法):
- luminance > 0.5 → 黑色文字(`#000`)
- luminance ≤ 0.5 → 白色文字(`#FFF`)

参考实现:`appthen-workspace/src/services/themeService.ts` 的 `pickContrastColor()` 函数。

---

## 2. 组件优先(`components/ui`)

### 2.1 appthen-workspace 项目的 28 件元件
从 `@appthen/vibe-workspace/components` import(无前缀语义名层):
```
Button  Input  Textarea  Select  Checkbox  Switch  RadioGroup
Dialog  Drawer  Badge  DotBadge  Card  Alert  EmptyState
Progress  Skeleton  Separator  SimpleSelect  Accordion
Avatar  Breadcrumb  Command  ScrollArea  Sheet  Table  Tabs  Toast  Tooltip
```

详细列表与用法见 `COMPONENTS_CONSOLIDATION_PLAN.md`(appthen-workspace 项目内)。

### 2.2 替换映射(参考)
手写元素 → components/ui 元件:

| 旧(手写) | 新(components/ui) |
|---|---|
| `<button className="rounded-md bg-primary px-4 py-2 text-white">` | `<Button>新建</Button>` |
| `<input className="border rounded px-3 py-2">` | `<Input />` |
| `<select className="border rounded">` | `<Select>` / `<SelectTrigger>` / `<SelectContent>` / `<SelectItem>` |
| `<div className="rounded-lg border bg-white p-4 shadow-sm">` | `<Card>` / `<CardHeader>` / `<CardContent>` |
| `<div className="border-b p-2 bg-gray-50 text-gray-500">` 标题 | `<CardHeader>` + `<CardTitle>` + `<CardDescription>` |
| `<div className="rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700">已选</div>` | `<Badge variant="default">已选</Badge>` |
| `<table>` 手写表格 | `<Table>` + `<TableHeader>` + `<TableBody>` + `<TableRow>` + `<TableCell>` |
| 居中 Modal | `<Dialog>` + `<DialogContent>` + `<DialogHeader>` + `<DialogFooter>` |
| 侧边抽屉 | `<Drawer>` + `<DrawerContent>` + `<DrawerHeader>` |

### 2.3 variants(变体)替代手写类组合
**Button** 的 variant 已经覆盖大部分场景:
```tsx
<Button variant="default">主操作</Button>        // bg-primary 蓝主色
<Button variant="secondary">次操作</Button>      // bg-secondary 灰底
<Button variant="outline">边框按钮</Button>      // border 透明
<Button variant="ghost">透明按钮</Button>        // 默认透明 hover 浅色
<Button variant="destructive">危险</Button>       // bg-destructive 红
```

**不要**再写 `<Button className="bg-red-500">`,改用 `variant="destructive"`。

---

## 3. 状态徽章与状态色

### 3.1 通用状态 ↔ Badge variant 映射
| 状态语义 | Badge variant | 视觉 |
|---|---|---|
| 待处理 / Pending | `outline` | 边框透明 |
| 处理中 / Processing / 进行中 | `secondary` | 灰底 |
| 已完成 / Completed / Success | `default` | 主色蓝底 |
| 失败 / Failed / Error | `destructive` | 红底 |
| 警告 / Warning | (用 DotBadge tone="warning" 或自定义) | 黄 |

### 3.2 状态点(小圆点)
用 `<DotBadge tone="success|warning|error|info">`,不要写 `<span className="h-2 w-2 rounded-full bg-emerald-500" />`。

---

## 4. 主题契约:新代码忘记它,旧代码机械替换

### 4.1 新代码(本规范唯一要求)
```tsx
// ✅ 直接写 shadcn 语义类,主题系统自动注入,不需要理解 token
<div className="bg-popover text-foreground border-border">
  <span className="text-muted-foreground">副标题</span>
</div>
<Button variant="default">主操作</Button>
<Badge variant="secondary">处理中</Badge>
```
**新代码不需要看下面的映射表**——直接写语义类就行。下面的表只在你**改造含 vscode-* 的旧代码**时才查。

### 4.2 旧代码机械替换映射(仅改造遗留代码时参考)
| 旧(--vscode-* / 其他) | 新(shadcn 语义类) | 用途 |
|---|---|---|
| `bg-vscode-panel` | `bg-popover` | 浮层面板 |
| `border-vscode-border` | `border-border` | 边框 |
| `text-vscode-text` | `text-foreground` | 主要文字 |
| `text-vscode-textDark` | `text-muted-foreground` | 次要文字 |
| `bg-vscode-itemActive` | `bg-accent` | 选中/激活态 |
| `bg-vscode-sidebar` | `bg-muted` | 默认背景 |
| `hover:bg-vscode-itemHover` | `hover:bg-muted` | hover 态 |
| `text-vscode-accent` | `text-primary` | 强调色 |

---

## 5. 布局与排版

### 5.1 间距系统
用 Tailwind 标准间距:`p-2` `p-4` `p-6` `gap-2` `space-y-1`,不要写 `padding: 7px`、`gap: 13px`。

### 5.2 容器宽度
- 浮层面板:`w-[260px]` 到 `w-[320px]`
- 内容卡片:`max-w-6xl` 或 `max-w-screen-md`
- 全屏:用 `h-dvh`(支持移动端地址栏动态)

### 5.3 圆角
- 按钮/输入:`rounded-md`(6px)
- 卡片:`rounded-lg`(8px)
- 大卡片:`rounded-xl`(12px)

不要混用 `rounded`、`rounded-sm`、`rounded-2xl`。

### 5.4 字体
- 标题(主标题):`text-2xl font-semibold`
- 副标题(区块):`text-sm font-semibold`
- 正文:`text-sm`(默认)
- 辅助文字:`text-xs text-muted-foreground`
- Tabular 数据:`font-mono`(任务号、ID、金额等)

不要混用 `text-base`、`text-md`、`text-lg`、`text-xl`,用 Tailwind 标准 scale。

---

## 6. 验证工作流(扩展开发完成后必做)

### 6.1 chrome headless 截图
```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --hide-scrollbars --window-size=1440,900 \
  --virtual-time-budget=6000 \
  --screenshot=/tmp/page-default.png \
  "http://localhost:5180/<route>"
```

### 6.2 多主题验证(若有主题切换)
URL 参数 `?theme=<id>` 支持 chrome headless 截图多主题:
```
?theme=appthen-light
?theme=marmos-light
?theme=marmos-dark
?theme=vercel
?theme=dark-plus
```

### 6.3 量化指标(grep)
提交前自检:
```bash
# 1. 硬编码色值数(应为 0)
grep -cE "#[0-9a-fA-F]{3,6}|rgba\(" <file>

# 2. vscode-* 引用数(应为 0)
grep -c "vscode-" <file>

# 3. React.CSSProperties 内联样式对象数(应极少)
grep -c "React.CSSProperties\|: React.CSSProperties" <file>
```

### 6.4 举一反三自检
发现一个问题后,跑一遍其他主题/其他类似元素,**确认不是通用问题**:
- 一个主题按钮看不见 → 跑所有主题
- 一个屏某元素不对 → 跑所有类似屏
- 一个状态色不对 → 跑所有状态

---

## 7. 实战案例参考

### 案例 A:SettingsPanel 收编(从手写 button 到 components/ui)
**Before**(1648 行大型应用片段):
```tsx
<button className={clsx(
  'flex h-9 w-full items-center justify-between rounded-md px-2 text-left text-sm',
  active ? 'bg-vscode-itemActive text-vscode-text'
         : 'text-vscode-textDark hover:bg-vscode-itemHover',
)}>
```

**After**(用 components/ui):
```tsx
<Button
  variant={active ? 'secondary' : 'ghost'}
  size="sm"
  className="h-9 w-full justify-between px-2 text-sm font-normal"
>
```

### 案例 B:状态徽章(从 rgba 到 Badge)
**Before**:
```tsx
<span className="rounded-md px-2 py-0.5" style={{
  background: 'rgba(245, 158, 11, 0.16)',
  color: '#b07c00',
}}>处理中</span>
```

**After**:
```tsx
<Badge variant="secondary">处理中</Badge>
```

### 案例 C:对比度自动计算(避免硬编码 onPrimary)
**Before**(硬编码):
```ts
const onPrimary = '#FFFFFF';  // Vercel 白主色主题下按钮文字看不见
```

**After**(WCAG 算法):
```ts
const onPrimary = pickContrastColor(portalColors.primary);
// pickContrastColor: hex/rgb/hsl → WCAG 相对亮度 → 0.5 阈值选黑/白
```

---

## 8. 加载时机

扩展开发完成后,自动加载本 reference 检查:
1. 是否还有硬编码颜色?(`grep -cE "#xxx|rgba("`)
2. 是否还在用 vscode-* 词汇?(`grep -c "vscode-"`)
3. 是否优先用 components/ui 元件?
4. 状态色是否用 Badge variant?
5. chrome headless 截图 + 多主题截图通过?
6. 举一反三:跑所有主题/类似屏都正常?

如果任一项不过,回去改,直到全过。