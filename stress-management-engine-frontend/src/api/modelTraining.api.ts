import { apiClient } from './client'
import type { ModelRegistry, PromotionResult, TrainingJob, TrainingJobList, TrainingPlan } from '../types/modelTraining'

export const modelTrainingApi = {
  plan: (request_text: string) => apiClient.post<TrainingPlan>('/admin/model-training/plan', { request_text }).then(r => r.data),
  confirm: (plan_id: string) => apiClient.post<TrainingJob>('/admin/model-training/confirm', { plan_id, confirmation: true }).then(r => r.data),
  jobs: () => apiClient.get<TrainingJobList>('/admin/model-training/jobs').then(r => r.data),
  job: (id: string) => apiClient.get<TrainingJob>(`/admin/model-training/jobs/${encodeURIComponent(id)}`).then(r => r.data),
  models: () => apiClient.get<ModelRegistry>('/admin/models').then(r => r.data),
  promote: (modelVersion: string) => apiClient.post<PromotionResult>(`/admin/models/${encodeURIComponent(modelVersion)}/promote`, { confirmation: true }).then(r => r.data),
}
