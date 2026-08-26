import React, { useMemo, useState } from 'react';
import type { PluginContext } from '@appthen/vibe-workspace/plugins/base';

/* ------------------------------------------------------------------ *
 * 关系图建模工作台（P3）
 * 租户在 Workbench 扩展里可视化定义 graphmodel/v1 schema，
 * 调用后端 /nebula-graph/models/{preview,apply}（租户上下文由后端从 token 推导）。
 * 扩展本身不碰多租户切换：ctx.runtime.tenantId 由宿主注入。
 * ------------------------------------------------------------------ */

const VIEW_STUDIO = 'editor.mengti.graph-modeling-studio.main';

const ALLOWED_TYPES = [
  'string', 'int', 'double', 'bool', 'date', 'datetime', 'time', 'timestamp',
];
const CARDINALITIES = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'];

type Prop = { name: string; type: string; notNull?: boolean };
type IndexDef = { name: string; properties: string[] };
type TagDef = {
  name: string;
  comment?: string;
  properties: Prop[];
  indexes: IndexDef[];
};
type EdgeDef = {
  name: string;
  from: string;
  to: string;
  comment?: string;
  cardinality: string;
  properties: Prop[];
};
type GraphModel = {
  apiVersion: 'graphmodel/v1';
  metadata: { name: string; tenantId: string; version: string };
  space: { name: string; partition_num?: number; replica_factor?: number; vid_type?: string };
  tags: TagDef[];
  edges: EdgeDef[];
};

let studioContext: PluginContext | null = null;

/* ---------------- API helpers ---------------- */

function getApiBase(): string {
  const w = window as any;
  if (w.__APPTHEN_API_BASE_URL__) return String(w.__APPTHEN_API_BASE_URL__).replace(/\/$/, '');
  try {
    const meta = (import.meta as any).env;
    if (meta?.VITE_API_BASE_URL) return String(meta.VITE_API_BASE_URL).replace(/\/$/, '');
  } catch {
    /* ignore */
  }
  return '';
}

async function apiPost(
  ctx: PluginContext,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = ctx.auth.getAccessToken();
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, data };
}

/* ---------------- Model factory ---------------- */

function emptyModel(tenantId: string): GraphModel {
  return {
    apiVersion: 'graphmodel/v1',
    metadata: { name: '未命名模型', tenantId, version: '0.1.0' },
    space: { name: '', partition_num: 100, replica_factor: 1, vid_type: 'FIXED_STRING(64)' },
    tags: [],
    edges: [],
  };
}

function sampleSpec(tenantId: string): GraphModel {
  return {
    apiVersion: 'graphmodel/v1',
    metadata: { name: '科研检测关系模型', tenantId, version: '0.1.0' },
    space: { name: '', partition_num: 100, replica_factor: 1, vid_type: 'FIXED_STRING(64)' },
    tags: [
      { name: 'Customer', comment: '客户', properties: [{ name: 'name', type: 'string', notNull: true }, { name: 'contact', type: 'string' }, { name: 'createdAt', type: 'int' }], indexes: [{ name: 'customer_name_idx', properties: ['name'] }] },
      { name: 'Supplier', comment: '供应商', properties: [{ name: 'name', type: 'string', notNull: true }, { name: 'creditCode', type: 'string', notNull: true }, { name: 'region', type: 'string' }], indexes: [{ name: 'supplier_credit_idx', properties: ['creditCode'] }] },
      { name: 'Product', comment: '产品', properties: [{ name: 'sku', type: 'string', notNull: true }, { name: 'title', type: 'string' }, { name: 'price', type: 'double' }], indexes: [{ name: 'product_sku_idx', properties: ['sku'] }] },
      { name: 'Order', comment: '订单', properties: [{ name: 'code', type: 'string', notNull: true }, { name: 'amount', type: 'double' }, { name: 'status', type: 'string' }, { name: 'placedAt', type: 'int' }], indexes: [{ name: 'order_code_idx', properties: ['code'] }] },
      { name: 'WorkOrder', comment: '工单/检测任务', properties: [{ name: 'code', type: 'string', notNull: true }, { name: 'sampleType', type: 'string' }, { name: 'status', type: 'string' }, { name: 'dueAt', type: 'int' }], indexes: [{ name: 'workorder_code_idx', properties: ['code'] }] },
    ],
    edges: [
      { name: 'PLACED', from: 'Customer', to: 'Order', comment: '客户下单', cardinality: 'MANY_TO_MANY', properties: [] },
      { name: 'CONTAINS', from: 'Order', to: 'Product', comment: '订单包含产品', cardinality: 'MANY_TO_MANY', properties: [{ name: 'quantity', type: 'int' }] },
      { name: 'PROVIDES', from: 'Supplier', to: 'Product', comment: '供应商提供产品', cardinality: 'MANY_TO_MANY', properties: [] },
      { name: 'SUBMITTED', from: 'Customer', to: 'WorkOrder', comment: '客户委托工单', cardinality: 'MANY_TO_MANY', properties: [] },
      { name: 'ASSIGNED', from: 'WorkOrder', to: 'Supplier', comment: '工单指派供应商', cardinality: 'MANY_TO_MANY', properties: [] },
    ],
  };
}

