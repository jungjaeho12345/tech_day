---
id: SPEC-EDIT-LOCK-001
version: 0.2.0
status: draft
author: manager-spec
---

# SPEC-EDIT-LOCK-001 — Compact (REQ / AC / Files / Exclusions)

> v0.2.0: 기존 잠금 동작은 Brownfield 특성화([EXISTING], 테스트 GREEN). **신규: 지연(lazy) 잠금
> 만료 TTL — reclaim-on-acquire([NEW], 테스트 미존재, run 단계 TDD RED→GREEN).** file:line은 증거 앵커.

## REQ + AC

### REQ-LOCK-ACQUIRE — 편집 진입 시 세션 단위 배타 잠금 (멱등) + 지연 TTL 만료
- AC-ACQ-1 자유 기사 획득 → `LockYN='Y'`/holder/`LockedAt` — [EXISTING] `test/articleService.test.js:198-207`
- AC-ACQ-2 동일 세션 재획득 멱등 — [EXISTING] `test/articleService.test.js:222-231`, `test/serverAuthWiring.test.js:216-224`
- AC-ACQ-3 없는 기사 → not-found — [EXISTING] `test/articleService.test.js:233-238`
- AC-ACQ-4 신규 초안은 미획득 — [EXISTING] `web/src/controller/useWriteController.lock.test.jsx:43-49`
- AC-ACQ-5 lock-before-load 순서 — [EXISTING] `web/src/controller/useWriteController.lock.test.jsx:32-41`
- **AC-TTL-1 [NEW] 스테일 재선점**: `LockedAt=now-31min` 잠금을 sess-B가 획득 → `{ok:true}`, holder=sess-B, `LockedAt=now`, `LockYN='Y'` — 테스트 미존재(RED 작성 대상), 구현 대상 `src/models/articleModel.js:84-99`(WHERE 확장)
- **AC-TTL-2 [NEW] 신선 잠금 비탈취**: `LockedAt=now-29min` 잠금을 sess-B가 획득 → `{ok:false,reason:'locked'}`, holder=sess-A 불변(REQ-LOCK-BLOCK 연동) — RED 작성 대상
- **AC-TTL-3 [NEW] 경계**: 만료 기준은 `LockedAt < (now - TTL)`(정확히 TTL은 비스테일). 경계 1케이스 단언 — RED 작성 대상
- **AC-TTL-4 [NEW] 구성**: `EDIT_LOCK_TTL_MS` 기본 `30*60*1000`, 오버라이드 가능(테스트는 작은 TTL/주입 `now` 사용) — RED 작성 대상

### REQ-LOCK-BLOCK — 비보유 세션 차단 (409, 홀더 비노출) — 단, **비스테일 잠금에 한함**
- AC-BLK-1 2번째 세션 차단(비스테일) `{reason:'locked',lockedBy}` — `test/articleService.test.js:209-220`
- AC-BLK-2 HTTP 409 + `'lockedBy' not in body` — `test/serverAuthWiring.test.js:199-213`
- AC-BLK-3 프론트 409 → 알림 "다른 사용자가 편집 중입니다." + 목록복귀 + 미로드 — `web/src/controller/useWriteController.lock.test.jsx:51-64`
- 주: 스테일 잠금은 차단 대상이 아니라 재선점 대상(REQ-LOCK-ACQUIRE / AC-TTL-1).

### REQ-LOCK-RELEASE-ACTION — 액션 성공 무조건 해제 / 무효 액션 보존
- AC-RLA-1 send/hold/kill 성공 → 무조건 해제 — `test/articleService.test.js:267-299`, `test/serverAuthWiring.test.js:245-259`
- AC-RLA-2 무효 액션 → 잠금 보존 — `test/articleService.test.js:301-311`
- AC-RLA-3 프론트 액션 후 이중 해제 방지 — `web/src/controller/useWriteController.lock.test.jsx:93-110`

