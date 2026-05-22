import { useEffect } from 'react';
import { toolsApi } from '../lib/api';
import { useToolStatusStore } from '../stores/toolStatusStore';
import { HEALTH_POLL_INTERVAL_MS } from '../constants';
import type { ToolStatus } from '../types';

export function useHealthPolling() {
  const setToolStatuses = useToolStatusStore((s) => s.setToolStatuses);

  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await toolsApi.list();
        if (res.data.success) {
          const statuses: ToolStatus[] = res.data.data.map((tool) => ({
            identifier: tool.identifier,
            name: tool.name,
            status: tool.status,
            last_health_check: tool.last_health_check ?? null,
          }));
          setToolStatuses(statuses);
        }
      } catch {
        // Silently fail — not critical
      }
    }

    fetchStatuses();
    const interval = setInterval(fetchStatuses, HEALTH_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [setToolStatuses]);
}
