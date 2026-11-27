# MRO Inventory - Project Rules

## i18n (Internationalization) — MANDATORY

모든 페이지, 컴포넌트에서 사용자에게 보이는 텍스트는 반드시 i18n을 적용해야 합니다.

### 규칙

1. **하드코딩 금지**: 사용자에게 보이는 모든 한국어/베트남어 문자열은 `t('key')` 호출로 대체
2. **useTranslation 필수**: 모든 페이지/컴포넌트에 `import { useTranslation } from 'react-i18next'` 및 `const { t } = useTranslation()` 추가
3. **양쪽 로케일 동시 업데이트**: 새로운 키를 추가할 때 `src/i18n/locales/ko.json`과 `src/i18n/locales/vi.json` 모두 업데이트
4. **키 네이밍**: `{페이지명}.{항목}` 형식 (예: `items.itemCode`, `outbound.requester`)
5. **공통 키 재사용**: `common.*` 키는 여러 페이지에서 공유 (save, cancel, delete, edit, create, confirm, actions, status, active, inactive)

### 적용 범위

- 페이지 제목, 테이블 컬럼 헤더
- 버튼 텍스트, 모달 제목
- 폼 라벨, 플레이스홀더, 유효성 검증 메시지
- 성공/실패 메시지 (`message.success`, `message.error`)
- Popconfirm 텍스트, 빈 데이터 메시지
- Breadcrumb 항목
- 차트 범례, 통계 카드 제목

### 예외

- `console.error` 등 개발자 전용 메시지는 한국어 하드코딩 허용
- 아이콘, 숫자, 날짜 형식은 i18n 불필요

### 지원 언어

- `ko` — 한국어 (기본)
- `vi` — 베트남어

## Multi-Factory System

- `location_id`는 데이터 스코핑 디스커미네이터 (NOT NULL, RLS 적용)
- 모든 서비스의 목록 조회 시 `getOptionalLocationId()`로 현재 공장 필터링
- 공장 변경 시 `<Outlet key={locationId}>` 로 페이지 자동 리마운트

## Auth · 권한 · 데이터 정합성 (2026-11-27 감사 수정 이후)

- 로그인은 **Supabase Auth** (`supabase.auth.signInWithPassword`). `users.auth_user_id` 로 앱 프로필과 연결. 비밀번호는 `auth.users` 에 있고 `users.password_hash` 는 더 이상 쓰지 않는다.
- 권한은 **DB RLS 가 강제**한다 (`private.*` 헬퍼, `app_*` 정책). 화면 숨김은 편의일 뿐 보안이 아니다.
  - `users.location_id` 지정 → 그 공장만, NULL → 전 공장 / `viewer` 읽기 전용 / 사용자 관리는 `system_admin` 만.
- `users` 테이블 쓰기는 클라이언트에서 불가. 생성·수정·비밀번호·삭제는 `/api/users*` (서버가 `api/_lib/auth.js` 로 system_admin 검증) 경유.
  `server/index.js` 는 `api/` 핸들러를 그대로 재사용한다 — 서버 쪽에 API 로직을 따로 쓰지 말 것.
- 재고가 바뀌는 입출고 생성·수정·삭제, 단가 저장은 **RPC 로만** (`create_*_atomic`, `update_*_atomic`, `delete_*_atomic`, `save_item_price`). 클라이언트에서 조회→계산→절대값 UPDATE 금지.
  - 참조번호(`IN-/OUT-YYYYMMDD-NN`)는 RPC 가 서버에서 채번한다. `created_by/updated_by` 도 RPC 가 로그인 사용자로 기록한다.
- `supabase.rpc()` 인자는 **전부 명시**한다. `undefined` 값은 요청에서 빠져 함수 시그니처가 안 맞는다 → 선택 값은 `?? null`.
- 목록·집계 조회는 Data API **1,000행 상한**이 있다. 늘어나는 테이블은 `fetchAllRows` (`src/lib/fetchAll.ts`) + 고유 컬럼까지 포함한 정렬로 조회.
- 공장 종속 쿼리에는 항상 `location_id` 조건. 공장이 아직 선택되지 않았으면 전역 조회로 대체하지 말고 기다린다.
- Supabase 응답은 실패해도 throw 하지 않는다 — `error` 를 반드시 확인 (`?? 0` 으로 덮지 말 것).
- 새 마이그레이션의 함수는 `REVOKE EXECUTE ... FROM PUBLIC, anon` 후 필요한 역할에만 GRANT.

## Coding Patterns

- Zustand 스토어: named export (`useXxxStore`), immutable 패턴 (spread/map/filter)
- Supabase 서비스: 에러 시 Korean 메시지로 throw
- Ant Design 5 API 사용, Table + Modal + Form 패턴
- Auth store에 factory/location 커플링 금지 — locationContext.ts 통해 접근


## 코딩 규칙을 따르세요

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

