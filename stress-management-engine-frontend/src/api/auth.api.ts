import { apiClient } from './client'
import type { LoginRequest, LoginResponse } from '../types/auth'
export const authApi = { login: (payload: LoginRequest) => apiClient.post<LoginResponse>('/auth/login', payload).then((r) => r.data) }
