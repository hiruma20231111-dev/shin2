import { create } from 'zustand';
import type { ToolStatus } from '../types';

interface ToolStatusStore {
  toolStatuses: ToolStatus[];
  offlineTools: ToolStatus[];
  setToolStatuses: (statuses: ToolStatus[]) => void;
}

export const useToolStatusStore = create<ToolStatusStore>((set) => ({
  toolStatuses: [],
  offlineTools: [],

  setToolStatuses: (statuses) =>
    set({
      toolStatuses: statuses,
      offlineTools: statuses.filter((t) => t.status !== 'online'),
    }),
}));
