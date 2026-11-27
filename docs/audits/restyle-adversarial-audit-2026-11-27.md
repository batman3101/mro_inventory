# 화면 개편 브랜치 적대적 감사 — 2026-11-27

**결론: 확인된 지적은 Critical 0 / High 0 / Medium 2 / Low 2, 총 4건이다.** 저장 테마값 손상 시 로그인 화면까지 비어 버리는 복구 결함과 변경 전 모달 증거의 오촬영을 먼저 수정·보완해야 한다. 정상 경로의 API·DB·권한 로직 변경이나 새 타입/lint 오류는 이번 감사에서 확인하지 못했다. 다만 로그인 후 전체 기능을 실제 DB와 재실행한 것은 아니므로 기능 무회귀 또는 배포 가능 판정은 아니다.

## 1. 고정한 범위와 수행 경계

- 작업공간: `C:/Users/USER/orca/workspaces/mro_inventory/workboard-style`
- 시작 및 종료 직전 확인 HEAD: `94d837ee6c601e914b674b3ebd3dd536fd0f179a`
- 브랜치: `feat/workboard-style`
- 비교 기준: `b906fb4f16f959ac82418b86a415248150c09dfd`
- 감사 커밋: `b991a52`, `69f7623`, `ec628dd`, `dedfef6`, `94d837e`
- 검토한 작성자 보고서: `C:/Users/USER/AppData/Roaming/orca/chat-scratch/717570378ebfa189b6e0caf0108bbdfd/restyle-worker-report.md`
- WorkBoard 참조: `C:/Work Drive/APP/ALMUS-CNC-WORKBOARD/apps/web/src/styles/prototype.css`, `app.css`; 참조 저장소 HEAD `a6728bc42f616ee76b5cd1bc96dfa38d89d4396c`. 읽기만 했다.
- 제품 소스 수정, 커밋, push, PR, checkout, 병합, fetch, DB 마이그레이션을 하지 않았다. `fef2451`의 로컬 Git 객체를 읽어 변경 범위만 비교했다.
- 운영 Supabase 및 운영 데이터에 접속하지 않았다. 브라우저는 로컬 Vite와 실제 로그인 페이지 또는 독립적인 테마 컴포넌트 검사 화면만 사용했다. 인증 상태를 위조해 보호 페이지에 진입하지 않았다.
- 로컬 서버는 Supabase URL을 `http://127.0.0.1:59999`의 사용하지 않는 주소로 강제 설정했다. 실제 앱 검사 브라우저에서는 `http://127.0.0.1:5197/` 외 요청을 차단했다. 외부 폰트도 차단했으므로 이번 브라우저 검사를 배포 폰트의 레이아웃 검증으로 해석하면 안 된다.
- 시작 시 존재한 미추적 `.omx/`, `.serena/`는 보존했다. 이 보고서 외 제품 파일을 변경하지 않았다.

## 2. 지적 요약

| ID | 심각도 | 조건 | 지적 | 증거 수준 |
|---|---|---|---|---|
| RESTYLE-01 | Medium | 저장 데이터 손상/비정상 값 | 잘못된 테마값으로 로그인 포함 앱 전체가 렌더링 실패 | 실제 `/login` 로컬 Chromium 재현 |
| RESTYLE-02 | Medium | 작성자 감사 자료 | 변경 전 등록·출고 모달 스크린샷이 실제로는 로그인 화면 | 파일 SHA256·이미지 직접 확인·스크립트 원인 대조 |
| RESTYLE-03 | Low | 알림이 떠 있는 동안 테마 전환 | 기존 정적 message 알림이 이전 테마를 유지 | 실제 provider와 antd를 사용하는 독립 검사 화면 재현 |
| RESTYLE-04 | Low | 저장 테마와 OS가 반대이며 JS 로드 지연 | 저장 테마 적용 전에 반대 색의 빈 화면이 먼저 그려짐 | 실제 `/login`의 main 모듈 응답 지연 및 이미지 확인 |

### RESTYLE-01 — 저장 테마값을 검증하지 않아 로그인 화면까지 비어 버림

