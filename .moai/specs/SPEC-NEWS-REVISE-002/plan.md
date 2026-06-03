---
id: SPEC-NEWS-REVISE-002
artifact: plan
version: 0.1.0
created: 2026-06-02
updated: 2026-06-02
---

# Plan — SPEC-NEWS-REVISE-002

## 1. 구현 접근 (Implementation Approach)

본 SPEC은 **Brownfield Δ-only**이다. 기존 SPEC 6종(NEWS-REVISE-001, DB-FOUNDATION-001, BACKEND-CORE-001, FRONTEND-UI-001, UI-EDITOR-001, AUTH-001)의 계약을 침범하지 않고, `news.md` / `ContentsVO.md`의 2차 개정에 정합하도록 7개 REQ만 추가/보강한다.

전략 원칙:

- TDD RED-GREEN-REFACTOR 사이클 적용 (현재 발견된 부분 GREEN 자산 — `articleDetail.js`/`articleDetail.test.js` — 은 GREEN을 유지한 채 AC 가드만 추가)
- 백엔드(`src/`)와 프론트엔드(`web/src/`) 두 영역 모두 변경되므로 우선순위는 데이터 계층(스키마) → 서비스 계층(락) → API 분기 → UI 보강 순
- 디자인 토큰은 *추가 없이* 재사용 (`--yh-blue`, `--yh-gray-line`, `--yh-serif`, `--yh-sans` 등)
- DB 삭제 금지(CLAUDE.md HARD): 락 컬럼 추가는 신규 DDL(`CREATE TABLE IF NOT EXISTS`) 또는 idempotent `ALTER TABLE ADD COLUMN`만 허용
- 인코딩 UTF-8 강제 (모든 신규 파일)

---

## 2. 마일스톤 (Priority-based, No Time Estimates)

### M0 — 준비 (Priority: High)

- spec.md / plan.md / acceptance.md 사용자 승인 (annotation cycle)
- Pending Decisions(D2-1 ~ D2-7) 잠금
- 기존 테스트 베이스라인 캡처 (`npm test -- --run`)
- SPEC-NEWS-REVISE-001 잔여 항목 종결 상태 확인 (M3 임베드 모델 / D-7 IME 회귀 GREEN 유지)

### M1 — REQ-DB-LOCKYN (Priority: High)

- `src/db/schema.js`
  - `CONTENTS_COLUMNS` Object.freeze 배열에 `'lockYN'` 추가 (locker 컬럼 추가 여부는 D2-2 결정 후)
  - `CREATE_CONTENTS` DDL에 `lockYN VARCHAR NOT NULL DEFAULT 'N'` 추가
  - 기존 `Contents` 테이블이 있는 환경 호환을 위해 `ensureContentsLockYNColumn(db)` 헬퍼(PRAGMA table_info 체크 후 ALTER) — `ensureUserActiveColumn`과 동일 패턴
- `src/models/articleModel.js`
  - `insert`의 SQL 컬럼/플레이스홀더에 `lockYN` 추가, default `'N'`
  - `findById` / `query` / `searchByText`는 `SELECT *`이므로 자동 포함
- `ContentsVO.md` 미커밋 변경 흡수 (사용자 변경 그대로 commit)
- 단위 테스트: schema GREEN, insert/findById/query round-trip GREEN

### M2 — REQ-EDIT-LOCK (Priority: High)

- M2.1 (백엔드) `src/services/articleService.js`:
  - `acquireEditLock(articleId, { userId, sessionId, now })` → SQLite `UPDATE Contents SET lockYN='Y', lockerUserId=?, lockerSessionId=?, lockedAt=? WHERE articleId=? AND lockYN='N'` 단일 트랜잭션; affected rows === 1이면 성공, 아니면 충돌
  - 좀비 락 해제(timeout 30분, D2-3): UPDATE의 WHERE에 `(lockYN='N' OR lockedAt < ?)` 추가 옵션
  - `releaseEditLock(articleId, { userId, sessionId })` → 보유자 검증 후 `lockYN='N'`
  - `assertLockHolder(articleId, { userId, sessionId })` → `applyAction` 진입점에서 호출
