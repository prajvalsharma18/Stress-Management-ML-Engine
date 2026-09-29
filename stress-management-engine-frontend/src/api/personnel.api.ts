import { apiClient } from './client'
import type { PersonnelDirectoryResponse, PersonnelFeatures, PersonnelOperationalResponse } from '../types/personnel'
export const personnelApi = {
  directory: (params?: { page?: number; page_size?: number; search?: string; status?: string }) => apiClient.get<PersonnelDirectoryResponse>('/welfare/personnel', { params }).then((r) => r.data),
  getOperational: (personnelId: string, domain: string) => apiClient.get<PersonnelOperationalResponse>(`/personnel/${personnelId}/operational/${domain}`).then((r) => r.data),
  getFeatures: (personnelId: string) => apiClient.get<PersonnelFeatures>(`/personnel/${personnelId}/features`).then((r) => r.data),
}
