# SPEC-NEWS-REVISE-010 — Implementation Plan

상세보기 별도 제목 요소 폐지 (본문 첫 줄이 제목). 본 문서는 Plan 단계 산출물이며 코드/테스트 구현은 Run 단계(별도 에이전트)에서 수행한다.

---

## 1. 기술 접근 (Technical Approach)

- 단일 파일 정정: `web/src/view/articleDetail.js` 의 `buildArticleDetailHtml` 함수에서 `section[aria-label="기사"]` 내부의 `<h1 class="yh-detail__title">${title}</h1>` 라인을 제거한다.
- 본문(`<div class="yh-detail__content">${body}</div>`)과 섹션 헤더(`<h2 class="yh-detail__section-title">기사</h2>`)는 유지한다.
- `<head><title>${title}</title>` 은 그대로 유지한다 (브라우저 탭 제목; `title` 은 `escapeHtml(a.title) || '(제목 없음)'`).
- 사용되지 않게 되는 `.yh-detail__title` CSS 룰은 정리(제거)한다. `.yh-detail__content` 룰 및 그 절대 폰트 사이즈는 유지한다 (제목 비교만 폐지).
- `body` 는 `buildBodyHtml(a)` → `a.markupVersion` 파싱 결과(첫 줄=제목 포함)이며 변경하지 않는다.

근거: 에디터 본문 첫째 줄이 제목(`moai-domain-news-editor` §2.5)이고, markupVersion 직렬화가 그 첫 줄을 포함하므로, 상세보기 본문이 이미 제목을 노출한다. 별도 `<h1>` 은 중복.

## 2. 마일스톤 (Milestones — Priority-based)

- **Priority High — M1**: `articleDetail.js` 에서 별도 제목 `<h1>` 제거 + `.yh-detail__title` CSS 정리. AC-NOTITLE-1/2 충족.
- **Priority High — M2**: `articleDetail.test.js` 의 제목 요소 존재 단언 / 본문 폰트 > 제목 폰트 비교 단언 제거 → AC-NOTITLE-1~4, EC-1~3 가드로 대체. (SPEC-001/002/003/004 의 폐지 대상 단언 정리)
- **Priority Medium — M3**: 회귀 확인 — 공통정보 12 dt, gray-line `#DDE3EC`, 공통정보 → 기사 순서, markupVersion 본문 순서, XSS escape, `<head><title>` 폴백 GREEN.

순서: M1 완료 후 M2 시작, M2 GREEN 확인 후 M3 회귀 확정.

## 3. 위험 & 완화 (Risks & Mitigation)

| 위험 | 영향 | 완화 |
|------|------|------|
| R1: 기존 4개 SPEC 의 폐지 대상 테스트가 남아 제목 요소 부재와 충돌 → 테스트 RED | CI 실패 | M2 에서 폐지 대상 단언을 명시적으로 제거/대체. supersession 마커가 폐지 범위를 명확히 함 |
| R2: `.yh-detail__title` CSS 제거가 다른 룰(`.yh-detail__content` 등)에 의도치 않은 영향 | 시각 회귀 | CSS 룰 단위 제거만 수행, 본문 룰 불변. M3 회귀 가드로 검출 |
| R3: 빈 제목 시 placeholder 요소를 실수로 남김 | 제목 중복 잔존 | EC-1 가드로 placeholder 요소 미생성 단언 |
| R4: `<head><title>` 폴백까지 함께 제거 | 탭 제목 회귀 | AC-NOTITLE-3 가 head title 유지를 단언 (제거 대상은 본문 영역 h1 한정) |

## 4. 검증 (Verification)

- `npm test` 전체 통과, `npm run build` 무경고.
- acceptance.md §1 (AC-NOTITLE-1~4) + §2 (EC-1~3) 전부 GREEN.
- TRUST 5 게이트 통과.

## 5. 영향 파일 (Affected Files)

- `web/src/view/articleDetail.js` (제목 `<h1>` 제거, `.yh-detail__title` CSS 정리)
- `web/src/view/articleDetail.test.js` (폐지 단언 제거 + AC-NOTITLE-* 가드 추가)

> Plan 단계에서는 위 파일을 수정하지 않는다.
