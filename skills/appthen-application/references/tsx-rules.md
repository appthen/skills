# TSX 写法规则

## 页面元信息

`/src/pages/*.tsx` 页面必须包含：

```tsx
/**
 * @type Page
 * @route /agent-demo
 * @frames web
 * @clients web
 */
```

route 必须以 `/` 开头，并且和最终 runner URL 对齐。

## 推荐结构

页面主结构直接写在 `render()` 返回的 JSX 里。Web 页面默认使用原生 HTML 元素和 Tailwind CSS：

```tsx
import React from 'react';

class IProps {}
class IState {}

class Document extends React.Component<IProps, IState> {
  render() {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-semibold">Agent Demo</h1>
          <p className="mt-3 text-slate-300">Built in an AppThen project space.</p>
          <img className="mt-6 rounded-lg" src="/assets/demo.png" alt="Demo" />
        </section>
      </main>
    );
  }
}

export default Document;
```

### 按 frame 选择 UI 元素

- `@frames web`：优先使用 HTML + Tailwind。使用 `div`、`span`、`img`、`button` 等语义化元素，不要把 `View`、`Text`、`Image` 当作默认 Web 组件。
- `@frames app`：可以使用 `@appthen/react` 的 `View`、`Text`、`Image` 等跨平台原子组件。
- `@frames web, app`：只有在确实需要共享跨平台 JSX 时才使用 `@appthen/react`；纯 Web 的复杂业务交互仍按 Web 端方式实现。
- 样式优先写在 `className` 中。内联 `style` 只用于动态计算值或 Tailwind 无法表达的运行时样式。
- `space-x-*` 和 `space-y-*` 依赖兄弟选择器，必须保留原 `className`，不要为了转换器改写为 `mt-*`、`mr-*` 或强制替换成 `gap-*`。
- 条件表达式中的分支可能在 schema 转换或预览阶段单独求值。对可能为数字、`null` 或 `undefined` 的值调用字符串方法时使用类型保护，例如 `String(value).trim()`。

### ref 与 HTML 元素访问

组件实例使用字符串 `ref`，通过 `this.$()` 获取：

```tsx
class Document extends React.Component<IProps, IState> {
  focusPanel() {
    const panel = this.$('panel');
    panel?.focus?.();
  }

  render() {
    return <View ref="panel" />;
  }
}
```

`ref="panel"` 只用于 AppThen 组件或其他需要获取实例的组件。访问原生 HTML 元素时不要使用组件 ref；直接使用浏览器 DOM API，例如 `document.getElementById()`、`document.querySelector()` 或 `getElementsByClassName()`。事件处理优先使用事件对象的 `currentTarget`。

新建页面优先使用 `class Document extends React.Component<IProps, IState>` 并 `export default Document`。不要用普通函数组件作为页面根组件；当前 TSX 转 LC Document 链路可能识别不到根组件并报 `未找到根组件`。

### 根组件禁止 constructor

`Document` 是 LC Document 转换链路识别的页面根组件，禁止定义 `constructor`。以下写法会被服务端拒绝，文件不会写入 VFS：

```tsx
constructor(props) {
  super(props);
  this.state = { activeTab: 'overview' };
}
```

必须使用类字段初始化 state：

```tsx
state = {
  activeTab: 'overview',
};
```

初始化逻辑放在 `componentDidMount()` 等生命周期方法中；事件处理使用普通 class method 或箭头类字段，不要通过 constructor 做绑定。

### state 与 TypeScript 注解限制

转换器只识别 `Document.state` 的对象字面量。不要写：

```tsx
state = new IState();
```

`IState` 只用于声明字段类型，不要给字段设置数组或对象字面量默认值：

```tsx
class IState {
  activeTab: string;
  rows: any[];
  filters: Record<string, any>;
}
```

运行时默认值统一放在 `Document.state = { ... }` 中。

`render()` 内的局部变量不要使用 TypeScript 类型注解。不要写：

```tsx
const rows: Row[] = this.state.rows;
```