- M2.2 (백엔드) API 라우터:
  - `POST /api/article/:id/lock` / `DELETE /api/article/:id/lock` 신규 (또는 기존 라우터 확장)
  - `applyAction` 라우트가 호출 시 `assertLockHolder` 자동 통과 검증
- M2.3 (프론트엔드) `web/src/controller/useWriteController.js`:
  - `useEffect`에서 `editArticleId` 보유 시 `acquireEditLock` 호출 → 성공/실패 반환
  - 실패 시 `lockError` 상태 설정 (UI 차단)
  - cleanup에서 `releaseEditLock` 호출
  - 모듈 로드 시 `beforeunload` / `visibilitychange:hidden` 리스너 등록 → `navigator.sendBeacon('/api/article/:id/lock/release', payload)` (D2-4 결정에 따라 채널 단일/이중)
- M2.4 (프론트엔드) `web/src/view/WritePage.jsx`:
  - `lockError` 상태일 때 ALERT 또는 inline 안내 표시 + 편집 영역 비활성화
- 통합 테스트: 두 세션 동시 진입 → 한 쪽만 성공, 해제 후 재획득 GREEN

### M3 — REQ-API-INSERT-UPDATE-SPLIT (Priority: High)

- `web/src/controller/useWriteController.js`
  - `submitAction`에서 컨텍스트 판정:
    - 신규 작성: `articleId === 'A-DRAFT'` (또는 초기값) → `model.articleInsert(dto)` 호출
    - 편집: `articleId !== 'A-DRAFT'` (또는 `editArticleId` 보유) → `model.articleUpdate(articleId, dto)` 호출
  - 두 호출 모두 후속으로 `model.applyAction(id, role, action)` (lifecycle 전이)
- `web/src/model/` (또는 `app/context.js`의 모델 어댑터)에 `articleInsert` / `articleUpdate` 별도 메서드 노출. (기존 `saveArticle`이 통합 함수였다면 분리.)
- 백엔드는 이미 `articleService.create` (insert) / `articleService.applyAction` (update lifecycle)이 존재; `articleUpdate`가 markupVersion/Contents 필드 갱신까지 포함하는지는 D2-6 결정
- 단위 테스트: `useWriteController.test.jsx`에 두 시나리오 추가, mock 모델로 호출 메서드 검증

### M4 — REQ-DETAIL-FONT-EMPHASIS (Priority: Medium)

- `web/src/view/articleDetail.js`: 미커밋 작업트리 변경(이미 1.3rem / 1.75rem)을 그대로 흡수
- `web/src/view/articleDetail.test.js`:
  - 기존 미커밋 단언("본문 폰트 사이즈가 제목 폰트 사이즈보다 크다") 유지
  - 추가 케이스 — 빈 제목(placeholder `(제목 없음)`) 시에도 본문 폰트 > 제목 폰트 유지
  - SPEC-NEWS-REVISE-001 AC-DTL-1~6 회귀 확인 (이미 통과 중)
- CSS 파싱 fallback: jsdom은 `getComputedStyle`의 rem→px 환산이 제한적 → 본 SPEC은 *CSS 룰 파싱(정규식 또는 `CSSStyleSheet.cssRules`)* 으로 contentSize > titleSize 단언을 우선 채택

### M5 — REQ-EDITOR-END-MARKER + REQ-EMBED-DELETE + REQ-SEARCH-YOUTUBE-API (Priority: Low/Medium 묶음)