/* ---------------- Shared styles ---------------- */

const panelStyle: React.CSSProperties = {
  height: '100%', overflow: 'auto', fontSize: 13, padding: 16,
  color: 'var(--vscode-editor-foreground)', background: 'var(--vscode-sideBar-background)',
  fontFamily: 'system-ui, sans-serif',
};
const mainStyle: React.CSSProperties = {
  height: '100%', overflow: 'auto', fontSize: 13, padding: 20,
  color: 'var(--vscode-editor-foreground)', background: 'var(--vscode-editor-background)',
  fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 14,
};
const cardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)', borderRadius: 8, padding: 12,
  background: 'var(--vscode-panel-background)',
};
const inputStyle: React.CSSProperties = {
  height: 30, padding: '0 8px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--vscode-panel-border)', color: 'var(--vscode-editor-foreground)',
  background: 'var(--vscode-input-background)', minWidth: 0, maxWidth: '100%',
};
const buttonStyle: React.CSSProperties = {
  height: 30, padding: '0 12px', fontSize: 12, fontWeight: 500, lineHeight: 1.2,
  fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--vscode-panel-border)',
  color: 'var(--vscode-editor-foreground)', background: 'var(--vscode-input-background)', cursor: 'pointer',
};
const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle, background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', borderColor: 'transparent',
};
const mutedStyle: React.CSSProperties = { color: 'var(--vscode-input-placeholderForeground)', lineHeight: 1.6 };

function S({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ ...mutedStyle, ...style }}>{children}</span>;
}

/* ---------------- Sidebar ---------------- */

function Sidebar() {
  const open = () => studioContext?.views.openEditor({
    viewId: VIEW_STUDIO, title: '关系图建模工作台',
    props: { title: '关系图建模工作台' }, key: VIEW_STUDIO,
  });
  return (
    <div style={panelStyle}>
      <h2 style={{ margin: 0, fontSize: 16 }}>关系图建模</h2>
      <p style={{ marginTop: 8, ...mutedStyle }}>可视化定义节点 / 边，生成隔离租户 space 的 nGQL schema。</p>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <button type="button" style={primaryButtonStyle} onClick={open}>打开建模工作台</button>
        <S>租户上下文由宿主注入，无需手动切换 space。</S>
      </div>
    </div>
  );
}

/* ---------------- Studio editor ---------------- */

type Selection =
  | { kind: 'tag'; name: string }
  | { kind: 'edge'; name: string }
  | null;

