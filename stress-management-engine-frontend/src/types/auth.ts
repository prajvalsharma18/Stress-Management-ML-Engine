export type Role = 'PERSONNEL' | 'WELFARE_OFFICER' | 'COMMANDER' | 'ADMIN'

export interface AuthUser {
  user_id: string
  username: string
  role: Role
  personnel_id?: string
}

export interface LoginRequest { username: string; password: string }

export interface LoginResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  expires_at: string
  user: AuthUser
}
