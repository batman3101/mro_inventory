// 부서 시드: 생산/품질/영업/MT/ENG/사무실 6개를 departments 테이블에 입력.
// 멱등 — 이미 존재하는 department_code 는 건너뛴다.
// 표시명 번역은 i18n 키(departments.names.<CODE>)로 처리하므로 여기서는
// department_name 에 한국어 기준값만 저장한다.
//   node scripts/seed-departments.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(root, '.env.local'), 'utf8');
const env = {};
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// department_name = 한국어 기준값(fallback). 번역은 i18n departments.names.<CODE>.
const DEPARTMENTS = [
  { department_code: 'PROD', department_name: '생산' },
  { department_code: 'QA', department_name: '품질' },
  { department_code: 'SALES', department_name: '영업' },
  { department_code: 'MT', department_name: 'MT' },
  { department_code: 'ENG', department_name: 'ENG' },
  { department_code: 'OFFICE', department_name: '사무실' },
];

const { data: existing, error: fetchErr } = await supabase
  .from('departments')
  .select('department_code');
if (fetchErr) {
  console.error('❌ 기존 부서 조회 실패:', fetchErr.message);
  process.exit(1);
}
const existingCodes = new Set((existing ?? []).map((d) => d.department_code));

const toInsert = DEPARTMENTS.filter((d) => !existingCodes.has(d.department_code));
if (toInsert.length === 0) {
  console.log('✅ 모든 부서가 이미 존재합니다. 추가 입력 없음.');
  process.exit(0);
}

const { data: created, error: insertErr } = await supabase
  .from('departments')
  .insert(toInsert)
  .select('department_code, department_name');
if (insertErr) {
  console.error('❌ 부서 입력 실패:', insertErr.message);
  process.exit(1);
}

console.log(`✅ 부서 ${created.length}개 입력 완료:`);
for (const d of created) console.log(`   - ${d.department_code} (${d.department_name})`);
if (existingCodes.size > 0) {
  console.log(`   (이미 있던 ${existingCodes.size}개는 건너뜀)`);
}
