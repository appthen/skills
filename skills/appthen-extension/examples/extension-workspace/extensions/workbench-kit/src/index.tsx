import React, { useMemo, useState } from 'react';
import type { ExtensionBadge, PluginContext } from '@appthen/vibe-workspace/plugins/base';
import {
  CodingButton,
  CodingInput,
  CodingListDetailWorkspace,
  CodingPanel,
} from '@appthen/vibe-workspace/coding-kit';
import '@appthen/vibe-workspace/styles.css';
import {
  WorkbenchSelect,
  WorkbenchSelectContent,
  WorkbenchSelectItem,
  WorkbenchSelectTrigger,
  WorkbenchSelectValue,
} from '@appthen/vibe-workspace/ui';
import {
  WorkbenchDialog,
  WorkbenchDialogContent,
  WorkbenchDialogDescription,
  WorkbenchDialogFooter,
  WorkbenchDialogHeader,
  WorkbenchDialogTitle,
  WorkbenchDrawer,
  WorkbenchDrawerContent,
  WorkbenchDrawerDescription,
  WorkbenchDrawerFooter,
  WorkbenchDrawerHeader,
  WorkbenchDrawerTitle,
} from '@appthen/vibe-workspace/overlay';

const VIEW_API_GALLERY = 'editor.acme.workbench-kit.api-gallery';
const VIEW_THEME_GUIDE = 'editor.acme.workbench-kit.theme-guide';
const VIEW_COMPONENT_PREVIEW = 'editor.acme.workbench-kit.component-preview';
const VIEW_API_REFERENCE = 'editor.acme.workbench-kit.api-reference';
const VIEW_CASES = 'editor.acme.workbench-kit.cases';
const VIEW_COMPONENTS = 'editor.acme.workbench-kit.components';
const VIEW_REGRESSION = 'editor.acme.workbench-kit.regression';
const VIEW_OVERLAY_GUIDE = 'editor.acme.workbench-kit.overlay-guide';
const VIEW_RESPONSIVE_WORKSPACE = 'editor.acme.workbench-kit.responsive-workspace';
const VIEW_CODING_TEMPLATE = 'editor.acme.workbench-kit.coding-template';
const SIDEBAR_VIEW_ID = 'sidebar.acme.workbench-kit';

let openApiGalleryTab: () => void = () => undefined;
let openEditorTab: (viewId: string, title: string, props?: Record<string, unknown>) => void = () => undefined;
let kitContext: PluginContext | null = null;

const panelStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'auto',
  fontSize: 13,
  padding: 16,
  color: 'var(--vscode-editor-foreground)',
  background: 'var(--vscode-sideBar-background)',
  fontFamily: 'system-ui, sans-serif',
};

const mainStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'auto',
  fontSize: 13,
  padding: 24,
  color: 'var(--vscode-editor-foreground)',
  background: 'var(--vscode-editor-background)',
  fontFamily: 'system-ui, sans-serif',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--vscode-panel-background)',
};

const buttonStyle: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.2,
  fontFamily: 'inherit',
  borderRadius: 6,
  border: '1px solid var(--vscode-panel-border)',
  color: 'var(--vscode-editor-foreground)',
  background: 'var(--vscode-input-background)',
};

const mutedStyle: React.CSSProperties = {
  color: 'var(--vscode-input-placeholderForeground)',
  lineHeight: 1.6,
};

const themeExample = {
  id: 'acme.sales',
  label: 'Acme 销售',
  type: 'dark',
  extends: 'vercel',
  colors: {
    'workbench.background': '#101820',
    'editor.background': '#101820',
    'editor.foreground': '#f4f7fa',
    'sideBar.background': '#17232d',
    'activityBar.background': '#0d141a',
    'button.background': '#2f9e8f',
    'input.background': '#1d2b35',
    'panel.border': '#2b414d',
  },
  portalColors: {
    primary: '#2f9e8f',
    'primary-hover': '#48b6a5',
    card: '#17232d',
  },
  monaco: {
    base: 'vs-dark',
    colors: {
      'editor.background': '#101820',
      'editor.foreground': '#f4f7fa',
    },
    rules: [],
  },
};

function BlockCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 12, ...mutedStyle }}>{children}</div>
    </section>
  );
}