function ModelingStudioView({ onClose }: { onClose?: () => void }) {
  const tenantId = studioContext?.runtime.tenantId ?? 'local-tenant';
  const [model, setModel] = useState<GraphModel>(() => sampleSpec(tenantId));
  const [selection, setSelection] = useState<Selection>({ kind: 'tag', name: 'Customer' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ddl' | 'error'; text: string } | null>(null);

  const setMeta = (patch: Partial<GraphModel['metadata']>) =>
    setModel((m) => ({ ...m, metadata: { ...m.metadata, ...patch } }));

  const addTag = () => {
    const name = `Node_${model.tags.length + 1}`;
    setModel((m) => ({ ...m, tags: [...m.tags, { name, properties: [], indexes: [] }] }));
    setSelection({ kind: 'tag', name });
  };
  const addEdge = () => {
    const name = `REL_${model.edges.length + 1}`;
    setModel((m) => ({ ...m, edges: [...m.edges, { name, from: model.tags[0]?.name ?? '', to: model.tags[0]?.name ?? '', cardinality: 'MANY_TO_MANY', properties: [] }] }));
    setSelection({ kind: 'edge', name });
  };
  const updateTag = (name: string, patch: Partial<TagDef>) =>
    setModel((m) => ({ ...m, tags: m.tags.map((t) => (t.name === name ? { ...t, ...patch } : t)) }));
  const updateEdge = (name: string, patch: Partial<EdgeDef>) =>
    setModel((m) => ({ ...m, edges: m.edges.map((e) => (e.name === name ? { ...e, ...patch } : e)) }));

  const selectedTag = selection?.kind === 'tag' ? model.tags.find((t) => t.name === selection.name) : undefined;
  const selectedEdge = selection?.kind === 'edge' ? model.edges.find((e) => e.name === selection.name) : undefined;

  const callEndpoint = async (path: string) => {
    if (!studioContext) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await apiPost(studioContext, path, { spec: model });
      if (res.ok) {
        const ddl = res.data?.ddl ?? JSON.stringify(res.data, null, 2);
        setResult({ kind: 'ddl', text: ddl });
      } else {
        const msg = res.data?.message || (typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
        setResult({ kind: 'error', text: `HTTP ${res.status}\n${msg}` });
      }
    } catch (err: any) {
      setResult({ kind: 'error', text: `网络/请求失败: ${err?.message || String(err)}` });
    } finally {
      setBusy(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.metadata.name || 'graph-model'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={mainStyle}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 18 }}>关系图建模工作台</strong>
          <input style={{ ...inputStyle, width: 200 }} value={model.metadata.name}
            onChange={(e) => setMeta({ name: e.target.value })} placeholder="模型名称" />
          <S>租户：<code>{tenantId}</code></S>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={buttonStyle} onClick={() => setModel(sampleSpec(tenantId))}>加载示例</button>
          <button type="button" style={buttonStyle} onClick={exportJson}>导出 JSON</button>
          <button type="button" style={buttonStyle} disabled={busy} onClick={() => callEndpoint('/nebula-graph/models/preview')}>
            {busy ? '请求中…' : '预览 DDL'}
          </button>
          <button type="button" style={primaryButtonStyle} disabled={busy} onClick={() => callEndpoint('/nebula-graph/models/apply')}>
            {busy ? '请求中…' : '应用建模'}
          </button>
          {onClose && <button type="button" style={buttonStyle} onClick={onClose}>关闭</button>}
        </div>
      </div>

      {/* 主体：左列表 / 中编辑 / 右结果 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) minmax(0, 1fr) minmax(260px, 360px)', gap: 14, flex: 1, minHeight: 0 }}>
        {/* 左：节点 / 边列表 */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>节点类型 ({model.tags.length})</strong>
            <button type="button" style={{ ...buttonStyle, padding: '0 8px' }} onClick={addTag}>+ 节点</button>
          </div>
          {model.tags.map((t) => (
            <button key={t.name} type="button" onClick={() => setSelection({ kind: 'tag', name: t.name })}
              style={{ ...buttonStyle, textAlign: 'left', background: selection?.kind === 'tag' && selection.name === t.name ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-input-background)' }}>
              {t.name}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <strong>边类型 ({model.edges.length})</strong>
            <button type="button" style={{ ...buttonStyle, padding: '0 8px' }} onClick={addEdge}>+ 边</button>
          </div>
          {model.edges.map((e) => (
            <button key={e.name} type="button" onClick={() => setSelection({ kind: 'edge', name: e.name })}
              style={{ ...buttonStyle, textAlign: 'left', background: selection?.kind === 'edge' && selection.name === e.name ? 'var(--vscode-list-activeSelectionBackground)' : 'var(--vscode-input-background)' }}>
              {e.name} <S>({e.from}→{e.to})</S>
            </button>
          ))}
        </div>

        {/* 中：编辑选中项 */}
        <div style={{ ...cardStyle, minHeight: 0, overflow: 'auto' }}>
          {selectedTag && (
            <TagEditor tag={selectedTag} allTags={model.tags.map((t) => t.name)}
              onChange={(patch) => updateTag(selectedTag.name, patch)}
              onRename={(next) => { updateTag(selectedTag.name, { name: next }); setSelection({ kind: 'tag', name: next }); }} />
          )}
          {selectedEdge && (
            <EdgeEditor edge={selectedEdge} allTags={model.tags.map((t) => t.name)}
              onChange={(patch) => updateEdge(selectedEdge.name, patch)}
              onRename={(next) => { updateEdge(selectedEdge.name, { name: next }); setSelection({ kind: 'edge', name: next }); }} />
          )}
          {!selectedTag && !selectedEdge && <S>从左侧选择节点或边进行编辑。</S>}
        </div>

        {/* 右：结果 */}
        <div style={{ ...cardStyle, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong>结果</strong>
          {!result && <S>点击「预览 DDL」或「应用建模」查看后端返回。</S>}
          {result?.kind === 'error' && (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--vscode-errorForeground)', fontSize: 12 }}>{result.text}</pre>
          )}
          {result?.kind === 'ddl' && (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, lineHeight: 1.6 }}>{result.text}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 子编辑器 ---------------- */

function PropTable({ props, onChange }: { props: Prop[]; onChange: (next: Prop[]) => void }) {
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      {props.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inputStyle, width: 120 }} value={p.name} onChange={(e) => {
            const next = [...props]; next[i] = { ...p, name: e.target.value }; onChange(next);
          }} placeholder="属性名" />
          <select style={{ ...inputStyle, width: 120 }} value={p.type} onChange={(e) => {
            const next = [...props]; next[i] = { ...p, type: e.target.value }; onChange(next);
          }}>
            {ALLOWED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={!!p.notNull} onChange={(e) => {
              const next = [...props]; next[i] = { ...p, notNull: e.target.checked }; onChange(next);
            }} /> NOT NULL
          </label>
          <button type="button" style={{ ...buttonStyle, padding: '0 8px' }} onClick={() => onChange(props.filter((_, j) => j !== i))}>删</button>
        </div>
      ))}
      <button type="button" style={{ ...buttonStyle, width: 'fit-content' }} onClick={() => onChange([...props, { name: `prop_${props.length + 1}`, type: 'string' }])}>+ 属性</button>
    </div>
  );
}

function TagEditor({ tag, onChange, onRename }: { tag: TagDef; allTags: string[]; onChange: (p: Partial<TagDef>) => void; onRename: (n: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>节点类型</strong>
        <input style={{ ...inputStyle, width: 160 }} value={tag.name} onChange={(e) => onRename(e.target.value)} />
      </div>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--vscode-input-placeholderForeground)' }}>
        注释
        <input style={inputStyle} value={tag.comment ?? ''} onChange={(e) => onChange({ comment: e.target.value })} />
      </label>
      <div>
        <strong style={{ fontSize: 12 }}>属性</strong>
        <PropTable props={tag.properties} onChange={(properties) => onChange({ properties })} />
      </div>
      <div>
        <strong style={{ fontSize: 12 }}>索引</strong>
        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
          {tag.indexes.map((idx, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input style={{ ...inputStyle, width: 140 }} value={idx.name} onChange={(e) => {
                const next = [...tag.indexes]; next[i] = { ...idx, name: e.target.value }; onChange({ indexes: next });
              }} placeholder="索引名" />
              <select style={{ ...inputStyle, width: 140 }} value={idx.properties[0] ?? ''} onChange={(e) => {
                const next = [...tag.indexes]; next[i] = { ...idx, properties: e.target.value ? [e.target.value] : [] }; onChange({ indexes: next });
              }}>
                <option value="">（无）</option>
                {tag.properties.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              <button type="button" style={{ ...buttonStyle, padding: '0 8px' }} onClick={() => onChange({ indexes: tag.indexes.filter((_, j) => j !== i) })}>删</button>
            </div>
          ))}
          <button type="button" style={{ ...buttonStyle, width: 'fit-content' }} onClick={() => onChange({ indexes: [...tag.indexes, { name: `${tag.name.toLowerCase()}_idx_${tag.indexes.length + 1}`, properties: tag.properties[0] ? [tag.properties[0].name] : [] }] })}>+ 索引</button>
        </div>
      </div>
    </div>
  );
}

function EdgeEditor({ edge, allTags, onChange, onRename }: { edge: EdgeDef; allTags: string[]; onChange: (p: Partial<EdgeDef>) => void; onRename: (n: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong>边类型</strong>
        <input style={{ ...inputStyle, width: 160 }} value={edge.name} onChange={(e) => onRename(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...inputStyle, width: 130 }} value={edge.from} onChange={(e) => onChange({ from: e.target.value })}>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <S>→</S>
        <select style={{ ...inputStyle, width: 130 }} value={edge.to} onChange={(e) => onChange({ to: e.target.value })}>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={{ ...inputStyle, width: 150 }} value={edge.cardinality} onChange={(e) => onChange({ cardinality: e.target.value })}>
          {CARDINALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--vscode-input-placeholderForeground)' }}>
        注释
        <input style={inputStyle} value={edge.comment ?? ''} onChange={(e) => onChange({ comment: e.target.value })} />
      </label>
      <div>
        <strong style={{ fontSize: 12 }}>边属性</strong>
        <PropTable props={edge.properties} onChange={(properties) => onChange({ properties })} />
      </div>
    </div>
  );
}

/* ---------------- activate ---------------- */

export function activate(ctx: PluginContext) {
  studioContext = ctx;
  const disposers = [
    ctx.capabilities.registerSidebarView({
      id: 'sidebar.mengti.graph-modeling-studio',
      title: '关系图建模',
      component: Sidebar,
    }),
    ctx.capabilities.registerEditorView({
      id: VIEW_STUDIO,
      routeKey: 'graph-modeling-studio',
      title: '关系图建模工作台',
      component: ModelingStudioView,
    }),
  ];
  return () => {
    studioContext = null;
    disposers.forEach((d) => d());
  };
}
