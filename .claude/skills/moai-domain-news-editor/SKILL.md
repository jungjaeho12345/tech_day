---
name: moai-domain-news-editor
description: >
  뉴스 제작 시스템(연합뉴스 스타일) 도메인 지식 캡슐화 스킬.
  기사 생애주기 RDS/DPS/RRH/RRK/DDH/DDK, 권한 R/D/Z, 12개 공통정보,
  에디터 단축키(Alt+Y/Ctrl+D)와 인라인 임베딩 의미, 디자인 토큰을
  모든 도메인 에이전트(manager-spec/expert-frontend/evaluator-active)가
  동일하게 참조하도록 단일 출처화한다.
license: Apache-2.0
allowed-tools: Read, Grep, Glob, Bash
metadata:
  version: "0.1.0"
  category: "domain"
  status: "active"
  updated: "2026-06-03"
  tags: "news, editor, lifecycle, design-tokens, 연합뉴스"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 5000

# MoAI Extension: Triggers
triggers:
  keywords:
    - news
    - 기사
    - writer.do
    - list.do
    - 에디터
    - 임베드
    - RDS
    - DPS
    - RRH
    - RRK
    - DDH
    - DDK
    - Alt+Y
    - Ctrl+D
    - 연합뉴스
    - 공통정보
  agents:
    - manager-spec
    - expert-frontend
    - evaluator-active
  phases:
    - plan
    - run
---

## HISTORY