- M5.1 Alt+Y "(끝)" 단순화 (Priority: Low)
  - adapter `appendEnd` 또는 `editorShortcuts` 모듈에서 삽입 문자열을 `"(끝)"`로 변경
  - 골드색 데이터 속성 유지
  - 중복 삽입 검사 로직: 본문 텍스트 끝이 정확히 `"(끝)"`로 끝나면 noop
  - SPEC-NEWS-REVISE-001 AC-CTRL-D-5 단언 갱신: 단언 문자열을 `"\r\n (끝)"` → `"(끝)"` 로 (acceptance 동기화는 SPEC-NEWS-REVISE-002 acceptance.md §5 AC-ENDMARK-4에서 명시)
- M5.2 임베드 노드 삭제 (Priority: Medium)
  - `web/src/view/InlineEmbed.jsx`: hover/focus 시 표시되는 × 버튼 추가 (D2-5: 둘 다 허용)
  - `onDelete` prop 도입; `useWriteController` 또는 adapter에 `removeEmbed(embedId)` 메서드 추가
  - 키보드 Backspace 시: 임베드 노드가 focus를 가진 상태이면 `onDelete` 호출, contentEditable 영역 안에서 임베드 직전 캐럿 + Backspace 케이스의 정책은 Pending Decision (기본: 임베드 노드 선택 상태에서만 삭제)
  - `getMarkup` 직렬화에서 삭제된 노드가 영구 제거되는지 round-trip 테스트
- M5.3 미디어 검색 회귀 가드 (Priority: Low)
  - `src/services/mediaSearch.test.js` (또는 동등): Youtube provider success/fail mock + Google fallback 호출 단언, 글기사 검색은 `articleService.searchArticles` 호출 단언
  - 기존 `mediaSearch.js`는 변경 없음 (회귀 가드만)

### M6 — 통합 회귀 (Priority: High)

- `npm test` 전체 통과
- `npm run build` 무경고
- TRUST 5 self-check (Tested ≥ 85% / Readable / Unified / Secured / Trackable)
- SPEC-NEWS-REVISE-001 AC 회귀 전체 GREEN 재확인 (AC-CTRL-D-5의 단언 문자열은 본 SPEC에서 갱신됨)

### M7 — Sync 및 Slack 보고 (Priority: Medium)

- `/moai sync SPEC-NEWS-REVISE-002`
- `news.md` / `ContentsVO.md` / SPEC-NEWS-REVISE-002 정합 확인 (lifecycle: spec-anchored)
- Slack `tech-day` 채널(ID `C0B69CG59UM`)에 작업 완료 보고 (CLAUDE.md HARD 규칙)
- 본 SPEC의 commit 메시지에 `SPEC-NEWS-REVISE-002` 및 REQ-* ID 포함

---

## 3. 기술 접근 (Technical Approach)

### 3.1 REQ-DB-LOCKYN

- `Contents` 테이블 컬럼은 모두 varchar (ContentsVO.md "타입" 절). `lockYN`은 `VARCHAR NOT NULL DEFAULT 'N'`로 선언하여 의미값 `'Y'`/`'N'` 두 가지로 제한 (애플리케이션 레이어 검증).
- `ensureContentsLockYNColumn(db)` 헬퍼는 기존 DB(테스트가 매 실행 재생성하지만 운영 호환을 위해)를 위해 PRAGMA → ALTER 패턴을 사용 (`ensureUserActiveColumn` 동일 형식).
- 직렬화: `articleModel.insert`가 받는 데이터 객체에 `lockYN` 필드가 없으면 default `'N'` 적용 (SQL DEFAULT 또는 JS 기본값).
- `findById` / `query` 결과의 행 객체에 `lockYN` 키가 포함된다.

### 3.2 REQ-EDIT-LOCK

- 락 컬럼: `lockYN`, `lockerUserId`, `lockerSessionId`, `lockedAt` (locker 컬럼 추가 여부는 D2-2 결정. 본 plan은 *추가* 기본값 채택)
- 단일 SQL로 race-safe 획득:
  - `UPDATE Contents SET lockYN='Y', lockerUserId=?, lockerSessionId=?, lockedAt=? WHERE articleId=? AND (lockYN='N' OR lockedAt < ?)` — SQLite의 atomic UPDATE 보장
  - 결과 `info.changes === 1` → 성공, `=== 0` → 충돌 (다른 사용자 보유 중)
