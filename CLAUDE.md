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
- 회원가입(`/signup`)은 관리자 승인제: `auth.users` INSERT 트리거(`private.handle_new_auth_user`)가 비활성 viewer 프로필을 만든다. 같은 이메일 프로필이 있으면 연결하지 않는다. `/api/users` 생성은 이 자리 프로필을 `auth_user_id` 기준 upsert 로 덮어쓴다 (GoTrue 는 app_metadata 를 INSERT 뒤에 쓰므로 메타데이터로 구분 불가).
- `users` 테이블 쓰기는 클라이언트에서 불가. 생성·수정·비밀번호·삭제는 `/api/users*` (서버가 `api/_lib/auth.js` 로 system_admin 검증) 경유.
  `server/index.js` 는 `api/` 핸들러를 그대로 재사용한다 — 서버 쪽에 API 로직을 따로 쓰지 말 것.
- 재고가 바뀌는 입출고 생성·수정·삭제, 단가 저장은 **RPC 로만** (`create_*_atomic`, `update_*_atomic`, `delete_*_atomic`, `save_item_price`). 클라이언트에서 조회→계산→절대값 UPDATE 금지.
  - 참조번호(`IN-/OUT-YYYYMMDD-NN`)는 RPC 가 서버에서 채번한다. `created_by/updated_by` 도 RPC 가 로그인 사용자로 기록한다.
- `supabase.rpc()` 인자는 **전부 명시**한다. `undefined` 값은 요청에서 빠져 함수 시그니처가 안 맞는다 → 선택 값은 `?? null`.
- 목록·집계 조회는 Data API **1,000행 상한**이 있다. 늘어나는 테이블은 `fetchAllRows` (`src/lib/fetchAll.ts`) + 고유 컬럼까지 포함한 정렬로 조회.
- 공장 종속 쿼리에는 항상 `location_id` 조건. 공장이 아직 선택되지 않았으면 전역 조회로 대체하지 말고 기다린다.
- Supabase 응답은 실패해도 throw 하지 않는다 — `error` 를 반드시 확인 (`?? 0` 으로 덮지 말 것).
- 새 마이그레이션의 함수는 `REVOKE EXECUTE ... FROM PUBLIC, anon` 후 필요한 역할에만 GRANT.
- 새 테이블은 같은 마이그레이션에서 반드시 `ENABLE ROW LEVEL SECURITY` + `app_*` 정책을 만든다. 빠뜨리면 로그인한 사용자 누구나 전체 행에 접근한다 (authenticated 는 기본 테이블 권한을 가짐).
  - 공장 데이터(`location_id` 있음): 기존 공장 범위 정책과 같은 식 — `20261127000100_auth_foundation.sql` 의 `loc_ok` 참고. 조회는 `is_active_user` + 공장 일치, 쓰기는 `can_write` 추가.
  - 전역 마스터(공장 없음): 조회 `is_active_user`, 쓰기 `can_write`.
  - 앱에서 직접 읽지 않는 내부용 테이블은 `private` 스키마에 둔다 (Data API 비노출).
- 마이그레이션 파일 이름은 마지막 적용분(`20261127000400`)보다 뒤의 타임스탬프로. 운영 적용은 `supabase db query --remote=<ref> --yes -f` 를 트랜잭션으로 감싸 실행하고 `supabase_migrations.schema_migrations` 에 기록한다 (사용자 승인 후에만).

## 화면 스타일 (2026-11-27 WorkBoard 스타일 적용 이후)

- 색·글꼴·모서리·행 높이 값은 **`src/styles/tokens.ts` 한 곳**에만 적는다 (라이트/다크 두 벌). 다른 파일에 `#hex`·`rgb()` 를 직접 쓰지 않는다.
  - CSS 는 `var(--accent)` 같은 변수로, antd 는 `src/styles/antdTheme.ts`, 차트(recharts)는 `useChartTheme()` (`src/components/chartTheme.ts`) 로 읽는다.
  - CSS 변수는 빌드할 때 `vite.config.ts` 의 `theme-boot` 가 tokens.ts 에서 만들어 `index.html` 의 `<head>` 에 넣는다 (`src/styles/themeBoot.ts`). 앱의 JS 가 도착하기 전 첫 화면부터 맞는 테마로 그리기 위해서다. `index.html` 에 색을 직접 적지 말 것.
  - 한곳 관리 대상은 색과 앱 전체가 같이 쓰는 크기(모서리·행 높이·상단바·메뉴 폭)다. 한 규칙에서만 쓰는 여백·글자 크기는 `app.css` 에 숫자로 둔다.
  - 값을 바꾸거나 더하면 `npm run lint:contrast` 로 글자 대비(WCAG AA 4.5:1)를 확인한다. 새 글자/배경 조합은 `scripts/check-contrast.mjs` 의 목록에 추가.