改为：

```tsx
const rows = this.state.rows;
```

## 类方法 JSX

`Document` 的 class method 可以返回 JSX，转换器会保留这类方法的源码和调用关系：

```tsx
renderPanel() {
  return <section>...</section>;
}

render() {
  return <main>{this.renderPanel()}</main>;
}
```

可以使用 `this.renderPanel()` 组合页面子树。若页面出现空白，应按 VFS 回读的 schema、服务端诊断和 runner 控制台逐层排查，不要仅凭旧规则禁止类方法 JSX。

## 方法参数

class method 参数不要写 TypeScript 类型注解：

```tsx
focusApp(appId) {
  this.setState({ activeApp: appId });
}
```

避免：

```tsx
focusApp(appId: string) {}
```

`IProps` / `IState` 接口可以保留。

## 类方法内「空对象 / 空源 Object.assign」陷阱（最常见的运行时报错来源）

转换器在 **class method 内部** 会把空对象字面量、空源 `Object.assign`、`new Object()` 处理成 `undefined`。这是弹窗/动态表单初始值导致白屏或 `Cannot read properties of undefined (reading 'xxx')` 的根因。

- ❌ 在 method 里以下写法都会变成 `undefined`：
  - `var f = {};`
  - `var f = new Object();`
  - `var f = Object.assign({}, {});`
  - `var f = Object.assign({}, cfg.someField);`（`cfg.someField` 是成员表达式源，转换器无法判定为非空，仍转成 `undefined`）
- 后果：若 `f` 作为弹窗表单初始值存入 `state.form`，渲染弹窗字段时 `this.state.form[key]` 报 `Cannot read properties of undefined (reading 'xxx')`。
- ✅ 正确做法（弹窗/动态表单初始值）：写一个 `blankForm()` class method，**返回带字段的非空字面量对象**（非空字面量会被转换器保留）：

```tsx
blankForm() {
  return { code: '', name: '', type: '' };
}

openAdd() {
  var f = this.blankForm();              // 直接返回字面量最稳；也可 Object.assign({}, this.blankForm())
  this.setState({ modalOpen: true, form: f });
}
```

- `state` 类字段里的 `form: {}` 同样有风险：弹窗关闭/保存后用 `this.blankForm()` 重新生成，不要依赖 `state.form` 的空对象。
- 使用 `@/data/*` 数据模块时，不要在 method 里写 `Object.assign({}, MODULES[key].emptyForm)`（成员表达式源会被转成 `undefined`）；应在生成页面时把各模块的空表单字面量直接注入 `blankForm()` 的 `return` 语句。

## 类属性、共享组件与多路由页面

- 转换器只保留 `Document.state` 类字段，**其余类属性（如 `MODULE_KEY = 'x'`）会被丢弃**。需要模块键/常量时，在模板生成阶段把 `this.MODULE_KEY` 等引用替换为字面量字符串（如 `'samples'`），并删除类属性行。
- `@type Component` 作为页面根组件时**只渲染传入的 `children`，自身 `render()` 被丢弃** → 共享布局组件（Layout/Module 拆分）不可行。页面间复用只走 `@/data/*` 数据模块。
- 不要 import 另一个含 `export default class Document` 的页面/组件文件：重复 default 导出在运行时冲突，报 `Element type is invalid ... got: object`（React #130 白屏）。每个页面/组件文件应是独立的 `export default class Document`。

## import 与 util

可以使用自然 import：

```tsx
import { formatHealthLabel } from '@/modules/cover/cover-tools';
```

服务端会把页面表达式转换到运行时可消费的 schema/utils 结构。验证时不要只看 import 是否存在，还要确认：

- `utilsMap` 有对应条目。
- runtime manifest 有对应 export。
- runner 中实际注入并渲染了结果。

### 模块级声明限制

页面当前不可靠支持 `class Document` 之前的模块级运行时代码。不要在
`import` 和根组件 class 之间声明或依赖 `const`、`let`、`var`、
`function`、运行时对象或模块级副作用，例如：

