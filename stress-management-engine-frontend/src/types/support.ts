export type SupportStatus = 'REQUESTED' | 'ACKNOWLEDGED' | 'SCHEDULED' | 'IN_PROGRESS' | 'RESOLVED'
export type SupportCategory = 'GENERAL_WELFARE' | 'WORKLOAD_FATIGUE' | 'SLEEP_RECOVERY' | 'PERSONAL_SUPPORT' | 'OTHER'
export type SupportUrgency = 'NORMAL' | 'URGENT'

export interface SupportRequest {
  support_request_id: string
  personnel_id?: string
  related_alert_id?: string | null
  category: SupportCategory
  message?: string | null
  urgency: SupportUrgency
  status: SupportStatus
  created_at: string
  updated_at?: string
  acknowledged_at?: string | null
  scheduled_follow_up?: string | null
  closed_at?: string | null
  assigned_to_user_id?: string | null
}

export interface SupportRequestList { requests: SupportRequest[]; count: number }
export interface CreateSupportRequest { category: SupportCategory; urgency: SupportUrgency; message?: string; related_alert_id?: string }
