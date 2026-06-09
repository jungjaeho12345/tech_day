# SPEC-NEWS-REVISE-009 — Acceptance Criteria

> 모든 [검증 명령]은 실제 레이아웃 명령만 사용한다: `npm run test:web`(프론트), `npm test`(백엔드), `npm run build`(vite build). `--prefix web` 류 금지.
> 본 SPEC 은 Δ-only — AC 는 HEAD/작업 트리에 이미 구현된 동작에 대한 회귀 가드 + 명세 잠금이다. production 코드 변경 0 을 기본값으로 한다(PD5 주석 정합만 예외).

---

## §1 REQ-MULTITAB-LIFECYCLE — 멀티 탭 워크스페이스 행위 계약

검증 파일: `web/src/view/WriteWorkspace.test.jsx` (기존 보강 — PD2 확정)
검증 명령: `npm run test:web`

### AC-TAB-1 — ＋ 버튼으로 새 작성 탭 추가 + 활성화

- **Given** `WriteWorkspace` 가 빈 새 기사 탭 1개로 마운트되어 있다.
- **When** 사용자가 ＋ 버튼(`getByRole('button', { name: /새 탭|＋|\+/ })`)을 클릭한다.
- **Then** 탭 목록의 길이가 1 → 2 로 증가하고, 새로 추가된 빈 새 기사 탭이 활성(active) 탭이 된다(`newsroom.editorTabs` 의 `activeId` 가 새 탭 id).

### AC-TAB-2 — 탭별 독립 내용 유지

- **Given** 탭 A 와 탭 B 가 열려 있고, 탭 A 의 제목 입력란에 `"기사 A"` 를 입력했다.
- **When** 탭 B 로 전환하여 탭 B 의 제목 입력란을 확인한다.
- **Then** 탭 B 의 제목은 `"기사 A"` 가 아니다(빈 값 또는 탭 B 고유 값). AND 탭 A 로 되돌아가면 제목이 여전히 `"기사 A"` 다(탭 전환이 내용을 섞지 않음 — 탭별 초안 `newsroom.writeDraft.<tabId>` 독립).

### AC-TAB-3 — 탭 닫기(×) 시 그 탭 내용 폐기

- **Given** 탭 A(내용 있음)와 탭 B 가 열려 있다.
- **When** 탭 A 의 × 버튼을 클릭하여 탭 A 를 닫는다.
- **Then** 탭 A 가 탭 목록에서 제거되고, 그 탭의 초안(`newsroom.writeDraft.<tabAId>`)이 sessionStorage 에서 제거된다(`removeStoredDraft` 호출). AND 탭 A 의 내용이 탭 B 나 레거시 초안(`newsroom.writeDraft`)으로 복원되지 않는다.

### AC-TAB-4 — 마지막 탭 닫으면 빈 새 기사 탭 1개 유지

- **Given** 탭이 1개만 열려 있다(마지막 탭).
- **When** 그 탭의 × 버튼을 클릭한다.
- **Then** 탭 목록이 빈 상태(0개)가 되지 않고, 빈 새 기사 탭 1개가 생성되어 유지·활성화된다(`tabs.length === 1`, 그 탭은 `editArticleId` 미보유 = 새 기사 탭).

---

## §2 REQ-EDIT-TAB-ROUTING — 편집/고침 진입 새 탭 + 재오픈 활성화 + 송고 후 블랭크 전환

검증 파일: `web/src/view/WriteWorkspace.test.jsx`, `web/src/controller/useWriteController.editLoad.test.jsx`
검증 명령: `npm run test:web`

### AC-EDTAB-1 — 편집/고침 진입 시 새 편집 탭 생성

- **Given** `WriteWorkspace` 가 새 기사 탭 1개로 마운트되어 있다.
- **When** 조회 페이지에서 기사 `AKR-001` 을 편집(또는 고침/포털고침)으로 진입하여 `writer.do?id=AKR-001` 로 워크스페이스가 해당 기사를 로드한다(`withEditTab(state, 'AKR-001')`).
- **Then** `editArticleId === 'AKR-001'` 인 새 탭이 추가·활성화된다.

### AC-EDTAB-2 — 이미 열린 기사 재오픈 시 새 탭 없이 기존 탭 활성화

- **Given** `editArticleId === 'AKR-001'` 탭이 이미 열려 있고, 현재 다른 탭이 활성 상태다.
- **When** 같은 기사 `AKR-001` 을 다시 편집 진입한다(`withEditTab(state, 'AKR-001')`).
- **Then** 탭 목록 길이가 증가하지 않고(중복 탭 미생성), 기존 `AKR-001` 탭이 활성화된다. AND 동시 편집 잠금 효과는 SPEC-008/002 D2-5 계약을 따른다(본 AC 는 탭 UI 만 단언).

