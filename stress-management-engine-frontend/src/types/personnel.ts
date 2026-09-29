export interface PersonnelOperationalResponse { records: OperationalRecord[]; count: number }
export type PersonnelStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TEMPORARILY_INACTIVE'
export interface PersonnelDirectoryItem { personnel_id: string; pseudonymous_reference?: string; unit_id?: string; status?: PersonnelStatus; posting_type?: string; created_at?: string; updated_at?: string }
export interface PersonnelDirectoryResponse { items: PersonnelDirectoryItem[]; page: number; page_size: number; total: number }
export interface PersonnelFeatures { [key: string]: string | number | boolean | null }
export interface OperationalRecord {
  record_id: string
  personnel_id: string
  created_at: string
  date?: string
  start_date?: string
  end_date?: string | null
  transfer_date?: string
  duty_hours?: number
  night_duty?: boolean
  shift_type?: string
  operational_intensity?: string
  leave_type?: string
  duration_days?: number
  deployment_type?: string
  location_category?: string
  previous_posting?: string
  new_posting?: string
  reason_category?: string
  training_type?: string
  training_hours?: number
  intensity?: string
  workload_score?: number
  task_count?: number
  consecutive_duty_days?: number
}