- **심각도:** Medium. 로컬 설정 손상이 필요한 경계 조건이다. 정상 테마 선택 UI만으로 발생했다고 주장하지 않으며, 원격 공격 또는 권한 우회로 분류하지 않는다.
- **위치:** `src/store/theme.store.ts:26`, `src/store/theme.store.ts:33`, `src/styles/antdTheme.ts:21`, `src/AntConfigProvider.tsx:17`.
- **문제:** persist가 읽은 `mode`를 런타임에서 검증하지 않는다. `resolveTheme()`은 `system` 외 값을 그대로 반환하고 `buildAntdTheme()`은 `palettes[name]`이 존재한다고 가정하여 `c.accentWeak`를 읽는다. TypeScript의 `ThemeMode` 타입은 localStorage JSON을 검증하지 않는다. 이 provider가 라우터 바깥에 있어 로그인도 사라지며 사용자는 화면의 테마 선택으로 복구할 수 없다.
- **재현:** 로컬 앱 출처의 개발자 콘솔에서 다음을 실행하고 새로고침한다. 운영 출처에서 실행할 필요가 없다.

```js
localStorage.setItem('mro-theme-storage', JSON.stringify({
  state: { mode: 'invalid' }, version: 0
}));
location.reload();
```

- **실제 출력:** `data-theme="invalid"`, 이메일 입력칸 수 `0`, `body.innerText === ''`; `Cannot read properties of undefined (reading 'accentWeak')`. `mode: null`도 같은 결과였다.
- **대조군:** OS dark에서 `system`, `light`, `dark`를 각각 저장하여 `/login`을 열면 theme은 각각 dark/light/dark, 이메일 입력칸은 각 1개, pageerror는 0건이었다.
- **권장 수정:** hydration/merge 시 저장값을 `light|dark|system`으로 좁히고 나머지는 `system`으로 복구한다. `resolveTheme` 또는 `buildAntdTheme`에도 안전한 fallback을 둔다. 잘못된 문자열·null·잘못된 JSON·버전 불일치 후 로그인 접근이 유지되는지 검증한다. 현재 증상은 해당 출처의 `mro-theme-storage`만 삭제하면 복구 가능하다.

### RESTYLE-02 — 변경 전 모달 증거가 로그인 화면이며 자동 검사가 이를 통과시킴

- **심각도:** Medium. 제품의 인증 회귀가 아니라 검증 증거의 결함이다.
- **위치:** `docs/restyle/tools/shoot.mjs:147`, `docs/restyle/tools/shoot.mjs:154`, `docs/restyle/README.md:32`.
- **대상 파일:** `docs/restyle/screenshots/before/before-{light,dark}-ko-modal-item.png` 및 `before-{light,dark}-ko-modal-outbound.png` (바이너리이므로 줄 번호 없음).
- **확인된 사실:** `before-light-ko-modal-item.png`와 `before-dark-ko-modal-item.png`는 `before-light-ko-login.png`와 SHA256이 같고, 이미지에도 로그인 폼만 있다. `before-light-ko-modal-outbound.png`를 직접 열면 이메일·비밀번호 필수 오류가 표시된 로그인 폼이다. dark 출고 파일도 같은 이미지 해시다.

```powershell
Get-FileHash docs/restyle/screenshots/before/before-light-ko-login.png,
  docs/restyle/screenshots/before/before-light-ko-modal-item.png,
  docs/restyle/screenshots/before/before-dark-ko-modal-item.png
```

세 파일 SHA256:

```text
FAF64E6B99EA230A5E7D157350C91A353D9D3AEA44844F32B23326163425820D
```

- **원인 근거:** 촬영기는 `button.ant-btn-primary`의 첫 번째 요소를 등록 버튼으로 간주한다. 기준 커밋 `b906fb4`의 Sidebar는 페이지보다 앞에 `danger type="primary"` 로그아웃 버튼을 둔다. 따라서 기준 화면에서는 등록 대신 로그아웃을 누르게 된다. 이후 `/outbound`로 이동해도 비인증 상태이며 첫 primary는 로그인 버튼이다. 촬영 전 URL·dialog 존재·모달 제목 확인이 없다. 로그인 화면이라는 관측은 확정이며, 이 선택자와 기준 코드의 조합이 원인을 설명한다. 이전 DB를 재생성해 촬영기 전체를 다시 실행한 것은 아니다.
- **영향:** 등록·출고 모달의 before/after 비교 증거가 성립하지 않는다. “스크린샷 98장”은 파일 개수로는 맞지만 98개의 올바른 목표 화면을 검증했다는 의미는 아니다. 잘못 찍은 로그인 폼에도 글자 잘림 검사가 적용되므로 ‘0건’으로 목표 모달의 상태를 보증할 수 없다.
- **권장 수정:** 페이지 영역과 접근 가능한 버튼 이름을 함께 지정한다. 클릭 후 예상 URL과 `.ant-modal`의 제목·핵심 입력칸을 assert하고, 로그인으로 돌아오면 즉시 실패시킨다. 해당 네 장을 정확한 기준 커밋에서 다시 촬영하고 증거 설명을 정정한다.

