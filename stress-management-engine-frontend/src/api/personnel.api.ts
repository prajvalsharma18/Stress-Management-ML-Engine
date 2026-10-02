import { apiClient } from './client'
import type { PersonnelDirectoryItem, PersonnelDirectoryResponse, PersonnelFeatures, PersonnelOperationalResponse } from '../types/personnel'
export const personnelApi = {
  directory: (params?: { page?: number; page_size?: number; search?: string; status?: string }) => apiClient.get<PersonnelDirectoryResponse>('/welfare/personnel', { params }).then((r) => r.data),
  getDirectoryItem: (personnelId: string) => apiClient.get<PersonnelDirectoryItem>(`/welfare/personnel/${encodeURIComponent(personnelId)}`).then((r) => r.data),
  getOperational: (personnelId: string, domain: string) => apiClient.get<PersonnelOperationalResponse>(`/personnel/${encodeURIComponent(personnelId)}/operational/${encodeURIComponent(domain)}`).then((r) => r.data),
  getFeatures: (personnelId: string) => apiClient.get<PersonnelFeatures>(`/personnel/${encodeURIComponent(personnelId)}/features`).then((r) => r.data),
}