- 해제: `UPDATE Contents SET lockYN='N', lockerUserId=NULL, lockerSessionId=NULL, lockedAt=NULL WHERE articleId=? AND lockerUserId=? AND lockerSessionId=?`
- 좀비 락 timeout: 기본 30분(D2-3). 획득 시 WHERE에 `lockedAt < (now - 30min)` 자동 통과 절 포함.
- 클라이언트 cleanup:
  - `useEffect` cleanup에서 `releaseEditLock` (정상 종료)
  - `beforeunload` / `visibilitychange:hidden` 리스너에서 `navigator.sendBeacon` (브라우저 닫힘/탭 닫힘)
  - 두 채널 모두 동일 endpoint 호출 → 백엔드는 idempotent 해제

### 3.3 REQ-API-INSERT-UPDATE-SPLIT

- `useWriteController.submitAction` 의사 코드(문장형): 사용자가 송고/보류/KILL을 누르면 (a) 제목 검증 → (b) 컨텍스트 판정 (`articleId === 'A-DRAFT'`이면 신규, 아니면 편집) → (c) 신규면 `model.articleInsert(dto)` 호출하여 새 articleId 획득 + lifecycle 전이, 편집이면 `model.articleUpdate(articleId, dto)` 호출 + lifecycle 전이.
- 기존 `saveArticle` 단일 진입점은 두 동작을 자동 분기했을 수 있음. 본 plan은 *명시적 분기*를 요구하여 호출 메서드 자체로 의도가 드러나도록 한다.
- 백엔드 API 라우트는 분리할 수도, `articleService` 메서드 시그니처를 분리할 수도 있음 (D2-6 결정).
- KILL은 편집 컨텍스트에서만 호출되며 항상 `articleUpdate`.

### 3.4 REQ-DETAIL-FONT-EMPHASIS

- 미커밋 작업트리의 변경값(`.yh-detail__title 1.3rem`, `.yh-detail__content 1.75rem`)을 본 SPEC이 정식으로 흡수.
- 테스트 단언 방식:
  - 1차: CSS 룰 텍스트에서 `font-size: X.Xrem` 정규식 매칭 후 숫자 비교 (jsdom 호환).
  - 2차(선택): `getComputedStyle`로 px 단위 비교 (jsdom 환산 신뢰도 낮으므로 1차 우선).
- 빈 제목 케이스: `(제목 없음)` 플레이스홀더가 들어가도 폰트 사이즈 관계는 CSS 클래스 기반이므로 유지된다 (별도 분기 없음).

### 3.5 REQ-EDITOR-END-MARKER

- adapter의 `appendEnd` (또는 `editorShortcuts.handleAltY`) 구현에서 삽입 문자열을 정확히 `"(끝)"`로 변경.
- 중복 검사: 본문 텍스트의 끝 N글자 (`N = '(끝)'.length`)가 정확히 `"(끝)"`이면 noop.
- 골드색: 기존 데이터 속성/CSS 클래스 유지 (`data-end-marker="true"` 또는 동등).
- SPEC-NEWS-REVISE-001 AC-CTRL-D-5는 acceptance.md 문서 갱신만 필요 (테스트 코드의 단언 문자열을 `"(끝)"`로 변경; 본 SPEC AC-ENDMARK-4에서 명시).

### 3.6 REQ-EMBED-DELETE