- 2026-06-05 (v0.1.1): 동기화 점검 반영. (1) news.md L66 `(끝)` 송고 가드 추가 (commit eaf747e, SPEC-NEWS-REVISE-005). (2) lockYN 출처 정정 — news.md가 아닌 SPEC-NEWS-REVISE-002/003. (3) news.md 라인 인용 전반 보정 (약 -5~6줄 drift). (4) 디자인 레드(#C8102E, news.md L35-36) vs 블루(CLAUDE.md) 모순을 미해결 사항으로 명시 (결정 보류).
- 2026-06-03 (v0.1.0): 최초 작성. SPEC-HARNESS-NEWS-001 REQ-HARNESS-SKILL-DOMAIN 충족. source-of-truth `D:\agents\tech_day\news.md` 의 도메인 사실을 캡슐화하며, news.md가 갱신되면 본 스킬도 동기 갱신되어야 한다.

## Source of Truth

- 원본: `D:\agents\tech_day\news.md` (마지막 sync 시점: 2026-06-03)
- 보조 출처: `D:\agents\tech_day\.moai\specs\SPEC-NEWS-REVISE-001\spec.md`, `SPEC-UI-EDITOR-001`, `SPEC-FRONTEND-UI-001`, `SPEC-AUTH-001`
- 동기화 의무: `news.md` 의 `^#`/`^##` 헤더 섹션이 추가/수정되면 본 SKILL.md `## HISTORY` 에 항목을 추가하고 해당 표를 갱신한다.

---

## 1. Quick Reference (Level 1)

뉴스 제작 시스템(연합뉴스 스타일, NodeJS + SQLite 서버 / React + Vite 클라이언트)의 도메인 사실을 한 곳에 모은 스킬이다. 페이지 3종(login.do, writer.do, list.do), 권한 R/D/Z, 기사 생애주기 6 상태, 에디터 단축키, 인라인 임베딩, 디자인 토큰을 표로 제공한다.

### 1.1 페이지·URL

| URL | 페이지 | 요지 |
|-----|--------|------|
| `login.do` | 로그인 페이지 | 아이디/암호 → USER 테이블 대조. 성공 시 writer.do로 이동, 실패 시 ALERT (Source: news.md L44, L94-96) |
| `writer.do` | 기사 작성 페이지 | 좌측 에디터 60% + 우측 메타데이터 40%. 우측 탭 4종(공통정보/이미지/영상/글기사). 송고/보류/KILL 버튼 (Source: news.md L45, L52-65) |
| `list.do` | 기사 조회 페이지 | 실시간 + 메뉴 4종(데스크 미송고/부서별 작성/부서별 송고/개인별 수정). 10개씩 페이징 (Source: news.md L46, L67-81) |

### 1.2 디자인 토큰 (연합뉴스 스타일)

| 변수 | 값 | 용도 |
|------|----|----|
| `--yh-blue` | `#0A4DA6` | 기본 파란색 (제목·헤더 강조선·활성 탭) — CLAUDE.md "파란색과 흰색" 정합 |
| `--yh-blue-deep` | `#08306B` | 진한 파란색 (호버·선택 상태) |
| `--yh-gray-line` | `#DDE3EC` | 1px 회색 구분선 (신문형 레이아웃) |
| `--yh-serif` | `'Nanum Myeongjo', 'Noto Serif KR'` | 헤드라인·제목 명조체 |
| `--yh-sans` | `'Noto Sans KR'` | 본문 고딕체 |
| 골드 색상 | (인라인 적용) | Alt+Y `(끝)` 마커 색상 (Source: news.md L120) |

본문 색 규칙 (Source: news.md L119): **제목은 파란색** (`--yh-blue`), **부제목은 빨간색**, **본문은 검정색**. CLAUDE.md "글자색은 파란색" 은 헤드라인/제목에 적용되며 본문 검정은 그대로 유지된다.

### 1.3 기사 생애주기 상태 한눈에

| 상태 | 의미 | 진입 조건 (단순화) |
|------|------|------------------|
| `RDS` | 작성 직후 초안 (편집 가능) | 최초 작성 시 (Source: news.md L148). R 권한이 송고해도 RDS 유지 (L149) |
| `RRH` | R 권한이 보류한 RDS 기사 | R + RDS + 보류 (Source: news.md L150) |
| `RRK` | R 권한이 KILL 한 RDS 기사 | R + RDS + KILL (Source: news.md L151) |
| `DPS` | D 권한이 송고한 RDS 기사 (= 배부 대상) | D + RDS + 송고 (Source: news.md L152). 부서별 송고 페이지에서 조회 (L73) |
| `DDH` | D 권한이 보류한 RDS 기사 | D + RDS + 보류 (Source: news.md L153) |
| `DDK` | D 권한이 KILL 한 RDS 기사 | D + RDS + KILL (Source: news.md L154) |

### 1.4 에디터 단축키

| 단축키 | 동작 | 제약 |
|--------|------|------|
| `Alt+Y` | 본문 끝에 `(끝)` 골드색 1회 삽입 | 이미 `(끝)` 이 있으면 삽입하지 않음 (Source: news.md L120-121) |
| `Ctrl+D` | 현재 라인 제거 | 에디터 포커스 한정, `preventDefault` 강제 (Source: news.md L122) |
| IME 합성 중 | repaint 차단 | compositionEnd 까지 stale bodyText 사용 금지 — SPEC-NEWS-REVISE-001 D-7 회귀 (Source: 최근 커밋 7580d2b) |

---

## 2. Implementation Guide (Level 2)

### 2.1 권한 R/D/Z 의미와 작성 페이지 버튼 가시성 매트릭스

권한 정의 (Source: news.md L137):
- **R** = 기자 리포터 (Reporter)
- **D** = 국기사 데스크 (Desk)
- **Z** = 관리자 (Admin)

기사 작성 페이지(writer.do)의 송고/보류/KILL 버튼 가시성·사용가능 규칙. RDS 상태의 기사 한정 (Source: news.md L62-65, SPEC-NEWS-REVISE-001 REQ-AUTH-Z-BUTTONS):

| 버튼 | R 권한 + RDS | D 권한 + RDS | Z 권한 + RDS | RDS 외 상태 |
|------|-------------|-------------|-------------|------------|
| 송고 | 보이고 사용가능 | 보이고 사용가능 | 보이고 사용가능 | 비표시 |
| 보류 | 보이고 사용가능 | 보이고 사용가능 | 보이고 사용가능 | 비표시 |
| KILL | 보이고 사용가능 | 비표시 | 보이고 사용가능 | 비표시 |

기사 제어/편집 권한 (Source: news.md L140-142):
- R/D/Z 모두 기사 편집 가능.
- 상태값이 `DPS` 일 때 **D 권한 사용자만** 고침/포털고침 메뉴 사용 가능.
- **Z 권한은 기사 작성 및 데스크 미송고 편집 권한**이 있다 — *송고/보류/KILL 3 버튼* 한정이며 일반 액션(고침/포털고침/재송/삭제요청 등)은 별도 권한 규칙 적용.

조회 페이지(list.do) 우클릭 컨텍스트 메뉴 (Source: news.md L75-77):
- 부서별 작성/송고, 개인별 수정 페이지: 상세보기 / 이력보기 / 송고이력보기 / 본문복사 / 제목만복사 / 번역 / 매핑 / 후속기사작성 / 계속기사작성 / 고침(포털제외) / 포털고침 / 삭제요청 / 재송.
- 데스크 미송고 페이지: 편집 / 상세보기 / 이력보기 / 본문복사 / 제목만복사.

### 2.2 기사 생애주기 전이 매트릭스 (R/D × 액션 × 결과)

초기 상태가 RDS 인 기사에 대해, 권한과 액션의 조합이 도달하는 결과 상태 (Source: news.md L148-154):

| 초기 상태 | 권한 | 액션 | 결과 상태 | 비고 |
|-----------|------|------|-----------|------|
| RDS | R | 송고 | RDS | 데스크 검수 대기 (L149) |
| RDS | R | 보류 | RRH | (L150) |
| RDS | R | KILL | RRK | (L151) |
| RDS | D | 송고 | DPS | 배부 대상으로 전환 (L152) |
| RDS | D | 보류 | DDH | (L153) |
| RDS | D | KILL | DDK | (L154) |
| RDS | Z | 송고/보류/KILL | R/D 와 동일 사이클을 따름 — Z 의 효과 상태는 SPEC-NEWS-REVISE-001 R7 미해결 결정 사항. 본 스킬은 현행 명세를 그대로 상속한다 |

API 측면 (Source: news.md L99-103, L127-131):
- 최초 작성 → `articleInsert` (RDS 생성).
- 편집 기능 후 송고/보류/KILL → `articleUpdate` (상태값 변경).
- 송고/보류/KILL 후 작성 페이지는 초기화.
- 제목이 없으면 송고/보류 실패 ALERT.

### 2.3 12 공통정보 필드 (Source: news.md L56, L84)

작성 페이지 우측 공통정보 탭과 상세보기 새창 상단에 동일한 순서로 노출되는 12 필드. 순서·label 은 본 표 그대로 고정한다:

| 순서 | 필드 | 비고 |
|------|------|------|
| 1 | 작성자 | 로그인한 사용자 이름 자동 입력 (Source: news.md L125) |
| 2 | 공동작성 | 다중 사용자 추가 가능 |
| 3 | 내용 | 짧은 요약/리드 |
| 4 | 지역 | |
| 5 | 속성 | 보도 속성 |
| 6 | 키워드 | 다중 |
| 7 | 내부코멘트 | |
| 8 | 외부코멘트 | |
| 9 | 첨부파일 | |
| 10 | 자료파일 | |
| 11 | 엠바고 | 시간 입력 |
| 12 | 2차 엠바고 | 시간 입력 |

상세보기 새창 레이아웃 (Source: news.md L84): 상단에 위 12 필드 → 하단에 기사의 제목과 본문 분리, **본문이 제목보다 크게** 표현.

### 2.4 인라인 임베딩 계약

핵심 규약 (Source: news.md L116-118, SPEC-NEWS-REVISE-001 REQ-EMB):
- 이미지/영상/글기사 탭 검색 결과를 **본문 커서 위치**에 임베딩.
- 임베딩 후 결과는 유지(persist) — markupVersion round-trip 보존 (편집 → 저장 → 불러오기 후에도 동일 위치).
- 임베딩된 데이터는 삭제 가능.
- 클립보드 붙여넣기로 들어온 이미지/유튜브 크기: 에디터 100% 기준 가로*세로 = 10%*10% (Source: news.md L118).

이미지/영상 검색 (Source: news.md L58-59):
- Youtube API 우선 사용 → 실패 시 구글 검색으로 fallback.
- 글기사는 내부 기사 DB에서 제목·본문 검색.

### 2.5 에디터 본문 구조 규약 (Source: news.md L114-115)

- **첫째 줄**: 제목 (색: `--yh-blue` 파란색).
- **둘째 줄 ~ 다섯째 줄**: 부제목 (색: 빨간색). 단 개행이 2번 이상이면 그 시점부터 본문 (색: 검정색).

### 2.6 lockYN 동시 편집 제어 (Source: news.md L86-88)

- 기사 편집 시작 → `lockYN = 'Y'`.
- 편집 종료 / 세션 종료 / 브라우저 닫힘 → `lockYN = 'N'`.
- 한 기사의 편집은 한 페이지 한 세션 한정 — 동일 세션 내 다른 페이지에서도 불가.

### 2.7 자주 발생하는 도메인 오해 3종

1. **"Z 권한은 모든 버튼"** — 오해. news.md L62 의 "Z권한은 송고/보류/KILL 버튼이 보이고 사용할 수 있다" 는 *작성 페이지의 3 버튼* 한정. 고침/포털고침/재송 등은 별도 권한 매트릭스를 따른다 (SPEC-NEWS-REVISE-001).
2. **"R 권한 송고 후 상태는 DPS"** — 오해. R 권한이 RDS 를 송고하면 **RDS 유지** (L149). DPS 는 D 권한 송고의 결과 (L152).
3. **"Ctrl+D 는 모든 페이지에서 라인 삭제"** — 오해. 에디터 포커스 한정. `preventDefault` 강제. 비-에디터 컨텍스트에서는 브라우저 기본 동작(북마크 추가)이 그대로 통과해야 한다.

---

## 3. Authority References (Level 3)

본 스킬은 *도메인 지식의 단일 출처화* 만 책임진다. 오케스트레이션(Intent Router, GAN Loop, Sprint Contract, Slack 보고 등)은 본 스킬의 책임이 아니며 `moai-workflow-news-production` 스킬이 담당한다.

### 3.1 정합성 유지 출처

- `D:\agents\tech_day\news.md` — source-of-truth. 변경 시 본 스킬 동기 갱신.
- `D:\agents\tech_day\.moai\specs\SPEC-NEWS-REVISE-001\spec.md` — Z 권한 버튼, IME 합성 처리, AC-CTRL-D, AC-EMB 인라인 임베딩.
- `D:\agents\tech_day\.moai\specs\SPEC-NEWS-REVISE-002\spec.md` — 후속 명세 (미커밋 상태).
- `D:\agents\tech_day\.moai\specs\SPEC-UI-EDITOR-001\spec.md` — 에디터 기본 명세.
- `D:\agents\tech_day\.moai\specs\SPEC-FRONTEND-UI-001\spec.md` — UI 전체 명세.
- `D:\agents\tech_day\.moai\specs\SPEC-AUTH-001\spec.md` — 인증·권한 명세.
- `D:\agents\tech_day\CLAUDE.md` — 디자인 ("파란색과 흰색", 글자색은 파란색), 한국어 응답, DB 삭제 금지.
- `D:\agents\tech_day\ContentsVO.md` / `ArticleVO.md` / `UserVO.md` — DTO 필드 정의.

### 3.2 본 스킬 사용 컨벤션

- `manager-spec` / `expert-frontend` / `evaluator-active` 가 `Skill("moai-domain-news-editor")` 로 동일하게 로드.
- 본 스킬의 표를 *그대로* 인용하고 정정이 필요하면 본 스킬을 먼저 수정한 뒤 사용처에 반영한다 (단일 출처 원칙).
- 도메인 사실이 모호하면 본 스킬을 갱신하는 PR 로 해결하고, 그 PR 머지 전까지 사용처 에이전트는 *모호함을 그대로* 보고한다.

### 3.3 Works Well With (단순 참조)

- `moai-workflow-news-production` — 본 스킬을 도메인 지식 채널로 사용.
- `moai-foundation-cc` — Claude Code 표준 (skill frontmatter / progressive disclosure).
- `moai-foundation-core` — TRUST 5 / SPEC-First.
- `moai-domain-frontend` — React/Vite 일반 패턴.
