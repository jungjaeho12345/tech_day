---
id: SPEC-NEWS-REVISE-001
artifact: acceptance
version: 0.1.0
created: 2026-06-02
updated: 2026-06-02
---

# Acceptance — SPEC-NEWS-REVISE-001

본 파일은 spec.md §4의 EARS 요구사항에 대한 **테스트 가능한 Given-When-Then 시나리오**와 **Definition of Done**을 정리한다. 모든 시나리오는 Vitest + jsdom + @testing-library/react로 자동화 가능하다.

---

## 1. REQ-AUTH-Z-BUTTONS — 시나리오

### Scenario AC-Z-1: Z권한 + RDS 기사에서 송고/보류/KILL 가시 + 사용 가능

- **Given** 로그인 사용자의 권한이 `Z`이고 편집 대상 기사 상태가 `RDS`이다
- **And** 사용자가 `/writer.do?id=AKR20260602001` 로 진입한다
- **When** WritePage가 렌더링된다
- **Then** `screen.getByRole('button', { name: '송고' })`, `getByRole('button', { name: '보류' })`, `getByRole('button', { name: 'KILL' })` 세 노드가 모두 DOM에 존재한다
- **And** 세 버튼 모두 `disabled` 속성이 없다 (`toBeEnabled()`)
- **And** 세 버튼 모두 visible (CSS display !== 'none')

### Scenario AC-Z-2: Z권한이라도 송고/보류/KILL 외 추가 버튼 노출 금지

- **Given** AC-Z-1과 동일한 컨텍스트
- **When** 작성 페이지 상단 버튼군 컨테이너의 `<button>` 노드를 모두 enumerate 한다
- **Then** 노드 텍스트의 집합은 `{ '송고', '보류', 'KILL' }` 의 부분집합이다 (다른 액션 버튼이 추가로 보이지 않음)
- **And** "고침", "포털고침", "재송", "삭제요청", "후속기사작성" 텍스트의 버튼은 `queryByRole('button', { name: <text> })`로 `null`을 반환한다

### Scenario AC-Z-3: Z권한이라도 status가 RDS가 아니면 버튼 비표시

- **Given** 권한 `Z`, 편집 대상 기사 상태 `DPS` (또는 `RRH`, `DDH`, `RRK`, `DDK` 중 어느 것)
- **When** WritePage 렌더링
- **Then** 송고/보류/KILL 세 버튼 모두 `queryByRole('button', { name: <text> })` 가 `null`

### Scenario AC-Z-4: R/D 권한 회귀

- **Given** 권한 `R`, status `RDS`
- **When** WritePage 렌더링
- **Then** 송고/보류/KILL 모두 가시 ✓ (기존 동작)
- **And** 권한 `D`, status `RDS` 일 때 송고/보류 가시, KILL **비**가시 ✓ (기존 동작)
- **And** 권한 `R`, status `DPS` 일 때 세 버튼 모두 비가시 ✓ (기존 status gating)

### Scenario AC-Z-5: 접근성 — 키보드 접근

- **Given** AC-Z-1 컨텍스트
- **When** Tab 키로 포커스를 이동한다
- **Then** 송고/보류/KILL 각 버튼이 포커스 가능 (`document.activeElement === button`)
- **And** 각 버튼은 visible text 또는 `aria-label` 속성을 가진다

---

## 2. REQ-DETAIL-LAYOUT-SPLIT — 시나리오

### Scenario AC-DTL-1: 제목/본문 섹션 구조 분리

- **Given** `article = { title: '테스트 제목', content: '본문 한 줄', author: '홍기자', ...12필드 채움 }`
- **When** `buildArticleDetailHtml(article)` 호출 후 결과 HTML 문자열을 `new DOMParser().parseFromString(html, 'text/html')`로 파싱
- **Then** `document.querySelectorAll('section[aria-label="제목"]').length === 1`
- **And** `document.querySelectorAll('section[aria-label="본문"]').length === 1`
- **And** 제목 섹션과 본문 섹션은 같은 부모를 공유하며 인접하거나 분리된 시각 영역이다

### Scenario AC-DTL-2: 시각적 분리 — 1px #DDD 계열 구분선 또는 섹션 헤더

