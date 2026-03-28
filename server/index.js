require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// =============================================================================
// 환경변수 검증
// =============================================================================
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ 필수 환경변수 누락:', missing.join(', '));
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const port = process.env.PORT || 3001;

// =============================================================================
// 미들웨어
// =============================================================================
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// =============================================================================
// 헬스 체크
// =============================================================================
app.get('/', (req, res) => {
  res.json({ status: 'MRO Inventory Server running' });
});

// =============================================================================
// POST /api/auth/login
// =============================================================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    console.log('🔐 로그인 시도:', email);

    // 사용자 조회 (활성 계정만)
    const { data: user, error: queryError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (queryError || !user) {
      console.log('❌ 사용자를 찾을 수 없음:', email);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('✅ 사용자 조회 성공:', user.username);

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      console.log('❌ 비밀번호 불일치:', email);
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    console.log('✅ 비밀번호 검증 성공, 로그인 완료:', user.username);

    // password_hash 제외하고 반환
    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (error) {
    console.error('🚨 로그인 처리 중 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// =============================================================================
// 프로덕션 정적 파일 서빙
// =============================================================================
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// =============================================================================
// 서버 시작
// =============================================================================
app.listen(port, () => {
  console.log(`✅ MRO Inventory Server running on port ${port}`);
});