### RESTYLE-03 — 떠 있는 message는 테마 전환을 즉시 따라가지 않음

- **심각도:** Low. 메시지 내용 소실이나 저장 실패는 확인하지 않았다.
- **위치:** `src/AntConfigProvider.tsx:33`.
- **문제:** `holderRender`에 테마를 넘기지만, 설정 변경 자체가 이미 생성된 antd의 별도 message React root를 다시 렌더링하지 않는다. 다음 message 호출 시에는 갱신되므로 “새 알림도 계속 라이트”라는 문제가 아니다.
- **재현:** 실제 `AntConfigProvider`, `ThemeSwitcher`, 설치된 antd를 사용하는 로컬 독립 검사 화면에서 light 상태로 `message.success({content:'message probe', duration:0})`를 표시한 뒤 dark로 전환한다. `duration:0`은 관측 시간을 확보하기 위한 검사 조건이다. 기본 지속시간 메시지도 그 표시 기간 안에 전환하면 같은 경로를 사용한다.
- **실제 계산 스타일:**

```text
light 알림:              foreground rgb(28, 34, 48),    background rgb(255, 255, 255)
dark 전환 후 기존 알림: foreground rgb(28, 34, 48),    background rgb(255, 255, 255)
dark에서 새 알림 호출:  foreground rgb(227, 231, 237), background rgb(23, 27, 33)
```

- **권장 수정:** holder 안에서 테마 store를 직접 구독하는 컴포넌트를 사용하거나 앱 컨텍스트의 message API로 연결한다. 열린 알림을 둔 채 light→dark→light를 전환하는 검증을 추가한다. 이번 재현은 message에 한정하며 notification·정적 Modal까지 같은 결함으로 단정하지 않는다.

### RESTYLE-04 — 저장된 테마를 JS 다운로드 전에 반영하지 않아 반대 색의 초기 화면 발생

- **심각도:** Low. 작성자 보고서에서 추정으로 남긴 현상을 제한된 로컬 조건에서 확인한 것이다.
- **위치:** `index.html:11`, `index.html:23`, `src/store/theme.store.ts:39`.
- **문제:** HTML에는 `color-scheme: light dark` 메타만 있고 저장된 선택을 먼저 적용하는 코드·최소 배경 CSS가 없다. CSS 변수와 `data-theme`는 main의 모듈 그래프 실행 때 생성된다. “첫 React render 이전”은 “브라우저의 최초 paint 이전”을 뜻하지 않는다.
- **재현:** OS dark, 저장 모드 light로 `/login`을 연다. 로컬 Chromium에서 `/src/main.tsx` 응답만 보류하고 약 600ms 뒤 초기 화면을 확인한 다음 응답을 풀었다. 외부 요청은 차단했다. 글꼴 준비 대기가 미완료 모듈과 함께 대기하는 것을 피하려고 설치된 Playwright의 screenshot font-wait를 해당 검사에서만 건너뛰었다.
- **실제 결과:** 모듈 실행 전 `data-theme` 없음, body 배경 `rgba(0,0,0,0)`, 메타 `light dark`; 촬영 이미지는 어두운 빈 화면이었다. 응답을 푼 뒤 theme light 및 body `rgb(233, 237, 242)`로 바뀌었다.
- **한계:** 실제 배포 네트워크에서 깜빡임 지속시간을 측정한 것은 아니다. 지연 주입은 잘못된 초기색이 보일 수 있는 조건을 분리한 검사다.
- **권장 수정:** 저장값 검증을 포함한 짧은 초기 테마 적용을 HTML head에서 수행하고 초기 배경·color-scheme을 앱과 맞춘다. 토큰의 이중 관리가 생기지 않도록 초기용 CSS를 같은 디자인 값에서 생성한다.

## 3. 실제 실행한 검증과 결과

