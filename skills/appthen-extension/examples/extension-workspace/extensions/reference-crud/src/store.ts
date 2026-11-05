import { useEffect, useState } from 'react';
import { INITIAL_REQUESTS, type RequestStatus, type ServiceRequest } from './data';

/**
 * 示例用的极简 store：真实扩展应换成后端接口。
 * 放在这里只是为了让「列表改状态 → 主面板计数跟着变」能真的跑起来，
 * 演示用，不要照抄成业务实现。
 */
let state: ServiceRequest[] = INITIAL_REQUESTS;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function useRequests(): ServiceRequest[] {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return state;
}

export function updateStatus(id: string, status: RequestStatus) {
  state = state.map((item) => (item.id === id ? { ...item, status } : item));
  emit();
}

export function selectById(id: string): ServiceRequest | undefined {
  return state.find((item) => item.id === id);
}
