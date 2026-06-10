# SPEC-NEWS-REVISE-013 — Acceptance Criteria

상세보기 별도 제목 요소 폐지 (본문 첫 줄이 제목). 모든 시나리오는 `web/src/view/articleDetail.js` 의 `buildArticleDetailHtml(article)` 출력 HTML 문자열을 `JSDOM`/`DOMParser` 로 파싱하여 검증한다 (Run 단계 구현 기준; 본 문서는 Plan 단계 명세).

---

## §1. REQ-DETAIL-NO-SEPARATE-TITLE — 별도 제목 요소 폐지

### AC-NOTITLE-1 (제목 요소 부재)

- **Given**: 정상 article 객체 (`title`, `markupVersion`, 공통정보 12 필드 채워짐)
- **When**: `buildArticleDetailHtml(article)` 결과를 파싱하여 `section[aria-label="기사"]` 내부를 검사한다
- **Then**: `section[aria-label="기사"]` 안에 `.yh-detail__title` 클래스 요소와 `<h1>` 요소가 **하나도 존재하지 않는다** (`querySelector('section[aria-label="기사"] .yh-detail__title')` === null AND `querySelector('section[aria-label="기사"] h1')` === null)

### AC-NOTITLE-2 (본문 요소 존재)

- **Given**: 위 AC-NOTITLE-1 컨텍스트
- **When**: 같은 `section[aria-label="기사"]` 내부를 검사한다
- **Then**: `.yh-detail__content` 본문 요소가 정확히 1개 존재하고, 그 안에는 markupVersion 으로부터 렌더된 본문(첫 줄=제목 포함, 임베드, `(끝)`)이 순서대로 들어 있다 (markupVersion 파싱·순서 회귀 없음)

### AC-NOTITLE-3 (head title 유지)

- **Given**: (a) `article.title` 이 채워진 경우, (b) `article.title` 이 빈 문자열 또는 `null` 인 경우 — 두 케이스
- **When**: 출력 HTML 의 `<head>` 영역을 검사한다
- **Then**: (a) 의 경우 `<title>` 텍스트 === escape 된 `article.title`; (b) 의 경우 `<title>` 텍스트 === `(제목 없음)`. 어느 경우에도 `<head><title>` 은 존재한다

### AC-NOTITLE-4 (회귀 — 공통정보 12 dt / gray-line / 섹션 순서)

- **Given**: 공통정보 12 필드가 모두 채워진 article 객체
- **When**: 출력 HTML 을 파싱하고 (1) 공통정보 섹션의 `<dt>` 노드를 enumerate, (2) `--yh-gray-line` 토큰 값을 검사, (3) 두 `<section>`(공통정보, 기사)의 문서 순서를 검사한다
- **Then**:
  - (1) 다음 12 label 이 모두 정확히 한 번씩 등장한다 — 작성자, 공동작성, 내용, 지역, 속성, 키워드, 내부코멘트, 외부코멘트, 첨부파일, 자료파일, 엠바고, 2차 엠바고 (가로 나열 레이아웃 회귀 없음)
  - (2) `--yh-gray-line: #DDE3EC` 정확 토큰 매치 (대소문자 무시; `/--yh-gray-line:\s*#DDE3EC/i`) — SPEC-NEWS-REVISE-004 AC-GRAY-1 계승
  - (3) 공통정보 섹션이 기사 섹션보다 먼저 등장한다 (공통정보 → 기사 순서), 두 섹션은 동일 부모의 형제 노드다 — SPEC-NEWS-REVISE-004 AC-GRAY-3 의 두 섹션 형제 가드 계승

---

## §2. 엣지 케이스 (Edge Cases)

### EC-1 (빈 제목 — 본문 placeholder 요소 미생성)

- **Given**: `article.title` === `''`, `article.markupVersion` 은 정상 본문 보유
- **When**: 출력 HTML 의 `section[aria-label="기사"]` 내부를 검사한다
- **Then**: `(제목 없음)` 텍스트를 담은 `.yh-detail__title`/`<h1>` placeholder 요소가 **생성되지 않는다**. 본문 영역(`.yh-detail__content`)은 markupVersion 본문만 렌더한다. (`(제목 없음)` 은 `<head><title>` 에만 잔존 — AC-NOTITLE-3 참조)

### EC-2 (레거시 — markupVersion 없음)

- **Given**: `article.markupVersion` 이 비어 있고 `article.content` 폴백만 존재
- **When**: 출력 HTML 을 검사한다
- **Then**: `section[aria-label="기사"]` 에 별도 제목 요소는 여전히 없으며, 본문(`.yh-detail__content`)은 escape 된 `article.content` 폴백을 렌더한다 (기존 레거시 폴백 동작 유지, 제목 요소만 부재)

### EC-3 (XSS escape 회귀)

- **Given**: `article.title` = `<script>alert(1)</script>`, `article.content` / markupVersion 텍스트에 `<img src=x onerror=alert(1)>`
- **When**: 출력 HTML 을 파싱한다
- **Then**: `<head><title>` 의 title 은 escape 되어 텍스트로만 표시되고, 본문의 위험 토큰도 escape 되어 실행 가능한 `<script>`/`<img onerror>` 노드가 DOM 에 생성되지 않는다 (escape 정책 회귀 없음)

---

## §3. 품질 게이트 (Quality Gate)

- [ ] AC-NOTITLE-1~4 모두 GREEN
- [ ] EC-1~3 모두 GREEN
- [ ] SPEC-NEWS-REVISE-001/002/003/004 의 폐지 대상 단언(제목 요소 존재 / 본문 폰트 > 제목 폰트)이 테스트에서 제거되거나 AC-NOTITLE-* 로 대체됨 (제목 요소 부재와 모순되는 잔존 단언 없음)
- [ ] `npm test` 전체 통과, `npm run build` 무경고
- [ ] TRUST 5 게이트 통과

---

## Definition of Done (요약)

상세보기 새창의 `기사` 영역에서 별도 제목 요소(`.yh-detail__title`/`<h1>`)가 완전히 제거되고, 본문(`.yh-detail__content`)·공통정보 12 필드·gray-line 토큰·섹션 순서·XSS escape·`<head><title>` 폴백은 회귀 없이 유지된다.