function Sidebar() {
  return (
    <div style={panelStyle}>
      <h2 style={{ margin: 0, fontSize: 16 }}>工作台工具包</h2>
      <p style={{ marginTop: 8, ...mutedStyle }}>
        用于展示工作台 API、可复用区块和编辑器页签的扩展起手式。
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <BlockCard title="侧边栏视图">通过 ctx.capabilities.registerSidebarView 注册。</BlockCard>
        <BlockCard title="编辑器页签视图">将 React 组件作为独立页签打开，并使用 view:// 文件定位。</BlockCard>
        <button type="button" style={buttonStyle} onClick={openApiGalleryTab}>
          打开 API 示例页签
        </button>
        <button type="button" style={buttonStyle} onClick={() => openEditorViewById(VIEW_THEME_GUIDE, '工作台主题指南')}>
          打开主题指南页签
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => openEditorTab(VIEW_COMPONENT_PREVIEW, '组件预览', { variant: 'compact' })}
        >
          打开组件预览页签
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => openEditorTab(VIEW_API_REFERENCE, 'API 参考', { section: 'capabilities' })}
        >
          打开 API 参考页签
        </button>
        <button type="button" style={buttonStyle} onClick={() => openEditorViewById(VIEW_CASES, '扩展案例')}>
          打开扩展案例页签
        </button>
        <button type="button" style={buttonStyle} onClick={() => openEditorViewById(VIEW_OVERLAY_GUIDE, '弹窗与侧边抽屉规范')}>
          打开弹窗与抽屉规范页签
        </button>
        <button type="button" style={buttonStyle} onClick={() => openEditorViewById(VIEW_RESPONSIVE_WORKSPACE, '多栏工作区与移动端折叠规范')}>
          打开多栏工作区规范页签
        </button>
        <button type="button" style={buttonStyle} onClick={() => openEditorTab(VIEW_COMPONENTS, 'UI 组件', { variant: 'interactive' })}>
          打开 UI 组件页签
        </button>
        <button type="button" style={buttonStyle} onClick={() => openEditorTab(VIEW_REGRESSION, '回归检查')}>
          运行回归检查
        </button>
        <CodingButton
          type="button"
          variant="primary"
          onClick={() => openEditorTab(VIEW_CODING_TEMPLATE, 'Coding 协作模板')}
        >
          打开 Coding 协作模板
        </CodingButton>
      </div>
    </div>
  );
}

function openEditorViewById(viewId: string, title: string) {
  kitContext?.views.openEditor({ viewId, title, props: { title }, key: viewId });
}