- **Given** AC-DTL-1 컨텍스트
- **When** 제목 섹션 및 본문 섹션 각각의 `outerHTML`을 검사한다
- **Then** 각 섹션 내부에 `<h2 class="yh-detail__section-title">제목</h2>` 및 `<h2 class="yh-detail__section-title">본문</h2>` 헤더가 존재한다
- **And** 각 섹션은 `border` 또는 `border-left` 스타일을 가진다 (CSS 클래스 `yh-detail__section`을 가지면 충족)

### Scenario AC-DTL-3: 공통정보 12 필드 누락 없음

- **Given** 12 필드가 모두 채워진 article
- **When** 상단 공통정보 섹션 내부의 `<dt>` 노드를 모두 enumerate (`querySelectorAll('section[aria-label="공통정보"] dt')`)
- **Then** `dt` 텍스트의 set은 정확히 다음 12 라벨을 모두 포함한다:
  `{ '작성자', '공동작성', '내용', '지역', '속성', '키워드', '내부코멘트', '외부코멘트', '첨부파일', '자료파일', '엠바고', '2차 엠바고' }`

### Scenario AC-DTL-4: 빈 제목 — placeholder 처리

- **Given** `article.title === ''` (또는 `null`)
- **When** HTML 렌더링 및 파싱
- **Then** 제목 섹션은 여전히 존재하고 제목 텍스트는 `'(제목 없음)'`
- **And** 본문 섹션은 별도로 분리된 채 존재한다

### Scenario AC-DTL-5: HTML 이스케이프 — XSS 방어

- **Given** `article.title === '<script>alert(1)</script>'`, `article.content === '<img src=x onerror=alert(1)>'`
- **When** HTML 렌더링 및 파싱
- **Then** `document.querySelectorAll('script').length === 0`
- **And** `document.querySelectorAll('img').length === 0`
- **And** 제목 섹션 내부 텍스트에 `'<script>alert(1)</script>'` 가 *문자열*로 포함되어 있다 (`textContent.includes('<script>')`)

### Scenario AC-DTL-6: 기존 테스트 회귀 가드

- **Given** 기존 `articleDetail.test.js`의 모든 케이스
- **When** `npx vitest run web/src/view/articleDetail.test.js`
- **Then** 모든 케이스가 통과한다 (skip/fail 없음)

---

## 3. REQ-EDITOR-EMBED-AND-CTRL-D — 시나리오

### Scenario AC-EMB-1: 커서 위치 임베드 (본문 끝 append 금지)

- **Given** 에디터 본문 텍스트 `"첫째줄\n둘째줄\n셋째줄"`, 캐럿이 둘째줄 끝(offset)에 위치
- **When** 이미지 탭에서 검색 결과 카드의 "삽입" 액션 트리거
- **Then** 임베드 노드는 둘째줄과 셋째줄 사이 (캐럿 위치)에 삽입된다
- **And** 임베드 노드는 본문 끝에 append되지 않는다 (`markupVersion` 또는 DOM 순서 검증)

### Scenario AC-EMB-2: 임베드 영속성 — 후속 입력에도 유지

- **Given** AC-EMB-1로 임베드된 상태
- **When** 다른 위치에 텍스트 `"추가본문"` 입력
- **Then** 임베드 노드가 동일 위치에 그대로 존재 (`querySelectorAll(embed selector).length === 1`)
- **And** 임베드 노드의 데이터(title, url, thumbnailUrl 등)가 보존됨

### Scenario AC-EMB-3: 임베드 영속성 — getMarkup ↔ setMarkup round-trip

- **Given** AC-EMB-1 상태에서 `markup = adapter.getMarkup()`
- **When** 새 어댑터 인스턴스 `adapter2`를 만들고 `adapter2.setMarkup(markup)` 호출
- **Then** 복원된 본문에 임베드 노드가 동일 위치 + 동일 데이터로 존재
- **And** 텍스트 콘텐츠도 보존됨

### Scenario AC-CTRL-D-1: 단일 라인 삭제

- **Given** 본문 `"AAA\nBBB\nCCC"`, 캐럿이 BBB 라인 내부의 임의 offset
- **When** `keydown` 이벤트 발화 (`{ ctrlKey: true, key: 'd' }`)
- **Then** 본문이 `"AAA\nCCC"`로 변경됨
- **And** 캐럿이 CCC 라인 시작 또는 AAA 라인 끝에 위치
- **And** `event.defaultPrevented === true`

