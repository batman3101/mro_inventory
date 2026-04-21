import { createClient } from '@supabase/supabase-js'

const REQUIRED = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
const missing = REQUIRED.filter((key) => !process.env[key])
if (missing.length > 0) {
  throw new Error(`필수 환경변수 누락: ${missing.join(', ')}`)
}

export const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