function OverlayGuideView({ onClose }: { onClose?: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  return (
    <div style={mainStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>弹窗与侧边抽屉规范</h1>
        <button type="button" style={{ ...buttonStyle, padding: '0 12px' }} onClick={onClose}>关闭</button>
      </div>
      <p style={{ marginTop: 8, maxWidth: 760, ...mutedStyle }}>主项目和扩展都应遵循同一套 Overlay 交互契约。下面两个实例可直接操作验证。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 20 }}>
        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 15 }}>弹窗 Dialog</h2>
          <p style={{ margin: '8px 0 0', fontSize: 12, ...mutedStyle }}>适用于确认、创建、编辑和权限变更等聚焦任务。</p>
          <button type="button" style={{ ...buttonStyle, marginTop: 14 }} onClick={() => setDialogOpen(true)}>打开弹窗</button>
        </section>
        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: 15 }}>侧边抽屉 Drawer</h2>
          <p style={{ margin: '8px 0 0', fontSize: 12, ...mutedStyle }}>适用于详情、筛选、分享和配置等上下文任务。</p>
          <button type="button" style={{ ...buttonStyle, marginTop: 14 }} onClick={() => setDrawerOpen(true)}>打开抽屉</button>
        </section>
      </div>
      <section style={{ ...cardStyle, marginTop: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15 }}>共同规则</h2>
        <ul style={{ margin: '10px 0 0', paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
          <li>必须有标题；有解释内容时同时提供描述。</li>
          <li>支持 Esc、遮罩点击、焦点恢复和内容区滚动。</li>
          <li>需要分享或恢复的内容统一使用编辑器页签。</li>
        </ul>
      </section>
      <WorkbenchDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <WorkbenchDialogContent>
          <WorkbenchDialogHeader>
            <WorkbenchDialogTitle>示例弹窗</WorkbenchDialogTitle>
            <WorkbenchDialogDescription>用于确认、创建和编辑等需要聚焦完成的任务。</WorkbenchDialogDescription>
          </WorkbenchDialogHeader>
          <div className="text-sm leading-6">
            <p>弹窗默认限制宽度和高度，超出内容只在内容区域滚动。</p>
            <p className="mt-3 text-xs text-muted-foreground">支持 Esc、遮罩点击和明确的关闭按钮。</p>
          </div>
          <WorkbenchDialogFooter>
            <button type="button" className="rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium" onClick={() => setDialogOpen(false)}>取消</button>
            <button type="button" className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" onClick={() => setDialogOpen(false)}>完成示例</button>
          </WorkbenchDialogFooter>
        </WorkbenchDialogContent>
      </WorkbenchDialog>
      <WorkbenchDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <WorkbenchDrawerContent side="right" mobileSide="bottom" className="flex flex-col gap-0 overflow-hidden p-0">
          <WorkbenchDrawerHeader className="shrink-0 border-b border-border px-5 py-4 pr-14">
            <WorkbenchDrawerTitle>示例侧边抽屉</WorkbenchDrawerTitle>
            <WorkbenchDrawerDescription>用于详情、筛选、分享和配置，同时保留当前主区域上下文。</WorkbenchDrawerDescription>
          </WorkbenchDrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm leading-6">
            <p>桌面端从右侧打开，移动端自动切换为底部抽屉。</p>
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 8 }, (_, index) => <div key={index} className="rounded-md border border-border p-2.5">可滚动内容 {index + 1}</div>)}
            </div>
          </div>
          <WorkbenchDrawerFooter className="shrink-0 border-t border-border px-5 py-3">
            <button type="button" className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" onClick={() => setDrawerOpen(false)}>关闭抽屉</button>
          </WorkbenchDrawerFooter>
        </WorkbenchDrawerContent>
      </WorkbenchDrawer>
    </div>
  );
}

// === 扩展 Badge 演示 ===
// setSidebarBadge 作用于 Activity Bar 入口按钮，setEditorTabBadge 作用于本扩展打开的编辑器页签。
function BadgeDemoSection() {
  const setSidebarBadge = (badge: ExtensionBadge | null) => {
    kitContext?.capabilities.setSidebarBadge({ viewId: SIDEBAR_VIEW_ID, badge });
  };
  const setTabBadge = (badge: ExtensionBadge | null) => {
    kitContext?.capabilities.setEditorTabBadge({ viewId: VIEW_API_GALLERY, key: VIEW_API_GALLERY, badge });
  };

  return (
    <section style={{ ...cardStyle, marginTop: 12 }}>
      <strong>Badge 提示</strong>
      <p style={{ margin: '6px 0 10px', fontSize: 12, ...mutedStyle }}>
        setSidebarBadge 提示左侧 Activity Bar 入口按钮，setEditorTabBadge 提示本扩展打开的页签；传 null 清除，扩展停用时宿主自动清理。
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" style={buttonStyle} onClick={() => setSidebarBadge({ count: 128 })}>侧边栏入口 · 数字</button>
        <button type="button" style={buttonStyle} onClick={() => setSidebarBadge({ text: '新', tone: 'info' })}>侧边栏入口 · 文本</button>
        <button type="button" style={buttonStyle} onClick={() => setSidebarBadge({ dot: true, tone: 'success' })}>侧边栏入口 · 圆点</button>
        <button type="button" style={buttonStyle} onClick={() => setTabBadge({ count: 3, tone: 'warning' })}>当前页签 · 数字</button>
        <button type="button" style={buttonStyle} onClick={() => { setSidebarBadge(null); setTabBadge(null); }}>全部清除</button>
      </div>
    </section>
  );
}

