---
id: SPEC-NEWS-REVISE-014
version: 0.1.0
status: Plan
created: 2026-06-10
updated: 2026-06-10
author: manager-spec
priority: high
issue_number: 0
---

# SPEC-NEWS-REVISE-014 — 구현 계획 (Implementation Plan)

## HISTORY

- 2026-06-10 (v0.1.0): 최초 작성. spec.md REQ-UNLOCK-CONFIRM / -DB / REQ-EDITOR-AUTOCLOSE /
  REQ-SSE-FORCED-FLAG / REGRESSION-GUARD 에 대한 구현 접근·마일스톤·리스크 정의. 사용자 직접 요청
  (2026-06-10 verbatim) + 종료 UX 결정(2026-06-10 AskUserQuestion 승인) 흡수. DB 강제 해제는
  SPEC-NEWS-REVISE-012 에서 구현 완료이므로 본 계획은 Δ(확인창 + 자동 종료 + forced 플래그)만 다룬다.
  (manager-spec)

---

## 1. 기술 접근 (Technical Approach)

### 1.1 핵심 결정 — Δ-only, SPEC-012 경로 재사용

DB 강제 해제(`forceReleaseEditLock` / `POST /force-unlock` / `forceUnlockArticle`)는 SPEC-012 에서 구현 완료다
(`src/services/articleService.js:172-183`, `server/index.js:364-383`, `web/src/model/httpModel.js:240`). 본 SPEC 은
새 백엔드 경로를 만들지 않고 다음 세 Δ 만 추가한다:
1. list.do "Lock해제" 클릭에 `window.confirm` 선행.
2. 강제 해제 SSE payload 에 `forced:true` 플래그.
3. WritePage 가 자기 기사의 `forced:true` 프레임을 SSE 구독으로 감지 → alert + 편집 탭 종료.

### 1.2 프론트 — Lock해제 확인창 (REQ-UNLOCK-CONFIRM)

`web/src/view/ViewPage.jsx` `buildForceUnlockItem` 의 활성 분기를 확인창 선행으로 바꾼다:
```
if (role === 'D' || role === 'Z') {
  return {
    label: 'Lock해제',
    onSelect: () => {
      if (window.confirm('Lock해제하시겠습니까?')) onForceUnlock(article.articleId);
    },
  };
}
```
- 취소 시 `onForceUnlock` 미호출(= DB/SSE 무변동).
- R 비활성 항목(`{...DISABLED}`)은 SPEC-012 대로 `onSelect` 자체가 없어 클릭 무동작 → 확인창도 안 뜬다(불변).
- 기존 송고/보류/KILL 의 `window.confirm` 패턴(`WritePage.jsx:882,...`)과 동일 메커니즘 — 새 모달 없음.

### 1.3 서버 — SSE forced 플래그 (REQ-SSE-FORCED-FLAG)

`server/index.js` force-unlock 라우트의 발행 한 줄을 확장한다:
```
bus.emit('change', { type: 'unlock', articleId, forced: true });
```
- 키 추가만 — 기존 `type`/`articleId` 불변(ViewPage 재조회 트리거 무영향, 하위호환).
- 정상 해제 이벤트(있다면)에는 `forced` 를 싣지 않는다 → 클라이언트가 강제/정상 구분.

### 1.4 프론트 — WritePage SSE 구독 + 자동 종료 (REQ-EDITOR-AUTOCLOSE)