```tsx
const DISTRICTS = ['朝阳区', '海淀区'];
function rnd(min, max) {
  return min + Math.random() * (max - min);
}
```

这类变量可能不会进入 schema；顶层函数虽然可能被收集为页面方法，但调用处
不会始终自动改写为 `this.rnd()`。不要依赖这种行为。

推荐替代方式：

- 页面共享数据放到 `/src/data/*.ts`，通过 named/default import 使用。
- 页面工具函数放到 `/src/utils/*.ts`，通过 import 使用。
- 只服务当前页面的方法定义为 `Document` 的 class method，并在调用处显式写 `this.methodName()`。
- 只服务当前页面的小型静态数据放进 `Document.state`，或作为受支持的 class property 使用。

页面文件在 import 后应直接进入 `IProps`、`IState`、`Document` 和
`export default` 结构，避免依赖模块级初始化顺序。

## 依赖策略

优先使用项目空间已有 `project.assets` 依赖。需要新依赖时：

1. 先读依赖列表，不要读取或修改内部 `assets`。
2. 缺少依赖时执行 `appthen install <package[@version]>`。
3. 记住 runtime build 会在隔离 workspace 生成临时 `package.json` 并执行 `pnpm install`；依赖版本无法解析时不会静默回退 `latest`。
4. 完成 runtime build、bundle/manifest 和 runner 验证。

## 事件处理与 `this` 绑定

类组件中事件回调里的 `this` 容易丢失。转换器对箭头类字段（`handleX = () => {}`）的支持不稳定，推荐统一用 `var self = this` 模式，或在 JSX 里用内联箭头捕获 `this`：

```tsx
class Document extends React.Component<IProps, IState> {
  selectModule(module) {
    this.setState({ activeModule: module });
  }

  renderSidebar() {
    var self = this;
    return (
      <button onClick={function () { self.selectModule('samples'); }}>
        样品管理
      </button>
    );
  }

  // 等价写法：在 JSX 中直接用内联箭头捕获 this
  // <button onClick={() => this.selectModule('samples')}>样品管理</button>
}
```

要点：

- 不要在 `render()` 之外定义普通 `function` 并依赖其内部的 `this` 指向组件。
- 需要复用的处理器定义为 class method，调用处用内联箭头 `() => this.method()` 包裹。
- 复杂表单提交、删除确认等闭包场景用 `var self = this` 最稳。

## 最小可运行模板

新建页面直接套用下面的骨架，已满足全部转换器硬约束（`@type Page` 元信息、无 `constructor`、`state` 类字段默认值、`IState` 只声明类型、`render()` 局部变量无类型注解、class method 返回 JSX、事件 `this` 绑定安全）：

```tsx
/**
 * @type Page
 * @route /lims
 * @frames web
 * @clients web
 */
import React from 'react';
import { Flask } from 'lucide-react';

class IProps {}
class IState {
  activeModule: string;
  rows: any[];
  keyword: string;
  modalOpen: boolean;
}

class Document extends React.Component<IProps, IState> {
  state = {
    activeModule: 'dashboard',
    rows: [],
    keyword: '',
    modalOpen: false,
  };

  componentDidMount() {
    // 初始化数据 / 拉取接口
  }

  selectModule(module) {
    this.setState({ activeModule: module });
  }

  renderSidebar() {
    var self = this;
    return (
      <aside>
        <button className="..." onClick={function () { self.selectModule('dashboard'); }}>仪表盘</button>
      </aside>
    );
  }

  renderDashboard() {
    return <section>...</section>;
  }

  render() {
    var active = this.state.activeModule;
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        {this.renderSidebar()}
        {active === 'dashboard' ? this.renderDashboard() : null}
      </main>
    );
  }
}

export default Document;
```

图标优先使用已安装的 `lucide-react`（`import { Flask, Microscope, Beaker } from 'lucide-react'`）；表格、表单、弹窗等复杂业务控件可用项目已有的 `antd` 或 `@appthen/antd`。