| 검증 | 결과와 해석 |
|---|---|
| `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD` | 지정 HEAD와 브랜치 일치; 감사 도중 변경 없음 |
| `git diff --stat b906fb4..94d837e`, 파일별 diff | 138파일; 제품 코드·도구·문서·98장 이미지를 구분하여 검토 |
| `git diff --check b906fb4..94d837e` | exit 0 |
| `npm run build` | exit 0; Vite 7.3.1, 4001 modules, 11.69초; 500kB 초과 chunk 및 오래된 Browserslist 경고 |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 1, 오류 40건 |
| `npm run lint` | exit 1, 26건 = 오류 14 + 경고 12 |
| `npm run lint:i18n` | exit 0; ko/vi 각 501개 키 일치 |
| `npm run lint:contrast` | exit 0; 각 모드 text 29쌍 + control 4쌍, 총 66쌍 통과 |
| 기준 소스의 TypeScript Compiler API 비교 | Git `b906fb4:src/...`를 메모리 compiler host에 공급; 동일 설치 의존성·tsconfig 사용; 기준 40/HEAD 40, 새 진단 위치·코드 없음 |
| 기준 소스의 ESLint `lintText` 비교 | 기준 27/HEAD 26; 새 rule/message 없음; LanguageSwitcher의 미사용 Space 오류 1건 제거 |
| Chromium 실제 `/login` | system/light/dark 저장값 정상; invalid/null 저장값에서 blank page 재현 |
| 독립 theme/antd 컴포넌트 검사 | 정상 초기 pageerror 0; 기존 message의 stale theme 재현; dark DatePicker 선택일은 fg `rgb(13,16,22)` / bg `rgb(109,155,242)`, Popconfirm 제목 fg `rgb(227,231,237)` 확인 |
| 저장 light + OS dark + main 응답 지연 | 초기 dark 빈 화면 → 최종 light 전환 확인 |
| 저장된 contrast 결과 재집계 | 50상태 / pass 5052 / fail 0 / incomplete 704로 파일 내부 합계 일치. 전체 axe 시나리오를 새로 실행한 결과는 아님 |
| 이미지 해시·직접 열람 | before 등록 모달 2장이 login과 동일; before 출고도 로그인 필수 오류 화면 |
| `git check-ignore docs/audits/restyle-adversarial-audit-2026-11-27.md` | 출력 없음, exit 1: 보고서는 ignore 대상 아님 |

타입 진단의 원문은 줄 이동 외에 변경되지 않은 suppliers 서비스의 TS2769 메시지에서 객체 속성 나열 순서 한 군데가 달랐다. 진단 코드·대상 소스·문제는 같으므로 이를 새 오류로 세지 않았다. “새 타입 오류 0건”은 지지하지만, “오류 목록 원문까지 완전히 동일”로 옮겨 적지는 않는다. 빌드 성공은 타입/lint 통과를 뜻하지 않는다.

임시 검사 파일은 OS TEMP의 `mro-restyle-audit-c0d2a58f`에만 작성했고 Vite 메모리 플러그인이 검사 entry를 제공했다. 제품 소스에 검사 entry를 쓰지 않았다. 초기 검사 실행 중 Windows ESM 경로와 Vite 가상 모듈 경로를 고친 뒤 재실행했으며, main 응답 보류 검사에서 screenshot의 font-wait가 timeout되어 font-wait를 제한한 후 성공했다. 이를 제품 오류로 집계하지 않았다.

## 4. 기능·i18n·디자인·위생 검토

### 기능과 권한

- Sidebar 메뉴 9개의 route·순서·번역 키가 기준과 같다. `/departments`가 메뉴에 없는 것은 기존 상태다.
- 기준 Sidebar에도 역할별 메뉴 필터가 없었다. 이번 변경이 권한별 노출을 제거했다고 판단할 증거는 없다.
- `ProtectedRoute`, router, auth store, location store, services, lib, 데이터 타입은 변경되지 않았다. 새 store 변경은 theme store뿐이다.
- MainLayout의 locations 조회·활성 필터·정렬·저장 공장 ID 복구·공장별 Outlet key는 유지됐다.
- LocationSelector는 선택 표시의 비교 기준을 code에서 id로 바꿨지만 이벤트는 목록에서 해당 id를 찾아 동일한 `setCurrentLocation(id, code)`를 호출한다. 현재 코드에서 추가 API 또는 데이터 변경은 없다.
- 로그아웃은 기존 auth store 함수를 Popover 안에서 호출하며 공장·언어 컨트롤 이동과 메뉴 전체 숨김은 의도된 화면 틀 변경이다.
- 페이지 diff의 데이터 조회, submit/delete handlers, form validation, 조건부 관리 권한과 가격·재고 계산에서 새 로직 회귀를 확인하지 못했다. Analytics의 label 축약, StatCard의 숫자 표시, 상태 태그·폭·레이아웃은 실제로 변경되므로 단순 문자열 치환만 한 변경은 아니다.
- 위 판정은 정적 비교다. admin/user/viewer의 로그인, 실제 저장·삭제·공장 전환은 재실행하지 않았다.

