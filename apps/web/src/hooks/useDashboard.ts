'use client';

import { useState, useCallback } from 'react';
import { dashboardApi } from '@/lib/api';

export interface DashboardMetrics {
  financial: any | null;
  hr: any | null;
  scm: any | null;
  cashFlow: any | null;
  loading: boolean;
  error: string | null;
}

export function useDashboardMetrics(tenantId: string) {
  const [state, setState] = useState<DashboardMetrics>({
    financial: null, hr: null, scm: null, cashFlow: null,
    loading: false, error: null,
  });

  const refresh = useCallback(async (startDate?: string, endDate?: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const [financial, hr, scm, cashFlow] = await Promise.all([
        dashboardApi.getFinancialMetrics(tenantId, startDate, endDate),
        dashboardApi.getHrMetrics(tenantId),
        dashboardApi.getScmMetrics(tenantId),
        dashboardApi.getCashFlowMetrics(tenantId),
      ]);
      setState({ financial, hr, scm, cashFlow, loading: false, error: null });
    } catch (err: any) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [tenantId]);

  return { ...state, refresh };
}
