import { apiClient } from './client'
import type { WellnessAssessment, WellnessListResponse, WellnessPayload } from '../types/wellness'
export const wellnessApi = {
  create: (payload: WellnessPayload) => apiClient.post<WellnessAssessment>('/personnel/me/wellness', payload).then((r) => r.data),
  listMine: () => apiClient.get<WellnessListResponse>('/personnel/me/wellness').then((r) => r.data),
  getMine: (id: string) => apiClient.get<WellnessAssessment>(`/personnel/me/wellness/${id}`).then((r) => r.data),
  removeMine: (id: string) => apiClient.delete<{ deleted: boolean }>(`/personnel/me/wellness/${id}`).then((r) => r.data),
  listForPersonnel: (id: string) => apiClient.get<WellnessListResponse>(`/personnel/${id}/wellness`).then((r) => r.data),
}
