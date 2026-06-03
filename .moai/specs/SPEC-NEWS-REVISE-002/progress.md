# Progress — SPEC-NEWS-REVISE-002

> Phase 2 (M1~M5) TDD 진행 로그. tasks.md의 마일스톤 의존성 순서대로 정렬.
> Baseline (2026-06-03): backend `npm test` 132 PASS, frontend `npm run test:web` 224 PASS.

## Iteration log (sorted by task ID / milestone dependency)

- T-M1-001 GREEN: src/db/schema.js — CONTENTS_COLUMNS에 lockYN 추가 + CREATE_CONTENTS DDL에 `lockYN VARCHAR NOT NULL DEFAULT 'N'` 컬럼 + ensureContentsLockYNColumn 헬퍼(ensureUserActiveColumn 패턴 재사용). AC-LOCKYN-1/REQ-SCH-010 GREEN. commit-ready: feat(db): SPEC-NEWS-REVISE-002 M1 — Contents.lockYN 컬럼 + ensureContentsLockYNColumn idempotent helper (REQ-DB-LOCKYN, AC-LOCKYN-1)
- T-M1-002 GREEN: src/models/articleModel.js — Contents INSERT SQL에 lockYN 컬럼/플레이스홀더 추가, data.lockYN ?? 'N' 기본값 적용. findById/query는 SELECT * 자동 포함. AC-LOCKYN-2 GREEN. commit-ready: feat(db): SPEC-NEWS-REVISE-002 M1 — articleModel.insert lockYN 직렬화 (REQ-DB-LOCKYN, AC-LOCKYN-2)
- T-M1-003 GREEN: test/schema.test.js + test/articleService.test.js — deepEqual을 16 컬럼(lockYN 포함)으로 갱신, AC-LOCKYN-1 PRAGMA notnull/dflt_value 단언, AC-LOCKYN-2 INSERT default 'N' 단언, REQ-SCH-010 idempotent ensureContentsLockYNColumn 단언, AC-LOCKYN-3 service-layer round-trip 단언(2건). commit-ready: test(db): SPEC-NEWS-REVISE-002 M1 — Contents.lockYN AC-LOCKYN-1/2/3 회귀 가드 (REQ-DB-LOCKYN, AC-LOCKYN-1/2/3)
- T-M2-001 GREEN: src/db/schema.js — CONTENTS_COLUMNS에 lockerUserId/lockerSessionId/lockedAt(VARCHAR, NULLABLE) 추가 + CREATE_CONTENTS DDL 19 컬럼 + ensureContentsLockerColumns 헬퍼(PRAGMA → per-column ALTER, ensureContentsLockYNColumn 패턴). test/schema.test.js AC-1 deepEqual 19 컬럼(R-CRIT-1 완결) + AC-EDIT-LOCK-1 schema 단언 + REQ-SCH-010 locker idempotence. backend 142→144 PASS. commit-ready: feat(db): SPEC-NEWS-REVISE-002 M2 — Contents locker 3 컬럼 + ensureContentsLockerColumns idempotent helper (REQ-EDIT-LOCK, D2-2, AC-EDIT-LOCK-1)
- T-M4-001 GREEN: web/src/view/articleDetail.js (미커밋 흡수: 1.3rem/1.75rem) + articleDetail.test.js — AC-FONT-1 CSS 룰 정규식 단언(본문 1.75 > 제목 1.3), AC-FONT-3 빈 제목/null/undefined placeholder에서도 폰트 관계 유지 단언, AC-FONT-4 SPEC-NEWS-REVISE-001 분리 구조/aria-label 회귀. articleDetail 테스트 17→20 GREEN. commit-ready: test(detail): SPEC-NEWS-REVISE-002 M4 — 상세보기 본문 폰트 강조 회귀 가드 (REQ-DETAIL-FONT-EMPHASIS, AC-FONT-1/3/4)
- T-M5-001 GREEN: web/src/model/editorContent.js (END_MARKER_BLOCK = END_MARKER, prefix-free) + editorAdapter.js (appendEnd JSDoc 동기) + useWriteController.js (주석 동기) + editorContent.test.js (AC-ENDMARK-1/2 단언 갱신 + legacy 호환 가드) + editorAdapter.test.js (AC-ENDMARK-1/2 + legacy "\n (끝)" no-op 케이스 추가) + editorColoring.test.js (AC-ENDMARK-3 새 form 단언 + legacy 백워드 호환 보존) + WritePage.test.jsx (AC-ENDMARK-1/2/3 갱신 + AC-CTRL-D-5 단언 동기) + SPEC-NEWS-REVISE-001 acceptance.md/spec.md AC-CTRL-D-5 단언 문자열 갱신 (AC-ENDMARK-4 정합). frontend 224→228 PASS. commit-ready: feat(editor): SPEC-NEWS-REVISE-002 M5 — Alt+Y "(끝)" prefix-free 단순화 (REQ-EDITOR-END-MARKER, AC-ENDMARK-1/2/3/4)
- T-M5-002 GREEN: web/src/model/editorContent.js (removeEmbedAt 순수 함수: 0-based ordinal, 인접 보존, 방어적 OOR no-op) + editorAdapter.js (removeEmbed(index) 어댑터 메서드) + useWriteController.js (removeEmbed 콜백 노출) + editorContent.test.js (AC-EMB-DEL-1/2/3 + OOR 4건) + editorAdapter.test.js (AC-EMB-DEL-3 markup round-trip) + useWriteController.test.jsx (AC-EMB-DEL-1/3 컨트롤러 seam). frontend 228→234 PASS. commit-ready: feat(editor): SPEC-NEWS-REVISE-002 M5 — removeEmbedAt 모델 + adapter.removeEmbed 어댑터 (REQ-EMBED-DELETE, AC-EMB-DEL-1/2/3)
- T-M5-004 GREEN: test/mediaSearch.test.js + test/articleService.test.js — AC-SEARCH-1 (Youtube success → Google noop), AC-SEARCH-2 (D2-8=B HTTP-fail OR empty 둘 다 Google fallback 두 경로 단언), AC-SEARCH-3 (글기사 탭 articleService.searchArticles 내부 LIKE 검색 + 임베딩 카드 형태), AC-SEARCH-4 (NFR-SEC: SECRET 키 비노출 회귀). **mediaSearch.js production 변경 없음 — 회귀 가드만**. backend 138→142 PASS. commit-ready: test(media): SPEC-NEWS-REVISE-002 M5 — mediaSearch + searchArticles 회귀 가드 (REQ-SEARCH-YOUTUBE-API, AC-SEARCH-1/2/3/4)

