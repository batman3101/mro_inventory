---
name: i18n-check
description: Scan page/component files for hardcoded Korean/Vietnamese strings and replace with i18n t() calls. Use after creating or modifying any page.
triggers: i18n, 번역, translation, 다국어, hardcoded, 하드코딩
---

# i18n Check & Apply

페이지/컴포넌트에서 하드코딩된 한국어/베트남어 문자열을 찾아 i18n `t()` 호출로 교체합니다.

## 실행 절차

### 1. 대상 파일 스캔
- 인자로 파일 경로가 주어지면 해당 파일만 검사
- 인자가 없으면 `src/pages/` 와 `src/components/` 전체 스캔

```bash
# 한국어 하드코딩 검색 (JSX 내 한글 문자열)
grep -rn "[가-힣]" src/pages/ src/components/ --include="*.tsx" | grep -v "import\|//\|console"
```

### 2. 검사 항목
각 파일에서 다음을 확인:
- [ ] `useTranslation` import 여부
- [ ] `const { t } = useTranslation()` 선언 여부
- [ ] 모든 사용자 표시 문자열이 `t('key')` 사용 중인지
- [ ] 해당 키가 `ko.json`과 `vi.json` 양쪽에 존재하는지

### 3. 교체 대상 문자열 유형
| 유형 | 예시 | 교체 방법 |
|------|------|----------|
| 페이지 제목 | `"재고 관리"` | `t('inventory.title')` |
| 테이블 컬럼 | `title: "소모품코드"` | `title: t('items.itemCode')` |
| 버튼 텍스트 | `>등록</Button>` | `>{t('common.create')}</Button>` |
| 모달 제목 | `title="소모품 등록"` | `title={t('items.createItem')}` |
| 폼 라벨 | `label="소모품명"` | `label={t('items.itemName')}` |
| 유효성 메시지 | `message: "필수 항목"` | `message: t('items.itemNameRequired')` |
| 성공/실패 | `message.success("등록 완료")` | `message.success(t('items.createSuccess'))` |
| Popconfirm | `title="삭제?"` | `title={t('items.deleteConfirm')}` |
| 빈 데이터 | `"데이터 없음"` | `t('common.noData')` |
| Breadcrumb | `{ title: "재고" }` | `{ title: t('menu.inventory') }` |

### 4. 키 네이밍 규칙
```
{페이지명}.{항목}
  items.itemCode        → 소모품코드
  inventory.title       → 재고 관리
  common.save           → 저장 (공통)
  outbound.requester    → 요청자
```

### 5. 교체 수행
1. 하드코딩 문자열을 `t('section.key')` 로 교체
2. 새 키가 필요하면 `src/i18n/locales/ko.json`에 추가
3. 동일 키를 `src/i18n/locales/vi.json`에 베트남어로 추가
4. TypeScript 컴파일 확인: `node_modules/.bin/tsc --noEmit`

### 6. 예외 (교체 불필요)
- `console.log/error/warn` 메시지
- import 문
- 주석
- 브랜드명 (Excel, MRO, Supabase 등)
- 아이콘, 숫자, 날짜 포맷 문자열

### 7. 검증
```bash
# 교체 후 남은 하드코딩 확인
grep -rn "[가-힣]" src/pages/ src/components/ --include="*.tsx" | grep -v "import\|//\|console\|\.json"

# ko.json과 vi.json 키 수 비교
node -e "const ko=require('./src/i18n/locales/ko.json'); const vi=require('./src/i18n/locales/vi.json'); const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?flat(v,p+k+'.'):p+k); const kk=flat(ko), vk=flat(vi); console.log('ko:', kk.length, 'vi:', vk.length); const missing=kk.filter(k=>!vk.includes(k)); if(missing.length) console.log('vi.json 누락:', missing);"
```

## 사용법

```
/i18n-check                    # 전체 페이지 스캔
/i18n-check src/pages/Items.tsx  # 특정 파일만 검사
```
