import { z } from 'zod'

export const USER_COLUMNS =
  'user_id, username, full_name, email, role, department_id, location_id, is_active, phone_number, position, created_at, updated_at'

const role = z.enum(['system_admin', 'admin', 'user', 'viewer'])
const optionalUuid = z.string().uuid().nullable().optional()

const profileFields = {
  full_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(100),
  role,
  department_id: optionalUuid,
  location_id: optionalUuid,
  phone_number: z.string().max(20).nullable().optional(),
  position: z.string().max(50).nullable().optional(),
  is_active: z.boolean().optional(),
}

export const password = z.string().min(6).max(72)

export const createUserSchema = z.object({
  ...profileFields,
  username: z.string().trim().min(1).max(50),
  password,
})

export const updateUserSchema = z.object(profileFields).partial()

// First validation message, for a 400 response.
export function firstIssue(result) {
  const issue = result.error.issues[0]
  return `입력값이 올바르지 않습니다: ${issue.path.join('.') || 'body'} — ${issue.message}`
}
