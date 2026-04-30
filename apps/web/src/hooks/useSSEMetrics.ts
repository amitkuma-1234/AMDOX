'use client';

import { useEffect, useRef, useState } from 'react';

export interface MetricUpdate {
  type: string;
  tenantId: string;
  timestamp: string;
}

/**
 * SSE hook for real-time metric updates from the backend stream endpoint.
 */
export function useSSEMetrics(tenantId: string, apiBase = '/api/v1') {
  const [lastUpdate, setLastUpdate] = useState<MetricUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${apiBase}/metrics/stream?tenantId=${encodeURIComponent(tenantId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('metrics', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setLastUpdate(data);
      } catch { /* ignore */ }
    });

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    return () => { es.close(); setConnected(false); };
  }, [tenantId, apiBase]);

  return { lastUpdate, connected };
}

/**
 * SSE hook for real-time notification badge updates.
 */
export function useSSENotifications(userId: string, apiBase = '/api/v1') {
  const [unreadCount, setUnreadCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${apiBase}/notifications/stream?userId=${encodeURIComponent(userId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.type === 'badge_update') setUnreadCount(data.unread);
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [userId, apiBase]);

  return { unreadCount };
}
