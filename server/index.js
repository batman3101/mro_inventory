require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const cors = require('cors');
const path = require('path');

// =============================================================================
// 환경변수 검증
// =============================================================================
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ 필수 환경변수 누락:', missing.join(', '));
  process.exit(1);
}

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
// API — reuse the Vercel handlers in /api so local dev and production run the
// same code (including the caller authentication in api/_lib/auth.js).
// Login itself is handled by Supabase Auth in the browser.
// =============================================================================
const adapt = (load) => async (req, res) => {
  try {
    const { default: handler } = await load();
    req.query = { ...req.query, ...req.params };
    await handler(req, res);
  } catch (error) {
    console.error('API 처리 중 오류:', error);
    if (!res.headersSent) res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

app.all('/api/users', adapt(() => import('../api/users/index.js')));
app.all('/api/users/:id/password', adapt(() => import('../api/users/[id]/password.js')));
app.all('/api/users/:id', adapt(() => import('../api/users/[id]/index.js')));

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
