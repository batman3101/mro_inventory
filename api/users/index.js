import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../_lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    username, full_name, email, password, role,
    department_id, location_id, phone_number, position, is_active,
  } = req.body || {}

  if (!username || !full_name || !email || !password || !role) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' })
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' })
  }

  try {
    const password_hash = await bcrypt.hash(password, 10)

    const { data: created, error } = await supabaseAdmin
      .from('users')
      .insert({
        username,
        full_name,
        email,
        password_hash,
        role,
        department_id: department_id ?? null,
        location_id: location_id ?? null,
        phone_number: phone_number ?? '',
        position: position ?? null,
        is_active: is_active ?? true,
      })
      .select('user_id, username, full_name, email, role, department_id, location_id, is_active, phone_number, position, created_at, updated_at')
      .single()

    if (error) {
      console.error('사용자 생성 실패:', error)
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
