---
name: moai-domain-news-editor
description: >
  기사 작성기(스타일) 도메인 지식의 단일 출처(SSOT) 스킬.
  기사 생애주기 RDS/DPS/RRH/RRK/DDH/DDK(Z=D-mirror), 권한 R/D/Z 버튼 매트릭스,
  송고 (끝) 가드, list.do 메뉴 4종 상태 필터·컬럼, 12개 공통정보,
  에디터 단축키(Alt+Y/Ctrl+D)·인라인 임베딩·디자인 토큰을 표로 제공한다.
  기사/송고/보류/KILL/권한/생애주기/에디터/임베드/list.do/writer.do/news.md 가
  언급되는 질문·구현·리뷰·SPEC 작성 시 코드 탐색 전에 반드시 이 스킬을 먼저
  참조한다 — news.md 가 낡은 항목(임베드 17%, Alt+Y embeds 뒤 배치)도
  코드 현실 기준으로 정리되어 있다.
license: Apache-2.0
allowed-tools: Read, Grep, Glob, Bash
metadata:
  version: "0.1.8"
  category: "domain"
  status: "active"
  updated: "2026-06-06"
  tags: "news, editor, lifecycle, design-tokens"

# MoAI Extension: Progressive Disclosure
progressive_disclosure:
  enabled: true
  level1_tokens: 100
  level2_tokens: 8000

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
    - Ctrl+D    - 공통정보
    - 송고
    - 보류
    - KILL
    - 생애주기
    - lockYN
  agents:
    - manager-spec
    - expert-frontend
    - evaluator-active
  phases:
    - plan
    - run
---

## HISTORY

