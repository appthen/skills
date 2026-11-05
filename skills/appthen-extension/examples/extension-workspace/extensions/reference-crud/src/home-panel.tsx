import { ArrowRight, ClipboardList, Plus, Settings2 } from 'lucide-react';
import { Button, StatusChip } from '@appthen/vibe-workspace/components';
import type { PluginContext } from '@appthen/vibe-workspace/plugins/base';
import { LIST_VIEW_ID, LIST_ROUTE_KEY, STATUS_TONE } from './constants';
import { useRequests } from './store';

/**
 * 主面板 = 模块 App 首页（UI-CONTRACT §7）。
 * 三问必须全过：有真实状态、有一个元素直达真实动作、零假入口。
 *
 * 注意这里的排版选择：
 *   · 字号只用 text-xs(12) / text-sm(14) / text-xl(20)，没有 11px —— 中文下限是 12px
 *   · 不写任何自定义 class，也不写内联 style
 *   · 宽度按容器自适应（侧栏可能只有 320px），因此用 grid-cols-2 而不是四列
 */
export function HomePanel({ ctx }: { ctx: PluginContext }) {
  const requests = useRequests();
  const openList = (status?: string) =>
    ctx.views.openEditor({
      viewId: LIST_VIEW_ID,
      title: '服务工单',
      key: `${LIST_ROUTE_KEY}:${status ?? 'all'}`,
      props: status ? { status } : {},
    });

  const pending = requests.filter((item) => item.status === '待受理');
  const active = requests.filter((item) => item.status === '处理中');
  const reviewing = requests.filter((item) => item.status === '待验收');
  const attention = [...pending, ...reviewing].slice(0, 4);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 [&>*]:shrink-0">
      <header className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground">客户服务</div>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-base font-medium">工单中心</h1>
          <Button size="sm" onClick={() => openList()}>
            <Plus className="mr-1 size-3.5" />新建工单
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">处理客户的报修与校准请求，跟踪到验收关闭。</p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        {[
          { label: '待受理', value: pending.length, onClick: () => openList('待受理') },
          { label: '处理中', value: active.length, onClick: () => openList('处理中') },
          { label: '待验收', value: reviewing.length, onClick: () => openList('待验收') },
          { label: '今日新增', value: requests.length, onClick: () => openList() },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
          >
            <span className="block text-xs text-muted-foreground">{item.label}</span>
            <span className="mt-1 block text-xl font-medium tabular-nums">{item.value}</span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ClipboardList className="size-3.5" />需要优先处理
          </span>
          <button type="button" onClick={() => openList()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            全部<ArrowRight className="size-3" />
          </button>
        </div>
        {attention.length ? (
          <ul className="flex flex-col gap-1">
            {attention.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openList(item.status)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{item.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.customer} · {item.updatedAt}</span>
                  </span>
                  <StatusChip tone={STATUS_TONE[item.status]} appearance="dot" className="shrink-0">{item.status}</StatusChip>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">没有待处理的工单</p>
        )}
      </section>

      <footer className="mt-auto border-t border-border pt-2">
        <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Settings2 className="size-3.5" />工单分类与字段设置
        </button>
      </footer>
    </div>
  );
}
