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

## Coding Patterns

- Zustand 스토어: named export (`useXxxStore`), immutable 패턴 (spread/map/filter)
- Supabase 서비스: 에러 시 Korean 메시지로 throw
- Ant Design 5 API 사용, Table + Modal + Form 패턴
- Auth store에 factory/location 커플링 금지 — locationContext.ts 통해 접근