### i18n

- 새 `layout.*` 2개와 `theme.*` 4개는 ko/vi 모두 존재한다.
- 새 화면 테마·계정·메뉴 토글 문구는 번역 경로를 사용한다. KO/VI는 언어 코드 표시이며 새 한국어 전용 문구로 집계하지 않았다.
- Login의 `MRO Inventory`, Analytics의 `Top 10`, Inventory의 `main` fallback 등 기존 직문자열을 이번 신규 위반으로 세지 않았다.
- 키 일치 검사는 실제 번역 품질이나 동적 key의 모든 경로 존재 여부를 보장하지 않는다. 전체 화면 베트남어 재검증은 미실시다.

### 토큰 및 대비

- WorkBoard의 prototype 기본값만 보면 글꼴·상태색이 달라 보이지만, `apps/web/src/styles/app.css:3`의 Inter/Noto override와 `:1330`, `:1333`, `:1334`의 대비 보정을 포함하면 이번 주요 palette와 일치한다. 기본 36px row, 48px top, 256px side, 6/4px radius도 옮겨졌다.
- `app.css`의 실색은 변수로 제공되며 소스의 hex 색은 tokens에 집중돼 있다. `index.html:9`의 기존 theme-color는 남아 있다. 배치 수치와 inline 스타일까지 모두 제거된 것은 아니다: `style={{...}}` 4개 외에 차트 legend의 `style={chart.legendText}` 3개가 있고, 전자는 DraggableModal/ResizableTable의 배치·드래그용이다. 동적 theme 값 참조를 색 하드코딩으로 분류하지 않는다.
- CSS 자체에는 padding·폰트 크기·row 버튼 높이 등이 숫자로 남아 있다. `app.css:2`의 “Every colour and size comes from tokens” 주석은 크기까지 문자 그대로 맞지는 않는다. 유지보수 규약 문구를 실제 적용 범위에 맞출 필요는 있지만 별도 제품 결함으로 중복 계수하지 않았다.
- 토큰 검사 통과는 그 목록의 조합만 보증한다. chart 6번째 색은 `chartTheme.ts:13`에서 테두리용 line2를 사용하며 surface 대비는 light **1.55:1**, dark **1.71:1**이다. 작성자가 밝힌 viz3/viz4 외에도 낮은 비문자 대비가 있다. 실제 기존 after-dark analytics 이미지에서도 이 회색 조각을 확인했다. 다만 원그래프에 이름·비율·경계선이 있으므로 이 계산만으로 WCAG 위반을 단정하지 않았고 별도 결함 건수에는 넣지 않았다.
- 독립 검사 화면의 Switch ON 글자는 white on accent로 낮은 대비가 관측됐지만, 실제 Categories/Users는 checkedChildren 없는 Switch를 사용한다. 제품에 없는 probe 텍스트를 제품 결함으로 보고하지 않았다.

### 저장소 위생와 규약

- 스크린샷 98개 Git blob의 합은 **11,996,801바이트(약 11.44MiB)**다. 약 12MB라는 작성자 설명은 맞다. 기준 dark/light가 같은 화면인 파일도 여러 개 있어 검증 자료 저장 비용에 비해 중복이 있다.
- 이미 커밋된 이미지를 다음 커밋에서 삭제해도 과거 Git blob이 사라지는 것은 아니다. 병합 방식과 증거 보관 장소는 조정자가 결정할 사항이며 이번 감사에서 파일을 삭제하거나 이력을 재작성하지 않았다.
- `docs/restyle/tools/seed.sql` 및 두 mjs의 텍스트 검사에서 운영 URL, 서비스 키, 실제 비밀번호를 찾지 못했다. 스크립트는 localhost 기본 URL과 환경변수의 테스트 로그인 값을 쓰며 seed는 example 도메인과 문서상 가상 데이터다. 이는 해당 파일 검사 결과이며 저장소 전체 비밀값 감사 결과는 아니다.
- seed의 관리자 승격·데이터 INSERT는 테스트 도구의 의도된 동작이다. 이번 감사에서는 실행하지 않았다.
- `package.json` 변경은 `lint:contrast` 한 줄뿐이며 의존성·lockfile 변경 없음. 검사 스크립트는 `.ts` 직접 import 때문에 Node 22.18+를 요구한다고 주석에 명시한다. 이번 실행 Node는 24.22.3이다.
- CLAUDE의 토큰 중앙화·semantic tag·두 테마 검사·기존 darkAlgorithm 보정 유지 취지는 타당하다. 다만 “색은 상태 표시에만”은 차트별 구분색·역할 강조 등 현재 예외를 설명해야 하고, static holder 설명에는 열린 메시지의 재테마 한계(RESTYLE-03)가 빠져 있다. 새 dependency 또는 API 규약을 도입한 변경은 없다.