## 사이클 정정사항 (2026-06-04 외부 reset 이후 재실행)

> 본 위임 진행 도중 외부 작업에 의해 backend / frontend 코드 + SPEC 파일들이 baseline (132/224 PASS)으로 한 차례 reset 되었음.
> baseline 자체도 frontend 224 → 223 으로 변화 (외부 작업으로 인한 기준 변동).
> 본 위임은 reset 후 가능한 모든 task를 재실행하여 다음을 다시 GREEN으로 회복함.
> 또한 reset 전에는 적용 못한 T-M2-002/003, T-M3-001 도 함께 적용함.

### 최종 상태 (post-reset 재실행 후)

- backend `npm test`: **151 PASS** (baseline 132 → +19)
- frontend `npm run test:web`: **233 PASS** (baseline 223 → +10)
- `npm run build`: 무경고

### 재실행으로 GREEN 회복한 작업

- T-M1-001/002/003 (lockYN 컬럼 + 모델 + 회귀 가드) — 재실행 후 GREEN
- T-M2-001 (locker 3 컬럼) — 재실행 후 GREEN
- T-M4-001 (articleDetail 폰트 강조) — 재실행 후 GREEN (articleDetail.js production 1.3rem / 1.75rem 적용)
- T-M5-001 (Alt+Y "(끝)" 단순화) — 재실행 후 GREEN, SPEC-001 acceptance.md / spec.md AC-CTRL-D-5 단언 문자열 재동기 갱신
- T-M5-002 (removeEmbedAt 모델 + adapter.removeEmbed) — 재실행 후 GREEN
- T-M5-004 (mediaSearch 회귀 가드 + searchArticles 단언) — 재실행 후 GREEN

### 추가 적용 (reset 이전 토큰 예산 미도달 task 일부)

