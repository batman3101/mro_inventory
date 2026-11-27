import { supabaseAdmin } from '../../_lib/supabase.js'
import { requireSystemAdmin } from '../../_lib/auth.js'
import { password as passwordSchema } from '../../_lib/userSchemas.js'

// POST /api/users/:id/password — set a new password on the user's auth account.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!(await requireSystemAdmin(req, res))) return

  const { id } = req.query
  const parsed = passwordSchema.safeParse(req.body?.password)
  if (!id) {
    return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
  }
  if (!parsed.success) {
    return res.status(400).json({ error: '비밀번호는 6자 이상 72자 이하여야 합니다.' })
  }

  try {
    const { data: target, error: findError } = await supabaseAdmin
      .from('users')
      .select('auth_user_id')
      .eq('user_id', id)
      .maybeSingle()
    if (findError) {
      console.error('사용자 조회 실패:', findError)
      return res.status(500).json({ error: findError.message })
    }
    if (!target?.auth_user_id) {
      return res.status(404).json({ error: '로그인 계정이 연결되지 않은 사용자입니다.' })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
      password: parsed.data,
    })
    if (error) {
      console.error('비밀번호 변경 실패:', error)
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('비밀번호 변경 중 오류:', error)
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' })
  }
}