- `InlineEmbed.jsx`에 `onDelete: () => void` prop 도입.
- × 어포던스: hover/focus 시 표시되는 button 노드 (`aria-label="임베드 삭제"`).
- 키보드 Backspace: 임베드 노드가 focus를 가진 상태에서 Backspace → `onDelete` 호출.
- adapter 측에 `removeEmbed(embedId)` 메서드 추가 — 인접 텍스트/임베드는 그대로 보존하고 해당 노드만 제거 + `markupVersion` 재직렬화.
- round-trip 가드: `removeEmbed` 후 `getMarkup` → `setMarkup` → `getStructure().embeds.length === before - 1`.

### 3.7 REQ-SEARCH-YOUTUBE-API

- 기존 `src/services/mediaSearch.js`는 이미 Youtube-first / Google-fallback 구조 (`defaultYoutubeProvider`, `defaultGoogleProvider`, `safeSearch`)로 작성됨.
- 본 SPEC은 EARS 잠금 + 회귀 가드만 도입:
  - mock provider로 Youtube success → Google 미호출
  - mock provider로 Youtube fail → Google fallback 호출
  - 응답 페이로드에 API 키 미포함 (`normalize` 결과 검증)
- 글기사 탭: `articleService.searchArticles(query)` 호출 → title/content LIKE 검색 결과를 임베딩 카드 형태로 정규화. 기존 `model.searchByText`를 사용.

---

## 4. 의존성 (Dependencies)

### 4.1 기존 SPEC

- SPEC-NEWS-REVISE-001 (직전 차수, M0~M3 Decision Lock D-1~D-7 적용)
- SPEC-DB-FOUNDATION-001 (Contents 스키마)
- SPEC-BACKEND-CORE-001 (articleService / lifecycle)
- SPEC-FRONTEND-UI-001 (4탭 60:40, 우상단 사용자 정보, 우클릭 컨텍스트 메뉴)
- SPEC-UI-EDITOR-001 (어댑터 계약, markupVersion)
- SPEC-AUTH-001 (R/D/Z 권한, 세션 sessionId 제공)

### 4.2 라이브러리/환경

- NodeJS ≥ 22.5.0, ESM, `node:sqlite` (이미 설치)
- React 19, Vite 7, Vitest ^3.2.4, jsdom (이미 설치)
- 브라우저 API: `navigator.sendBeacon`, `beforeunload`, `visibilitychange` (모든 모던 브라우저)
- `YOUTUBE_API_KEY`, `GOOGLE_API_KEY` 환경변수 (운영시; 테스트는 mock provider)

---

## 5. Pending Decisions (사용자 승인 필요 항목)

| ID | 결정 항목 | 옵션 | 본 SPEC의 추정 기본값 |
|----|----------|------|----------------------|
| **D2-1** | 락 충돌 시 UX | (A) ALERT(blocking modal) / (B) inline 배너 + 편집 비활성화 / (C) 둘 다 | (C) 둘 다 — ALERT는 진입 거부 즉시, inline 배너는 페이지에 잔존 (Pending) |
| **D2-2** | 락 보유자 식별 컬럼 추가 여부 | (A) `lockerUserId`+`lockerSessionId`+`lockedAt` 신규 컬럼 / (B) `lockYN`만 추가 (보유자는 별도 인메모리 맵) | (A) 신규 컬럼 — 단일 SQLite 환경에서 race-safe 단일 SQL 획득을 가능케 함 |
| **D2-3** | 좀비 락 자동 해제 timeout | (A) 30분 / (B) 15분 / (C) 비활성화 | (A) 30분 — 일반 편집 세션 길이와 정합 |
| **D2-4** | 브라우저 닫힘 감지 채널 | (A) `beforeunload` 단일 / (B) `visibilitychange:hidden` 단일 / (C) 두 채널 모두 `sendBeacon` | (C) 두 채널 모두 — 모바일 Safari `beforeunload` 비신뢰성 보완 |
| **D2-5** | 동일 사용자 동일 세션 다른 페이지 재진입 허용 여부 | (A) 거부(엄격) / (B) 허용(동일 세션 인정) | (A) 거부 — `news.md` "한 페이지에서만 가능" 문구를 엄격 해석 |
| **D2-6** | 임베드 삭제 UX | (A) × 버튼만 / (B) Backspace만 / (C) 둘 다 | (C) 둘 다 — 마우스/키보드 모두 지원 |
| **D2-7** | `articleUpdate`가 갱신하는 컬럼 범위 | (A) markupVersion + 변경된 Contents 필드 / (B) markupVersion만 / (C) 모든 Contents 필드 overwrite | (A) markupVersion + 변경된 Contents — 부분 업데이트 (Pending; 기존 `articleService` 구현 확인 필요) |
| **D2-8** | Youtube API 실패 판정 기준 | (A) HTTP 비-2xx만 / (B) HTTP + 빈 결과(`items === []`) 둘 다 fallback / (C) 네트워크 오류만 | (A) HTTP 비-2xx만 — 기존 `defaultYoutubeProvider`가 `res.ok === false`에 throw하는 동작 유지 |

