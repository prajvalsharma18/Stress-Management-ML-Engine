export interface WellnessAssessment { assessment_id: string; personnel_id: string; assessment_date: string; submitted_at: string; sleep_quality: number; fatigue_level: number; perceived_stress: number; mood_wellbeing: number }
export interface WellnessListResponse { assessments: WellnessAssessment[]; count: number }
export interface WellnessPayload { assessment_date: string; sleep_quality: number; fatigue_level: number; perceived_stress: number; mood_wellbeing: number }