- 2026-06-09 (v0.2.0): 상세보기 별도 제목 요소 폐지 동기화 (SPEC-NEWS-REVISE-013 REQ-DETAIL-NO-SEPARATE-TITLE) — 상세보기 새창 `기사` 영역에서 별도 제목 요소(`.yh-detail__title`/`<h1>`)를 제거하고 본문(`.yh-detail__content`, markupVersion 첫 줄이 제목)만 렌더한다. 사용자 지시("제목은 이미 본문에서 같이 나오니 없애라") 기반. 기존 REQ-DETAIL-LAYOUT-SPLIT(001)·FONT-EMPHASIS(002)·BODY-EMPHASIS(003)의 제목-요소/폰트강조 전제는 supersede(마커 부착), gray-line `#DDE3EC`·12 공통정보 dt·공통정보→기사 형제 가드는 AC-NOTITLE-4 로 계승. `<head><title>`(빈 제목 시 `(제목 없음)`)은 유지. §2.3 반영, news.md "# 상세보기" 절 1줄 갱신. 구현: web/src/view/articleDetail.js (h1·CSS 제거), articleDetail.test.js (제목 단언 → AC-NOTITLE-*). 동반(별건): 에디터 임베드 Backspace 삭제 시 커서 점프 수정(editorCaret.embedTextOffset), 조회 작성/수정시간 컬럼 grid 정렬(yonhap.css).
- 2026-06-08 (v0.1.9): 생애주기 신규 결정 동기화 — **최초 송고 = RDS**: 작성 페이지(writer.do) 신규 기사(A-DRAFT)의 송고는 권한과 무관하게 상태 전이 없이 RDS 저장만 한다 (useWriteController.submitAction 이 applyAction 을 부르지 않음). §1.3/§2.2 의 권한별 전이 표(D 송고 → DPS 등)는 기존 기사(편집 컨텍스트)의 송고/보류/KILL 에만 적용된다. 보류/KILL 은 신규에서도 종전 전이 유지 (R→RRH/RRK, D→DDH/DDK). news.md 기사 생애주기 절에 결정 1줄 반영. 동반: 부서별 작성/송고의 부서 멀티셀렉트 체크박스 드롭다운(.yh-multi-select) 디자인 토큰 스타일 신설 (yonhap.css — 종전엔 무스타일이라 깨져 보였음).
- 2026-06-06 (v0.1.8): 작성 에디터 멀티탭 동기화 — writer.do 는 WriteWorkspace(web/src/view/WriteWorkspace.jsx) 가 탭 스트립 + 탭별 WritePage 인스턴스(전부 mounted, 비활성 hidden)를 관리. 탭 메타 sessionStorage `newsroom.editorTabs`, 탭별 초안 키 `newsroom.writeDraft.<tabId>` (구 단일 키는 첫 진입 시 1회 이관). 조회(list.do) 편집/고침/포털고침 진입(?id=)은 **새 탭** 생성·활성화, 같은 기사 재진입은 기존 탭 활성화(잠금 자기충돌 방지 — D2-5 strict 정합). 편집 탭에서 송고/보류/KILL 성공 시 그 탭은 빈 '새 기사' 탭으로 전환(잠금 해제 + 주소창 ?id= 제거). 주소창은 활성 탭을 replaceState 로 비춘다. 동반 수정: 서버 POST /lock 이 sendBeacon 페이로드의 release:true 를 해제로 처리하도록 계약 복원 (종전엔 무시되어 언로드 해제가 잠금 재획득이 되는 기존 버그). news.md 기사 작성페이지 절(L60-62)에 규칙 3줄 반영.
- 2026-06-06 (v0.1.7): 작성 초안 보존 동기화 — writer.do → list.do 이동 후 복귀 시 작성 내용(제목/본문/임베드/공통정보) 유지. sessionStorage 키 `newsroom.writeDraft` 영속(useWriteController, 블랭크-신규 컨텍스트 한정), 편집 진입(?id=)은 서버 ContentsVO 로드 우선(영속/복원 OFF), 송고/보류/KILL 성공 초기화 시 보존 draft 도 함께 제거. news.md 기사 작성페이지 절에 규칙 반영.
- 2026-06-06 (v0.1.6): 세션 정책 신설 동기화 — (1) 무동작 1시간(IDLE_TIMEOUT_MS=3600000) 세션 만료, 요청마다 sliding 갱신 (src/services/sessionService.js touchSession). (2) 로그아웃 전까지 활동 시 무기한 유지. (3) F5 새로고침 유지 — sessionId 를 sessionStorage 영속 + GET /api/session 복원 (탭/브라우저 닫힘 시 소멸 = lockYN 규칙 정합). news.md "## 세션 정책" 섹션(L94-97 부근) 신설 반영.
- 2026-06-06 (v0.1.5): 상세보기 새창 레이아웃 개편 동기화 — 공통정보 12필드 세로→**가로 나열**(flex wrap), 제목/본문 분리 섹션 폐지 → 단일 `기사` 섹션에서 제목+본문 통합 표시 (본문>제목 폰트 1.3rem<1.75rem 유지). 구두 지시 기반, news.md L89 반영 완료. 구현: web/src/view/articleDetail.js.
- 2026-06-06 (v0.1.4): news.md 전수 대조 동기화. (1) 라인 인용 drift 보정 — 생애주기 L148-154→L153-159, Ctrl+D L122→L124, 상세보기 L84→L89, 본문 색 L119→L121, 골드 L120→L122, 임베딩 L116-118→L119-120, 본문 구조 L114-115→L116-118, 권한 정의 L137→L138, 제어 권한 L140-142→L141-143, 작성자 자동입력 L125→L127, API L99-103/L127-131→L101-105/L130-135. (2) §2.6 lockYN 출처를 본문에서도 SPEC-NEWS-REVISE-002/003 으로 정정 (v0.1.1 HISTORY 기록의 본문 미반영분). (3) 신규 반영 — §2.8 list.do 메뉴 4종 필터·컬럼 규약 (L71-86), 송고 `(끝)` 가드 본문 규칙 (§1.4, L66), 송고/보류/KILL 확인창·성공 시 상태 메시지 미표시 (§2.2, L101/L104), 기사아이디 SP 규칙 AKR+YYYYMMDD+난수9 (§2.2, L112-113), '본문' 라벨 미표시 (§2.5, L116), news.md L45 `wirter.do` 오타 주석 (§1.1). (4) skill-creator 평가(iteration-1)에서 발견된 낡은 표기 정정 — §2.2 Z 전이를 'R7 미해결'에서 **D-mirror 확정**(lifecycle.js TRANSITIONS + SPEC-NEWS-REVISE-001 D-6 + lifecycleRule.test.js)으로 갱신.
- 2026-06-06 (v0.1.3): 구두 지시 기반 미커밋 구현 동기화 — (1) Alt+Y `(끝)` 마커가 embeds 뒤 **최종 블록**으로 배치 (최종 시각 순서: 본문 텍스트 → embeds → `(끝)`; `getBodyText()`는 여전히 `(끝)`으로 끝나 송고 가드 통과). (2) 임베드 크기 1.7배 — 클립보드 10%×10% → **17%×17%**, 사진/영상 figure 360px → **612px** (기사 카드 480px는 유지). 두 변경 모두 사용자 승인 하에 news.md L120/L122-123 에 반영 완료. news.md 라인 인용 +2줄 drift 보정 (Alt+Y L120-121 → L122-123, 클립보드 L118 → L120).
- 2026-06-06 (v0.1.2): SPEC-NEWS-REVISE-007 동기화 — 편집/고침/포털고침 포워딩 + ContentsVO 매핑 (news.md L78-79, L147-150) 반영. §2.1 컨텍스트 메뉴 절 갱신 (부서별 송고 편집 항목 추가 + 고침/포털고침 D+DPS 게이팅 포워딩 + 읽기전용 8필드 매핑).
- 2026-06-05 (v0.1.1): 동기화 점검 반영. (1) news.md L66 `(끝)` 송고 가드 추가 (commit eaf747e, SPEC-NEWS-REVISE-005). (2) lockYN 출처 정정 — news.md가 아닌 SPEC-NEWS-REVISE-002/003. (3) news.md 라인 인용 전반 보정 (약 -5~6줄 drift). (4) 디자인 레드(#C8102E, news.md L35-36) vs 블루(CLAUDE.md) 모순을 미해결 사항으로 명시 (결정 보류).
- 2026-06-03 (v0.1.0): 최초 작성. SPEC-HARNESS-NEWS-001 REQ-HARNESS-SKILL-DOMAIN 충족. source-of-truth `D:\agents\tech_day\news.md` 의 도메인 사실을 캡슐화하며, news.md가 갱신되면 본 스킬도 동기 갱신되어야 한다.

## Source of Truth

- 원본: `D:\agents\tech_day\news.md` (마지막 sync 시점: 2026-06-06 v0.1.4 — **전수 대조 완료**. 부서별 작성/개인별 수정 필터, 컬럼 통일, 송고 `(끝)` 가드 본문 규칙, 확인창/SP 규칙/'본문' 라벨 미표시 포함)
- **2026-06-06 구두 지시 2건은 news.md 에 반영 완료 (사용자 승인)**: (1) 클립보드 임베드 크기 17%*17% (1.7배, figure 612px / 기사 카드 480px 유지) — news.md L120. (2) Alt+Y `(끝)` prefix-free 토큰을 embeds 뒤 최종 블록으로 배치 — news.md L122-123. 코드·news.md·본 스킬 3자 정합 상태.
- 보조 출처: `D:\agents\tech_day\.moai\specs\SPEC-NEWS-REVISE-001\spec.md`, `SPEC-UI-EDITOR-001`, `SPEC-FRONTEND-UI-001`, `SPEC-AUTH-001`
- 동기화 의무: `news.md` 의 `^#`/`^##` 헤더 섹션이 추가/수정되면 본 SKILL.md `## HISTORY` 에 항목을 추가하고 해당 표를 갱신한다.

---

## 1. Quick Reference (Level 1)

기사 작성기(스타일, NodeJS + SQLite 서버 / React + Vite 클라이언트)의 도메인 사실을 한 곳에 모은 스킬이다. 페이지 3종(login.do, writer.do, list.do), 권한 R/D/Z, 기사 생애주기 6 상태, 에디터 단축키, 인라인 임베딩, 디자인 토큰을 표로 제공한다.

### 1.1 페이지·URL

| URL | 페이지 | 요지 |
|-----|--------|------|
| `login.do` | 로그인 페이지 | 아이디/암호 → USER 테이블 대조. 성공 시 writer.do로 이동, 실패 시 실패 이유 포함 ALERT (Source: news.md L44, L95-98) |
| `writer.do` | 기사 작성 페이지 | **멀티탭**: 작성 에디터를 탭으로 여러 개 연다 (＋ 추가/× 닫기, 탭별 내용 독립; 조회의 편집/고침/포털고침 진입은 새 탭, 같은 기사 재진입은 기존 탭 활성화 — v0.1.8). 각 탭 = 좌측 에디터 60% + 우측 메타데이터 40%. 우측 탭 4종(공통정보/이미지/영상/글기사). 송고/보류/KILL 버튼 (Source: news.md L45, L51-69 — news.md L45 표기는 `wirter.do` 오타, 구현·테스트는 `writer.do`) |
| `list.do` | 기사 조회 페이지 | 실시간 + 메뉴 4종(데스크 미송고/부서별 작성/부서별 송고/개인별 수정). 메뉴별 상태 필터·컬럼은 §2.8. 시간 내림차순, 10개씩 페이징 (Source: news.md L46, L68-86) |

### 1.2 디자인 토큰 (스타일)

| 변수 | 값 | 용도 |
|------|----|----|
| `--yh-blue` | `#0A4DA6` | 기본 파란색 (제목·헤더 강조선·활성 탭) — CLAUDE.md "파란색과 흰색" 정합 |
| `--yh-blue-deep` | `#08306B` | 진한 파란색 (호버·선택 상태) |
| `--yh-gray-line` | `#DDE3EC` | 1px 회색 구분선 (신문형 레이아웃) |
| `--yh-serif` | `'Nanum Myeongjo', 'Noto Serif KR'` | 헤드라인·제목 명조체 |
| `--yh-sans` | `'Noto Sans KR'` | 본문 고딕체 |
| 골드 색상 | (인라인 적용) | Alt+Y `(끝)` 마커 색상 (Source: news.md L122) |

본문 색 규칙 (Source: news.md L121): **제목은 파란색** (`--yh-blue`), **부제목은 빨간색**, **본문은 검정색**. CLAUDE.md "글자색은 파란색" 은 헤드라인/제목에 적용되며 본문 검정은 그대로 유지된다.

### 1.3 기사 생애주기 상태 한눈에

| 상태 | 의미 | 진입 조건 (단순화) |
|------|------|------------------|
| `RDS` | 작성 직후 초안 (편집 가능) | 최초 작성 시 (Source: news.md L153). R 권한이 송고해도 RDS 유지 (L154) |
| `RRH` | R 권한이 보류한 RDS 기사 | R + RDS + 보류 (Source: news.md L155) |
| `RRK` | R 권한이 KILL 한 RDS 기사 | R + RDS + KILL (Source: news.md L156) |
| `DPS` | D 권한이 송고한 RDS 기사 (= 배부 대상) | D + RDS + 송고 (Source: news.md L157). 부서별 송고 페이지에서 조회 (L75) |
| `DDH` | D 권한이 보류한 RDS 기사 | D + RDS + 보류 (Source: news.md L158) |
| `DDK` | D 권한이 KILL 한 RDS 기사 | D + RDS + KILL (Source: news.md L159) |

### 1.4 에디터 단축키

| 단축키 | 동작 | 제약 |
|--------|------|------|
| `Alt+Y` | `(끝)` 골드색 1회 삽입 — embeds 뒤 **최종 블록**으로 배치 (시각 순서: 본문 → embeds → `(끝)`) | 이미 `(끝)` 이 있으면 삽입하지 않음 (Source: news.md L122-123. prefix-free 토큰은 SPEC-NEWS-REVISE-002)"` / 본문 끝 삽입. prefix-free 토큰은 SPEC-NEWS-REVISE-002, embeds 뒤 배치는 2026-06-06 구두 지시) |
| `Ctrl+D` | 현재 라인 제거 | 에디터 포커스 한정, `preventDefault` 강제 (Source: news.md L124) |
| IME 합성 중 | repaint 차단 | compositionEnd 까지 stale bodyText 사용 금지 — SPEC-NEWS-REVISE-001 D-7 회귀 (Source: 최근 커밋 7580d2b) |

송고 가드 (Source: news.md L66, SPEC-NEWS-REVISE-005): **송고는 본문에 `(끝)` 이 있어야** 진행된다. 없으면 ALERT 후 송고 차단. **보류/KILL 은 `(끝)` 없이도 진행**된다.

---

## 2. Implementation Guide (Level 2)

### 2.1 권한 R/D/Z 의미와 작성 페이지 버튼 가시성 매트릭스

권한 정의 (Source: news.md L138):
- **R** = 기자 리포터 (Reporter)
- **D** = 국기사 데스크 (Desk)
- **Z** = 관리자 (Admin)

기사 작성 페이지(writer.do)의 송고/보류/KILL 버튼 가시성·사용가능 규칙. RDS 상태의 기사 한정 (Source: news.md L62-65, SPEC-NEWS-REVISE-001 REQ-AUTH-Z-BUTTONS):

| 버튼 | R 권한 + RDS | D 권한 + RDS | Z 권한 + RDS | RDS 외 상태 |
|------|-------------|-------------|-------------|------------|
| 송고 | 보이고 사용가능 | 보이고 사용가능 | 보이고 사용가능 | 비표시 |
| 보류 | 보이고 사용가능 | 보이고 사용가능 | 보이고 사용가능 | 비표시 |
| KILL | 보이고 사용가능 | 비표시 | 보이고 사용가능 | 비표시 |

- **KILL 추가 조건 (v0.6.0)**: 기사아이디가 생성되지 않은 신규 초안(A-DRAFT)에서는 권한과 무관하게 KILL 비표시 — KILL은 기사아이디가 부여된(편집 컨텍스트) RDS 기사에서만 노출된다 (Source: news.md "기사아이디가 생성되지 않은 기사…KILL 버튼을 표시하지 않는다", SPEC-FRONTEND-UI-001 v0.6.0).

기사 제어/편집 권한 (Source: news.md L141-143):
- R/D/Z 모두 기사 편집 가능.
- 상태값이 `DPS` 일 때 **D 권한 사용자만** 고침/포털고침 메뉴 사용 가능.
- **Z 권한은 기사 작성 및 데스크 미송고 편집 권한**이 있다 — *송고/보류/KILL 3 버튼* 한정이며 일반 액션(고침/포털고침/재송/삭제요청 등)은 별도 권한 규칙 적용.

조회 페이지(list.do) 우클릭 컨텍스트 메뉴 (Source: news.md L77-79):
- 부서별 작성/송고, 개인별 수정 페이지: 상세보기 / 이력보기 / 송고이력보기 / 본문복사 / 제목만복사 / 번역 / 매핑 / 후속기사작성 / 계속기사작성 / 고침(포털제외) / 포털고침 / 삭제요청 / 재송.
- 부서별 송고 페이지의 우클릭 메뉴에는 **편집** 항목이 추가로 있다 (Source: news.md L79).
- 데스크 미송고 페이지: 편집 / 상세보기 / 이력보기 / 본문복사 / 제목만복사.

편집/고침/포털고침 포워딩 + ContentsVO 매핑 (Source: news.md L78, L147-150 / SPEC-NEWS-REVISE-007):
- 데스크 미송고 편집, 부서별 송고 편집·고침(포털제외)·포털고침, DPS 행의 고침/포털고침 버튼은 모두 기사작성 페이지로 포워딩되어 ContentsVO 정보가 매핑된다.
- 고침(포털제외)/포털고침은 상태값 DPS + D 권한에서만 활성화 (메뉴/행 버튼 동일 게이팅).
- 매핑: 제목/본문내용/작성자/엠바고/2차 엠바고는 기존 입력란에, 나머지 8필드(기사아이디/수정자/송고자/부서/부서코드/작성시간/편집시간/송고시간)는 작성 페이지 읽기전용 영역에 표시.
- 고침/포털고침 진입은 단순 편집 진입 — 기사 상태값 전이를 일으키지 않는다.

### 2.2 기사 생애주기 전이 매트릭스 (R/D × 액션 × 결과)

초기 상태가 RDS 인 기사에 대해, 권한과 액션의 조합이 도달하는 결과 상태 (Source: news.md L153-159):

| 초기 상태 | 권한 | 액션 | 결과 상태 | 비고 |
|-----------|------|------|-----------|------|
| RDS | R | 송고 | RDS | 데스크 검수 대기 (L154) |
| RDS | R | 보류 | RRH | (L155) |
| RDS | R | KILL | RRK | (L156) |
| RDS | D | 송고 | DPS | 배부 대상으로 전환 (L157) |
| RDS | D | 보류 | DDH | (L158) |
| RDS | D | KILL | DDK | (L159) |
| RDS | Z | 송고 → DPS / 보류 → DDH / KILL → DDK | **Z 는 D-mirror** — `lifecycle.js` TRANSITIONS `'RDS|Z|send'→DPS, 'RDS|Z|hold'→DDH, 'RDS|Z|kill'→DDK` (SPEC-NEWS-REVISE-001 D-6 결정, `lifecycleRule.test.js` 검증). news.md 생애주기 절에는 Z 행이 없으며 코드·SPEC 이 출처 |

API 측면 (Source: news.md L101-105, L130-135):
- 최초 작성 → `articleInsert` (RDS 생성).
- 편집 기능 후 송고/보류/KILL → `articleUpdate` (상태값 변경).
- 송고/보류/KILL 버튼은 먼저 '송고/보류/KILL하시겠습니까?' **확인창**을 띄우고, 확인 시에만 진행 — 취소하면 아무것도 저장/전송하지 않는다 (L101).
- 송고/보류/KILL 후 작성 페이지는 초기화. 요청 성공 시 버튼 아래에 상태 메시지를 **표시하지 않는다** (L103-104).
- 제목이 없으면 송고/보류 실패 ALERT (L105).
- 기사아이디는 SQLite SP 가 생성 — 규칙: `'AKR' + YYYYMMDD + 난수 9자리` (L112-113).

### 2.3 12 공통정보 필드 (Source: news.md L56, L89)

작성 페이지 우측 공통정보 탭과 상세보기 새창 상단에 동일한 순서로 노출되는 12 필드. 순서·label 은 본 표 그대로 고정한다:

| 순서 | 필드 | 비고 |
|------|------|------|
| 1 | 작성자 | 로그인한 사용자 이름 자동 입력 (Source: news.md L127) |
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

상세보기 새창 레이아웃 (Source: news.md "# 상세보기" / SPEC-NEWS-REVISE-013): 상단에 위 12 필드를 **가로로 나열**(flex wrap 카드형 셀, dt 위/dd 아래) → 하단에 단일 `기사` 영역(aria-label="기사")에서 **기사 본문만** 표시한다. **별도 제목 요소(`.yh-detail__title`/`<h1>`)는 두지 않는다** — 본문(`.yh-detail__content`, markupVersion 파싱)의 첫 줄이 곧 제목이므로 중복이다(SPEC-NEWS-REVISE-013 REQ-DETAIL-NO-SEPARATE-TITLE). 기존 "제목+본문 통합 표시"·"본문>제목 폰트 강조"(REQ-DETAIL-LAYOUT-SPLIT/FONT-EMPHASIS/BODY-EMPHASIS)는 supersede. 브라우저 탭 제목용 `<head><title>`(빈 제목 시 `(제목 없음)`)은 유지.

### 2.4 인라인 임베딩 계약

핵심 규약 (Source: news.md L119-120, SPEC-NEWS-REVISE-001 REQ-EMB):
- 이미지/영상/글기사 탭 검색 결과를 **본문 커서 위치**에 임베딩.
- 임베딩 후 결과는 유지(persist) — markupVersion round-trip 보존 (편집 → 저장 → 불러오기 후에도 동일 위치).
- 임베딩된 데이터는 삭제 가능.
- 클립보드 붙여넣기로 들어온 이미지/유튜브 크기: 에디터 100% 기준 가로*세로 = **17%*17%** (news.md L120 의 10%*10% 에 1.7배 적용 — 2026-06-06 구두 지시, news.md L120 반영 완료). 사진/영상 figure 폭도 360px → 612px (1.7배), 기사 참조 카드는 480px 유지.
- `(끝)` 마커는 embeds 와 별개의 **구분된 최종 텍스트 블록** — setBodyText 가 trailing `(끝)` 을 peel 하여 `[...본문, ...embeds, "(끝)"]` 순서를 타이핑 중에도 유지하고, 이 순서는 markupVersion round-trip 에서 보존된다.

이미지/영상 검색 (Source: news.md L58-59):
- Youtube API 우선 사용 → 실패 시 구글 검색으로 fallback.
- 글기사는 내부 기사 DB에서 제목·본문 검색.

### 2.5 에디터 본문 구조 규약 (Source: news.md L116-118)

- 에디터 본문 영역 위에 **'본문' 라벨 텍스트는 표시하지 않는다** — 접근성 aria-label 은 유지 (L116).
- **첫째 줄**: 제목 (색: `--yh-blue` 파란색).
- **둘째 줄 ~ 다섯째 줄**: 부제목 (색: 빨간색). 단 개행이 2번 이상이면 그 시점부터 본문 (색: 검정색).

### 2.6 lockYN 동시 편집 제어 (Source: SPEC-NEWS-REVISE-002/003 — news.md 에는 lock 의미론 비수록, `LockYN` 컬럼 노출만 L81·L84 에 존재)

- 기사 편집 시작 → `lockYN = 'Y'`.
- 편집 종료 / 세션 종료 / 브라우저 닫힘 → `lockYN = 'N'`.
- 한 기사의 편집은 한 페이지 한 세션 한정 — 동일 세션 내 다른 페이지에서도 불가.
- 세션 정책 (news.md "## 세션 정책"): 무동작 1시간 만료(sliding — 요청마다 갱신), 로그아웃 전까지 활동 시 무기한 유지, F5 새로고침 유지(sessionStorage + GET /api/session 복원; 탭/브라우저 닫힘 시 종료). 편집 lock 의 30분 stale 타임아웃과는 독립.

### 2.7 자주 발생하는 도메인 오해 3종

1. **"Z 권한은 모든 버튼"** — 오해. news.md L62 의 "Z권한은 송고/보류/KILL 버튼이 보이고 사용할 수 있다" 는 *작성 페이지의 3 버튼* 한정. 고침/포털고침/재송 등은 별도 권한 매트릭스를 따른다 (SPEC-NEWS-REVISE-001).
2. **"R 권한 송고 후 상태는 DPS"** — 오해. R 권한이 RDS 를 송고하면 **RDS 유지** (L154). DPS 는 D 권한 송고의 결과 (L157).
3. **"Ctrl+D 는 모든 페이지에서 라인 삭제"** — 오해. 에디터 포커스 한정. `preventDefault` 강제. 비-에디터 컨텍스트에서는 브라우저 기본 동작(북마크 추가)이 그대로 통과해야 한다.

### 2.8 list.do 메뉴 4종 — 상태 필터·컬럼 규약 (Source: news.md L71-86)

| 메뉴 | 조회 조작 | 상태 필터 |
|------|----------|----------|
| 데스크 미송고 (Default) | 진입 즉시 목록 | **RDS, DDH 만** (L80) |
| 부서별 작성 | 부서 Select + 조회버튼. 진입 시 로그인 사용자 부서 기본 선택·자동 조회 (L72) | 해당 부서 작성 기사 중 **DPS·RRH 가 아닌** 기사만 (L73) |
| 부서별 송고 | 부서 드롭다운 + 조회버튼 (L74) | **DPS 만** (L75) |
| 개인별 수정 | 로그인 계정이 작성한 기사 한정 (L76) | **RDS, RRK 만** (L76) |

- 4개 메뉴 모두 목록 컬럼은 **기사아이디 / 제목 / 작성자 / 수정자 / 작성시간 / 수정시간 / 기사상태(status) / LockYN** 8종만 표현 (L81, L84; SPEC-FRONTEND-UI-001 v0.5.0 — 기사상태 컬럼 추가).
- 정렬은 시간 내림차순, 10개씩 페이징 (L84, L86).
- 기사 클릭 시 새 창에서 제목·내용·공통정보 표시 (L85).

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
