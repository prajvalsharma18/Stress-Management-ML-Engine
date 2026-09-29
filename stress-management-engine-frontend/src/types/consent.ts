export type ConsentType = 'WELLNESS_DATA_PROCESSING' | 'BIOMETRIC_DATA_PROCESSING' | 'RECOMMENDATION_PROCESSING' | 'DATA_SHARING'
export interface ConsentState { consent_type: ConsentType; granted: boolean; timestamp: string | null }
export interface ConsentListResponse { user_id: string; consents: ConsentState[] }
export interface UpdateConsentRequest { consent_type: ConsentType; granted: boolean }