### REQ-LOCK-RELEASE-EXIT — 이탈 시 조건부 해제 (unmount/beforeunload/logout)
- AC-RLE-1 보유자 해제 `released:true` + 재획득 — `test/articleService.test.js:240-253`, `test/serverAuthWiring.test.js:227-242`
- AC-RLE-2 비보유자 해제 no-op `released:false` — `test/articleService.test.js:255-265`
- AC-RLE-3 unmount 해제 — `web/src/controller/useWriteController.lock.test.jsx:66-78`
- AC-RLE-4 차단 진입 시 해제 미발생 — `web/src/controller/useWriteController.lock.test.jsx:80-91`
- AC-RLE-5 beforeunload keepalive 해제 — `web/src/controller/useWriteController.lock.test.jsx:112-124`, `web/src/model/httpModel.js:172`
- AC-RLE-6 logout release-before-clear-session — `web/src/controller/useWriteController.lock.test.jsx:126-144`, `web/src/app/App.jsx:54-55`

### REQ-LOCK-AUTH-SCOPE — 세션 단위 식별 / 역할 게이팅 / 인증 우선순위
- AC-AUTH-1 R 세션 200 + holder=세션 — `test/serverAuthWiring.test.js:187-196`
- AC-AUTH-2 미인증 → 401, 상태 불변 — `test/serverAuthWiring.test.js:262-270`
- AC-AUTH-3 없는 기사 → 404 — `test/serverAuthWiring.test.js:273-280`
- AC-AUTH-4 세션-단위 식별(body 무시) — `server/index.js:158,166,180,188`, `web/src/model/contract.js:29-30`

## Files to Touch

| 파일 | 역할 | 마커 | 앵커 |
|------|------|------|------|
| `src/db/schema.js` | 잠금 컬럼 + 멱등 마이그레이션 | [EXISTING] | :65-67, :101-112, :22 |
| `src/services/articleService.js` | acquire/release + 액션 auto-release + (TTL: `options` 통해 `now` 주입, 스테일 임계 전달) | [EXISTING]+[MODIFY] | :65-79, :89-106 |
| `src/models/articleModel.js` | 원자적 check-and-set / 조건부 해제 + **TTL WHERE 분기 + `EDIT_LOCK_TTL_MS`** | [EXISTING]+[NEW]+[MODIFY] | :84-115 |
| `src/controllers/index.js` | controller wiring | [EXISTING] | :98-99 |
| `server/index.js` | HTTP lock/unlock 라우트 | [EXISTING] | :153-193 |
| `web/src/model/contract.js` | lockArticle/unlockArticle 계약 | [EXISTING] | :29-30 |
| `web/src/model/httpModel.js` | lock POST / unlock keepalive | [EXISTING] | :151-178 |
| `web/src/controller/useWriteController.js` | lock effect + 해제 경로 | [EXISTING] | :64, :104-158, :246-248 |
| `web/src/app/App.jsx` | logout release-before-clear-session | [EXISTING] | :44-58 |
| `test/articleService.test.js` | 백엔드 잠금 테스트 + **TTL RED 추가** | [EXISTING]+[NEW] | :198-311 |
| `test/serverAuthWiring.test.js` | HTTP 잠금 테스트 | [EXISTING] | :187-280 |
| `web/src/controller/useWriteController.lock.test.jsx` | 프론트 잠금 테스트 | [EXISTING] | :32-144 |

## Exclusions (What NOT to Build)

- **active background sweep / 스케줄러 기반 만료** (지연 reclaim-on-acquire만 채택)
- **만료 알림 UX / 만료된 홀더에 대한 알림** (스테일 홀더는 조용히 대체됨)
- **lock-acquire 외 시점의 만료 처리** (예: idle 폴링, 주기적 정리 잡)
- 멱등성 키(idempotency key)
- 잠금 식별자 변경 (세션 → 사용자/단말)
- `Contents` 잠금 컬럼 외 스키마 변경
- 역할 게이팅 의미 변경 (R/D/Z 외 403)
- 생애주기 전이 로직 변경
- 실시간 잠금 표시 UI / 홀더 표시

## Pending Decisions

- **PD-1 RESOLVED** — 잠금 TTL: **지연 만료(reclaim-on-acquire), TTL 30분, In Scope** 채택.
- **PD-2 RESOLVED** — `LockedAt`: **만료 판단의 단일 입력**(더 이상 audit-only 아님).
- PD-3 확정: 현행 유지 — KILL(RRK/DDK) 후 액션-해제 → 재편집 진입 시 재-lockable.
- PD-4 확정: 현행 유지 — 강제종료 시 best-effort(keepalive unlock); 이제 TTL이 잔존 잠금을 30분 후 자동 회복.

---

Version: 0.2.0 · Status: draft
