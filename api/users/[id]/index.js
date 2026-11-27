import { supabaseAdmin } from '../../_lib/supabase.js'
import { requireSystemAdmin } from '../../_lib/auth.js'
import { USER_COLUMNS, updateUserSchema, firstIssue } from '../../_lib/userSchemas.js'

// PATCH  /api/users/:id — update profile (email change is mirrored to the login).
// DELETE /api/users/:id — delete an inactive user and its login.
export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireSystemAdmin(req, res))) return

  const { id } = req.query
  if (!id) {
    return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
  }

  try {
    const { data: target, error: findError } = await supabaseAdmin
      .from('users')
      .select('user_id, email, is_active, auth_user_id')
      .eq('user_id', id)
      .maybeSingle()
    if (findError) {
      console.error('사용자 조회 실패:', findError)
      return res.status(500).json({ error: findError.message })
    }
    if (!target) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })
    }

    if (req.method === 'DELETE') {
      return await deleteUser(target, res)
    }
    return await updateUser(target, req.body ?? {}, res)
  } catch (error) {
    console.error('사용자 처리 중 오류:', error)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}

async function updateUser(target, body, res) {
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return res.status(400).json({ error: firstIssue(parsed) })
  }
  const changes = parsed.data

  if (changes.email && changes.email !== target.email && target.auth_user_id) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
      email: changes.email,
      email_confirm: true,
    })
    if (error) {
      console.error('로그인 이메일 변경 실패:', error)
      const duplicate = /already|registered|exists/i.test(error.message)
      return res.status(duplicate ? 409 : 500).json({
        error: duplicate ? '이미 존재하는 이메일입니다.' : error.message,
      })
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from('users')
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq('user_id', target.user_id)
    .select(USER_COLUMNS)
    .single()
  if (error) {
    console.error('사용자 수정 실패:', error)
    if (error.code === '23505') {
      return res.status(409).json({ error: '이미 존재하는 사용자명 또는 이메일입니다.' })
    }
    return res.status(500).json({ error: error.message })
  }
  return res.status(200).json({ user: updated })
}

async function deleteUser(target, res) {
  if (target.is_active) {
    return res.status(400).json({ error: '비활성화된 사용자만 삭제할 수 있습니다.' })
  }
  const { error } = await supabaseAdmin.from('users').delete().eq('user_id', target.user_id)
  if (error) {
    console.error('사용자 삭제 실패:', error)
    return res.status(500).json({ error: error.message })
  }
  if (target.auth_user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(target.auth_user_id)
    if (authError) console.error('로그인 계정 삭제 실패 (프로필은 삭제됨):', authError)
  }
  return res.status(200).json({ ok: true })
}
