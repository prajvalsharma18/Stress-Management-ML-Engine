import { apiClient } from './client'
import type { AdminUser, AdminUserListResponse, CreateAdminUserRequest, UpdateAdminUserRequest, UserStatus } from '../types/admin'
import type { Role } from '../types/auth'

// Backend permission checks remain authoritative for all account operations.
export const adminApi = {
  listUsers: (params?: { status?: UserStatus; role?: Role }) => apiClient.get<AdminUserListResponse>('/admin/users', { params }).then(response => response.data),
  createUser: (payload: CreateAdminUserRequest) => apiClient.post<AdminUser>('/admin/users', payload).then(response => response.data),
  getUser: (userId: string) => apiClient.get<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`).then(response => response.data),
  updateUser: (userId: string, payload: UpdateAdminUserRequest) => apiClient.patch<AdminUser>(`/admin/users/${encodeURIComponent(userId)}`, payload).then(response => response.data),
}
