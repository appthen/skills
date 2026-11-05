export type RequestStatus = '待受理' | '处理中' | '待验收' | '已完成';

export interface ServiceRequest {
  id: string;
  title: string;
  customer: string;
  owner: string;
  updatedAt: string;
  status: RequestStatus;
}

export const STATUSES: RequestStatus[] = ['待受理', '处理中', '待验收', '已完成'];

export const INITIAL_REQUESTS: ServiceRequest[] = [
  { id: 'SR-2401', title: '产线温控探头读数漂移', customer: '华东精工', owner: '周启明', updatedAt: '2026-11-03', status: '处理中' },
  { id: 'SR-2402', title: '包装线扫码枪无法识别批次码', customer: '远洋食品', owner: '陈思远', updatedAt: '2026-11-03', status: '待受理' },
  { id: 'SR-2403', title: '冷库温度记录断档 6 小时', customer: '远洋食品', owner: '林曼', updatedAt: '2026-11-02', status: '待验收' },
  { id: 'SR-2404', title: '注塑机压力传感器需校准', customer: '华东精工', owner: '周启明', updatedAt: '2026-11-01', status: '处理中' },
  { id: 'SR-2405', title: '实验室离心机异响', customer: '康泽生物', owner: '林曼', updatedAt: '2026-10-31', status: '已完成' },
  { id: 'SR-2406', title: '空压机压力表更换', customer: '远洋食品', owner: '陈思远', updatedAt: '2026-10-30', status: '已完成' },
];
