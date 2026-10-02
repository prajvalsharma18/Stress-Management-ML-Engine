import { apiClient } from './client'
import type { CreateSupportRequest, SupportRequest, SupportRequestList, SupportStatus } from '../types/support'

export const supportApi = {
  mine: () => apiClient.get<SupportRequestList>('/personnel/me/support-requests').then(r => r.data),
  create: (payload: CreateSupportRequest) => apiClient.post<SupportRequest>('/personnel/me/support-requests', payload).then(r => r.data),
  queue: (status?: SupportStatus) => apiClient.get<SupportRequestList>('/welfare/support-requests', { params: status ? { status } : undefined }).then(r => r.data),
  acknowledge: (id: string) => apiClient.post<SupportRequest>(`/welfare/support-requests/${encodeURIComponent(id)}/acknowledge`).then(r => r.data),
  schedule: (id: string, scheduled_follow_up: string) => apiClient.post<SupportRequest>(`/welfare/support-requests/${encodeURIComponent(id)}/schedule`, { scheduled_follow_up }).then(r => r.data),
  start: (id: string) => apiClient.post<SupportRequest>(`/welfare/support-requests/${encodeURIComponent(id)}/start`).then(r => r.data),
  resolve: (id: string) => apiClient.post<SupportRequest>(`/welfare/support-requests/${encodeURIComponent(id)}/resolve`).then(r => r.data),
}
