import type { Role } from '../types/auth'

export function getRoleHome(role: Role): string { switch (role) { case 'PERSONNEL': return '/403'; case 'WELFARE_OFFICER': return '/welfare/dashboard'; case 'COMMANDER': return '/commander/dashboard'; case 'ADMIN': return '/admin/dashboard' } }