function MainView({ onClose }: { onClose?: () => void }) {
  return (
    <div style={mainStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>扩展 API 示例</h1>
        <button type="button" style={{ ...buttonStyle, padding: '0 12px' }} onClick={onClose}>
          关闭
        </button>
      </div>
      <p style={{ marginTop: 8, maxWidth: 720, ...mutedStyle }}>
        这个编辑器页签适合承载仪表盘、设置页和完整的扩展页面。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 20 }}>
        <BlockCard title="组件区块">使用 CSS 变量创建小型 React 区块，使其自动继承工作台主题。</BlockCard>
        <BlockCard title="运行时 API">从 ctx.runtime 和 ctx.auth 读取租户、工作台和当前操作者上下文。</BlockCard>
        <BlockCard title="贡献点">通过 ctx.capabilities.registerContribution 注册顶部栏、资源管理器或自定义贡献。</BlockCard>
        <BlockCard title="UI 资源">通过 manifest.mcp.uiResources 暴露可复用 UI 资源，为后续平台共享做准备。</BlockCard>
      </div>
      <BadgeDemoSection />
    </div>
  );
}

function ResponsiveWorkspaceGuide({ onClose }: { onClose?: () => void }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const members = ['林夏', '周然', '陈默', '赵一'];

  return (
    <div style={mainStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>多栏工作区与移动端折叠规范</h1>
        <button type="button" style={{ ...buttonStyle, padding: '0 12px' }} onClick={onClose}>关闭</button>
      </div>
      <p style={{ marginTop: 8, maxWidth: 760, ...mutedStyle }}>
        桌面端保留导航、列表、详情的并行关系；移动端将导航交给工作台抽屉，列表和详情改为同一主区域内的前进与返回。
      </p>
      <style>{`
        .wk-responsive-workspace { display: grid; grid-template-columns: 180px minmax(0, 1fr) 250px; height: 430px; overflow: hidden; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: var(--vscode-editor-background); }
        .wk-responsive-nav, .wk-responsive-list, .wk-responsive-detail { min-width: 0; overflow: hidden; }
        .wk-responsive-nav { border-right: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); }
        .wk-responsive-list { border-right: 1px solid var(--vscode-panel-border); }
        .wk-responsive-detail { display: flex; flex-direction: column; }
        .wk-responsive-back { display: none; }
        .wk-responsive-item { display: flex; width: 100%; align-items: center; gap: 8px; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 60%, transparent); background: transparent; color: var(--vscode-editor-foreground); padding: 10px 12px; text-align: left; font: inherit; cursor: pointer; }
        .wk-responsive-item:hover { background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent); }
        @media (max-width: 767px) {
          .wk-responsive-workspace { grid-template-columns: minmax(0, 1fr); height: 430px; }
          .wk-responsive-nav, .wk-responsive-detail { display: none; }
          .wk-responsive-workspace.is-detail-open .wk-responsive-list { display: none; }
          .wk-responsive-workspace.is-detail-open .wk-responsive-detail { display: flex; }
          .wk-responsive-back { display: inline-flex; }
        }
      `}</style>
      <div className={`wk-responsive-workspace${detailOpen ? ' is-detail-open' : ''}`} style={{ marginTop: 18 }}>
        <aside className="wk-responsive-nav">
          <div style={{ padding: 14, fontWeight: 700 }}>工作区导航</div>
          {['全部成员', '部门', '角色', '邀请'].map((item, index) => (
            <div key={item} style={{ padding: '10px 14px', fontSize: 12, color: index === 0 ? 'var(--vscode-editor-foreground)' : 'var(--vscode-input-placeholderForeground)', background: index === 0 ? 'color-mix(in srgb, var(--vscode-button-background) 12%, transparent)' : 'transparent' }}>
              {item}
            </div>
          ))}
        </aside>
        <section className="wk-responsive-list">
          <div style={{ borderBottom: '1px solid var(--vscode-panel-border)', padding: 14 }}>
            <strong>成员列表</strong>
            <div style={{ marginTop: 6, fontSize: 11, ...mutedStyle }}>移动端先浏览列表，再进入详情</div>
          </div>
          {members.map((member, index) => (
            <button key={member} type="button" className="wk-responsive-item" onClick={() => setDetailOpen(true)}>
              <span style={{ display: 'inline-flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--vscode-button-background)', color: 'white', fontSize: 11 }}>{member.slice(0, 1)}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ display: 'block', fontSize: 12 }}>{member}</strong>
                <span style={{ display: 'block', marginTop: 3, fontSize: 11, ...mutedStyle }}>{index % 2 ? '产品部' : '研发部'}</span>
              </span>
            </button>
          ))}
        </section>
        <aside className="wk-responsive-detail">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--vscode-panel-border)', padding: 14 }}>
            <button type="button" className="wk-responsive-back" style={{ ...buttonStyle, height: 28, padding: '0 8px' }} onClick={() => setDetailOpen(false)}>返回</button>
            <strong>成员详情</strong>
          </div>
          <div style={{ padding: 16, fontSize: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>林夏</div>
            <div style={{ marginTop: 5, ...mutedStyle }}>研发部 · 产品工程师</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
              {['职位：产品工程师', '部门：研发部', '状态：正常', '邮箱：linxia@example.com'].map((item) => <div key={item} style={cardStyle}>{item}</div>)}
            </div>
          </div>
        </aside>
      </div>
      <section style={{ ...cardStyle, marginTop: 12 }}>
        <strong>规范要点</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
          <li>桌面端可并行展示导航、列表、详情，列宽必须允许内容收缩。</li>
          <li>移动端不把多栏压缩成纵向长页面；导航进抽屉，详情改为全屏滑层。</li>
          <li>移动端详情必须提供返回列表，返回后保留列表筛选和滚动上下文。</li>
        </ul>
      </section>
    </div>
  );
}