- T-M2-002 GREEN: src/services/articleService.js — acquireEditLock(articleId, {userId, sessionId, now, timeoutMs}) 신규. race-safe 단일 SQL UPDATE ... WHERE lockYN='N' OR lockedAt < ?, info.changes 판정. D2-3 = 30분 좀비 timeout 자동 해제, D2-5 = A 엄격(동일 user 다른 session 거부 + 동일 session 재진입은 idempotent refresh). EDIT_LOCK_TIMEOUT_MS 상수 export. test/articleService.test.js AC-EDIT-LOCK-1/2/3/5/7 단언 GREEN. commit-ready: feat(backend): SPEC-NEWS-REVISE-002 M2 — articleService.acquireEditLock 락 서비스 (REQ-EDIT-LOCK, D2-3, D2-5, AC-EDIT-LOCK-1/2/3/5/7)
- T-M2-003 GREEN: src/services/articleService.js — releaseEditLock(articleId, {userId, sessionId}) + assertLockHolder(articleId, {userId, sessionId, now, timeoutMs}) 신규. 보유자 검증, idempotent release, stale lock = released 처리. AC-EDIT-LOCK-3/6 GREEN. commit-ready: feat(backend): SPEC-NEWS-REVISE-002 M2 — releaseEditLock + assertLockHolder strict holder check (REQ-EDIT-LOCK, AC-EDIT-LOCK-3/6)
- T-M3-001 GREEN: src/services/articleService.js — update(articleId, fields) 신규. D2-7 = A 부분 업데이트 (Article markupVersion/title/content/modifier + Contents 명시 필드만 UPDATE, lockYN/locker 컬럼 미접근). lifecycle TRANSITIONS 표 변경 없음 회귀 보장. test/articleService.test.js AC-API-2/5 GREEN (region 미지원 컬럼 사례 → department로 단언 정합 수정). commit-ready: feat(backend): SPEC-NEWS-REVISE-002 M3 — articleService.update 부분 업데이트 (REQ-API-INSERT-UPDATE-SPLIT, D2-7, AC-API-2/3/5)

### 본 위임에서 *미완료* — 사용자/후속 위임 책임

- T-M2-004 MISSED: server/index.js `POST/DELETE /api/articles/:id/lock` 엔드포인트 + web/src/model/contract.js MODEL_KEYS에 `acquireEditLock`/`releaseEditLock` 추가 + httpModel 두 메서드 구현 (해제는 `navigator.sendBeacon`과 호환되는 페이로드). 세션에서 userId/sessionId 추출, 클라이언트 사칭 금지 NFR-SEC 가드.
- T-M2-005 MISSED: web/src/controller/useWriteController.js editArticleId useEffect에서 model.acquireEditLock 호출 + cleanup에서 releaseEditLock + module 마운트 시 beforeunload / visibilitychange:hidden 리스너 → sendBeacon(D2-4=C). WritePage.jsx에 lockError 발생 시 ALERT(blocking) + inline 배너(aria-live="assertive") 동시 표시(D2-1=C) + 편집 영역 비활성화.
- T-M3-002 MISSED (R-CRIT-2): server/index.js PUT `/api/articles/:id` 핸들러를 `controllers.article.create` → `controllers.article.update`로 분기 + controllers/index.js article.update 노출 + 락 보유자 자동 검증(assertLockHolder).
- T-M3-003 MISSED: useWriteController.submitAction 컨텍스트 분기를 model.saveArticle 단일 진입점에서 명시적 articleInsert/articleUpdate 호출 분기로 정렬. (현재 model.httpModel.saveArticle은 articleId === 'A-DRAFT' → POST, 아니면 PUT으로 *전송 레벨*에서 분기하고 있음. SPEC 의도는 *컨트롤러* 레벨에서도 분기를 명시화하는 것.)
- T-M5-003 MISSED: web/src/view/InlineEmbed.jsx에 × 어포던스 button(hover/focus 시 표시, `aria-label="임베드 삭제"`) + `onDelete` prop. WritePage.jsx BodyEditor onKeyDown에 임베드 노드 focus 상태 Backspace 핸들러(D2-6=C × 버튼 + Backspace 둘 다). 인접 보존(AC-EMB-DEL-2) + SPEC-NEWS-REVISE-001 AC-EMB-1~3 회귀 가드(AC-EMB-DEL-4) + 접근성(AC-EMB-DEL-5).

위 미완 task들은 모델/어댑터/컨트롤러 seam(useWriteController.removeEmbed, adapter.removeEmbed, articleService.acquire/release/assert/update)이 이미 GREEN이므로, 후속 위임에서 *UI 노출 + 라우트 와이어링*만 추가하면 완결된다. T-M6 통합 회귀와 T-M7 Slack 보고는 본 위임 범위 밖 (manager-git / MoAI 오케스트레이터 책임).

