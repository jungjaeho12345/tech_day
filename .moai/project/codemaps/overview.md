# Codemaps — Overview

기사 작성기 구현 완료 현황. SPEC-DB-FOUNDATION-001 → SPEC-BACKEND-CORE-001 → SPEC-FRONTEND-UI-001 순서로 3계층 구현 완료. SPEC-NEWS-REVISE-001(2026-06-03)로 Z권한 lifecycle 전이, M3 인라인 임베드, IME 합성 가드 보강.

## 시스템 경계 (구현 완료)

- **클라이언트** (`web/`, React 19 + Vite 7): 로그인 · 기사 작성(`WritePage`) · 기사 조회(`ViewPage`) + 상세보기 새창(`articleDetail.js`)
- **서버** (`src/`, NodeJS 22.5+): 기사/사용자 CRUD, 인증(bcryptjs), 기사 생애주기 (`lifecycle.js`), SQLite 영속화
- **DB** (SQLite via `node:sqlite`): Article · Contents · User 3개 테이블, 기사 ID 생성 (`articleId.js`)

## 핵심 데이터 흐름

```
로그인 → 인증(bcryptjs) → 기사 작성 페이지
  → 에디터 입력(IME 가드, contentEditable)
  → 임베드 삽입(InlineEmbed, 캐럿 위치)
  → 단축키(Ctrl+D 라인 삭제 / Alt+Y "(끝)")
  → 송고(기사 DTO) → lifecycle.js 상태 전이
    [R: RDS/RRH/RRK, D/Z: DPS/DDH/DDK]
  → SQLite 반영 → 조회 페이지(실시간)
  → 우클릭 → 상세보기 새창(제목/본문 분리, 공통정보 12필드)
```

## 주요 엔트리포인트

| 경로 | 역할 |
|------|------|
| `src/controllers/index.js` | 서버 진입점: `createControllers(db, deps)` |
| `web/src/app/App.jsx` | 클라이언트 진입점: 라우팅 + 인증 가드 + Model 주입 |
| `src/services/lifecycle.js` | 기사 상태 전이 순수 함수 (`transition`, `canEdit`) |
| `web/src/view/WritePage.jsx` | 기사 작성 UI (Z권한 포함 버튼 가시성 제어) |
| `web/src/view/articleDetail.js` | 상세보기 HTML 빌더 (`buildArticleDetailHtml`) |

## 테스트 커버리지 현황

| 계층 | 러너 | 테스트 수 |
|------|------|-----------|
| DB + 백엔드 | `node:test` | 73개 |
| 프런트엔드 | Vitest | 28개 이상 (SPEC-NEWS-REVISE-001 AC 포함) |