function ThemeGuideView({ onClose }: { onClose?: () => void }) {
  return (
    <div style={mainStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>工作台主题指南</h1>
        <button type="button" style={{ ...buttonStyle, padding: '0 12px' }} onClick={onClose}>关闭</button>
      </div>
      <p style={{ marginTop: 8, maxWidth: 760, ...mutedStyle }}>
        离线主题契约的可运行参考。主题定义属于工作台配置，不应通过扩展激活副作用设置。
      </p>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: 20 }}>
        {[
          ['工作台', 'var(--vscode-workbench-background)'],
          ['编辑器', 'var(--vscode-editor-background)'],
          ['侧边栏', 'var(--vscode-sideBar-background)'],
          ['强调色', 'var(--vscode-button-background)'],
          ['门户', 'var(--portal-primary)'],
        ].map(([label, color]) => (
          <section key={label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: color, border: '1px solid var(--vscode-panel-border)' }} />
            <div><strong>{label}</strong><div style={{ fontSize: 11, ...mutedStyle }}>{color}</div></div>
          </section>
        ))}
      </div>
      <pre style={{ ...cardStyle, marginTop: 20, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6 }}>
        {JSON.stringify(themeExample, null, 2)}
      </pre>
      <p style={{ marginTop: 12, ...mutedStyle }}>
        建议使用本地文件：themes/acme-sales.json。本示例用于说明契约和 token 继承；全局自定义主题注册将在后续运行时能力中提供。
      </p>
    </div>
  );
}

function ComponentPreviewTab(props: { title?: string; variant?: string }) {
  return (
    <div style={mainStyle}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{props.title || '组件预览'}</h1>
      <p style={{ marginTop: 8, ...mutedStyle }}>
        这个 React 组件通过 ctx.views.openEditor() 作为普通编辑器页签打开。
      </p>
      <div style={{ display: 'grid', gap: 12, marginTop: 20, maxWidth: 520 }}>
        <BlockCard title="可复用区块">租户专属组件可以先采用这种模式，成熟后再提升到共享 UI 包。</BlockCard>
        <BlockCard title="属性">变体 = {props.variant || '-'}</BlockCard>
      </div>
    </div>
  );
}

function ApiReferenceTab(props: { title?: string; section?: string }) {
  return (
    <div style={mainStyle}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{props.title || 'API 参考'}</h1>
      <p style={{ marginTop: 8, ...mutedStyle }}>
        这个页签展示大多数本地扩展所需的最小 API 集合。
      </p>
      <pre style={{ ...cardStyle, marginTop: 20, whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6 }}>
{`ctx.capabilities.registerSidebarView(...)
ctx.capabilities.registerEditorView(...)
ctx.capabilities.registerFrontendToolHandler(...)
ctx.capabilities.registerContribution(...)

import { WorkbenchDialog, WorkbenchDrawer } from '@appthen/vibe-workspace/overlay';

ctx.views.openEditor(...)
ctx.links.create(...)`}
      </pre>
      <p style={{ marginTop: 12, ...mutedStyle }}>章节 = {props.section || '-'}</p>
    </div>
  );
}

