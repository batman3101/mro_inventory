# 화면 스타일 변경 (ALMUS WorkBoard 와 같은 인상) — 확인 자료

브랜치 `feat/workboard-style`, 기준 커밋 `b906fb4` (2026-11-27).
기능·데이터 흐름·API·DB 는 바꾸지 않았고 화면 모양만 바꿨다.

## 무엇이 어디에 있나

| 내용 | 위치 |
|---|---|
| 디자인 값 (색·글꼴·모서리·행 높이, 라이트/다크) | `src/styles/tokens.ts` — 한 곳 |
| 그 값을 antd 에 넘기는 곳 | `src/styles/antdTheme.ts` |
| 화면 틀·공통 클래스 | `src/styles/app.css` (색은 전부 `var(--…)`) |
| 라이트/다크/시스템 선택과 저장 | `src/store/theme.store.ts`, `src/components/ThemeSwitcher.tsx` |
| 차트 색 | `src/components/chartTheme.ts` |
| 지켜야 할 규칙 | 저장소 루트 `CLAUDE.md` 의 "화면 스타일" |

## 기능은 그대로, 자리만 바뀐 것

| 기능 | 변경 전 | 변경 후 |
|---|---|---|
| 공장 선택 | 사이드바 아래 버튼 | 상단바 오른쪽 (ALT / ALV) |
| 언어 전환 | 사이드바 아래 국기 버튼 | 상단바 오른쪽 (KO / VI) |
| 로그아웃, 내 이메일 | 사이드바 아래 | 상단바 맨 오른쪽 동그란 버튼 → 계정 팝업 (이름·이메일·역할·로그아웃) |
| 메뉴 접기 | 사이드바 맨 아래 화살표, 아이콘만 남김 | 상단바 맨 왼쪽 버튼, 메뉴 전체를 숨김 (WorkBoard 와 같음) |
| 화면 테마 (새로 생김) | 없음 | 사이드바 아래 (라이트 / 다크 / 시스템) |

메뉴 항목과 순서는 그대로다 (부서 화면 `/departments` 는 원래도 메뉴에 없고 주소로만 열린다).

## 스크린샷 (`screenshots/`)

파일 이름: `<before|after>-<light|dark>-<ko|vi>-<화면>.png`, 창 폭 1440px, 화면 전체.

- `before/` 40장 — 기준 커밋에서 찍음. 변경 전에는 다크 모드가 없어서 `before-dark-*` 는 PC 를 다크로 두어도 라이트와 똑같이 나온다는 것을 보여준다.
- `after/` 58장 — 마지막 코드 커밋 `ec628dd` 상태에서 찍음. 12개 화면(Login, Signup, Dashboard, Items, Categories, Inventory, Inbound, Outbound, Suppliers, Departments, Analytics, Users)을 라이트·다크 × 한국어·베트남어로. 한국어에는 창 5개(단가 관리, 소모품 등록, 새 출고, 소모품 상세, 일괄등록)와 계정 팝업, 메뉴를 닫은 모습이 더 있다. Login·Signup 은 언어 전환 버튼이 로그인 뒤에만 있어 한국어만 있다.

**찍은 방법.** 운영 DB 에는 접속하지 않았다. PC 안에 임시 Supabase(테스트용 DB)를 띄우고 저장소의 `database/db_setup.sql` + `supabase/migrations/*` 를 적용한 뒤, 지어낸 데이터(`tools/seed.sql`: 품목 25, 입고 69, 출고 193 …)를 넣고 임시 계정으로 로그인해 찍었다. 화면에 보이는 사람·업체 이름은 모두 가짜다.

## 자동 확인 결과

아래 화면 검사는 마지막 코드 커밋 `ec628dd` 상태에서, 저장소의 `tools/seed.sql`·`tools/*.mjs` 그대로 다시 돌린 결과다.