편집 잠금을 보유한 동안에만 SSE 를 구독한다. `useWriteController.js`(잠금 effect 가 있는 곳, `:245-283`) 또는
`WritePage.jsx` 에 effect 를 추가한다:
```
useEffect(() => {
  if (!editArticleId) return undefined;            // 초안 탭(잠금 없음)은 구독 안 함 (AC-CLOSE-3)
  let closed = false;                              // 멱등 가드 (AC-CLOSE-5)
  const sub = model.subscribe(undefined, (payload) => {
    if (closed) return;
    if (payload?.type !== 'unlock') return;
    if (!payload.forced) return;                   // 자기/정상 해제 무시 (AC-CLOSE-4)
    if (payload.articleId !== editArticleId) return; // 다른 기사 무시 (AC-CLOSE-2)
    closed = true;
    window.alert('Lock이 해제되어 편집을 종료합니다'); // 정확히 1회 (AC-CLOSE-1/5)
    onForceClosed?.();                              // 탭 종료 → 저장 안 한 변경분 폐기 (AC-CLOSE-6)
  });
  return () => sub.unsubscribe();                   // unmount 정리 (NFR 6.2)
}, [editArticleId, model, onForceClosed]);
```
- 자기 시작 release(송고/보류/KILL/정상 탭 닫기)는 `forced:true` 가 아니므로 통과하지 않는다(AC-CLOSE-4).
- 구현 위치는 `model` 접근이 깔끔한 쪽(controller 권장)을 택한다 — `acquiredLockRef` 와 같은 effect 군에 둔다.

### 1.5 프론트 — WriteWorkspace 강제 종료 배선 (REQ-EDITOR-AUTOCLOSE)

`WriteWorkspace.jsx` 에서 강제 종료 콜백을 탭별로 주입한다. 기존 `closeTab(tabId)`(탭 닫기 + 초안 폐기,
`:174-191`)을 재사용한다:
```
<WritePage
  ...
  onForceClosed={() => closeTab(t.id)}   // 강제 해제 → 그 편집 탭을 닫는다(남은 탭/새 기사 탭 전환)
/>
```
- `closeTab` 은 마지막 탭이면 빈 '새 기사' 탭을 유지하고, 남은 탭이 있으면 그쪽으로 active 를 옮긴다 → spec
  의 "남은 탭 / 새 기사 탭 전환" 요구 충족.
- `closeTab` 이 `removeStoredDraft` 로 초안을 폐기하고, WritePage unmount 로 에디터 상태가 사라져 저장 안 한
  변경분이 폐기된다(AC-CLOSE-6). 별도 저장 시도 없음.
- (대안) `endEditContext` 는 탭을 '새 기사'로 전환만 하므로, "화면을 자동으로 닫는다"는 사용자 요구에는
  `closeTab` 이 더 직접적이다. Run 단계에서 기존 테스트와 정합되는 쪽 확정.

### 1.6 정합 (코드 변경 없음 — 회귀 확인)

REQ-UNLOCK-DB 는 SPEC-012 의 DB 경로가 확인창 추가 후에도 동일하게 LockYN='N' 을 만든다는 회귀 확인만 한다
(새 코드 없음). 자기 해제 경로(`endEditContext`/`closeTab` 정상 호출)는 SSE forced 가드로 자연히 제외된다.

---

## 2. 마일스톤 (Milestones — 우선순위 기반, 시간 추정 없음)

### M1 (Priority High) — 확인창 + SSE forced 플래그
- `ViewPage.jsx` `buildForceUnlockItem` 활성 분기에 `window.confirm('Lock해제하시겠습니까?')` 선행.
- `server/index.js` force-unlock 발행에 `forced:true` 추가.
- 대응 테스트: `web/src/view/ViewPage.forceUnlock.test.jsx`(확인창 수락/취소/R), `test/forceUnlock.test.js`
  또는 `test/serverAuthWiring.test.js`(SSE forced payload).
- 충족 AC: AC-CONFIRM-1~4, AC-SSE-1~2, AC-DB-1.

### M2 (Priority High) — WritePage 자동 종료
- `useWriteController.js`(또는 `WritePage.jsx`)에 잠금 보유 시 `model.subscribe` 구독 effect + forced/articleId
  가드 + `alert` 1회 + `onForceClosed` 호출.
- `WriteWorkspace.jsx` 에서 `onForceClosed={() => closeTab(t.id)}` 배선.
- 대응 테스트: WritePage/WriteWorkspace 자동 종료 테스트(fake subscribe 로 forced 프레임 주입, `window.alert`
  스파이, 탭 닫힘 검증).
