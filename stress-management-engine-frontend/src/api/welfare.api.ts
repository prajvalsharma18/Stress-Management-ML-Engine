import { apiClient } from './client'
import type { AlertListResponse, WelfareAlert, WelfareIntervention, WelfareRecommendationResponse } from '../types/welfare'
import type { WelfareDashboardSummary } from '../types/operational'
export const welfareApi = {
  dashboardSummary: () => apiClient.get<WelfareDashboardSummary>('/welfare/dashboard/summary').then((r) => r.data),
  recommendations: (id: string) => apiClient.get<WelfareRecommendationResponse>(`/personnel/${id}/welfare-recommendations`).then((r) => r.data),
  personnelAlerts: (id: string) => apiClient.get<AlertListResponse>(`/personnel/${id}/alerts`).then((r) => r.data),
  alerts: () => apiClient.get<AlertListResponse>('/welfare/alerts').then((r) => r.data),
  evaluateAlert: (id: string, reference_date?: string) => apiClient.post<WelfareAlert>(`/welfare/alerts/evaluate/${id}`, { reference_date }).then((r) => r.data),
  alert: (id: string) => apiClient.get<WelfareAlert>(`/welfare/alerts/${id}`).then((r) => r.data),
  transition: (id: string, action: 'acknowledge' | 'review' | 'follow-up' | 'resolve' | 'dismiss', payload?: Record<string, unknown>) => apiClient.post<WelfareAlert>(`/welfare/alerts/${id}/${action}`, payload).then((r) => r.data),
  createIntervention: (id: string, payload: Record<string, unknown>) => apiClient.post<WelfareIntervention>(`/welfare/alerts/${id}/intervention`, payload).then((r) => r.data),
  updateIntervention: (id: string, payload: Record<string, unknown>) => apiClient.patch<WelfareIntervention>(`/welfare/interventions/${id}`, payload).then((r) => r.data),
}
