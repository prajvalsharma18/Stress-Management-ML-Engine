import { apiClient } from './client'
import type { ConsentListResponse, ConsentState, UpdateConsentRequest } from '../types/consent'

// Durable consent state is always loaded and updated through the backend.
export const consentApi = {
  getMine: () => apiClient.get<ConsentListResponse>('/consent').then(response => response.data),
  updateMine: (payload: UpdateConsentRequest) => apiClient.post<ConsentState>('/consent', payload).then(response => response.data),
}
