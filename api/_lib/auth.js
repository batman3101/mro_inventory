import { supabaseAdmin } from './supabase.js'

// Resolves the caller from the `Authorization: Bearer <supabase access token>`
// header. Returns the caller's users row only for an active system_admin;
// otherwise responds 401/403 and returns null, before any data is touched.
export async function requireSystemAdmin(req, res) {
  const header = req.headers?.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' })
    return null
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.' })
    return null
  }

  const { data: caller, error: callerError } = await supabaseAdmin
    .from('users')
    .select('user_id, role, is_active')
    .eq('auth_user_id', data.user.id)
    .maybeSingle()

  if (callerError) {
    console.error('호출자 조회 실패:', callerError)
    res.status(500).json({ error: '서버 오류가 발생했습니다.' })
    return null
  }
  if (!caller || !caller.is_active || caller.role !== 'system_admin') {
    res.status(403).json({ error: '사용자 관리 권한이 없습니다.' })
    return null
  }
  return caller
}
