import type * as React from 'react';

/** 资源分页查询：picker 内部约定的最小查询契约。 */
export interface ResourcePickerQuery {
  page: number;
  size: number;
  /** 关键词（防抖后），无关键词时不传。 */
  keyword?: string;
  /** 筛选键值（来自 adapter.filters 声明的 key），空值不传。 */
  filters?: Record<string, string>;
}

/** 资源分页结果。 */
export interface ResourcePage<T> {
  list: T[];
  total: number;
}

/** 单个筛选项。value 为空字符串表示「全部」。 */
export interface ResourceFilterOption {
  value: string;
  label: string;
}

/** 筛选定义：chips 用于状态类少量枚举，select 用于更多枚举。 */
export interface ResourceFilterDef {
  key: string;
  label: string;
  options: ResourceFilterOption[];
  variant?: 'chips' | 'select';
}

/**
 * 资源适配器：把任意业务资源接入选择器的全部信息。
 * 新增一种资源 = 写一个 adapter 对象，组件零改动。
 */
export interface ResourceAdapter<T> {
  /** 资源标识，如 'product' | 'coupon' | 'user'。 */
  key: string;
  /** 抽屉标题，如「选择产品」。 */
  title: string;
  /** 抽屉标题下的补充说明（可选）。 */
  description?: string;
  searchPlaceholder?: string;
  /** 分页拉取资源；由接入方对接真实 API 或本地 mock。 */
  fetch: (query: ResourcePickerQuery) => Promise<ResourcePage<T>>;
  getId: (item: T) => string | number;
  /** 主文本，如商品名。 */
  getPrimary: (item: T) => string;
  /** 次文本（可选），如类目、部门。 */
  getSecondary?: (item: T) => string | undefined;
  /** 左侧媒体区（图标色块 / 头像 / 图片，可选）。 */
  renderMedia?: (item: T) => React.ReactNode;
  /** 行/卡片右侧徽标（可选，如状态）。 */
  renderBadge?: (item: T) => React.ReactNode;
  /** 右侧元信息文本（可选，如价格）。 */
  getMeta?: (item: T) => string | undefined;
  /**
   * 禁选规则：返回 true = 禁选（无原因文案）；返回字符串 = 禁选并展示原因。
   * 未提供则全部可选。
   */
  isDisabled?: (item: T) => boolean | string;
  /** 筛选声明（可选）。含「已结束 / 已归档」等状态枚举，保证历史数据可被检索。 */
  filters?: ResourceFilterDef[];
  /** 展示布局：list 行式（默认） / grid 卡片网格。 */
  layout?: 'list' | 'grid';
  /** 每页条数，默认 list 10 / grid 12。 */
  pageSize?: number;
  /** 抽屉宽度（px），默认 list 560 / grid 640。 */
  drawerWidth?: number;
}

/** 由 adapter 推导布局的工具类型，组件内部使用。 */
export type PickerLayout = 'list' | 'grid';
