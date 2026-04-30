/**
 * API client for AMDOX ERP backend.
 * Base URL is set via NEXT_PUBLIC_API_URL environment variable.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

// ── Dashboard ──────────────────────────────────────────
export const dashboardApi = {
  getFinancialMetrics: (tenantId: string, start?: string, end?: string) =>
    request<any>(`/metrics/financial?tenantId=${tenantId}${start ? `&startDate=${start}` : ''}${end ? `&endDate=${end}` : ''}`),
  getHrMetrics: (tenantId: string) =>
    request<any>(`/metrics/hr?tenantId=${tenantId}`),
  getScmMetrics: (tenantId: string) =>
    request<any>(`/metrics/scm?tenantId=${tenantId}`),
  getCashFlowMetrics: (tenantId: string) =>
    request<any>(`/metrics/cash-flow?tenantId=${tenantId}`),
  getWidgets: (tenantId: string) =>
    request<any>(`/dashboard/widgets?tenantId=${tenantId}`),
  createWidget: (body: any) =>
    request<any>('/dashboard/widgets', { method: 'POST', body: JSON.stringify(body) }),
  deleteWidget: (id: string) =>
    request<void>(`/dashboard/widgets/${id}`, { method: 'DELETE' }),
};

// ── Projects ───────────────────────────────────────────
export const projectApi = {
  list: (tenantId: string, status?: string) =>
    request<any>(`/projects?tenantId=${tenantId}${status ? `&status=${status}` : ''}`),
  get: (id: string) => request<any>(`/projects/${id}`),
  create: (body: any) =>
    request<any>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) =>
    request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getGantt: (id: string) => request<any>(`/projects/${id}/gantt`),
  getTasks: (projectId: string) => request<any>(`/projects/${projectId}/tasks`),
  createTask: (projectId: string, body: any) =>
    request<any>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (projectId: string, taskId: string, body: any) =>
    request<any>(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  getUtilisation: (projectId: string) =>
    request<any>(`/projects/${projectId}/resource-utilisation`),
};

// ── Notifications ──────────────────────────────────────
export const notificationApi = {
  list: (userId: string, page = 1) =>
    request<any>(`/notifications?userId=${userId}&page=${page}`),
  getBadgeCount: (userId: string) =>
    request<{ unread: number }>(`/notifications/badge?userId=${userId}`),
  markRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
};

// ── ML Service ─────────────────────────────────────────
export const mlApi = {
  predict: (skuId: string, horizonDays = 90) =>
    request<any>(`${process.env.NEXT_PUBLIC_ML_URL ?? 'http://localhost:8000'}/predict`, {
      method: 'POST',
      body: JSON.stringify({ sku_id: skuId, horizon_days: horizonDays }),
    }),
  getMetrics: () =>
    request<any>(`${process.env.NEXT_PUBLIC_ML_URL ?? 'http://localhost:8000'}/metrics`),
};