function CasesView({ onClose }: { onClose?: () => void }) {
  const cases = [
    { title: '侧边栏贡献', description: '使用 ctx.capabilities 注册侧边栏视图。', viewId: VIEW_COMPONENTS, tabTitle: 'UI 组件' },
    { title: '可分享的编辑器页签', description: '使用稳定的 routeKey 和可序列化属性打开视图。', viewId: VIEW_API_REFERENCE, tabTitle: 'API 参考' },
    { title: '运行时 API 检查', description: '在真实扩展中查看租户、工作台和当前操作者上下文。', viewId: VIEW_REGRESSION, tabTitle: '回归检查' },
  ];
  return (
    <div style={mainStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>扩展案例</h1>
        <button type="button" style={{ ...buttonStyle, padding: '0 12px' }} onClick={onClose}>关闭</button>
      </div>
      <p style={{ marginTop: 8, ...mutedStyle }}>稳定工作台扩展契约的可运行案例。</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 20, maxWidth: 720 }}>
        {cases.map((item) => (
          <section key={item.title} style={cardStyle}>
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            <div style={{ marginTop: 6, ...mutedStyle }}>{item.description}</div>
            <button type="button" style={{ ...buttonStyle, marginTop: 12 }} onClick={() => openEditorTab(item.viewId, item.tabTitle, { source: 'cases' })}>
              打开案例
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}

function ComponentsTab(props: { title?: string; variant?: string }) {
  const [count, setCount] = useState(0);
  const [enabled, setEnabled] = useState(true);
  return (
    <div style={mainStyle}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{props.title || 'UI 组件'}</h1>
      <p style={{ marginTop: 8, ...mutedStyle }}>可提升为共享 UI 区块的交互式组件示例。</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 20, maxWidth: 520 }}>
        <section style={cardStyle}>
          <strong>按钮</strong>
          <div style={{ marginTop: 8, ...mutedStyle }}>已点击 {count} 次。变体 = {props.variant || '-'}</div>
          <button type="button" style={{ ...buttonStyle, marginTop: 12 }} onClick={() => setCount((value) => value + 1)}>点击组件</button>
        </section>
        <section style={cardStyle}>
          <strong>开关</strong>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            {enabled ? '已启用' : '已禁用'}
          </label>
        </section>
      </div>
    </div>
  );
}

function RegressionTab() {
  const [ran, setRan] = useState(false);
  const checks = [
    ['插件上下文', Boolean(kitContext?.plugin.id)],
    ['运行时上下文', Boolean(kitContext?.runtime.workbenchId)],
    ['视图 API', typeof kitContext?.views.openEditor === 'function'],
    ['链接 API', typeof kitContext?.links.create === 'function'],
    ['能力 API', typeof kitContext?.capabilities.registerContribution === 'function'],
  ] as const;
  return (
    <div style={mainStyle}>
      <h1 style={{ margin: 0, fontSize: 20 }}>回归检查</h1>
      <p style={{ marginTop: 8, ...mutedStyle }}>用于快速验证扩展宿主契约的小型检查面板。</p>
      <button type="button" style={{ ...buttonStyle, marginTop: 16 }} onClick={() => setRan(true)}>运行检查</button>
      <div style={{ display: 'grid', gap: 8, marginTop: 16, maxWidth: 520 }}>
        {checks.map(([label, passed]) => (
          <div key={label} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between' }}>
            <span>{label}</span><strong>{ran && passed ? '通过' : ran ? '失败' : '未运行'}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

type CodingTemplateItem = {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: '进行中' | '已完成' | '待开始';
  due: string;
};

const codingTemplateItems: CodingTemplateItem[] = [
  {
    id: 'task-001',
    title: '完善成员邀请流程',
    description: '补齐邀请、角色和通知状态的协作流程。',
    owner: '林夏',
    status: '进行中',
    due: '今天',
  },
  {
    id: 'task-002',
    title: '整理工作台权限矩阵',
    description: '确认团队管理员和普通成员的功能边界。',
    owner: '周然',
    status: '待开始',
    due: '明天',
  },
  {
    id: 'task-003',
    title: '发布移动端适配检查单',
    description: '覆盖列表、详情、抽屉和表单的窄屏行为。',
    owner: '陈默',
    status: '已完成',
    due: '周五',
  },
];

const statusStyle: Record<CodingTemplateItem['status'], React.CSSProperties> = {
  进行中: { color: 'var(--ck-status-brand-text)', background: 'var(--ck-status-brand-bg)' },
  已完成: { color: 'var(--ck-status-success-text)', background: 'var(--ck-status-success-bg)' },
  待开始: { color: 'var(--ck-status-idle-text)', background: 'var(--ck-status-idle-bg)' },
};

function CodingTemplateView() {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部状态');
  const [editorOpen, setEditorOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return codingTemplateItems.filter((item) => {
      const matchesQuery = !normalizedQuery
        || `${item.title} ${item.description} ${item.owner}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === '全部状态' || item.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  return (
    <div className="coding-kit" style={{ height: '100%', minHeight: 0, padding: 16, background: 'var(--ck-surface-page)' }}>
      <CodingListDetailWorkspace
        title="事项协作"
        subtitle="Workbench Kit 的标准列表-详情模板，适用于团队协作型扩展。"
        rows={visibleItems}
        getRowInfo={(item) => ({
          key: item.id,
          title: item.title,
          description: item.description,
          meta: `${item.owner} · 截止 ${item.due}`,
          status: <span style={{ ...statusStyle[item.status], borderRadius: 4, padding: '3px 6px', fontSize: 11 }}>{item.status}</span>,
        })}
        toolbar={(
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 'min(100%, 320px)', minWidth: 0 }}>
              <CodingInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索事项、描述或负责人"
                containerClassName="min-w-0"
              />
            </div>
            <WorkbenchSelect value={statusFilter} onValueChange={setStatusFilter}>
              <WorkbenchSelectTrigger aria-label="事项状态" className="text-xs" style={{ width: 160, height: 32 }}>
                <WorkbenchSelectValue placeholder="全部状态" />
              </WorkbenchSelectTrigger>
              <WorkbenchSelectContent>
                <WorkbenchSelectItem value="全部状态">全部状态</WorkbenchSelectItem>
                <WorkbenchSelectItem value="进行中">进行中</WorkbenchSelectItem>
                <WorkbenchSelectItem value="待开始">待开始</WorkbenchSelectItem>
                <WorkbenchSelectItem value="已完成">已完成</WorkbenchSelectItem>
              </WorkbenchSelectContent>
            </WorkbenchSelect>
            <span style={{ color: 'var(--ck-text-muted)', fontSize: 12 }}>{visibleItems.length} 条结果</span>
          </div>
        )}
        headerActions={(
          <CodingButton type="button" variant="primary" size="sm" onClick={() => { setSaved(false); setEditorOpen(true); }}>
            新建事项
          </CodingButton>
        )}
        detailActions={(
          <CodingButton type="button" size="sm" onClick={() => { setSaved(false); setEditorOpen(true); }}>
            编辑
          </CodingButton>
        )}
        renderDetail={({ row }) => (
          <div style={{ display: 'grid', gap: 16 }}>
            <CodingPanel style={{ padding: 16 }}>
              <div style={{ color: 'var(--ck-text-muted)', fontSize: 12 }}>事项说明</div>
              <p style={{ margin: '8px 0 0', color: 'var(--ck-text-primary)', fontSize: 14, lineHeight: 1.7 }}>{row.description}</p>
            </CodingPanel>
            <CodingPanel style={{ display: 'grid', gap: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--ck-text-muted)', fontSize: 12 }}>负责人</span><strong style={{ fontSize: 13 }}>{row.owner}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--ck-text-muted)', fontSize: 12 }}>状态</span><span style={{ ...statusStyle[row.status], borderRadius: 4, padding: '3px 6px', fontSize: 11 }}>{row.status}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color: 'var(--ck-text-muted)', fontSize: 12 }}>截止时间</span><strong style={{ fontSize: 13 }}>{row.due}</strong></div>
            </CodingPanel>
            <div style={{ color: 'var(--ck-text-muted)', fontSize: 12 }}>这是扩展开发者可以直接替换数据查询、行渲染和详情内容的模板入口。</div>
          </div>
        )}
        editor={(
          <div style={{ display: 'grid', minWidth: 0, gap: 16 }}>
            <label style={{ display: 'grid', minWidth: 0, gap: 6, color: 'var(--ck-text-secondary)', fontSize: 12 }}>
              事项标题
              <CodingInput defaultValue="新的协作事项" style={{ minWidth: 0, maxWidth: '100%' }} />
            </label>
            <label style={{ display: 'grid', minWidth: 0, gap: 6, color: 'var(--ck-text-secondary)', fontSize: 12 }}>
              事项描述
              <textarea defaultValue="填写目标、范围和协作信息" style={{ minHeight: 96, width: '100%', maxWidth: '100%', resize: 'vertical', border: '1px solid var(--ck-border-default)', borderRadius: 4, padding: 10, color: 'var(--ck-text-primary)', background: 'var(--ck-surface-overlay)', font: 'inherit', fontSize: 13 }} />
            </label>
          </div>
        )}
        editorTitle="新建协作事项"
        editorDescription="桌面端从右侧打开，移动端从底部打开。"
        editorOpen={editorOpen}
        onEditorOpenChange={setEditorOpen}
        editorFooter={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
            <CodingButton type="button" size="sm" onClick={() => setEditorOpen(false)}>取消</CodingButton>
            <CodingButton type="button" variant="primary" size="sm" onClick={() => { setSaved(true); setEditorOpen(false); }}>保存</CodingButton>
          </div>
        )}
      />
      {saved ? <div role="status" style={{ position: 'fixed', right: 16, bottom: 16, borderRadius: 6, padding: '8px 12px', color: 'var(--ck-status-success-text)', background: 'var(--ck-status-success-bg)', fontSize: 12 }}>已保存示例</div> : null}
    </div>
  );
}

export function activate(ctx: PluginContext) {
  kitContext = ctx;
  openApiGalleryTab = () => {
    ctx.views.openEditor({
      viewId: VIEW_API_GALLERY,
      title: '扩展 API 示例',
      props: { title: '扩展 API 示例' },
      key: VIEW_API_GALLERY,
    });
  };

  openEditorTab = (viewId, title, props = {}) => {
    ctx.views.openEditor({ viewId, title, props: { ...props, title }, key: title });
  };

  const disposers = [
    ctx.capabilities.registerSidebarView({
      id: SIDEBAR_VIEW_ID,
      title: '工作台工具包',
      component: Sidebar,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_API_GALLERY,
      routeKey: 'api-gallery',
      title: '扩展 API 示例',
      component: MainView,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_THEME_GUIDE,
      routeKey: 'theme-guide',
      title: '工作台主题指南',
      component: ThemeGuideView,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_CASES,
      routeKey: 'cases',
      title: '扩展案例',
      component: CasesView,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_OVERLAY_GUIDE,
      routeKey: 'overlay-guide',
      title: '弹窗与侧边抽屉规范',
      component: OverlayGuideView,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_RESPONSIVE_WORKSPACE,
      routeKey: 'responsive-workspace',
      title: '多栏工作区与移动端折叠规范',
      component: ResponsiveWorkspaceGuide,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_COMPONENT_PREVIEW,
      routeKey: 'component-preview',
      title: '组件预览',
      component: ComponentPreviewTab,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_API_REFERENCE,
      routeKey: 'api-reference',
      title: 'API 参考',
      component: ApiReferenceTab,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_COMPONENTS,
      routeKey: 'components',
      title: 'UI 组件',
      component: ComponentsTab,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_REGRESSION,
      routeKey: 'regression',
      title: '回归检查',
      component: RegressionTab,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_CODING_TEMPLATE,
      routeKey: 'coding-template',
      title: 'Coding 协作模板',
      component: CodingTemplateView,
    }),
    ctx.capabilities.registerFrontendToolHandler({
      ref: 'echo',
      source: 'manifest:acme.workbench-kit',
      handler: async (input, runtime) => ({
        ok: true,
        input,
        actor: runtime.actor,
        handledAt: new Date().toISOString(),
      }),
    }),
    ctx.capabilities.registerContribution('topbar.item', 'acme.workbench-kit.status', {
      component: () => <span style={{ fontSize: 12, color: 'var(--vscode-input-placeholderForeground)' }}>本地扩展</span>,
    }),
  ];

  return () => {
    kitContext = null;
    disposers.forEach((dispose) => dispose());
  };
}