### AC-EDTAB-3 — 서로 다른 기사는 별도 탭

- **Given** `editArticleId === 'AKR-001'` 탭이 열려 있다.
- **When** 다른 기사 `AKR-002` 를 편집 진입한다.
- **Then** `editArticleId === 'AKR-002'` 인 별도의 새 탭이 추가된다(두 기사가 한 탭에 합쳐지지 않음, `tabs.length` 2 이상).

### AC-EDTAB-4 — 송고/보류/KILL 성공 시 그 탭이 빈 새 기사 탭으로 전환

- **Given** `editArticleId === 'AKR-001'` 편집 탭이 활성 상태다.
- **When** 송고(또는 보류/KILL)가 성공하여 컨트롤러의 `editArticleId` 가 null 로 전이된다(`endEditContext`).
- **Then** 그 탭이 빈 새 기사 탭으로 전환된다(`editArticleId` 미보유, 제목/본문 빈 값). 락 해제는 SPEC-008 계약대로 일어난다(본 AC 는 탭 전환만 단언).

### AC-EDTAB-5 — 송고 실패 시 블랭크 미전환

- **Given** `editArticleId === 'AKR-001'` 편집 탭이 활성 상태이고 본문에 `"(끝)"` 마커가 없다.
- **When** 송고 버튼을 눌러 SPEC-005 `(끝)` 가드(또는 제목 가드/확인창 취소)로 송고가 차단된다.
- **Then** 그 탭은 블랭크로 전환되지 않고 `editArticleId === 'AKR-001'` 및 기사 내용을 유지한다.

---

## §3 REQ-EMBED-TEXT-ORDER — 임베드-텍스트 시각 순서 보존 (Bug 1)

검증 파일: `web/src/view/editorCaret.test.js` (단위 — PD3 필수), `web/src/view/WritePage.test.jsx` (통합 — PD3 권장)
검증 명령: `npm run test:web`

### AC-ORDER-1 — 트레일링 임베드 뒤 텍스트 입력 후 순서 보존

- **Given** 에디터 본문이 텍스트 `"본문"` + 그 뒤 트레일링 임베드(`[data-embed-index="0"]`) 순서로 구성된 DOM 이다.
- **When** 임베드 뒤에 텍스트 `"추가"` 를 입력한 상태의 root 를 `readOrderedContentFromDom(root, embedFor)` 로 읽는다.
- **Then** 반환 `blocks` 가 `[{type:'text', text:'본문'}, {type:'embed', embed:{...}}, {type:'text', text:'추가'}]` interleave 순서다(임베드가 텍스트보다 앞/뒤로 강제 재배치되지 않음). `[...textBlocks, ...embeds]` 형태(텍스트 전부 앞, 임베드 전부 뒤)가 **아니다**.

### AC-ORDER-2 — Enter 후 임베드가 입력 텍스트 아래로 점프하지 않음

- **Given** 본문 `"본문"` + 트레일링 임베드 + 입력 텍스트 `"추가"` (AC-ORDER-1 상태).
- **When** Enter 처리에 따른 repaint 경로(`setOrderedContent`/`readOrderedContentFromDom` 사이클)를 수행한다.
- **Then** 임베드 블록의 인덱스가 텍스트 `"추가"` 블록보다 **앞**에 유지된다(임베드가 `"추가"` 아래로 점프 = Bug 1 회귀가 발생하지 않음).

### AC-ORDER-3 — Alt+Y "(끝)" 이 임베드 뒤 최종 블록으로 배치

- **Given** 본문 `"본문"` + 트레일링 임베드(`data-embed-index=0`).
- **When** Alt+Y 로 `"(끝)"` 을 삽입한다(SPEC-002/003 `(끝)` 정본 소비).
- **Then** 최종 시각 순서의 블록 배열에서 `"(끝)"` 토큰이 임베드 블록보다 **뒤**(최종 블록)에 위치한다 — 순서: 텍스트 → 임베드 → `"(끝)"`. AND `"(끝)"` 은 골드색 스타일이다(SPEC-002 회귀 정합).

### AC-ORDER-4 — interleave round-trip 보존

- **Given** interleave 본문(텍스트 → 임베드 → 텍스트 → 임베드)이 있다.
- **When** `readOrderedContentFromDom` → `setOrderedContent` round-trip 을 수행한다.
- **Then** 텍스트/임베드 블록의 상대 순서가 동일하게 복원된다(임베드 유실/중복/순서뒤바뀜 없음 — SPEC-UI-EDITOR-001 임베드 상호 순서 AC 와 충돌 없이 정합).