- **색은 상태 표시에만** 쓴다 (정상 ok · 주의 warn · 위험 danger · 선택 accent). 단순 숫자·역할·분류에 색을 입히지 않는다.
  - 지금 있는 예외 (늘리면 여기에 적는다): ① 차트의 계열 구분색 — `useChartTheme().series` (차트 색 4개 + 회색 2개, 모두 바탕 대비 확인 대상), ② 로그인·가입 화면의 브랜드 색 `brand-ink`, ③ 역할 태그 중 "시스템 관리자" 하나의 강조.
  - `Tag` 는 `color="success|processing|error|warning"` 또는 색 없음. `green`·`blue`·`red` 같은 antd 기본 색 이름 금지 (디자인 값을 따르지 않고 다크에서 대비가 깨진다).
- 페이지에 `style={{...}}` 를 새로 쓰지 않는다. `src/styles/app.css` 의 클래스(`toolbar`, `stats`, `fill`, `muted`, `t-danger` …)를 쓰고, 없으면 거기에 추가한다. 페이지 제목은 `PageHeader`, 숫자 카드는 `StatCard`.
  - 남아 있는 인라인 스타일은 계산된 값뿐이다: 창 끌기·열 너비 조절(`DraggableModal`, `ResizableTable`) 4곳과 차트 범례 글자색 `style={chart.legendText}` 3곳.
- 다크 모드: `<html data-theme="light|dark">`. 선택(라이트/다크/시스템)은 `theme.store.ts` 가 브라우저에 저장한다. 화면을 고치면 라이트·다크 둘 다 확인.
  - 저장된 값은 믿지 않는다: `theme.store.ts` 의 `merge` 가 `light|dark|system` 이 아닌 값을 `system` 으로 바꾼다 (TypeScript 타입은 localStorage 내용을 보장하지 않는다 — 검증이 없을 때 깨진 값 하나로 로그인 화면까지 빈 화면이 됐다). 저장하는 설정을 늘릴 때도 같은 식으로 검증할 것.
  - 테마를 정하는 규칙은 두 군데에 같은 내용으로 있다: `resolveTheme()` (앱) 과 `themeBoot.ts` 의 `bootScript()` (JS 도착 전 index.html). 한쪽을 바꾸면 다른 쪽도 바꾼다.
- 함정: antd `darkAlgorithm` 은 준 색을 그대로 쓰지 않고 더 어둡게 바꾼다 (태그·삭제 버튼 글자가 4.1~4.45:1 로 떨어졌었다). `antdTheme.ts` 의 `exactColours` 가 원래 값으로 되돌리므로 지우지 말 것.
- `message.success()` 같은 정적 호출은 `ConfigProvider` 밖(antd 가 따로 만든 React 루트)에서 그려진다 → `AntConfigProvider.tsx` 의 `StaticHolder` 가 테마·언어를 넘겨준다 (없으면 다크에서 알림만 밝게 나온다).
  - `StaticHolder` 는 테마 store 와 i18n 을 직접 구독한다. `holderRender` 에 그때의 theme 객체를 넘기는 방식으로 되돌리지 말 것 — 이미 떠 있는 알림이 테마 전환을 따라가지 못하고 이전 색으로 남는다.
- 베트남어가 한국어보다 길다. 표의 상태·역할 열 너비, 버튼·세그먼트 글자는 베트남어로도 잘리지 않는지 확인한다.
- 휴대폰 화면은 대상이 아니다 (PC 폭 1280px 이상 기준).

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

