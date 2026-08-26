import * as extension0 from '../../../extensions/remote-html-sandbox/src/index.tsx';
import * as extension1 from '../../../extensions/workbench-kit/src/index.tsx';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionDevWorkbench } from '@appthen/vibe-workspace/extension-dev-workbench';
import '@appthen/vibe-workspace/styles.css';

createRoot(document.getElementById('root')!).render(
  <ExtensionDevWorkbench
    workspace={{"extensionsDir":"extensions","themeCatalog":[{"id":"acme.sales","label":"Acme 销售","type":"dark","extends":"vercel","colors":{"workbench.background":"#101820","editor.background":"#101820","editor.foreground":"#f4f7fa","sideBar.background":"#17232d","activityBar.background":"#0d141a","button.background":"#2f9e8f","input.background":"#1d2b35","panel.border":"#2b414d"},"portalColors":{"primary":"#2f9e8f","primary-hover":"#48b6a5","card":"#17232d"},"monaco":{"base":"vs-dark","colors":{"editor.background":"#101820","editor.foreground":"#f4f7fa"},"rules":[]}}],"devWorkbench":{"tenantId":"local-tenant","workbenchId":"local-extension-dev","name":"Local Extension Dev","theme":"acme.sales","enabledExtensionIds":["acme.workbench-kit","acme.remote-html-sandbox"]},"actor":{"subjectId":"local-subject","subjectClassId":"developer","userId":"local-user","role":"admin"}}}
    extensions={[
  { manifest: {"id":"acme.remote-html-sandbox","name":"Remote HTML Sandbox","version":"0.1.0","manifestVersion":1,"apiVersion":"1","main":"./src/index.tsx","sourceType":"umd","runtime":{"sidebarViewId":"sidebar.acme.remote-html-sandbox","autoActivate":true},"mcp":{"enabled":true,"uiResources":[],"frontendTools":[]}}, module: extension0 },
  { manifest: {"id":"acme.workbench-kit","name":"工作台工具包示例","version":"0.1.0","manifestVersion":1,"apiVersion":"1","icon":"data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"%3E%3Crect width=\"32\" height=\"32\" rx=\"7\" fill=\"%232f9e8f\"/%3E%3Cpath d=\"M8 9h16v4H8zm0 6h10v4H8zm0 6h16v4H8z\" fill=\"white\"/%3E%3C/svg%3E","main":"./src/index.tsx","sourceType":"umd","runtime":{"sidebarViewId":"sidebar.acme.workbench-kit","autoActivate":true},"mcp":{"enabled":true,"uiResources":[{"uri":"ui://acme.workbench-kit/starter-card","name":"起手式卡片区块","description":"由本地扩展提供的可复用卡片区块。","mimeType":"text/html","content":"<section data-block=\"starter-card\">工作台起手式卡片</section>","metadata":{"capabilities":["展示","起手式"]}}],"frontendTools":[{"name":"starter.echo","description":"回显本地扩展收到的输入数据。","inputSchema":{"type":"object","properties":{"message":{"type":"string"}}},"handlerRef":"echo"}]}}, module: extension1 }
    ]}
  />,
);