### Scenario AC-CTRL-D-2: 멀티라인 선택 round-up

- **Given** 본문 `"AAA\nBBB\nCCC\nDDD"`, 선택 범위가 BBB의 중간부터 CCC의 중간까지
- **When** `Ctrl+D` 발화
- **Then** 본문이 `"AAA\nDDD"`로 변경됨 (선택에 일부라도 포함된 BBB, CCC 두 라인 모두 제거)

### Scenario AC-CTRL-D-3: 경계 — 첫/마지막/단일 라인

- **Given** 본문 `"AAA\nBBB"`, 캐럿이 AAA에 있다
- **When** `Ctrl+D`
- **Then** 본문 `"BBB"`
- **And** 본문이 `"AAA"` (단일 라인)일 때 `Ctrl+D` → 본문 빈 문자열 (또는 빈 라인 한 줄), 에디터는 여전히 포커스 가능

### Scenario AC-CTRL-D-4: 스코프 한정 (에디터 외부 무시)

- **Given** 포커스가 메타데이터 탭의 검색 input (`<input type="text">`)에 있다
- **When** `Ctrl+D` 발화
- **Then** 에디터의 라인 삭제 핸들러는 호출되지 않는다
- **And** 에디터 본문은 변하지 않는다

### Scenario AC-CTRL-D-5: Alt+Y 회귀 보존

- **Given** 본문에 임의 텍스트
- **When** `Alt+Y` 발화
- **Then** news.md 기존 명세대로 본문 끝에 `"\r\n (끝)"`이 1회 삽입되며 골드색 스타일 적용. 이미 존재 시 noop

---

## 4. 비기능 시나리오

### Scenario NFR-A11Y: 접근성

- 모든 버튼은 visible text 또는 `aria-label`을 가진다
- 모든 detail 섹션은 `aria-label`을 가진다 (`공통정보`, `제목`, `본문`)
- 키보드만으로 송고/보류/KILL 액션 트리거 가능 (Tab → Enter)

### Scenario NFR-DESIGN: 디자인 토큰

- 신규 CSS 변수 도입 없음 (`grep -r '--yh-' web/src/styles/` 결과에 변화 없음)
- 상세보기 분리 구분선은 `--yh-gray-line` 또는 1px #DDD 계열

### Scenario NFR-REG: 회귀 가드

- `npm test` 전체 통과 (기존 13개 이상 테스트 파일 모두)
- `npm run build` 무경고
- 기존 SPEC(UI-EDITOR-001, FRONTEND-UI-001, AUTH-001) AC 회귀 없음

---

## 5. Quality Gate Criteria (TRUST 5)

- **Tested**: 신규/변경 코드 커버리지 85% 이상. RED-GREEN-REFACTOR 사이클 적용
- **Readable**: ESLint/Prettier 무경고. 한국어 코드 주석은 `code_comments` 설정 따름
- **Unified**: 기존 코드 스타일과 일치 (yh-* CSS 클래스 네이밍 유지)
- **Secured**: HTML 이스케이프(AC-DTL-5), Ctrl+D 단축키의 스코프 한정(AC-CTRL-D-4), 권한 인가 회귀 없음(AC-Z-4)
- **Trackable**: commit 메시지에 SPEC-NEWS-REVISE-001, REQ-* ID 포함

---

## 6. Definition of Done

전체 spec.md §12와 본 acceptance.md 시나리오 전부에 더해:

- [ ] 본 acceptance.md의 모든 Scenario가 자동화 테스트로 존재하고 GREEN
- [ ] Pending Decisions (D-1 ~ D-5) 사용자 승인 완료
- [ ] 미커밋 변경분 처리 결정(commit / stash / 폐기) 완료 (사용자 권한)
- [ ] `npm test`, `npm run build` 통과
- [ ] news.md / SPEC 정합 확인
- [ ] Slack `tech-day` 채널에 완료 보고 (CLAUDE.md HARD)
- [ ] `/moai sync SPEC-NEWS-REVISE-001` 실행 및 docs 동기화

Version: 0.1.0
