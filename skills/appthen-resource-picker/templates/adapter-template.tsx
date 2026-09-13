import React from 'react';
import { Package } from 'lucide-react';
import { PickerMediaTile } from './ResourcePickerDrawer';
import type { ResourceAdapter } from './types';

/**
 * 新资源适配器模板：复制本文件，替换 <YourResource> 与 TODO 项即可接入一种新资源。
 * 组件（Field/Drawer）零改动；mock 与真实 API 都走同一个 fetch 契约。
 */

/** TODO 1：替换为你的资源类型（与后端/类型定义对齐）。 */
interface YourResource {
  id: number;
  name: string;
  /** 次要展示信息，如类目 / 部门 / 编码。 */
  category?: string | null;
  /** 右侧元信息，如价格 / 库存 / 金额。 */
  price?: number;
  /** 状态枚举：筛选与禁选都会用到。 */
  status: 'ACTIVE' | 'ENDED' | 'ARCHIVED';
}

/** 状态 → 中文文案与徽标配色。 */
const STATUS_TEXT: Record<YourResource['status'], string> = {
  ACTIVE: '进行中',
  ENDED: '已结束',
  ARCHIVED: '已归档',
};

const STATUS_TONE: Record<YourResource['status'], string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600',
  ENDED: 'bg-slate-500/10 text-slate-500',
  ARCHIVED: 'bg-amber-500/10 text-amber-600',
};

/** 由 id 稳定推导色相（0-359），给没有专属图标的资源上色。 */
function hueOfId(id: string | number): number {
  const text = String(id);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360;
  return hash;
}

/** TODO 2：对接真实 API（保持 ResourcePage 契约）或先用下面的 mock。 */
async function fetchResources(query: {
  page: number;
  size: number;
  keyword?: string;
  filters?: Record<string, string>;
}): Promise<{ list: YourResource[]; total: number }> {
  // ---- mock 实现（联调前使用）----
  const all: YourResource[] = [
    // TODO: mock 数据或删除
  ];
  const status = query.filters?.status ?? '';
  const kw = (query.keyword ?? '').toLowerCase();
  const filtered = all.filter(
    (r) =>
      (!status || r.status === status) &&
      (!kw || r.name.toLowerCase().includes(kw)),
  );
  const start = (query.page - 1) * query.size;
  return { list: filtered.slice(start, start + query.size), total: filtered.length };

  // ---- 真实 API 实现（示例）----
  // const res = await pageYourResources({
  //   page: query.page,
  //   size: query.size,
  //   keyWord: query.keyword,
  //   status: query.filters?.status || undefined,
  // });
  // return { list: res.list, total: res.pagination?.total ?? res.list.length };
}

/**
 * TODO 3：按业务命名 adapter 并填写信息映射。
 * 用法：<ResourcePickerField adapter={yourResourceAdapter} value={v} onChange={setV} />
 * 多选：追加 multiple 与 maxCount（数值与业务上限一致）。
 */
export const yourResourceAdapter: ResourceAdapter<YourResource> = {
  key: 'your-resource',
  title: '选择资源',
  description: '进行中的资源可选；已结束 / 已归档数据可通过筛选检索。',
  searchPlaceholder: '搜索名称',
  fetch: fetchResources,
  getId: (r) => r.id,
  getPrimary: (r) => r.name,
  getSecondary: (r) => r.category ?? undefined,
  getMeta: (r) => (r.price !== undefined ? `¥${r.price}` : undefined),
  renderMedia: (r) => (
    <PickerMediaTile hue={hueOfId(r.id)}>
      <Package className="h-4 w-4" />
    </PickerMediaTile>
  ),
  renderBadge: (r) => (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${STATUS_TONE[r.status]}`}>
      {STATUS_TEXT[r.status]}
    </span>
  ),
  /** TODO 4：禁选规则——返回字符串 = 禁选并展示原因；返回 false = 可选。 */
  isDisabled: (r) => {
    if (r.status === 'ARCHIVED') return '已归档不可选择';
    return false;
  },
  /**
   * TODO 5：筛选声明。状态枚举必须提供（含「全部」），保证已结束/归档数据可检索。
   * ≤5 个枚举用 chips；更多用 select。
   */
  filters: [
    {
      key: 'status',
      label: '状态',
      variant: 'chips',
      options: [
        { value: '', label: '全部' },
        { value: 'ACTIVE', label: '进行中' },
        { value: 'ENDED', label: '已结束' },
        { value: 'ARCHIVED', label: '已归档' },
      ],
    },
  ],
  // layout: 'grid',        // 卡片网格（产品/素材类资源推荐）
  // pageSize: 12,
  // drawerWidth: 640,
};
