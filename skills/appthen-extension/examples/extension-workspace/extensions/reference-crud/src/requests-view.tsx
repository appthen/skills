import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  SimpleSelect,
  Skeleton,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@appthen/vibe-workspace/components';
import { STATUS_TONE } from './constants';
import { STATUSES, type ServiceRequest } from './data';
import { RequestDrawer } from './request-drawer';
import { useRequests } from './store';

const ALL = '全部状态';

export function RequestsView({ initialStatus }: { initialStatus?: string }) {
  const requests = useRequests();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState(initialStatus ?? ALL);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading] = useState(false); // 接后端时换成真实 loading 状态

  const rows = useMemo(
    () =>
      requests.filter((item) => {
        const hitStatus = status === ALL || item.status === status;
        const hitKeyword = !keyword || `${item.title}${item.customer}${item.id}`.includes(keyword);
        return hitStatus && hitKeyword;
      }),
    [requests, status, keyword],
  );

  const active = requests.find((item) => item.id === activeId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 [&>*]:shrink-0">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">客户服务 / 服务工单</div>
          <h1 className="mt-1 text-xl font-medium">服务工单</h1>
        </div>
        <span className="text-xs text-muted-foreground">共 {rows.length} 条</span>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {/* SimpleSelect 默认 w-full，放进横向布局要包一层定宽容器 */}
        <label className="flex h-8 w-full max-w-[260px] items-center gap-1.5 rounded-md border border-input bg-background px-2 text-muted-foreground @min-[420px]:w-[260px]">
          <Search className="size-3.5 shrink-0" />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索工单号、标题或客户"
            className="h-full border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
        <div className="w-[140px]">
          <SimpleSelect
            value={status}
            onValueChange={setStatus}
            options={[ALL, ...STATUSES]}
            size="sm"
            aria-label="按状态筛选"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : rows.length ? (
        <div className="rounded-lg border border-border">
          <Table cardMode>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                <TableHead>工单号</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>更新</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item: ServiceRequest) => (
                <TableRow
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className="cursor-pointer"
                >
                  <TableCell label="工单号" className="text-xs tabular-nums text-muted-foreground">{item.id}</TableCell>
                  <TableCell cardTitle className="text-sm">{item.title}</TableCell>
                  <TableCell label="客户" className="text-sm">{item.customer}</TableCell>
                  <TableCell label="负责人" className="text-sm">{item.owner}</TableCell>
                  <TableCell label="更新" className="text-xs tabular-nums text-muted-foreground">{item.updatedAt}</TableCell>
                  <TableCell label="状态">
                    <StatusChip tone={STATUS_TONE[item.status]} appearance="dot">{item.status}</StatusChip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={<Search className="size-5" />}
          title="没有匹配的工单"
          description={keyword ? `没有包含「${keyword}」的工单，换个关键词或清空筛选。` : '当前状态下还没有工单。'}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setKeyword('');
                setStatus(ALL);
              }}
            >
              清空筛选
            </Button>
          }
        />
      )}

      {active ? (
        <RequestDrawer
          request={active}
          open={Boolean(active)}
          onOpenChange={(open) => {
            if (!open) setActiveId(null);
          }}
        />
      ) : null}
    </div>
  );
}
