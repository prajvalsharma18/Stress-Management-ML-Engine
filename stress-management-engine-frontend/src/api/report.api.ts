import { apiClient } from './client'
export const reportApi = { welfareReport: (id: string) => apiClient.get<Blob>(`/personnel/${encodeURIComponent(id)}/welfare-report`, { responseType: 'blob' }).then((r) => r.data) }
