// One-off: link every public.users row to a Supabase Auth account.
//   node scripts/migrate-users-to-auth.mjs            → dry run (prints the plan, changes nothing)
//   node scripts/migrate-users-to-auth.mjs --apply    → create auth users + set users.auth_user_id
//   --env <file>                                       → env file to read (default .env.local)
//
// The existing bcrypt hash is copied into auth.users, so everyone keeps the
// password they use today. Safe to re-run: rows already linked are skipped.
// An auth account that already exists for the email is linked ONLY if this
// script created it (app_metadata.migrated_from = users.user_id); any other
// existing account is reported for manual review, never auto-linked — it could
// have been registered by someone else to take over the profile.
// Disable public sign-ups before running. Requires 20261127000100_auth_foundation.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envIndex = args.indexOf('--env');
const envPath = envIndex >= 0 ? resolve(args[envIndex + 1]) : join(root, '.env.local');

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = readEnv(envPath);
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
  console.error(`❌ ${envPath} 에 VITE_SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다.`);
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth 사용자 목록 조회 실패: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

const { data: rows, error } = await supabase
  .from('users')
  .select('user_id, username, email, password_hash, is_active, auth_user_id')
  .order('username');
if (error) {
  console.error('❌ users 조회 실패 (마이그레이션 20261127000100 적용 여부 확인):', error.message);
  process.exit(1);
}

console.log(`${apply ? '[적용]' : '[미리보기 — 변경 없음, 실제 적용은 --apply]'} 대상 ${rows.length}명`);
let failed = 0;
for (const u of rows) {
  const label = `${u.username} <${u.email ?? '-'}>`;
  if (u.auth_user_id) { console.log(`  = ${label}: 이미 연결됨`); continue; }
  if (!u.email) { console.log(`  ! ${label}: 이메일 없음 → 건너뜀 (로그인 불가)`); failed += 1; continue; }
  if (!u.password_hash) { console.log(`  ! ${label}: 비밀번호 해시 없음 → 건너뜀`); failed += 1; continue; }
  if (!apply) { console.log(`  + ${label}: auth 계정 생성 후 연결 예정 (active=${u.is_active})`); continue; }

  try {
    let authId;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password_hash: u.password_hash,
      email_confirm: true,
      app_metadata: { migrated_from: u.user_id },
    });
    if (createErr) {
      const existing = await findAuthUserByEmail(u.email);
      if (!existing) throw new Error(createErr.message);
      if (existing.app_metadata?.migrated_from !== u.user_id) {
        throw new Error('이 이메일로 이미 다른 auth 계정이 있습니다 (이 스크립트가 만든 계정 아님). '
          + '자동 연결하지 않음 — Supabase 대시보드에서 그 계정을 확인·삭제한 뒤 다시 실행하세요.');
      }
      authId = existing.id;
      console.log(`  ~ ${label}: 이전 실행에서 만든 auth 계정에 연결`);
    } else {
      authId = created.user.id;
    }
    const { error: linkErr } = await supabase
      .from('users')
      .update({ auth_user_id: authId })
      .eq('user_id', u.user_id);
    if (linkErr) throw new Error(linkErr.message);
    console.log(`  ✓ ${label}: 연결 완료`);
  } catch (e) {
    failed += 1;
    console.error(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
