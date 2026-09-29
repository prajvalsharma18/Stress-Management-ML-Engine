export type RiskCategory = 'LOW' | 'ELEVATED' | 'HIGH'
export type RiskDataMode = 'OPERATIONAL_ONLY' | 'OPERATIONAL_AND_WELLNESS'

export interface RiskProbabilities {
  LOW: number
  ELEVATED: number
  HIGH: number
}

interface RiskResultMetadata {
  personnel_id: string
  reference_date: string
  risk_category: RiskCategory
  probabilities: RiskProbabilities
  model_version: string
  data_mode: RiskDataMode
}

export interface RiskPredictionResponse extends RiskResultMetadata {}

export interface RiskContributor {
  feature: string
  label: string
  shap_value: number
  direction: string
}

export interface RiskExplanationPayload {
  method: 'SHAP'
  predicted_class: RiskCategory
  top_contributors: RiskContributor[]
}

export interface RiskExplanationResponse extends RiskResultMetadata {
  explanation: RiskExplanationPayload
}

export interface RiskHistoryItem {
  reference_date: string
  risk_category: RiskCategory
  model_version: string
  data_mode: RiskDataMode
  created_at?: string
}

export interface RiskHistoryResponse {
  items: RiskHistoryItem[]
  page: number
  page_size: number
  total: number
}