## 5. 작성자 주장 판정

| 주장 | 이번 감사 판정 |
|---|---|
| 빌드 성공 | 재현됨 |
| 새 타입/lint 오류 0건 | 기준 소스와 같은 설치 의존성 비교로 지지됨. 현재 검사 자체는 실패 상태 |
| 기능·API·DB 변경 없음 | API/DB·인증/서비스 불변은 정적 diff로 지지. 전체 사용자 흐름 무회귀는 미검증 |
| 대비 위반 0건 | 기록의 합계와 토큰 검사 통과는 맞음. 704개 미측정과 제한된 상태 범위가 있어 전 화면 AA 보증으로 확대 불가 |
| 글자 잘림 0건 | 작성자 도구가 확인한 범위의 주장. 전체 재실행 안 함. 특히 before 등록·출고 모달은 다른 화면을 검사했으므로 해당 모달의 증거로는 틀림 |
| 98장 before/after 증거 | 파일 수는 맞지만 before 모달 네 장은 목표 상태가 아님 |
| 다크 알림이 테마를 따름 | 다크에서 새 message 생성은 맞음. 이미 열린 메시지는 전환을 바로 따르지 않음 |
| 초기 잘못된 색은 추정 | 지연 주입 조건에서 실제 확인됨 |
| 패키지 추가 없음 | diff로 확인 |
| fef2451 시험 병합·빌드 성공 | 작성자 주장으로만 남김. 이번 감사는 병합/합친 빌드를 실행하지 않음 |

## 6. fef2451과의 통합 위험 — 정적 검토만

`git diff b906fb4 fef2451 -- src/main.tsx vercel.json`로 확인한 main 측 변경은 stale chunk 복구 listener와 assets 경로 rewrite 예외다. 이 브랜치는 `src/main.tsx`에 theme store 및 app.css import를 추가하며 `vercel.json`은 바꾸지 않는다.

따라서 공유 변경 파일은 `src/main.tsx`이고 겉보기 텍스트 변경 위치는 분리돼 있다. 이것은 실제 병합 성공이나 결합 런타임의 검증이 아니다. 후속 통합 검증에서는 테마 import와 CSS 적용 순서, `vite:preloadError` listener, `/assets/*` rewrite 예외를 모두 보존했는지 확인하고, 새 배포 전 탭에서 lazy page chunk 실패 후 복구 및 저장 테마 유지 여부를 봐야 한다. 이번 감사는 main branch를 전환·변경하거나 시험 병합하지 않았다.

## 7. 미검증 범위 및 정리

- 실제/임시 Supabase의 로그인 후 10개 페이지 데이터 읽기·쓰기, 역할별 화면, 저장·삭제·공장 전환의 통합 실행.
- 전체 50개 axe 시나리오의 새 실행, 전체 스크린샷 재촬영, 텍스트 잘림 전수 검사.
- 실제 페이지의 모든 Select 목록·표 필터·Dropdown·DatePicker 범위 선택·Modal·notification·차트 tooltip 및 hover/focus/disabled/error 조합. DatePicker와 Popconfirm은 독립 검사에서 일부만 확인했다.
- 긴 운영 문자열·대용량 데이터·다수 공장·1280/1920 및 확대 배율 전수 검사. 휴대폰은 요청 범위 밖이다.
- 실제 Google Fonts 로드 후 현재 UI의 글꼴/레이아웃, Firefox·Safari, 화면 낭독기 및 전체 키보드 동선.
- 운영·배포 환경, 실측 초기 paint 시간, 결합된 fef2451의 빌드/실행.

검사에 사용한 브라우저와 포트 5197의 임시 Vite 서버, TEMP 검사 스크립트·이미지는 종료·정리했다. DB 컨테이너는 만들지 않았다. 보고서는 미커밋으로 남겼으며 기존 `.omx/`, `.serena/`를 보존했다. 일반 build 산출물과 도구 캐시는 제품 소스 변경으로 취급하지 않았다.