| 확인 | 결과 | 원문 |
|---|---|---|
| 디자인 값의 글자/배경 대비 (WCAG AA: 글자 4.5:1, 입력칸 테두리 3:1) | 라이트 33쌍·다크 33쌍 모두 통과 | `token-contrast-result.txt` (`npm run lint:contrast`) |
| 실제 화면의 글자 대비 (axe-core `color-contrast`) | 50개 화면 상태(라이트·다크 × ko·vi × 화면, 창 2개, 계정 팝업)에서 위반 0건 · 글자 5,052개 통과 · 704개는 자동 측정 불가 | `contrast-scan-result.txt` |
| 테마 전환·저장, 메뉴 접기, 언어·공장 전환, 로그아웃 | 동작함 | 같은 파일 끝부분 |
| 개발 서버와 배포용 빌드의 스타일 차이 (CSS 적용 순서) | 라이트·다크 각 26개 항목의 계산된 스타일이 동일 (차이 0) | 스크래치에서 실행, 원문은 저장소에 없음 |
| 알림 토스트가 다크 테마를 따르는지 | 다크에서 배경 `surface`, 글자 `ink` 로 표시됨 (로컬 테스트 DB 에 부서 1건을 넣어 확인) | 위와 같음 |
| 글자 잘림 (제목·버튼·표 머리글·세그먼트, 표 칸) | 한국어·베트남어 모두 0건 (변경 전에는 표 열 9곳이 잘렸음) | `tools/shoot.mjs` 가 찍으면서 검사 |

자동 측정 불가 704개는 ① 차트 안의 글자(SVG 라 도구가 배경을 못 읽음 — 값은 `ink-2` 로 위 표의 첫 줄에서 확인됨) ② 가로로 넘치는 표에서 고정된 "작업" 열 밑에 깔린 칸이다.

## 다시 돌려 보려면

`tools/` 의 스크립트는 프로젝트 의존성이 아닌 `playwright-core`·`axe-core` 를 쓴다 (프로젝트에 패키지를 추가하지 않으려고 다른 폴더에 설치해 실행했다).

1. 임시 Supabase: 빈 폴더에서 `supabase init` → `database/db_setup.sql` 을 첫 마이그레이션으로, 이어서 `supabase/migrations/*` 복사 → 포트를 다른 프로젝트와 겹치지 않게 바꿔 `supabase start`.
2. Auth 관리 API 로 테스트 계정을 만들고 `tools/seed.sql` 실행.
3. `VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… npx vite --port 5188`
4. `SHOT_EMAIL=… SHOT_PASSWORD=… node shoot.mjs after <폴더> light,dark ko,vi` / `node contrast-scan.mjs`

## WorkBoard 와 다르게 남은 것

- **antd 부품의 생김새**: 표의 정렬·필터 아이콘, 페이지 번호, 달력, 드롭다운, 스위치, 업로드 상자는 antd 모양 그대로다 (색·모서리·글꼴만 맞춤). WorkBoard 는 이 부품들을 직접 만든 것이라 세부가 다르다.
- **세그먼트(공장·언어·테마 전환)**: antd `Segmented` 를 WorkBoard `.seg` 색으로 맞췄지만 칸 사이 세로선이 없고 선택 표시가 미끄러지듯 움직인다.
- **표가 카드 안에 있다**: WorkBoard 는 표를 작업면에 바로 놓는다. 기존 화면 구조(카드 안의 검색줄 + 표)를 유지했다.
- **글꼴 IBM Plex Mono 는 넣지 않았다**: 고정폭 글꼴을 쓰는 곳이 없다. 숫자는 Inter 의 같은 폭 숫자(`tabular-nums`)다.
- **차트 색 2개의 대비**: 라이트에서 `viz-3`(2.82:1)·`viz-4`(2.17:1)는 그림 요소 권장치 3:1 에 못 미친다. WorkBoard 차트 색을 그대로 쓴 값이며, 원그래프의 3·4번째 조각과 단가 추이의 3·4번째 통화 선에만 쓰인다 (조각 옆에 이름·비율 글자, 조각 사이 흰 선이 있다). 범례·툴팁 글자는 색이 아닌 본문 글자색으로 바꿨다.
- **원그래프 5·6번째 조각**은 WorkBoard 차트 색이 4개뿐이라 회색 2개를 쓴다.
- **상단바**: WorkBoard 의 검색·알림·도움말은 이 앱에 기능이 없어 넣지 않았다.
