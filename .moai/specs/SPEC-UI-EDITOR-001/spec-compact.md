# SPEC-UI-EDITOR-001 (Compact) — 기사 에디터 (구조 파싱 + 인라인 임베딩)

> 자동 생성 압축본. 요구사항(EARS)과 인수 기준만 포함. 전체 맥락은 `spec.md` / `plan.md` / `acceptance.md` 참조.
> Delta: [EXISTING] 유지 · [MODIFY] 대체/강화 · [NEW] 신규.

## 요구사항 (Requirements — EARS)

### 모듈 1 — 에디터 어댑터 concrete 구현
- REQ-EDIT-ADP-001 (Ubiquitous) [MODIFY]: 에디터 영역은 기존 `EditorAdapter` 계약(`getMarkup()`/`setMarkup()`)을 구현하는 concrete 리치텍스트 에디터로 뒷받침되며, 작성 페이지가 소비하는 계약 표면을 바꾸지 않는다.
- REQ-EDIT-ADP-002 (Ubiquitous) [EXISTING]: `getMarkup()` 반환값은 `Article.markupVersion`에 저장되는 단일 값으로 유지(덮어쓰기-온-세이브, 이력 없음) — DP-F1 보존.
- REQ-EDIT-ADP-003 (Event-Driven) [EXISTING]: `setMarkup(markup)` 호출 시 에디터 뷰에 마크업을 로드(덮어쓰기)한다.

### 모듈 2 — 구조 파싱 (제목/부제목/본문)
- REQ-EDIT-PARSE-001 (Event-Driven) [NEW]: DTO 조립용으로 내용을 읽을 때, 제목/부제목/본문 3개 논리 역할의 결정론적 구조로 파싱한다.
- REQ-EDIT-PARSE-002 (Ubiquitous) [NEW]: 첫째 줄을 제목으로 취급한다.
- REQ-EDIT-PARSE-003 (Ubiquitous) [NEW]: 제목 다음 줄들을 최대 2~5번째 줄까지 부제목으로, 나머지를 본문으로 취급하되, 결정론적 빈 줄(연속 개행) 경계 규칙으로 부제목/본문 경계를 정한다(정확한 규칙은 plan.md §4에서 고정).
- REQ-EDIT-PARSE-004 (Unwanted) [NEW]: 내용이 한 줄(제목)뿐이면 비어있지 않은 제목 + 빈 부제목 + 빈 본문을 에러 없이 산출한다.
- REQ-EDIT-PARSE-005 (Ubiquitous) [NEW]: 파서는 순수·부작용 없는 함수로, 동일 입력은 항상 동일 `{title, subtitle, body}` 산출(결정론·단위테스트 가능).
- REQ-EDIT-PARSE-006 (Ubiquitous) [MODIFY]: 파싱 구조는 `getMarkup()`의 `markupVersion` 값에 인코딩되어 DTO 조립이 변경 없는 어댑터 계약으로 구조화 마크업을 소비한다.

### 모듈 3 — 인라인 임베딩 렌더링
- REQ-EDIT-EMBED-001 (Event-Driven) [MODIFY]: 검색 결과 임베드 선택 시 본문 삽입점에 시각적 인라인 임베드를 삽입(기존의 본문 끝 참조-마커 텍스트 append 대체).
- REQ-EDIT-EMBED-002 (Event-Driven) [NEW]: 이미지 결과(`{source,title,url,thumbnailUrl}`)는 시각적 이미지 요소로 인라인 렌더.
- REQ-EDIT-EMBED-003 (Event-Driven) [NEW]: 유튜브/영상 결과는 시각적 비디오 참조(플레이어/링크 카드)로 인라인 렌더.
- REQ-EDIT-EMBED-004 (Event-Driven) [NEW]: 내부 글기사 결과(`{articleId,title}`)는 시각적 기사 참조 카드(최소 제목 표시)로 인라인 렌더(기존 `기사:{articleId}` 마커 대체).
- REQ-EDIT-EMBED-005 (Ubiquitous) [NEW]: 인라인 임베드는 `markupVersion`에 보존되어 `setMarkup()` 재로드 시 동일 임베드 재구성(round-trip 안정).
- REQ-EDIT-EMBED-006 (Ubiquitous) [NEW]: 인라인 임베드는 연합뉴스 디자인 토큰(`yonhap.css`)을 따라 본문과 시각적으로 구별.
- REQ-EDIT-EMBED-007 (Optional) [NEW]: 다중 임베드 시 각각을 distinct 인라인 임베드로 삽입, 상대 순서 보존.

## 인수 기준 (Acceptance — Given/When/Then 요약)

- AC-1 구조 파싱: 제목 1줄 + 부제목 2줄 + 빈 줄 + 본문 → `{title, subtitle, body}` 결정론 분리(후보 A).
- AC-2 이미지 인라인 임베드: 삽입 시 시각 이미지 요소 삽입, plain 마커 텍스트 append 안 함, 디자인 토큰 적용.
- AC-3 round-trip: `getMarkup()`→`setMarkup()` 후 임베드 동일 순서 복원(유실/중복 없음).
- AC-4 가드(브라운필드): 어댑터 교체 후에도 `assembleDto().markupVersion === adapter.getMarkup()`, 송고/보류 호출 시퀀스 불변(DP-F1/DP-F5).
- EC-1 제목만 입력 → 제목만 채워지고 부제목/본문 빈 값, 에러 없음.
- EC-2 빈 본문 → 제목·부제목 채워지고 본문 빈 값; 전체 빈 입력도 에러 없음.
- EC-3 다중 삽입 → 3종(이미지/유튜브/내부기사) distinct 인라인 임베드, 순서 보존.
- EC-4 모호한 개행(빈 줄 없는 6줄, 후보 A) → 제목 1 / 부제목 4(줄2~5) / 본문(줄6); 규칙 확정에 따라 갱신.
- EC-5 부분 결과(thumbnailUrl 없음) → url 기반 렌더, 크래시 없음.

## 확정 결정 (Confirmed)
- 파싱 규칙: **후보 A(빈 줄 블록 분리) 확정**. 제목=1줄 → 첫 빈 줄 전까지 부제목(최대 4줄=2~5번째 줄) → 빈 줄 이후 본문; 빈 줄 없으면 2~5번째 줄 부제목·6번째+ 본문. REQ-EDIT-PARSE-003 및 EC-4(4a/4b)에 고정 반영됨. 후보 B/C는 기각(plan.md §4).
