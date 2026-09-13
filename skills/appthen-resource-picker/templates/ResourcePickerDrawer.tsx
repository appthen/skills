import React, { useCallback, useEffect, useState } from 'react';
import {
  WorkbenchDrawer,
  WorkbenchDrawerContent,
  WorkbenchDrawerDescription,
  WorkbenchDrawerHeader,
  WorkbenchDrawerTitle,
} from '@appthen/vibe-workspace/overlay';
import { Button, Checkbox, Input, SimpleSelect } from '@appthen/vibe-workspace/components';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { ResourceAdapter } from './types';

/** 资源选择抽屉：搜索 + 筛选 + 分页列表/网格 + 已选暂存。
 * 单选：点击行/卡片立即确认并关闭；多选：行内勾选暂存，底部「确定」统一提交。
 * 筛选项由 adapter.filters 声明，「已结束 / 已归档」等历史数据通过筛选可检索。
 */
export function ResourcePickerDrawer<T>({
  adapter,
  open,
  onOpenChange,
  mode,
  selected = [],
  onConfirm,
  maxCount,
}: {
  adapter: ResourceAdapter<T>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'single' | 'multiple';
  /** 打开时的初始已选（抽屉内为草稿，确定后才提交）。 */
  selected?: T[];
  onConfirm?: (items: T[]) => void;
  /** 多选最大数量，超限后未选行禁用并在底部提示。 */
  maxCount?: number;
}) {
  const layout = adapter.layout ?? 'list';
  const pageSize = adapter.pageSize ?? (layout === 'grid' ? 12 : 10);
  const drawerWidth = adapter.drawerWidth ?? (layout === 'grid' ? 640 : 560);
  // Tailwind v4 只扫描源码中的静态类名字面量（插值模板不会被生成 CSS），
  // 因此宽度档位必须是下面的完整字面量；带 ! 后缀确保覆盖 SDK 的 w-full。
  const WIDTH_CLASS: Record<number, string> = {
    480: 'md:w-[min(480px,calc(100vw-16px))]!',
    560: 'md:w-[min(560px,calc(100vw-16px))]!',
    640: 'md:w-[min(640px,calc(100vw-16px))]!',
    720: 'md:w-[min(720px,calc(100vw-16px))]!',
  };
  const widthClass = WIDTH_CLASS[drawerWidth] ?? WIDTH_CLASS[560];

  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<T[]>([]);
  const [list, setList] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // 每次打开：以外部 selected 初始化草稿，清空搜索与筛选。
  useEffect(() => {
    if (open) {
      setKeyword('');
      setKeywordInput('');
      const defaults: Record<string, string> = {};
      (adapter.filters ?? []).forEach((f) => {
        defaults[f.key] = f.options[0]?.value ?? '';
      });
      setFilterValues(defaults);
      setPage(1);
      setDraft([...selected]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 关键词防抖：输入停止 300ms 后生效并回到第一页。
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keywordInput, open]);

  // 拉取数据。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const filters = Object.fromEntries(
      Object.entries(filterValues).filter(([, v]) => v !== ''),
    );
    adapter
      .fetch({
        page,
        size: pageSize,
        keyword: keyword || undefined,
        filters: Object.keys(filters).length ? filters : undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setList(res.list);
        setTotal(res.total);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : '数据加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // tick 用于失败后手动重试。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyword, page, filterValues, tick, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const disableReasonOf = useCallback(
    (item: T): string | null => {
      if (!adapter.isDisabled) return null;
      const result = adapter.isDisabled(item);
      if (result === true) return '不可选择';
      if (typeof result === 'string') return result;
      return null;
    },
    [adapter],
  );

  function toggle(item: T) {
    const id = adapter.getId(item);
    setDraft((prev) => {
      const exists = prev.some((it) => adapter.getId(it) === id);
      if (exists) return prev.filter((it) => adapter.getId(it) !== id);
      if (maxCount !== undefined && prev.length >= maxCount) return prev;
      return [...prev, item];
    });
  }

  function confirmSingle(item: T) {
    onConfirm?.([item]);
    onOpenChange(false);
  }

  const overLimit = maxCount !== undefined && draft.length >= maxCount;

  const chips =
    mode === 'multiple' ? (
      <div className="flex min-h-7 flex-wrap items-center gap-1">
        {draft.length === 0 ? (
          <span className="text-xs text-muted-foreground">尚未选择</span>
        ) : null}
        {draft.slice(0, 8).map((it) => {
          const id = adapter.getId(it);
          return (
            <span
              key={id}
              className="inline-flex max-w-[11rem] items-center gap-1 rounded-full bg-accent py-0.5 pl-2 pr-0.5 text-xs text-accent-foreground"
            >
              <span className="truncate">{adapter.getPrimary(it)}</span>
              <button
                type="button"
                aria-label={`移除 ${adapter.getPrimary(it)}`}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setDraft((prev) => prev.filter((x) => adapter.getId(x) !== id));
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {draft.length > 8 ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            +{draft.length - 8}
          </span>
        ) : null}
      </div>
    ) : null;

  return (
    <WorkbenchDrawer open={open} onOpenChange={onOpenChange}>
      <WorkbenchDrawerContent
        side="right"
        // 定位/移动端转底部抽屉由 SDK Sheet 负责，这里只覆盖宽度。
        className={`flex w-full flex-col gap-0 overflow-hidden p-0 ${widthClass}`}
      >
        <WorkbenchDrawerHeader className="shrink-0 border-b border-border px-4 py-3 pr-14">
          <WorkbenchDrawerTitle className="text-sm font-semibold">{adapter.title}</WorkbenchDrawerTitle>
          {adapter.description ? (
            <WorkbenchDrawerDescription className="text-xs">{adapter.description}</WorkbenchDrawerDescription>
          ) : null}
          {mode === 'multiple' ? <div className="pt-1">{chips}</div> : null}
        </WorkbenchDrawerHeader>

        {/* 工具栏：搜索 + 筛选（sticky，不随列表滚动） */}
        <div className="shrink-0 space-y-2 border-b border-border bg-background/95 px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder={adapter.searchPlaceholder ?? '搜索…'}
              className="h-8 pl-8 text-xs"
              aria-label={`搜索${adapter.title.replace(/^选择/, '')}`}
            />
          </div>
          {(adapter.filters ?? []).map((f) =>
            f.variant === 'select' ? (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                <SimpleSelect
                  value={filterValues[f.key] ?? ''}
                  onValueChange={(v) => {
                    setFilterValues((prev) => ({ ...prev, [f.key]: v }));
                    setPage(1);
                  }}
                  options={f.options}
                  aria-label={f.label}
                />
              </div>
            ) : (
              <div key={f.key} className="flex flex-wrap items-center gap-1" role="group" aria-label={f.label}>
                {f.options.map((opt) => {
                  const active = (filterValues[f.key] ?? '') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                      onClick={() => {
                        setFilterValues((prev) => ({ ...prev, [f.key]: opt.value }));
                        setPage(1);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </div>

        {/* 列表区 */}
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
                重试
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <p className="text-sm font-medium text-foreground">没有匹配的数据</p>
              <p className="text-xs text-muted-foreground">换个关键词，或切换筛选状态试试</p>
            </div>
          ) : layout === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {list.map((item) => {
                const id = adapter.getId(item);
                const checked = draft.some((it) => adapter.getId(it) === id);
                const reason = disableReasonOf(item);
                const disabled = reason !== null;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-disabled={disabled || undefined}
                    title={reason ?? undefined}
                    className={`group relative flex flex-col items-stretch rounded-lg border p-2.5 text-left transition-colors ${
                      checked
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border hover:border-primary/50 hover:bg-accent/40'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={() => {
                      if (disabled) return;
                      if (mode === 'single') confirmSingle(item);
                      else toggle(item);
                    }}
                  >
                    {checked ? (
                      <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6.5 4.8 9 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : null}
                    {adapter.renderMedia ? (
                      <div className="mb-2 grid h-16 w-full place-items-center overflow-hidden rounded-md">
                        {adapter.renderMedia(item)}
                      </div>
                    ) : null}
                    <span className="truncate text-xs font-medium text-foreground">{adapter.getPrimary(item)}</span>
                    {adapter.getSecondary?.(item) ? (
                      <span className="truncate text-[11px] text-muted-foreground">{adapter.getSecondary(item)}</span>
                    ) : null}
                    {reason ? <span className="mt-1 text-[11px] text-destructive">{reason}</span> : null}
                    {adapter.renderBadge?.(item) ? <span className="mt-1">{adapter.renderBadge(item)}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1" role="listbox" aria-label={adapter.title}>
              {list.map((item) => {
                const id = adapter.getId(item);
                const checked = draft.some((it) => adapter.getId(it) === id);
                const reason = disableReasonOf(item);
                const disabled = reason !== null;
                const secondary = adapter.getSecondary?.(item);
                const meta = adapter.getMeta?.(item);
                const badge = adapter.renderBadge?.(item);
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    aria-disabled={disabled || undefined}
                    title={reason ?? undefined}
                    className={`flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors ${
                      checked ? 'border-primary/40 bg-accent' : 'hover:bg-accent/50'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    onClick={() => {
                      if (disabled) return;
                      if (mode === 'single') confirmSingle(item);
                      else toggle(item);
                    }}
                  >
                    {mode === 'multiple' ? (
                      <Checkbox
                        checked={checked}
                        disabled={disabled || (!checked && overLimit)}
                        aria-label={`选择 ${adapter.getPrimary(item)}`}
                        className="shrink-0"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                        }`}
                      >
                        {checked ? <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" /> : null}
                      </span>
                    )}
                    {adapter.renderMedia ? <div className="shrink-0">{adapter.renderMedia(item)}</div> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{adapter.getPrimary(item)}</span>
                      {secondary ? <span className="block truncate text-xs text-muted-foreground">{secondary}</span> : null}
                      {reason ? <span className="block text-[11px] text-destructive">{reason}</span> : null}
                    </span>
                    {badge}
                    {meta ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部：分页 + 多选确认栏 */}
        <div className="shrink-0 border-t border-border">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>
              共 {total} 条
              {totalPages > 1 ? ` · 第 ${page} / ${totalPages} 页` : ''}
            </span>
            {totalPages > 1 ? (
              <span className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page <= 1 || loading}
                  aria-label="上一页"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages || loading}
                  aria-label="下一页"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </span>
            ) : null}
          </div>
          {mode === 'multiple' ? (
            <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
              <span className="min-w-0 flex-1 text-xs">
                {overLimit ? (
                  <span className="text-destructive">最多可选 {maxCount} 项</span>
                ) : (
                  <span className="text-muted-foreground">
                    已选 {draft.length}
                    {maxCount !== undefined ? ` / ${maxCount}` : ''} 项
                  </span>
                )}
              </span>
              {draft.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setDraft([])}>
                  清空
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button size="sm" onClick={() => onConfirm?.(draft)}>
                确定
              </Button>
            </div>
          ) : null}
        </div>
      </WorkbenchDrawerContent>
    </WorkbenchDrawer>
  );
}

/** 供适配器作者使用的媒体色块辅助：图标 + 色相底。 */
export function PickerMediaTile({
  children,
  hue,
  size = 'md',
}: {
  children: React.ReactNode;
  hue: number;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-7 w-7 rounded' : 'h-10 w-10 rounded-md';
  return (
    <span
      aria-hidden
      className={`grid ${dim} shrink-0 place-items-center`}
      style={{
        backgroundColor: `hsl(${hue} 70% 50% / 0.14)`,
        color: `hsl(${hue} 65% 42%)`,
      }}
    >
      {children}
    </span>
  );
}
