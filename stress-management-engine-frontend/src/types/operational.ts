import type { OperationalRecord } from './personnel'

export type OperationalDomain = 'duty_records' | 'leave_records' | 'deployment_records' | 'transfer_records' | 'training_records' | 'workload_records'
export interface OperationalListResponse { records: OperationalRecord[]; count: number }
export interface OperationalSummary { start_date: string; end_date: string; domains: Record<OperationalDomain, { record_count: number; average_duty_hours?: number; night_duty_records?: number; average_workload_score?: number }> }

export interface WelfareDashboardSummary {
  personnel: { total_authorized: number }
  risk: { LOW: number; ELEVATED: number; HIGH: number }
  alerts: { open: number; attention: number; priority: number }
  interventions: { active: number; follow_up: number }
  generated_at: string
}
