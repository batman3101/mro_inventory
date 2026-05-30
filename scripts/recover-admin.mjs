// One-off admin password recovery / inspection helper.
//   node scripts/recover-admin.mjs                      → list system_admin users (read-only)
//   node scripts/recover-admin.mjs <email> <newPass>    → reset that user's password (bcrypt) + activate
//
// Reads VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local and talks to
// Supabase with the service-role key (bypasses RLS). Mirrors the server's
// bcrypt.hash(password, 10) so the new password works with /api/auth/login.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnv() {
  const text = readFileSync(join(root, '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv();
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_KEY;
if (!url || !serviceKey) {
  console.error('❌ .env.local에 VITE_SUPABASE_URL / SUPABASE_SERVICE_KEY가 없습니다.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const [email, newPassword] = process.argv.slice(2);

if (!email) {
  // Read-only: identify admin accounts
  const { data, error } = await supabase
    .from('users')
    .select('user_id, username, email, role, is_active')
    .eq('role', 'system_admin')
    .order('email');
  if (error) {
    console.error('❌ 조회 실패:', error.message);
    process.exit(1);
  }
  console.log(`\n시스템 관리자 계정 ${data.length}개:`);
  for (const u of data) {
    console.log(`  - ${u.email}  (username=${u.username}, active=${u.is_active})`);
  }
  console.log('\n비번 재설정:  node scripts/recover-admin.mjs <email> <새비밀번호>\n');
  process.exit(0);
}

if (!newPassword || newPassword.length < 6) {
  console.error('❌ 새 비밀번호는 6자 이상이어야 합니다.');
  process.exit(1);
}

const password_hash = await bcrypt.hash(newPassword, 10);
const { data, error } = await supabase
  .from('users')
  .update({ password_hash, is_active: true, updated_at: new Date().toISOString() })
  .eq('email', email)
  .select('user_id, username, email, role, is_active');

if (error) {
  console.error('❌ 변경 실패:', error.message);
  process.exit(1);
}
if (!data || data.length === 0) {
  console.error(`❌ 해당 이메일의 사용자를 찾지 못했습니다: ${email}`);
  process.exit(1);
}
console.log(`✅ 비밀번호 재설정 완료: ${data[0].email} (active=${data[0].is_active})`);
console.log('   이제 이 이메일 + 새 비밀번호로 로그인할 수 있습니다.');
