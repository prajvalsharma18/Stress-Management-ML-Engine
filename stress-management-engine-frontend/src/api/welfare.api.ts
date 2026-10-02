import { apiClient } from './client'
import type { AlertEvaluation, AlertListResponse, WelfareAlert, WelfareIntervention, WelfareInterventionListResponse, WelfareRecommendationResponse } from '../types/welfare'
import type { WelfareDashboardSummary } from '../types/operational'
export const welfareApi = {
  dashboardSummary: () => apiClient.get<WelfareDashboardSummary>('/welfare/dashboard/summary').then((r) => r.data),
  recommendations: (id: string) => apiClient.get<WelfareRecommendationResponse>(`/personnel/${encodeURIComponent(id)}/welfare-recommendations`).then((r) => r.data),
  personnelAlerts: (id: string) => apiClient.get<AlertListResponse>(`/personnel/${encodeURIComponent(id)}/alerts`).then((r) => r.data),
  alerts: () => apiClient.get<AlertListResponse>('/welfare/alerts').then((r) => r.data),
  evaluateAlert: (id: string, reference_date?: string) => apiClient.post<AlertEvaluation>(`/welfare/alerts/evaluate/${encodeURIComponent(id)}`, reference_date ? { reference_date } : {}).then((r) => r.data),
  alert: (id: string) => apiClient.get<WelfareAlert>(`/welfare/alerts/${encodeURIComponent(id)}`).then((r) => r.data),
  transition: (id: string, action: 'acknowledge' | 'review' | 'follow-up' | 'resolve' | 'dismiss', payload?: Record<string, unknown>) => apiClient.post<WelfareAlert>(`/welfare/alerts/${encodeURIComponent(id)}/${action}`, payload ?? {}).then((r) => r.data),
  createIntervention: (id: string, payload: Record<string, unknown>) => apiClient.post<WelfareIntervention>(`/welfare/alerts/${encodeURIComponent(id)}/intervention`, payload).then((r) => r.data),
  interventions: () => apiClient.get<WelfareInterventionListResponse>('/welfare/interventions').then((r) => r.data),
  updateIntervention: (id: string, payload: Record<string, unknown>) => apiClient.patch<WelfareIntervention>(`/welfare/interventions/${encodeURIComponent(id)}`, payload).then((r) => r.data),
}
