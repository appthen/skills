import { useState } from 'react';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  SimpleSelect,
} from '@appthen/vibe-workspace/components';
import { STATUS_TONE } from './constants';
import { STATUSES, type RequestStatus, type ServiceRequest } from './data';
import { updateStatus } from './store';

/**
 * 单条记录的详情/编辑 —— 适用 Drawer（UI-CONTRACT §7.1），不是独立 editor view。
 *
 * 抽屉渲染在 body 下，不在扩展的容器查询作用域里。
 * 因此这里如果要做宽度适配，只能用视口断点（sm:），不能用 @min-[...] 容器变体。
 * 本例直接用宿主默认宽度，不做覆盖 —— 覆盖越少越不容易和宿主打架。
 */
export function RequestDrawer({
  request,
  open,
  onOpenChange,
}: {
  request: ServiceRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<RequestStatus>(request.status);
  const changed = draft !== request.status;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" className="flex flex-col overflow-hidden">
        <DrawerHeader className="shrink-0 border-b border-border">
          <DrawerTitle>{request.title}</DrawerTitle>
          <DrawerDescription>
            {request.id} · {request.customer} · 负责人 {request.owner}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">当前状态</span>
            <span className={`text-sm ${STATUS_TONE[request.status] === 'success' ? 'text-[color-mix(in_srgb,var(--portal-success)_78%,var(--foreground))]' : ''}`}>
              {request.status}
            </span>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            变更为
            <div className="w-full">
              <SimpleSelect
                value={draft}
                onValueChange={(value) => setDraft(value as RequestStatus)}
                options={STATUSES}
                aria-label="变更工单状态"
              />
            </div>
          </label>

          <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
            状态变更只写本地示例 store，刷新后回到初始数据。接后端时换成 mutation + 失败回滚。
          </p>
        </div>

        <DrawerFooter className="shrink-0 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button
            disabled={!changed}
            onClick={() => {
              updateStatus(request.id, draft);
              onOpenChange(false);
            }}
          >
            保存状态
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
