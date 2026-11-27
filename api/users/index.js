import { supabaseAdmin } from '../_lib/supabase.js'
import { requireSystemAdmin } from '../_lib/auth.js'
import { USER_COLUMNS, createUserSchema, firstIssue } from '../_lib/userSchemas.js'

// POST /api/users — create a login (auth.users) and its profile (public.users).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireSystemAdmin(req, res))) return

  const parsed = createUserSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: firstIssue(parsed) })
  }
  const { password, ...profile } = parsed.data

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: profile.email,
      password,
      email_confirm: true,
    })
    if (authError) {
      console.error('인증 계정 생성 실패:', authError)
      const duplicate = /already|registered|exists/i.test(authError.message)
      return res.status(duplicate ? 409 : 500).json({
        error: duplicate ? '이미 존재하는 이메일입니다.' : authError.message,
      })
    }

    const { data: created, error } = await supabaseAdmin
      .from('users')
      .insert({
        ...profile,
        department_id: profile.department_id ?? null,
        location_id: profile.location_id ?? null,
        phone_number: profile.phone_number ?? '',
        position: profile.position ?? null,
        is_active: profile.is_active ?? true,
        auth_user_id: authData.user.id,
      })
      .select(USER_COLUMNS)
      .single()

    if (error) {
      console.error('사용자 생성 실패:', error)
      // Do not leave a login without a profile behind.
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      if (error.code === '23505') {
        return res.status(409).json({ error: '이미 존재하는 사용자명 또는 이메일입니다.' })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json({ user: created })
  } catch (error) {
    console.error('사용자 생성 중 오류:', error)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