---

## 6. 위험 (Risks)

위험 표는 spec.md §9에 정리되어 있다. 추가로 plan 단계 위험:

- **R-PLAN-1**: 미커밋 작업트리(`articleDetail.js`/`articleDetail.test.js`)가 본 SPEC의 REQ-DETAIL-FONT-EMPHASIS의 부분 GREEN이지만, M0 진입 전에 별도 commit으로 정리되지 않으면 Run 단계에서 의도와 충돌 가능. → M0의 첫 작업으로 작업트리 정리 결정 (사용자 권한).
- **R-PLAN-2**: SPEC-NEWS-REVISE-001 AC-CTRL-D-5의 단언 문자열 갱신이 누락되면 본 SPEC의 REQ-EDITOR-END-MARKER와 회귀 충돌. → 본 SPEC의 M5.1에서 명시적으로 갱신 명세화.
- **R-PLAN-3**: 락 컬럼 추가가 SPEC-DB-FOUNDATION-001 `CONTENTS_COLUMNS` Object.freeze 배열 변경을 요구 → 그 SPEC의 회귀 테스트가 컬럼 수를 단언한다면 깨짐. → 본 SPEC이 명시적으로 *추가만 허용* 명세화 + Run 단계에서 회귀 테스트 갱신 동반.
- **R-PLAN-4**: 백엔드 API 라우트 구조가 본 작업트리에서 확인되지 않음 (server entry point 미확인). → Run 단계 진입 전 `src/server/` 또는 동등 라우트 위치 확인 필요. 미존재 시 본 SPEC은 articleService 메서드 시그니처 분리 + 라우트 추가를 동시에 처리.

---

## 7. 출력물 (Deliverables)

- `src/db/schema.js` (수정 — `lockYN` 컬럼 + ensure helper)
- `src/models/articleModel.js` (수정 — insert에 `lockYN`)
- `src/services/articleService.js` (확장 — `acquireEditLock` / `releaseEditLock` / `assertLockHolder`)
- 백엔드 락 라우트 (신규 또는 기존 라우터 확장)
- `web/src/controller/useWriteController.js` (수정 — 락 통합 + Insert/Update 분기 + beforeunload)
- `web/src/view/WritePage.jsx` (수정 — 락 거부 안내)
- `web/src/view/articleDetail.js` (미커밋 변경 흡수만)
- `web/src/view/articleDetail.test.js` (확장 — AC-FONT-1~4)
- `web/src/view/InlineEmbed.jsx` (확장 — 삭제 어포던스 + onDelete)
- `web/src/view/editorShortcuts.js` 또는 adapter (수정 — Alt+Y `"(끝)"` 단순화)
- `web/src/view/editorAdapter.js` (확장 — `removeEmbed` 시그니처)
- 신규/확장 단위/통합 테스트 (다수)
- `news.md` / `ContentsVO.md` 미커밋 변경 commit
- Slack `tech-day` 채널 작업 완료 보고 (CLAUDE.md HARD 규칙)

---

Version: 0.1.0
