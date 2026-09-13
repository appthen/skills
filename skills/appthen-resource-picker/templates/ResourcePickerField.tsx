import React, { useState } from 'react';
import { ChevronsUpDown, Plus, X } from 'lucide-react';
import { ResourcePickerDrawer } from './ResourcePickerDrawer';
import type { ResourceAdapter } from './types';

/**
 * 资源选择表单控件（范式核心）：控件本身是静态的——只展示已选值；
 * 点击控件打开抽屉，在资源列表中完成实际选择。
 * 单选：value 长度 0/1；多选：value 为数组，受 maxCount 约束。
 */
export function ResourcePickerField<T>({
  adapter,
  value,
  onChange,
  multiple = false,
  maxCount,
  placeholder = '点击选择',
  disabled = false,
  size = 'md',
  clearable = true,
  maxVisibleChips = 6,
  className,
  ariaLabel,
}: {
  adapter: ResourceAdapter<T>;
  value: T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
  maxCount?: number;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  clearable?: boolean;
  /** 多选 chips 超出该数量折叠为「+N」。 */
  maxVisibleChips?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleConfirm(items: T[]) {
    onChange(multiple ? items : items.slice(0, 1));
  }

  function removeItem(id: string | number) {
    onChange(value.filter((it) => adapter.getId(it) !== id));
  }

  const height = size === 'sm' ? 'min-h-8' : 'min-h-10';
  const selected = value;

  const singleBody =
    !multiple && selected.length > 0 ? (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {adapter.renderMedia ? adapter.renderMedia(selected[0]) : null}
        <span className="min-w-0">
          <span className="block truncate text-sm text-foreground">{adapter.getPrimary(selected[0])}</span>
          {adapter.getSecondary?.(selected[0]) ? (
            <span className="block truncate text-xs text-muted-foreground">{adapter.getSecondary(selected[0])}</span>
          ) : null}
        </span>
      </span>
    ) : null;

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-label={ariaLabel ?? adapter.title}
        aria-disabled={disabled || undefined}
        className={`flex ${height} w-full cursor-pointer items-center gap-1 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
          multiple ? 'flex-wrap gap-1 py-1.5' : ''
        }`}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {!multiple && selected.length === 0 ? (
          <span className="flex-1 truncate text-sm text-muted-foreground">{placeholder}</span>
        ) : null}
        {singleBody}
        {multiple ? (
          <>
            {selected.length === 0 ? (
              <span className="px-0.5 text-sm text-muted-foreground">{placeholder}</span>
            ) : null}
            {selected.slice(0, maxVisibleChips).map((it) => {
              const id = adapter.getId(it);
              return (
                <span
                  key={id}
                  className="inline-flex max-w-[11rem] items-center gap-1 rounded-full bg-accent py-0.5 pl-2 pr-0.5 text-xs text-accent-foreground"
                >
                  <span className="truncate">{adapter.getPrimary(it)}</span>
                  {!disabled ? (
                    <button
                      type="button"
                      aria-label={`移除 ${adapter.getPrimary(it)}`}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </span>
              );
            })}
            {selected.length > maxVisibleChips ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                +{selected.length - maxVisibleChips}
              </span>
            ) : null}
            {!disabled ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                <Plus className="h-3 w-3" />
                添加
              </span>
            ) : null}
          </>
        ) : null}

        {/* 右侧操作区：单选可清除；切换图标 */}
        <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
          {clearable && !multiple && !disabled && selected.length > 0 ? (
            <button
              type="button"
              aria-label="清除选择"
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </div>

      <ResourcePickerDrawer
        adapter={adapter}
        open={open}
        onOpenChange={setOpen}
        mode={multiple ? 'multiple' : 'single'}
        selected={selected}
        onConfirm={handleConfirm}
        maxCount={maxCount}
      />
    </div>
  );
}