---

## §4 REQ-CLIPBOARD-EMBED-SIZE — 클립보드 임베드 17% 사이징

검증 파일: `web/src/view/clipboardEmbed.test.js` + `web/src/styles/yonhap.css` 사이징 룰 단언(PD4: 텍스트 정규식 우선)
검증 명령: `npm run test:web`

### AC-SIZE-1 — 클립보드 임베드 17%×17% 사이징

- **Given** `yonhap.css` 의 `.yh-embed`(클립보드 붙여넣기 이미지/유튜브) 사이징 규칙.
- **When** CSS 텍스트에서 클립보드 임베드 사이징 규칙을 파싱한다(또는 임베드 노드 인라인/클래스 사이징을 읽는다).
- **Then** 가로×세로가 에디터 100% 기준 `17%` 로 표현된다(`/17%/` 매치). AND 구 `10%` 값이 클립보드 임베드 사이징에 남아 있지 않다.

### AC-SIZE-2 — figure 612px / 기사 참조 카드 480px

- **Given** `yonhap.css` 의 사진/영상 figure 및 기사 참조 카드(article-card) 폭 규칙.
- **When** CSS 룰을 파싱한다.
- **Then** figure 폭 단언에 `612px` 가, 기사 참조 카드 폭 단언에 `480px` 가 정확히 존재한다.

### AC-SIZE-3 — 10% / 360px 회귀 금지

- **Given** 본 SPEC 정밀화 이후의 `yonhap.css` 사이징 규칙.
- **When** 사이징 규칙을 검사한다.
- **Then** 클립보드 임베드 사이징이 구 정책 `10%` 또는 figure `360px` 로 회귀하지 않는다(negative 보조 단언). (news.md L127 갱신 정본; SPEC-001/002 의 10% 비목표화 기록은 무수정.)

---

## §5 회귀 매트릭스 (기존 001~008 AC GREEN 유지 + production 무변경)

검증 명령: `npm run test:web`, `npm test`, `npm run build`, `git diff --stat`

| 가드 | 기준 | 검증 |
|------|------|------|
| RG-1 | SPEC-NEWS-REVISE-008 락 수명(편집 탭 수명)/해제 4시점/멱등 재획득 회귀 없음 | `web/src/controller/useWriteController.editLoad.test.jsx`(또는 lockRetention), `test/editLockBehavior.test.js` GREEN |
| RG-2 | SPEC-NEWS-REVISE-002 D2-5 strict / lockYN 계약 회귀 없음 | `test/editLockBehavior.test.js`, `test/schema.test.js` GREEN |
| RG-3 | SPEC-NEWS-REVISE-001 커서 위치 임베드/Ctrl+D, 002/003 Alt+Y "(끝)" 단순화/임베드 삭제 회귀 없음 | `InlineEmbed.test.jsx`, `editorShortcuts.test.js`, `editorCaret.test.js` GREEN |
| RG-4 | SPEC-UI-EDITOR-001 임베드 상호 순서(REQ-EDIT-EMBED-007) + 어댑터 계약 회귀 없음 | `editorAdapter.test.js` 임베드 순서 round-trip GREEN |
| RG-5 | SPEC-007 부서별 송고 진입점/ContentsVO 읽기전용 8필드 회귀 없음 | `ViewPage.contextMenu.test.jsx`, `WritePage.test.jsx` GREEN |
| RG-6 | production 코드 무변경(PD5 주석 정합 제외) | `git diff --stat` 으로 비-테스트 production 변경 0 (clipboardEmbed.js 주석 1줄 정합은 비-동작 변경) |
| RG-7 | 빌드 무경고 | `npm run build` (vite build web) 무경고 |

---

## §6 Definition of Done (acceptance 관점)

- [ ] AC 총 14개 (AC-TAB-1~4, AC-EDTAB-1~5, AC-ORDER-1~4, AC-SIZE-1~3) — 모든 REQ 가 3개 이상 AC 보유
- [ ] 모든 [검증 명령]이 `npm run test:web` / `npm test` / `npm run build` / `git diff --stat` 만 사용(`--prefix web` 금지)
- [ ] §5 회귀 매트릭스(RG-1~7)로 001~008 AC GREEN + production 무변경 단언
- [ ] PD1~PD5 의 Plan 확정값을 AC 가 그대로 반영(17% 정본, WriteWorkspace.test 보강, editorCaret 단위 가드, CSS 텍스트 단언, 주석 정합)
