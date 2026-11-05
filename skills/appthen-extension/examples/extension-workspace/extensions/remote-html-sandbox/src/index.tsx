/* ============================================================================
 * ⚠️ 历史遗留示例 —— 违反现行 UI 契约，请勿照抄。
 *
 * 本文件的具体问题（`node scripts/audit-ui.mjs` 可复现）：
 *   · 4 行引用 var(--vscode-*)：宿主已提供语义 token
 *   · 5 处内联 style：应改为原子类
 *
 * 正确范式：同目录 ../reference-crud（0 行 CSS、0 内联 style、字号 ≥12px）。
 * 契约条款：docs/UI-CONTRACT.md §2 主题变量 / §6 样式路线 / §8 字号下限 / §9 体量预算。
 * ========================================================================== */

import React, { useEffect, useMemo, useState } from 'react';
import type { PluginContext } from '@appthen/vibe-workspace/plugins/base';

const sandboxDocument = [
  '<!doctype html><html><body style="font:14px system-ui;padding:16px">',
  '<strong>Sandboxed remote HTML</strong>',
  '<p id="status">Waiting for host message...</p>',
  '<script>window.parent.postMessage({ type: "sandbox-ready" }, "*"); window.addEventListener("message", function (event) { var status = document.getElementById("status"); if (status) status.textContent = "Received: " + JSON.stringify(event.data); });</script>',
  '</body></html>',
].join('');

function SandboxSidebar() {
  const [message, setMessage] = useState('');
  const frameId = useMemo(() => 'sandbox-frame-' + Math.random().toString(36).slice(2), []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'sandbox-ready') setMessage('The iframe sent a message to the host.');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div style={{ height: '100%', padding: 16, color: 'var(--vscode-editor-foreground)', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Remote HTML Sandbox</h2>
      <p style={{ color: 'var(--vscode-input-placeholderForeground)', lineHeight: 1.5 }}>
        This iframe runs scripts but has no same-origin access.
      </p>
      <iframe
        id={frameId}
        title="Remote HTML Sandbox"
        srcDoc={sandboxDocument}
        sandbox="allow-scripts"
        csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"
        referrerPolicy="no-referrer"
        style={{ width: '100%', minHeight: 160, border: '1px solid var(--vscode-panel-border)' }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--vscode-input-placeholderForeground)' }}>{message || 'Loading iframe...'}</div>
    </div>
  );
}

export function activate(ctx: PluginContext) {
  return ctx.capabilities.registerSidebarView({
    id: 'sidebar.acme.remote-html-sandbox',
    title: 'Remote HTML Sandbox',
    component: SandboxSidebar,
  });
}
