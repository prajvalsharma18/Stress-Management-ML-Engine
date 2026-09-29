import { apiClient } from './client'
import type { RiskExplanationResponse, RiskHistoryResponse, RiskPredictionResponse } from '../types/risk'
export const riskApi = {
  prediction: (id: string) => apiClient.get<RiskPredictionResponse>(`/personnel/${encodeURIComponent(id)}/risk-prediction`).then((r) => r.data),
  explanation: (id: string) => apiClient.get<RiskExplanationResponse>(`/personnel/${encodeURIComponent(id)}/risk-explanation`).then((r) => r.data),
  history: (id: string, params?: { page?: number; page_size?: number; reference_date_from?: string; reference_date_to?: string }) => apiClient.get<RiskHistoryResponse>(`/personnel/${encodeURIComponent(id)}/risk-history`, { params }).then((r) => r.data),
}