- 충족 AC: AC-CLOSE-1~6.

### M3 (Priority Medium) — 회귀 가드
- SPEC-012 메뉴/라우트(AC-REG-1), 잠금 계약/WritePage lock-before-load(AC-REG-2), 기존 송고/보류/KILL
  확인창 + `endEditContext`/`closeTab` 정상 경로(AC-REG-3) GREEN 유지.
- ViewPage SSE 재조회 회귀(AC-SSE-3).

### M4 (Priority Low) — 품질 게이트 + 보고
- `npm test` + `npm run test:web` + `npm run build` GREEN/무경고, `npm run lint` 무경고, 커버리지 확인.
- TRUST 5 게이트, 3파일 정합, news.md 미변경 확인.
- Slack `tech-day` 보고.

---

## 3. 개발 방법론

- `.moai/config/sections/quality.yaml` `development_mode` 를 따른다. 본 작업은 신규 동작(확인창 분기 + SSE 구독
  종료 + forced 플래그) 추가이므로 **TDD(RED→GREEN→REFACTOR)** 가 적합: 확인창 수락/취소, forced 가드 분기,
  탭 닫힘 각각 실패 테스트 먼저 작성.
- WritePage 자동 종료 테스트는 실제 EventSource 대신 fake `subscribe` 로 forced 프레임을 주입해 결정적으로
  검증한다(실시간 대기 금지).

---

## 4. 리스크 및 완화 (Risks & Mitigation)

| 리스크 | 영향 | 완화 |
|--------|------|------|
| forced 플래그 없이 자기 해제까지 종료 | 송고/보류/KILL 후 자기 탭이 alert 와 함께 닫힘(오작동) | SSE payload 에 `forced:true` 추가 + WritePage 가드가 forced 일 때만 종료(REQ-SSE-FORCED-FLAG, AC-CLOSE-4) |
| 다른 기사/초안 탭이 종료됨 | 무관한 편집 손실 | 가드 `articleId 일치 && editArticleId 존재`(AC-CLOSE-2/3) |
| 중복 SSE 프레임으로 alert 다회 | 사용자에게 alert 반복 노출 | effect 내 `closed` 멱등 플래그(AC-CLOSE-5) |
| SSE 구독 누수 | 탭 종료/언마운트 후에도 EventSource 유지 | effect cleanup 에서 `unsubscribe`(NFR 6.2) |
| 확인창이 인가를 대체한다고 오해 | 서버 가드 약화 시도 | 확인창은 UX 안전장치일 뿐 — D/Z 서버 가드(SPEC-012)는 불변(spec §6.1) |
| `closeTab` vs `endEditContext` 선택 오류 | "화면을 닫는다" 요구 미충족(전환만) | spec 종료 UX = 탭 닫기 → `closeTab` 채택; Run 단계 기존 테스트 정합 확인 |
| payload 키 변경으로 ViewPage 재조회 회귀 | list.do 실시간 갱신 깨짐 | `forced` 는 키 추가만(기존 `type`/`articleId` 불변, AC-SSE-3) |

---

## 5. 검증 명령 (실제 레이아웃 기준)

- 백엔드: `npm test` (= `node --experimental-sqlite --test --experimental-test-coverage test/*.test.js`)
- 프론트: `npm run test:web` (= `vitest run --root web`)
- 빌드: `npm run build` (= `vite build web`)
- 린트: `npm run lint` (ESLint 9 flat config)

---

## 6. Exclusions (계획 범위 밖)

spec.md §9 Exclusions 를 그대로 따른다. 특히: DB 강제 해제 재구현(SPEC-012 완료), 새 모달/토스트/토큰, 강제
라우팅/저장 권유 UX, 정상 해제 동작 변경, 새 락 스토어/채널/폴링/타이머, 서버 권한 모델 변경, DB 스키마
변경/삭제, news.md 수정, 코드 외 타 SPEC 3파일 수정.

---

Version: 0.1.0
Status: Plan
Last Updated: 2026-06-10
