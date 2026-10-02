import { apiClient } from './client'
import type { OperationalDomain, OperationalListResponse, OperationalSummary } from '../types/operational'
export const operationalApi = {
  list: (domain: OperationalDomain, params?: Record<string, string>) => apiClient.get<OperationalListResponse>(`/operational/${domain}`, { params }).then((r) => r.data),
  create: (domain: OperationalDomain, payload: Record<string, unknown>) => apiClient.post(`/operational/${domain}`, payload).then((r) => r.data),
  get: (domain: OperationalDomain, recordId: string) => apiClient.get(`/operational/${domain}/${encodeURIComponent(recordId)}`).then((r) => r.data),
  update: (domain: OperationalDomain, recordId: string, payload: Record<string, unknown>) => apiClient.patch(`/operational/${domain}/${encodeURIComponent(recordId)}`, payload).then((r) => r.data),
  remove: (domain: OperationalDomain, recordId: string) => apiClient.delete<{ deleted: boolean }>(`/operational/${domain}/${encodeURIComponent(recordId)}`).then((r) => r.data),
  summary: (params?: Record<string, string>) => apiClient.get<OperationalSummary>('/operational/summary', { params }).then((r) => r.data),
}
