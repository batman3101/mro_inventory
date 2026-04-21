import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../_lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query
  const { password } = req.body || {}

  if (!id) {
    return res.status(400).json({ error: '사용자 ID가 필요합니다.' })
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' })
  }

  try {
    const password_hash = await bcrypt.hash(password, 10)
    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('user_id', id)

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
