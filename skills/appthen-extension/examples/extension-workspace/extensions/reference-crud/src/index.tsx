import React from 'react';
import type { PluginContext } from '@appthen/vibe-workspace/plugins/base';
import '@appthen/vibe-workspace/styles.css';
import { LIST_ROUTE_KEY, LIST_VIEW_ID, SIDEBAR_VIEW_ID } from './constants';
import { HomePanel } from './home-panel';
import { RequestsView } from './requests-view';

export function activate(ctx: PluginContext) {
  const disposers = [
    ctx.capabilities.registerSidebarView({
      id: SIDEBAR_VIEW_ID,
      title: '工单中心',
      component: () => <HomePanel ctx={ctx} />,
    }),
    ctx.capabilities.registerEditorView({
      id: LIST_VIEW_ID,
      routeKey: LIST_ROUTE_KEY,
      title: '服务工单',
      component: (props: Record<string, unknown>) => (
        <RequestsView initialStatus={typeof props?.status === 'string' ? props.status : undefined} />
      ),
    }),
  ];

  return () => disposers.reverse().forEach((dispose) => dispose());
}
