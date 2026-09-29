import type { Role } from './auth'

export type UserStatus = 'ACTIVE' | 'DISABLED'
export interface AdminUser { user_id: string; username: string; role: Role; status: UserStatus; personnel_id?: string; created_at?: string; updated_at?: string }
export interface AdminUserListResponse { users: AdminUser[] }
export interface CreateAdminUserRequest { username: string; password: string; role: Role; personnel_id?: string; status?: UserStatus }
export interface UpdateAdminUserRequest { password?: string; role?: Role; personnel_id?: string | null; status?: UserStatus }
