export interface TrainingPlan {
  plan_id: string
  status: string
  dataset_id?: string
  feature_version?: string
  model_family?: string
  training_mode?: string
  candidate_model_version?: string
  confirmation_required?: boolean
  config?: Record<string, number>
  summary?: string
}

export interface TrainingJob {
  job_id: string
  model_version?: string
  feature_version?: string
  status: string
  created_at?: string
  started_at?: string
  completed_at?: string | null
  metrics?: Record<string, unknown>
  error_summary?: string | null
}

export interface TrainingJobList { jobs: TrainingJob[] }
export interface ModelEntry {
  model_version?: string
  feature_version?: string
  dataset_id?: string
  trained_at?: string
  status: string
  metrics?: Record<string, unknown>
  promotion_allowed?: boolean
}
export interface ModelRegistry { active_model: ModelEntry | null; candidate_models: ModelEntry[] }
export interface PromotionResult { active_model_id: string; model_version: string; rollback_model_id: string }
