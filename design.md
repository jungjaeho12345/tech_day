# 디자인 가이드 (design.md)

본 문서는 기사 제작 시스템(연합뉴스 스타일, React + 단일 yonhap.css)의 디자인 규칙을 정리한다. 추출 대상은 구현 단일 출처인 `web/src/styles/yonhap.css`(CSS 변수 토큰 + 컴포넌트 클래스), 뷰 컴포넌트(`web/src/view/*`), `web/index.html`, `news.md`, `CLAUDE.md`, `.moai/` 하위 SPEC·스킬·프로젝트 문서다. 값이 충돌하는 경우 양쪽을 병기하고, `web/src/styles/yonhap.css`를 비롯한 코드가 현재 구현 기준임을 표시한다.

> 주의: `.moai/design/*.md` 와 `.moai/project/brand/*.md` 는 전부 빈 TBD 템플릿(값 없음)이다. 디자인 토큰·색·타이포의 실값은 모두 코드와 news.md/SPEC/스킬 문서에서 추출했다. (자세한 목록은 11장 참조)

---

## 브랜드 아이덴티티

연합뉴스 보도 화면을 기준으로 한 신문형 보도 화면 아이덴티티를 따른다.

- **색 체계 (코드 기준)**: blue+white 주도 — BLUE가 UI 크롬(헤더 보더/워드마크, 기본 버튼, 활성 탭/네비, 링크, 포커스, 테이블 밑줄)을 주도하고, RED는 연합 브랜드 액센트(로고 좌측 룰, 알림 보더, '송고' 상태 배지)로 유지된다. 흰 배경이 지배적이다. (출처: web/src/styles/yonhap.css)
- **글자색 규칙**: 헤드라인/제목·브랜드 워드마크·UI 라벨 강조는 파란색(--yh-blue). 본문은 검정(--yh-ink) 유지. (출처: CLAUDE.md, .claude/skills/moai-domain-news-editor/SKILL.md)
- **단일 파일 스타일시트**: yonhap.css v2.0, 구성 순서 tokens → resets → layout → components. (출처: web/src/styles/yonhap.css)

> 색 체계 충돌 주의: news.md / CLAUDE.md(루트 변형본)에는 "브랜드 레드 #C8102E를 헤더 바·활성 탭·주요 버튼·강조선에 사용"이라는 레드 주도 서술이 있으나, 현재 구현(yonhap.css, articleDetail.js)과 SPEC Decision Lock(D-4)은 블루 #0A4DA6 주도로 통일했다. RED는 포인트 액센트(로고 룰/알림 보더/송고 배지/임베드 좌측 룰)로만 사용된다. 상세 병기는 10장 참조.

---

## 색상 팔레트

모든 색은 yonhap.css `:root` 토큰으로 정의되며, 신규 색 변수 도입은 금지된다(SPEC-NEWS-REVISE 전반 NFR §5.1, SPEC-HARNESS-NEWS-001 Exclusions). (출처: web/src/styles/yonhap.css)

| 토큰명 | 값 | 용도 | 출처 |
|--------|----|------|------|
| `--yh-blue` | `#0a4da6` | primary chrome, 헤더 보더/워드마크, 기본 버튼, 활성 탭·네비, 링크, 포커스, 테이블 밑줄 (연합 호환 딥블루) | web/src/styles/yonhap.css |
| `--yh-blue-dark` | `#083d84` | hover/active 강조 | web/src/styles/yonhap.css |
| `--yh-blue-light` | `rgba(10,77,166,0.08)` | hover row / focus tint용 연한 블루 틴트 | web/src/styles/yonhap.css |
| `--yh-red` | `#c8102e` | accent/point, 연합 brand identity (로고 룰, 알림 보더, 송고 배지, 임베드 좌측 룰) | web/src/styles/yonhap.css |
| `--yh-red-dark` | `#a50d26` | 알림 텍스트 등 짙은 레드 | web/src/styles/yonhap.css |
| `--yh-red-light` | `rgba(200,16,46,0.08)` | 삭제 어포던스 hover 배경 등 연한 레드 | web/src/styles/yonhap.css |
| `--yh-gold` | `#d4af37` | Alt+Y '(끝)' end marker 골드색 | web/src/styles/yonhap.css |
| `--yh-ink` | `#1a1a1a` | 본문 기본 글자색(검정) | web/src/styles/yonhap.css |
| `--yh-gray-line` | `#ddd` | 1px 회색 구분선 | web/src/styles/yonhap.css |
| `--yh-gray-bg` | `#f5f5f5` | thead 배경, secondary hover 배경 | web/src/styles/yonhap.css |
| `--yh-gray-mid` | `#888` | 보조 텍스트/플레이스홀더 | web/src/styles/yonhap.css |
| `--yh-gray-dark` | `#444` | 일반 보조 텍스트 | web/src/styles/yonhap.css |
| `--yh-white` | `#ffffff` | 배경, 카드, 버튼 텍스트 | web/src/styles/yonhap.css |

### 상태 배지 색 토큰

상태 배지/버튼 팔레트에 공통 사용된다. (출처: web/src/styles/yonhap.css)

| 토큰명 | 값 | 용도 |
|--------|----|------|
| `--yh-badge-rds-bg` / `--yh-badge-rds-fg` | `#e8e8e8` / `#555` | RDS(기사대기/draft) |
| `--yh-badge-send-bg` / `--yh-badge-send-fg` | `#c8102e` / `#ffffff` | 송고(send, *PS/DPS/BPS) — 레드 |
| `--yh-badge-hold-bg` / `--yh-badge-hold-fg` | `#d97706` / `#ffffff` | 보류(hold, *RH/*DH) — amber |
| `--yh-badge-kill-bg` / `--yh-badge-kill-fg` | `#374151` / `#ffffff` | KILL(*RK/*DK) — slate |
| `--yh-badge-ok-bg` / `--yh-badge-ok-fg` | `#15803d` / `#ffffff` | OK/confirmed(published) — green |

### 상세보기 팝업 전용 토큰 (별도 :root)

상세보기 새창(`articleDetail.js`)은 yonhap.css와 분리된 자체 `:root` 토큰 6종을 정의한다. 토큰명이 일부 겹치지만 값/표기가 다르므로 별도 관리된다. (출처: web/src/view/articleDetail.js)

| 토큰명 | 값 | 용도 |
|--------|----|------|
| `--yh-blue` | `#0A4DA6` | 강조선, 라벨, 섹션 헤더 |
| `--yh-blue-deep` | `#08306B` | hover/선택 강조 |
| `--yh-blue-soft` | `#E8F0FB` | 공통정보 셀 배경 |
| `--yh-ink` | `#08306B` | 본문 글자색(팝업은 잉크를 딥블루로 정의) |
| `--yh-gray-line` | `#DDE3EC` | 1px 구분선 (파란빛 회색) |
| `--yh-gray-mid` | `#6B7A90` | 빈 필드(em-dash) 약화 텍스트 |

> gray-line 토큰 충돌: yonhap.css는 `--yh-gray-line: #ddd`, 상세보기 팝업·`.moai/project/tech.md`·도메인 스킬·SPEC-NEWS-REVISE 계열은 `--yh-gray-line: #DDE3EC`(파란빛 회색)로 명기한다. SPEC-NEWS-REVISE-004/006이 정확 토큰 `#DDE3EC`를 회귀 가드로 잠갔다(`#DD0000` 같은 레드 오변경 차단). 상세보기 팝업 기준 정본은 `#DDE3EC`이다.

---

## 타이포그래피

### 폰트 스택

- `--yh-serif`: `"Nanum Myeongjo", "Noto Serif KR", serif` — 헤드라인/제목/에디터 본문 (명조)
- `--yh-sans`: `"Noto Sans KR", system-ui, sans-serif` — UI/본문 고딕

(출처: web/src/styles/yonhap.css, news.md)

폰트는 Google Fonts에서 3종 로딩한다: Nanum Myeongjo(wght@400;700;800), Noto Sans KR(wght@400;500;600;700), Noto Serif KR(wght@400;700), `display=swap` 적용. `fonts.googleapis.com`/`fonts.gstatic.com` preconnect 2개로 로딩 최적화(gstatic은 crossorigin). 주석상 역할: Noto Sans KR=UI, Nanum Myeongjo=headlines. (출처: web/index.html)

### 크기·굵기 체계

- 베이스: `html font-size 14px`, body `var(--yh-sans)`, color `var(--yh-ink)`, background `var(--yh-white)`, line-height 1.5. `box-sizing: border-box` 전역. (출처: web/src/styles/yonhap.css)
- 제목 `h1~h4`: font-family `var(--yh-serif)`, line-height 1.3. (출처: web/src/styles/yonhap.css)
- 입력 요소: `input/select/textarea` font-size 0.9rem (베이스). 컴포넌트별 0.85~0.95rem로 오버라이드. (출처: web/src/styles/yonhap.css)

### 줄 역할별 색 규칙 (에디터 본문 / 상세보기)

에디터 본문은 줄 역할에 따라 색을 입힌다. 색 의미는 클래스(span)로 구분하고 실제 텍스트는 변경하지 않는다. 표시(presentation)만 적용하며 compositionend/blur/programmatic-load 시 재실행(한글 IME 안전), 매 키 입력에는 비적용한다. (출처: web/src/styles/yonhap.css, web/src/view/editorColoring.js, web/src/view/WritePage.jsx)

| 역할 | 클래스 | 글자색 | 판정 규칙 |
|------|--------|--------|-----------|
| 제목 | `.yh-line--title` | 파란색 `var(--yh-blue)` | line[0] 항상 제목 |
| 부제목 | `.yh-line--subtitle` | 빨간색 `var(--yh-red)` | 제목 다음 줄~첫 빈 줄(또는 4줄 캡, MAX_SUBTITLE_LINES=4, 즉 2~5번째 줄) 직전까지. 개행 2회 이상이면 그 시점부터 본문 |
| 본문 | `.yh-line--body` | 검정 `var(--yh-ink)` | 그 이후 모든 줄(기본값) |
| (끝) 마커 | `.yh-end-mark` | 골드 `var(--yh-gold)` | 본문 끝의 (끝) END_MARKER를 peel off하여 별도 골드 세그먼트로 처리 |

상세보기 팝업의 줄 역할별 색은 별도다: 제목/본문 모두 명조체이며 색은 블루 계열(제목 `--yh-blue-deep` #08306B, 섹션 헤더/라벨 `--yh-blue` #0A4DA6, 본문 `--yh-ink` #08306B). (출처: web/src/view/articleDetail.js)

---

## 레이아웃

### 작성 워크스페이스 셸 (멀티탭)

작성 화면은 단일 페이지가 아니라 멀티탭 워크스페이스(`WriteWorkspace`)로 구성된다. 최상위 `div.yh-workspace` 안에 탭 스트립(`role=tablist`, aria-label='작성 탭', `.yh-edit-tabs`, data-testid=edit-tabs) + 각 탭별 탭 패널(`div role=tabpanel .yh-edit-tabpanel`, 비활성 탭은 hidden·활성 탭만 표시)이 있고, 탭 패널이 아래 '작성기 60/40 분할' WritePage 레이아웃을 감싼다. (출처: web/src/view/WriteWorkspace.jsx)

각 탭은 `span.yh-edit-tab`(활성 시 `.yh-edit-tab--active`) 안에 라벨 버튼 `button.yh-edit-tab__label`(role=tab, aria-selected, aria-controls=writer-panel-{id}, 텍스트=editArticleId 또는 '새 기사') + 닫기 버튼 `button.yh-edit-tab__close`(텍스트 '×', aria-label='{label} 탭 닫기')로 구성되고, 스트립 끝에 새 탭 추가 버튼 `button.yh-edit-tabs__add`(텍스트 '＋', aria-label='새 작성 탭')가 있다. 모든 탭 에디터는 mounted 상태를 유지하고 비활성 탭만 hidden 처리한다. (출처: web/src/view/WriteWorkspace.jsx)

조회 페이지의 편집/고침/포털고침 진입은 해당 기사를 새 탭으로 연다. 같은 기사(`?id=`)를 다시 열면 새 탭을 만들지 않고 기존 탭을 활성화한다(D2-5 자기 잠금 충돌 차단). (출처: web/src/view/WriteWorkspace.jsx, web/src/view/ViewPage.jsx)

### 페이지별 구조

| 페이지 | 구조 | 출처 |
|--------|------|------|
| 로그인 (login.do) | `.yh-login-wrap`(min-height 100vh, flex center) 안 `.yh-card`(width 380px). 블루 그라데이션 배경 + 흰 카드 | web/src/view/LoginPage.jsx, web/src/styles/yonhap.css |
| 공통 셸 헤더 | `header.yh-topbar` height 48px(`--yh-header-height`), sticky top 0, z-index 100. 좌측 브랜드(`.yh-brand`) + 우측 사용자(`.yh-user`) | web/src/view/TopBar.jsx, web/src/styles/yonhap.css |
| 작성기 셸 (writer.do) | `div.yh-workspace` 안 탭 스트립(`.yh-edit-tabs`) + 탭 패널(`.yh-edit-tabpanel`)로 멀티탭 구성. 각 패널이 WritePage 60/40 레이아웃을 감쌈 | web/src/view/WriteWorkspace.jsx |
| 작성기 본문 (writer.do) | `.yh-write-layout` grid `60% 40%` — 좌측 에디터 영역 60%(`.yh-editor-region`, aria-label 에디터) + 우측 메타 40%(`.yh-meta-region`, aria-label 메타데이터). min-height `calc(100vh - var(--yh-header-height) - 40px)` | web/src/view/WritePage.jsx, news.md, web/src/styles/yonhap.css |
| 조회 (list.do) | `.yh-view-wrap`(padding, max-width 1400px, 중앙 정렬). 조회 메뉴 4종 + 공유 8컬럼 그리드 헤더/행 | web/src/view/ViewPage.jsx, web/src/styles/yonhap.css |
| 상세보기 (새창 팝업) | 상단 공통정보 12필드 가로 나열 → 하단 통합 '기사' 영역(제목 → 본문 연속) | web/src/view/articleDetail.js, news.md |

### 헤더 (.yh-topbar)

position sticky top 0, z-index `var(--yh-topbar-z)`=100, height 48px, padding `0 var(--yh-sp-xl)`, flex space-between. 흰 배경(`var(--yh-white)`), color `var(--yh-ink)`, **border-bottom 3px solid var(--yh-blue)**(블루 밑줄), box-shadow `var(--yh-shadow-sm)`. (출처: web/src/styles/yonhap.css)

### 작성 탭 스트립 (.yh-edit-tabs / .yh-edit-tab)

멀티탭 작성 워크스페이스(`WriteWorkspace`)의 탭 UI. yonhap.css '6b. Writer workspace tabs (멀티탭 작성 — WriteWorkspace)' 별도 layer로 정의된다(기본 `tokens → resets → layout → components` 구성 순서와 별개 섹션). (출처: web/src/styles/yonhap.css, web/src/view/WriteWorkspace.jsx)

| 컴포넌트 | 스타일 | 출처 |
|----------|--------|------|
| `.yh-edit-tabs` (탭 스트립) | display flex, align-items flex-end, gap 2px, padding `var(--yh-sp-sm) var(--yh-sp-md) 0`, background `var(--yh-gray-bg)`, **border-bottom 2px solid `var(--yh-blue)`**(블루 밑줄), overflow-x auto | web/src/styles/yonhap.css |
| `.yh-edit-tab` (개별 탭) | inline-flex, max-width 240px, background #fff, color `var(--yh-gray-mid)`, border 1px solid `var(--yh-gray-line)`, border-bottom none, border-radius `6px 6px 0 0`(상단만 둥근 탭형) | web/src/styles/yonhap.css |
| `.yh-edit-tab--active` (활성 탭) | background `var(--yh-blue)`, color #fff(블루 반전) | web/src/styles/yonhap.css |
| `.yh-edit-tab__label` (탭 라벨 버튼) | padding `var(--yh-sp-sm) var(--yh-sp-sm) var(--yh-sp-sm) var(--yh-sp-md)`, font-size 0.85rem, color inherit, max-width 190px, 한 줄 말줄임(white-space nowrap, overflow hidden, text-overflow ellipsis) | web/src/styles/yonhap.css |
| `.yh-edit-tab__close` (× 닫기 버튼) | background none, border none, padding `0 var(--yh-sp-sm)`, font-size 0.9rem, line-height 1, color inherit. hover color `var(--yh-blue)`; 활성 탭 내부 close hover 는 color #fff + opacity 0.75 | web/src/styles/yonhap.css |
| `.yh-edit-tabs__add` (＋ 새 탭 추가) | background none, **border 1px dashed `var(--yh-gray-line)`**(점선 보더), border-bottom none, border-radius `6px 6px 0 0`, padding `var(--yh-sp-sm) var(--yh-sp-md)`, color `var(--yh-blue)`. hover background #fff | web/src/styles/yonhap.css |

### 작성기 60/40 분할

좌측 에디터 영역(`.yh-editor-region`, data-testid=editor-region) 60% + 우측 메타데이터 영역(`.yh-meta-region`, data-testid=metadata-region) 40%. 좌측은 본문 에디터, 우측은 송고/보류/KILL 액션 버튼 + 읽기전용 메타 + 탭 4종(공통정보/이미지/영상/글기사). 탭 위에 송고·보류 버튼 배치. (출처: web/src/view/WritePage.jsx, news.md, .claude/skills/moai-domain-news-editor/SKILL.md)

### 조회 8컬럼 그리드 (.yh-desk-header / .yh-desk-row)

조회 4개 메뉴(데스크 미송고/부서별 작성/부서별 송고/개인별 수정) 공용. `grid-template-columns: 11rem minmax(0,1fr) 6rem 6rem 8.5rem 8.5rem 4.5rem 4rem` = 기사아이디 | 제목(flex) | 작성자 | 수정자 | 작성시간 | 수정시간 | 기사상태 | LockYN, gap `var(--yh-sp-sm)`. 헤더 padding `var(--yh-sp-xs) var(--yh-sp-sm)`, border-bottom 2px solid `var(--yh-blue)`, color `var(--yh-blue)`, font-size 0.8rem, font-weight 700. 행은 `grid-auto-flow:column` + `grid-auto-columns:max-content`로 9번째 액션 버튼(부서별 송고 DPS 행 고침/포털고침)을 같은 줄 암시 컬럼에 배치. 정렬 시간 내림차순, 페이지당 10개(PAGE_SIZE=10). (출처: web/src/view/ViewPage.jsx, web/src/styles/yonhap.css, news.md, REQ-FE-VIEW-011 v0.5.0)

### 상세보기 팝업 레이아웃

새창 body: margin 0, padding 24px, font-family `'Noto Sans KR', system-ui, sans-serif`, color `var(--yh-ink)`(#08306B), background #fff, line-height 1.6, box-sizing border-box. 상단 공통정보 12필드를 가로 나열(`.yh-detail__info` display flex, flex-wrap wrap, gap 8px) → 하단 단일 `.yh-detail__article` 통합 영역(제목 → 본문 연속). 제목/본문 분리 2영역은 폐지(SPEC-NEWS-REVISE-002). 두 섹션 aria-label은 "공통정보"/"기사". (출처: web/src/view/articleDetail.js)

> 상세보기 구조 충돌 주의: SPEC-NEWS-REVISE-001/003/004/006의 회귀 가드는 `aria-label="제목"` + `aria-label="본문"` 2섹션 분리 구조를 단언한다. 그러나 현재 구현(articleDetail.js, SPEC-NEWS-REVISE-002)은 제목+본문을 단일 `.yh-detail__article`(aria-label="기사")로 통합했다. 코드 현실 기준 정본은 통합 구조다. 10장 참조.

---

## 컴포넌트 디자인

### 버튼 (.yh-btn)

베이스: inline-flex center, padding `var(--yh-sp-xs) var(--yh-sp-md)`, font-size 0.85rem, font-weight 500, border-radius 3px, border 1px solid transparent, transition `background/border-color 0.15s`. `--sm`: padding `2px var(--yh-sp-sm)` font-size 0.8rem. `:disabled` opacity 0.45 cursor not-allowed. (출처: web/src/styles/yonhap.css)

| 변형 | 클래스 | 스타일 | 용도 |
|------|--------|--------|------|
| Primary | `.yh-btn--primary` | solid blue: bg `--yh-blue`, color `--yh-white`, border `--yh-blue`, letter-spacing 0.02em. hover bg `--yh-blue-dark` + box-shadow `0 2px 6px rgba(10,77,166,0.3)`. active translateY(1px) | 송고, 로그인 제출 |
| Secondary | `.yh-btn--secondary` | outlined: bg `--yh-white`, color `--yh-gray-dark`, border `--yh-gray-line`. hover bg `--yh-gray-bg` | 조회/고침/페이지네이션/검색·삽입 |
| Hold | `.yh-btn--hold` | amber 경고: bg #fff7ed, color #92400e, border #fcd34d. hover bg #fef3c7 | 보류 |
| KILL | `.yh-btn--kill` | slate danger: bg #374151(`--yh-badge-kill-bg`), color `--yh-white`. hover bg #1f2937 border #1f2937 | KILL |

크기 수식자 `.yh-btn--sm`(소형)은 검색/삽입/조회/페이지네이션 버튼에 공통 적용된다. 송고/보류/KILL 노출 조건은 역할(R/D/Z) + 상태 RDS이며, KILL은 추가로 articleId 생성된 편집 컨텍스트에서만 표시(신규 초안 A-DRAFT 비표시). 권한별 색 구분은 없다(SPEC-NEWS-REVISE-001). (출처: web/src/view/WritePage.jsx, news.md, .claude/skills/moai-domain-news-editor/SKILL.md)

### 폼

| 컴포넌트 | 스타일 | 출처 |
|----------|--------|------|
| `.yh-field` | flex column gap 2px. label font-size 0.78rem color `--yh-gray-mid` weight 600. input/select/textarea width 100%, padding `--yh-sp-sm`, border 1px solid `--yh-gray-line`, border-radius `--yh-radius-sm`(2px), font-size 0.88rem. focus: border-color `--yh-blue` + box-shadow `0 0 0 3px rgba(10,77,166,0.12)`(soft blue glow), outline none | web/src/styles/yonhap.css |
| `.yh-field-row` | grid `6rem 1fr`, align center, gap `--yh-sp-sm`. label 우측 정렬 0.78rem `--yh-gray-mid` weight 600. input/select padding `2px --yh-sp-sm`, focus border `--yh-blue`. 공통정보 입력 폼·엠바고 datetime-local | web/src/styles/yonhap.css, web/src/view/WritePage.jsx |
| `.yh-readonly-meta` | 편집 컨텍스트 8필드 읽기전용. 컨테이너 border-top 2px solid `--yh-blue`, border-bottom 1px solid `--yh-gray-line`. `__row` grid `6rem 1fr`. `__label` 0.78rem weight 600 우측정렬 color `--yh-blue`(연합 라벨 파란색). `__value` 0.88rem `--yh-ink` word-break break-all. 신규 토큰 없이 기존 토큰만(REQ-NFR §5.1, SPEC-NEWS-REVISE-007) | web/src/styles/yonhap.css, web/src/view/WritePage.jsx |

읽기전용 8필드: 기사아이디·수정자·송고자·부서·부서코드·작성시간·편집시간·송고시간. `<dl class=yh-readonly-meta>`(aria-label 기사 정보), 각 행 `__row`, dt `__label`, dd `__value`로 표기하며 입력창이 아닌 display-only로 편집 불가 처리. (출처: web/src/view/WritePage.jsx)

### 테이블/목록

| 컴포넌트 | 스타일 | 출처 |
|----------|--------|------|
| `.yh-table` | width 100%, border-collapse collapse, font-size 0.88rem. thead bg `--yh-gray-bg`. th padding `--yh-sp-xs --yh-sp-sm`, **border-bottom 2px solid `--yh-blue`**(블루 헤더 밑줄), 0.78rem weight 700 color `--yh-gray-dark`. td border-bottom 1px solid `--yh-gray-line`, color `--yh-ink`. `tr:hover td` bg `--yh-blue-light` | web/src/styles/yonhap.css |
| `.yh-article-list` / `.yh-article-row` | ul 기반(table 아님), list-style none, **border-top 2px solid `--yh-blue`**(블루 주도 상단 룰). row flex, gap `--yh-sp-sm`, padding `--yh-sp-sm`, border-bottom 1px solid `--yh-gray-line`, 0.88rem, transition background/border-left, border-left 3px solid transparent(hover 액센트 공간 예약), cursor pointer | web/src/styles/yonhap.css |

목록 컬럼 텍스트: `__id/__status/__lock` color `--yh-gray-dark` 0.82rem 말줄임, `__title` flex 1 명조체 `--yh-ink` 말줄임, `__author/__modifier` width 6rem `--yh-gray-dark` 0.82rem 말줄임, `__time` width 9rem `--yh-gray-mid` 0.78rem 우측정렬. 신문 인덱스풍 고정폭 한 줄 정렬. 인라인 액션 `__actions` flex gap `--yh-sp-xs`. (출처: web/src/styles/yonhap.css, web/src/view/ViewPage.jsx)

> v0.4.0 목록 통일로 목록 자체의 상태 배지는 제거됐으나, 배지 색 토큰은 버튼 팔레트가 계속 사용한다.

### 상태 배지 (.yh-badge)

기본: inline-block, padding `1px 6px`, border-radius 3px, font-size 0.7rem, font-weight 700, letter-spacing 0.04em, white-space nowrap. 상태별 색 매핑(생애주기 시각 표현 규칙): (출처: web/src/styles/yonhap.css)

| 변형 | 대상 상태 | 배경/글자 |
|------|-----------|-----------|
| `--rds` | 기사대기/draft | `--yh-badge-rds-bg` #e8e8e8 / `--yh-badge-rds-fg` #555 |
| `--send` | 송고 *PS/DPS/BPS | `--yh-badge-send-bg` #c8102e / #ffffff (레드) |
| `--hold` | 보류 *RH/*DH | `--yh-badge-hold-bg` #d97706 / #ffffff (amber) |
| `--kill` | *RK/*DK | `--yh-badge-kill-bg` #374151 / #ffffff (slate) |
| `--ok` | 확정/published | `--yh-badge-ok-bg` #15803d / #ffffff (green) |

### 탭/네비

| 컴포넌트 | 스타일 | 출처 |
|----------|--------|------|
| `.yh-nav` (사이트 네비) | flex, padding `0 --yh-sp-xl`, bg `--yh-white`, border-bottom 1px solid `--yh-gray-line`. `__link` padding `--yh-sp-sm --yh-sp-md`, 0.85rem, color `--yh-gray-dark`, border-bottom 2px solid transparent. hover color `--yh-blue`. `--active` color `--yh-blue`, border-bottom-color `--yh-blue`, weight 600 | web/src/styles/yonhap.css |
| `.yh-tabs` / `.yh-tab` (메타 탭 4종) | tabs border-bottom 1px solid `--yh-gray-line`. tab padding `--yh-sp-sm --yh-sp-md`, 0.85rem, border-bottom 2px solid transparent, color `--yh-gray-mid`, margin-bottom -1px. hover color `--yh-blue`. `--active` color `--yh-blue`, border-bottom-color `--yh-blue`, weight 600 + aria-selected=true. 패널 `.yh-tabpanel`(role=tabpanel) | web/src/styles/yonhap.css, web/src/view/WritePage.jsx |
| `.yh-view-menu` / `__btn` (조회 4메뉴) | menu flex, padding `--yh-sp-sm 0`, border-bottom 2px solid `--yh-blue`. btn padding `--yh-sp-xs --yh-sp-md`, 0.82rem, border 1px solid `--yh-gray-line`, border-radius `--yh-radius-sm`, bg `--yh-white`, color `--yh-gray-dark`. hover bg `--yh-blue-light` color `--yh-blue` border rgba(10,77,166,0.2). `--active` bg `--yh-blue` color `--yh-white` border `--yh-blue` weight 600 box-shadow `0 1px 4px rgba(10,77,166,0.25)` + aria-pressed=true | web/src/styles/yonhap.css, web/src/view/ViewPage.jsx |

### 컨텍스트 메뉴 (.yh-ctxmenu)

우클릭(ViewPage). position fixed, z-index `calc(var(--yh-topbar-z)+10)`, padding `--yh-sp-xs 0`, list-style none, min-width 11rem, bg `--yh-white`, border 1px solid `--yh-gray-line`, **border-top 3px solid `--yh-blue`**(BLUE-LED 상단 라인), border-radius `--yh-radius-md`, box-shadow `--yh-shadow-lg`, font-size 0.85rem. 커서 위치 추종(인라인 style top/left = clientX/clientY). (출처: web/src/styles/yonhap.css, web/src/view/ContextMenu.jsx)

- `__item`: flex space-between, width 100%, padding `--yh-sp-xs --yh-sp-md`, border 0, bg transparent, color `--yh-ink`, 명조 아닌 `--yh-sans`. `role=menuitem`.
- hover(`:not(:disabled)`): bg `--yh-blue-light`(BLUE-LED hover). `:focus-visible` outline 2px solid `--yh-blue` offset -2px. `--disabled/:disabled` color `--yh-gray-mid` cursor not-allowed.
- `__hint`(준비중 마커): color `--yh-red`(RED 포인트 액센트), 0.72rem, 텍스트 '(준비중)'.

메뉴 항목(부서별 작성/송고/개인별 수정): 상세보기/이력보기/송고이력보기/본문복사/제목만복사/번역/매핑/후속기사작성/계속기사작성/고침(포털제외)/포털고침/삭제요청/재송. 데스크 미송고: 편집/상세보기/이력보기/본문복사/제목만복사. 부서별 송고에는 편집 추가. 고침/포털고침은 DPS 기사에서 D 권한만 활성. (출처: news.md, .moai/specs/SPEC-NEWS-REVISE-007)

### 에디터 (.yh-editor-body / .yh-editor-region)

- region: flex column, padding `--yh-sp-md`, border-right 1px solid `--yh-gray-line`. label 0.78rem `--yh-gray-mid` weight 600(단, v0.3.0부터 '본문' 라벨 텍스트 비표시, aria-label만 유지).
- 본문(contentEditable div, id=editor-body): flex 1, min-height 50vh, padding `--yh-sp-md --yh-sp-sm`, border 1px solid `--yh-gray-line`, border-radius `--yh-radius-sm`, font-family `--yh-serif`, font-size 0.95rem, line-height 1.8, color `--yh-ink`, bg `--yh-white`, white-space pre-wrap, overflow-wrap anywhere. `role=textbox`, `aria-multiline=true`, `aria-label=본문`. 줄바꿈은 모델('\n')로 관리, trailing '\n'은 보이지 않는 마지막 줄 위해 `<br>`로 패딩 렌더(textContent 미영향).
- 포커스: outline none, border-color `--yh-blue`, box-shadow `0 0 0 3px rgba(10,77,166,0.1)`(파란 포커스 링).
- (구) textarea 기반 에디터도 정의 존재: flex 1, min-height 60vh, 명조 0.95rem line-height 1.7, resize vertical.

(출처: web/src/styles/yonhap.css, web/src/view/WritePage.jsx, SPEC-UI-EDITOR-001)

### 임베드 (크기·배율)

이미지/영상/글기사 검색 결과를 본문 커서 위치에 인라인 삽입한다. 임베드 span은 textContent에 기여하지 않아 캐럿 오프셋·글자수가 byte-stable하게 유지된다. (출처: web/src/styles/yonhap.css, web/src/view/WritePage.jsx, SPEC-UI-EDITOR-001)

| 컴포넌트 | 크기/스타일 | 출처 |
|----------|-------------|------|
| `.yh-embed-inline` | display block, margin `--yh-sp-md 0`, border-left-color `--yh-blue`. 본문 텍스트 흐름 안 자기 줄 차지하는 본문형 블록. 래퍼 색은 디자인 토큰(파랑/회색)만, #C8102E 금지(AC-EMB-INLINE-3 잠금) | web/src/styles/yonhap.css, SPEC-NEWS-REVISE-003 |
| `.yh-embed` (카드 베이스) | position relative, flex column, gap `--yh-sp-xs`, **max-width 612px**(사진/영상 figure 폭 = 기존 360px × 1.7), padding `--yh-sp-sm --yh-sp-md`, border 1px solid `--yh-gray-line`, **border-left 3px solid `--yh-red`**(D-4 잠금 레드 액센트), border-radius 3px, bg `--yh-white`, `--yh-sans` 0.85rem | web/src/styles/yonhap.css, news.md |
| `.yh-embed--article` (기사 참조) | flex row, align center, **max-width 480px**(배지+제목 한 줄 가로형). 1.7배(612px) 미적용, 480px 유지 | web/src/styles/yonhap.css, news.md |
| `.yh-embed--clipboard` (클립보드) | **max-width 17% / max-height 17%**(에디터 100% 대비 가로*세로 10%→17%, 10×1.7=17) | web/src/styles/yonhap.css, news.md |
| `.yh-embed__img` | width 100%(figure 폭 채움), height auto(비율 유지), object-fit cover, border-radius 2px, border 1px solid `--yh-gray-line`. 캡션(`.yh-embed__caption`)은 SPEC-NEWS-REVISE-001로 렌더링 안 함(규칙 제거), title은 img alt로만 접근성 유지 | web/src/styles/yonhap.css, web/src/view/WritePage.jsx |
| `.yh-embed__title` | `--yh-sans`, color `--yh-gray-dark`, 한 줄 말줄임 | web/src/styles/yonhap.css |
| `.yh-embed__link` | 0.78rem, color `--yh-red`, 한 줄 말줄임 | web/src/styles/yonhap.css |
| `.yh-embed__video-mark` / `__article-mark` | flex-shrink 0, padding `1px 6px`, border-radius 3px, **bg `--yh-red`**(브랜드 레드), color `--yh-white`, 0.7rem weight 700. 영상/기사 타입 표시 | web/src/styles/yonhap.css |
| `.yh-embed__delete` (× 삭제) | position absolute top 2px right 4px, padding `0 4px`, border none, bg transparent, color `--yh-gray-mid`, 1rem. hover/focus color `--yh-red` + bg `--yh-red-light`. 카드 우상단 은은 배치. `aria-label='임베드 삭제'`, type=button, mousedown preventDefault로 캐럿 안정 | web/src/styles/yonhap.css, web/src/view/WritePage.jsx, SPEC-NEWS-REVISE-002/003 |

임베드 렌더 구조: 이미지=`.yh-embed--image` + `<img class=yh-embed__img>`; 영상=`.yh-embed--video` + 썸네일 img + `__video-mark` + `__title` + `__link`; 기사=`.yh-embed--article` + `__article-mark` + `__title`(썸네일 없이 텍스트 표식+제목). 모두 contenteditable=false, tabindex=0. (출처: web/src/view/WritePage.jsx)

> 임베드 크기 충돌 주의: `.moai/project/tech.md`·`clipboardEmbed.js`·SPEC-NEWS-REVISE-003 Exclusions에는 클립보드 이미지 "10%×10%"로 기재돼 있으나, 현재 yonhap.css/news.md/도메인 스킬은 1.7배 적용한 "17%×17%"가 정본이다. 코드(yonhap.css 17%) 기준. 10장 참조.

### 상세 팝업 (.yh-detail__*)

(출처: web/src/view/articleDetail.js)

| 컴포넌트 | 스타일 |
|----------|--------|
| `.yh-detail__section` | margin `0 0 24px`, padding 16px, bg #fff, border 1px solid `--yh-gray-line`(#DDE3EC), **border-left 4px solid `--yh-blue`**(#0A4DA6 좌측 강조선), border-radius 4px. 마지막 섹션 margin-bottom 0 |
| `.yh-detail__section-title` | 0.95rem weight 700, color `--yh-blue`(#0A4DA6), border-bottom 1px solid `--yh-gray-line` |
| `.yh-detail__info` | 공통정보 12필드 가로 나열: flex, flex-wrap wrap, gap 8px (좁은 새창에서도 줄바꿈) |
| `.yh-detail__row` | flex `1 1 9rem`, min-width 9rem, flex column, padding `6px 8px`, border 1px solid `--yh-gray-line`, border-radius 4px, bg `--yh-blue-soft`(#E8F0FB), 0.9rem. dt color `--yh-blue` weight 600. dd `--yh-ink` overflow-wrap anywhere |
| `.yh-detail__row--empty` | 빈 필드는 em-dash '—'(EMPTY_PLACEHOLDER) 표시 + dd color `--yh-gray-mid`(#6B7A90) 약화. 12행 항상 렌더 |
| `.yh-detail__title` | 명조(`'Nanum Myeongjo','Noto Serif KR',serif`), **font-size 1.3rem** weight 700, color `--yh-blue-deep`(#08306B), border-bottom 1px solid `--yh-gray-line`. 빈 제목 시 '(제목 없음)' 플레이스홀더 |
| `.yh-detail__content` | 명조, **font-size 1.75rem**(제목 1.3rem보다 크게 — REQ-DETAIL-FONT-EMPHASIS 시각 강조), line-height 1.8, color `--yh-ink`(#08306B), white-space pre-wrap |

본문 폰트(1.75rem) > 제목 폰트(1.3rem) 관계는 테스트로 단언되며, 빈 제목 placeholder 케이스에서도 동일 관계가 유지된다(AC-FONT-1/AC-EMPH-1). XSS 방어로 escapeHtml 적용(script/img 노드 0개, 문자열로만 표시). (출처: web/src/view/articleDetail.js, web/src/view/articleDetail.test.js, SPEC-NEWS-REVISE-002/003)

### 기타 컴포넌트

| 컴포넌트 | 스타일 | 출처 |
|----------|--------|------|
| `.yh-card` (로그인) | bg `--yh-white`, border 1px solid rgba(10,77,166,0.15), border-radius `--yh-radius-lg`(6px), box-shadow `--yh-shadow-lg` + `0 0 0 1px rgba(255,255,255,0.1)`, padding `2rem 2rem 1.75rem`, width 380px, position relative, overflow hidden | web/src/styles/yonhap.css |
| `.yh-card::before` | 상단 브랜드 바 height 5px, `linear-gradient(90deg, --yh-blue-dark 0%, --yh-blue 50%, --yh-red 100%)`(블루→레드) | web/src/styles/yonhap.css |
| `.yh-card::after` | 우하단 블루 틴트 원 120px, `radial-gradient(circle, rgba(10,77,166,0.06) 0%, transparent 70%)` | web/src/styles/yonhap.css |
| `.yh-login-wrap` 배경 | `linear-gradient(160deg, --yh-blue-dark 0%, --yh-blue 60%, #1a6acf 100%)`(딥네이비→블루 그라데이션) | web/src/styles/yonhap.css |
| `.yh-alert` (경고/에러) | padding `--yh-sp-xs --yh-sp-sm`, **border-left 3px solid `--yh-red`**, bg #fff5f5, 0.85rem, color `--yh-red-dark`. role=alert/status | web/src/styles/yonhap.css, web/src/view/WritePage.jsx |
| `.yh-lock-banner` (편집 잠금) | role=alert aria-live=assertive. '해당 기사는 다른 페이지/세션에서 편집 중입니다.' 표시 + 에디터 contentEditable=false 비활성 | web/src/view/WritePage.jsx, SPEC-NEWS-REVISE-002/003 |
| `.yh-pagination` | flex center, gap `--yh-sp-md`, padding `--yh-sp-md 0`. `__indicator` 0.82rem weight 600 min-width 4rem '{page} / {pageCount}'. 이전/다음 버튼 경계 disabled | web/src/styles/yonhap.css, web/src/view/ViewPage.jsx |
| `.yh-dept-filter` | flex align center, gap `--yh-sp-sm`. label `--yh-gray-mid` weight 600 0.78rem. select 0.85rem border `--yh-gray-line`. 부서별 송고/작성에서만 노출 | web/src/styles/yonhap.css, web/src/view/ViewPage.jsx |
| `.yh-search-bar` / `.yh-result-list` / `__row` | search-bar flex gap `--yh-sp-xs`; input flex 1, :focus border `--yh-blue`. result-row flex space-between, border-bottom 1px solid `--yh-gray-line`, 말줄임 | web/src/styles/yonhap.css, web/src/view/WritePage.jsx |
| `.yh-result-thumb` | width 56px, height 40px, object-fit cover, border 1px solid `--yh-gray-line`, border-radius 2px. 이미지/영상 검색 행 썸네일 | web/src/styles/yonhap.css |
| 유틸리티 | `.yh-divider` border-top 1px `--yh-gray-line`; `.yh-page-content` padding `--yh-sp-md --yh-sp-lg`; `.yh-text-red` color `--yh-red`; `.yh-text-muted` color `--yh-gray-mid` 0.82rem; `.yh-tabpanel` padding-top `--yh-sp-sm` | web/src/styles/yonhap.css |

### 브랜드/사용자 영역

- `.yh-brand__logo`: '연합' 블루 레터링, 명조 1.15rem weight 700, letter-spacing -0.02em, color `--yh-blue`, **border-left 3px solid `--yh-red`**(레드 좌측 룰), padding `3px --yh-sp-sm`. (출처: web/src/styles/yonhap.css)
- `.yh-brand__title`: 0.8rem weight 600 color `--yh-blue` opacity 0.9. 텍스트 '기사 제작 시스템'. (출처: web/src/styles/yonhap.css, web/src/view/TopBar.jsx)
- `.yh-user`: flex gap `--yh-sp-md` 0.8rem. `__name` weight 600 color `--yh-blue`(userId 브랜드 블루) · `__dept` color `--yh-gray-dark` · `__role` color `--yh-gray-mid` 0.75rem. ' · ' 구분자. (출처: web/src/styles/yonhap.css, web/src/view/TopBar.jsx)
- `.yh-logout-btn`: padding `2px --yh-sp-sm`, 0.75rem weight 600, color `--yh-blue`, bg `--yh-white`, border 1px solid `--yh-blue`, border-radius 3px. hover bg `--yh-blue` color `--yh-white`. focus-visible outline 2px solid `--yh-blue`. aria-label='로그아웃'. (출처: web/src/styles/yonhap.css, web/src/view/TopBar.jsx)
- 로그인 카드 로고 `.yh-card__logo`: 명조 1.9rem weight 800(최중량, 신문 1면 타이틀 질감), color `--yh-blue`, letter-spacing -0.04em, **border-left 4px solid `--yh-red`**. 서브타이틀 `.yh-card__subtitle`: Noto Serif KR 0.82rem weight 400 color `--yh-blue` opacity 0.7 letter-spacing 0.1em. (출처: web/src/styles/yonhap.css)

---

## 간격·그림자·radius·transition 스케일

(출처: web/src/styles/yonhap.css)

### 간격 (--yh-sp-*)

| 토큰 | 값 |
|------|----|
| `--yh-sp-xs` | 0.25rem |
| `--yh-sp-sm` | 0.5rem |
| `--yh-sp-md` | 0.75rem |
| `--yh-sp-lg` | 1rem |
| `--yh-sp-xl` | 1.5rem |

### 그림자 (--yh-shadow-*)

| 토큰 | 값 |
|------|----|
| `--yh-shadow-sm` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| `--yh-shadow-md` | `0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)` |
| `--yh-shadow-lg` | `0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)` |

### radius (--yh-radius-*)

| 토큰 | 값 |
|------|----|
| `--yh-radius-sm` | 2px |
| `--yh-radius-md` | 4px |
| `--yh-radius-lg` | 6px |

### transition / 레이아웃

| 토큰 | 값 |
|------|----|
| `--yh-transition` | 0.15s ease |
| `--yh-header-height` | 48px |
| `--yh-topbar-z` | 100 |

---

## 인터랙션/상태 표현

### 호버

- 링크: a color `--yh-blue` text-decoration none, hover underline. (출처: web/src/styles/yonhap.css)
- 테이블/목록 행: `tr:hover td` 또는 `.yh-article-row:hover` bg `--yh-blue-light` + 목록 행은 border-left-color `--yh-blue`(파란 좌측 액센트). (출처: web/src/styles/yonhap.css)
- 버튼: primary hover `--yh-blue-dark` + 블루 box-shadow; secondary hover `--yh-gray-bg`; 조회 메뉴 btn hover `--yh-blue-light`. (출처: web/src/styles/yonhap.css)

### 포커스

- 폼/에디터: border-color `--yh-blue` + box-shadow `0 0 0 3px rgba(10,77,166,0.12~0.1)`(파란 포커스 링), outline none. (출처: web/src/styles/yonhap.css)
- 클릭 가능 행/버튼/메뉴: `:focus-visible` outline 2px solid `--yh-blue`, offset 1px 또는 -2px. (출처: web/src/styles/yonhap.css)

### 활성

- 탭/네비/조회메뉴 활성: color `--yh-blue` + border-bottom-color `--yh-blue` + weight 600(조회메뉴는 bg `--yh-blue` 반전 + box-shadow). aria-selected/aria-pressed=true. (출처: web/src/styles/yonhap.css, web/src/view/ViewPage.jsx)
- 버튼 active: primary translateY(1px). (출처: web/src/styles/yonhap.css)

### 연결 상태 점 (.yh-status-bar)

flex, 0.75rem, padding `--yh-sp-xs --yh-sp-sm`, border-radius 3px, bg `--yh-blue-light`(연한 블루 틴트 칩), color `--yh-gray-dark`. 상태 점(`::before`) 7px 원형: **connected #4ade80(green dot)**, **disconnected #fbbf24(amber dot)**. 텍스트는 연결 시 '실시간 연결됨', 미연결 시 '비-실시간 (재연결 중)'(ViewPage RealtimeStatus는 '실시간 연결됨'/'비-실시간 (재연결 중)' 표기). 헤더 우측 상단 위치. (출처: web/src/styles/yonhap.css, web/src/view/ViewPage.jsx, news.md)

### (끝) 마커

Alt+Y로 본문 끝(임베드 뒤 최종 블록)에 정확히 '(끝)'을 1회 골드색(`--yh-gold` #d4af37)으로 삽입. 최종 시각 순서: 본문 텍스트 → 임베드 → '(끝)'. 이미 존재 시 noop. 골드 마킹은 `.yh-end-mark` 클래스(또는 data-end-marker/data-token=end-marker/color:gold 동등). 판정: trimEnd() 후 '(끝)'으로 끝나는지(공백/개행 허용, '(끝) 본문'처럼 중간만 있으면 미인정). (출처: web/src/styles/yonhap.css, web/src/view/editorColoring.js, news.md, SPEC-NEWS-REVISE-002/003/005/006)

### 단축키 / 가드

- Alt+Y: '(끝)' 골드 마커 삽입(위). Ctrl+D: 현재 라인 제거(에디터 포커스 한정, preventDefault, 전역 핸들러 금지). (출처: news.md, SPEC-NEWS-REVISE-001/003, .claude/skills/moai-domain-news-editor/SKILL.md)
- 송고 가드: 본문이 '(끝)'로 끝나지 않으면 표준 window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.') 1회 후 차단. 보류/KILL은 (끝) 없이 진행. 제목 가드('제목이 없어 송고/보류할 수 없습니다.')가 (끝) 가드보다 우선. (출처: news.md, SPEC-NEWS-REVISE-005/006)
- 송고/보류/KILL: 확인창('송고/보류/KILL하시겠습니까?') 선행, 확인 시에만 진행. 성공 시 상태 메시지 미표시 + 작성 페이지 초기화. (출처: news.md, SPEC-FRONTEND-UI-001)

---

## 접근성·품질 기준

### WCAG / 접근성

- WCAG AA 준수(대비율/키보드 내비/ARIA 라벨)가 Craft & Functionality must-pass 조건. 모든 버튼은 visible text 또는 aria-label 보유. (출처: .moai/config/evaluator-profiles/frontend.md, SPEC-NEWS-REVISE-001/002/003)
- 상세보기 섹션 aria-label('공통정보'/'기사'; 폐지된 분리 구조에서는 '제목'/'본문'). 키보드만으로 송고/보류/KILL 트리거 가능(Tab → Enter). 임베드 × 어포던스 aria-label='임베드 삭제' + 키보드(Backspace/Delete) 삭제. 락 거부 안내 aria-live='assertive'. (출처: web/src/view/articleDetail.js, SPEC-NEWS-REVISE-002/003)
- 폰트 크기 차이는 시각 강조 수단으로만 작용, 정보 의미를 색/크기에만 의존하지 않음. (출처: SPEC-NEWS-REVISE-003)
- 단, SPEC-FRONTEND-UI-001은 접근성(WCAG)·i18n·다국어·테마/다크모드를 자체 범위 밖으로 명시(Exclusions). 접근성 기준은 후속 SPEC-NEWS-REVISE 및 evaluator 프로파일에서 강화됨. (출처: .moai/specs/SPEC-FRONTEND-UI-001/spec.md)

### 반응형

- Responsive breakpoints(mobile/tablet/desktop) 테스트가 must-pass. (출처: .moai/config/evaluator-profiles/frontend.md)
- 모든 인터랙티브 요소에 hover/focus/active 상태 필수. (출처: .moai/config/evaluator-profiles/frontend.md)

### 평가 루브릭 (GAN 루프 4차원)

evaluator-active 4차원 점수, 각 0.0~1.0. pass_threshold 0.75(종합 PASS), max_iterations 5, escalation_after 3, improvement_threshold 0.05, floor 0.60(FROZEN). (출처: .moai/config/evaluator-profiles/frontend.md, .claude/skills/moai-workflow-news-production/SKILL.md)

| 차원 | 가중치 | 1.00 기준 |
|------|--------|-----------|
| Originality | 40% | 고유·의도적 디자인, 커스텀 토큰, AI-slop 미감지 |
| Design Quality | 30% | 일관 타이포 위계 + 일관 색 적용 + 의도적 spacing 리듬 |
| Craft & Functionality | 30% | WCAG AA 통과 + 전 breakpoint 반응형 + 모든 인터랙티브 상태 + 콘솔 에러 없음 |

뉴스 도메인 Design Quality rubric: 0.25=토큰 미사용·임의 색 / 0.50=일부 토큰·본문 색 규칙 부분 위반 / 0.75=토큰 일관 + 색 규칙(제목 파랑/부제 빨강/본문 검정) 준수 + 1px 회색선 / 1.0=토큰 + 신문형 밀도 + 헤더 블루 밑줄·로고 레드 룰 완벽 정합. (출처: .claude/skills/moai-workflow-news-production/SKILL.md)

### AI-Slop 안티패턴 6종 (Originality 감점)

3개 이상 감지 시 Originality FAIL, 1~2개 감지 시 0.50 캡. (출처: .moai/config/evaluator-profiles/frontend.md)

1. Stock card layouts (커스텀 토큰 없는 기본 Bootstrap/Tailwind 카드 그리드)
2. Default utility-only styling (커스텀 CSS 변수/토큰 없이 유틸 클래스만)
3. Purple/blue gradient backgrounds (브랜드 정합 없는 보라/파랑 그라디언트 hero)
4. Generic placeholder text (Lorem ipsum, Welcome to our platform 등)
5. Identical component structure (무관한 섹션 2개 이상 동일 레이아웃)
6. Missing interactive states (버튼/링크/입력/카드 hover·focus·active 누락)

> 안티패턴 3(Purple/blue gradient)과 본 프로젝트 로그인 블루 그라데이션 배경의 관계: 본 프로젝트의 블루 그라데이션은 연합뉴스 브랜드 색(--yh-blue 계열)에 정합된 의도적 배경이므로 "브랜드 정합 없는" 안티패턴에 해당하지 않는다.

### 디자인 anti-pattern cross-check

`.moai/research/observations/`의 anti-pattern과 일치 시 해당 차원 점수 ≤ 0.50 캡(편향 방지 메커니즘 5). news 도메인 예: 'Z 권한이 고침/포털고침 메뉴를 보유' 같은 권한 매트릭스 위반. (출처: .claude/skills/moai-workflow-news-production/SKILL.md)

---

## 충돌·주의 사항

문서 간 또는 문서-코드 간 값이 충돌하는 항목이다. 모든 경우 코드(`web/src/styles/yonhap.css`, `web/src/view/*`)가 현재 구현 기준이다.

| 항목 | 값 A (출처) | 값 B (출처) | 정본(코드 기준) |
|------|-------------|-------------|------------------|
| 색 체계 주도 | RED 주도: 헤더 바·활성 탭·주요 버튼·강조선에 레드 #C8102E (news.md, 루트 CLAUDE.md 변형본) | BLUE 주도: UI 크롬은 블루, RED는 포인트 액센트 (yonhap.css, SPEC D-4 Decision Lock) | BLUE 주도. RED는 로고 룰/알림 보더/송고 배지/임베드 좌측 룰 액센트 |
| gray-line 값 | `#ddd` (yonhap.css `:root`) | `#DDE3EC`(파란빛 회색) (articleDetail.js, tech.md, 도메인 스킬, SPEC-NEWS-REVISE-004/006) | 컨텍스트별 분리: yonhap.css는 #ddd, 상세보기 팝업·SPEC 정본은 #DDE3EC. `#DD0000`(레드)로의 변경은 회귀 가드 차단 |
| 클립보드 임베드 크기 | 10%×10% (tech.md, clipboardEmbed.js, SPEC-NEWS-REVISE-003 Exclusions) | 17%×17%(10×1.7) (yonhap.css, news.md, 도메인 스킬, SPEC-NEWS-REVISE) | 17%×17%(`.yh-embed--clipboard max-width/height 17%`) |
| 상세보기 제목/본문 구조 | 분리 2섹션 aria-label '제목'/'본문' + 회색 구분선 (SPEC-NEWS-REVISE-001/003/004/006 회귀 가드) | 통합 1섹션 aria-label '기사'(제목 → 본문 연속) (articleDetail.js, SPEC-NEWS-REVISE-002) | 통합 구조(`.yh-detail__article` aria-label '기사') |
| 상세보기 본문 폰트(과거값) | title 1.6rem / content 1.02rem (이전 구현) | title 1.3rem / content 1.75rem (현재 작업트리) | title 1.3rem < content 1.75rem (본문 강조) |
| Alt+Y (끝) 형식 | '\r\n (끝)'(prefix 포함, 레거시) | '(끝)'(prefix-free) (SPEC-NEWS-REVISE-002/003 단순화) | '(끝)' prefix-free, 단 가드 판정은 레거시 '\n (끝)'도 trimEnd로 통과 |
| 헤더 강조선 색 | 레드 바 (news.md '상단 헤더는 레드 바') | 블루 밑줄 border-bottom 3px `--yh-blue` (yonhap.css `.yh-topbar`) | 블루 밑줄(헤더). 레드는 로고 좌측 룰로 표현 |

---

## 출처 문서 목록

| 파일 | 비고 |
|------|------|
| `web/src/styles/yonhap.css` | **디자인 구현 단일 출처(SSOT)**. CSS 변수 토큰 + 전 컴포넌트 클래스. v2.0 (tokens→resets→layout→components) + 별도 layer '6b. Writer workspace tabs' |
| `web/index.html` | Google Fonts 3종 로딩 + preconnect, lang=ko, `<title>기사 제작 시스템 – 연합뉴스</title>` |
| `web/src/view/WriteWorkspace.jsx` | 작성 멀티탭 워크스페이스 셸 — `.yh-workspace` + 탭 스트립(role=tablist) + 탭 패널(role=tabpanel), 새 탭 열기/기존 탭 활성화(D2-5 자기 잠금 차단), 전 탭 mounted 유지 |
| `web/src/view/articleDetail.js` | 상세보기 새창 팝업 — 자체 :root 토큰 6종(#0A4DA6/#08306B/#E8F0FB/#DDE3EC/#6B7A90), 통합 '기사' 영역, 본문>제목 폰트 강조 |
| `web/src/view/articleDetail.test.js` | 폰트 크기·gray-line(#DDE3EC) 정확 토큰·섹션 분리·12필드 테스트 가드 |
| `web/src/view/WritePage.jsx` | 작성기 60/40, 송고/보류/KILL, 탭 4종, 읽기전용 메타, 검색/임베드, 잠금 배너 |
| `web/src/view/LoginPage.jsx` | 로그인 래퍼/카드, 블루 그라데이션 의도 주석 |
| `web/src/view/TopBar.jsx` | 공통 상단바 — 브랜드 + 사용자 + 로그아웃 |
| `web/src/view/ContextMenu.jsx` | 우클릭 컨텍스트 메뉴 클래스 구조 + 커서 추종 |
| `web/src/view/ViewPage.jsx` | 조회 래퍼/4메뉴/8컬럼 리스트/부서 필터/페이지네이션/실시간 상태바 |
| `web/src/view/editorColoring.js` | 줄 역할 판정(제목/부제목/본문/(끝)) + 골드 세그먼트 분리 |
| `news.md` | 제작 시스템 요구 — 연합뉴스 스타일 톤, 레드 #C8102E 서술(코드와 충돌, 10장 참조), 레이아웃·단축키·임베드 |
| `CLAUDE.md` | 디자인 규칙으로 design.md 위임. 루트 변형본에 '연합뉴스 스타일, 파랑+흰색, 글자색 파랑' 명시 |
| `.moai/project/tech.md` | 디자인 토큰 표(--yh-blue #0A4DA6 등), gray-line #DDE3EC, 클립보드 10%(코드 17%와 충돌) |
| `.moai/config/evaluator-profiles/frontend.md` | 평가 루브릭(Originality 40/Design 30/Craft 30), AI-slop 안티패턴 6종, WCAG/반응형 must-pass |
| `.claude/skills/moai-domain-news-editor/SKILL.md` | 도메인 SSOT — 디자인 토큰 표, 줄 색 규칙, 60/40, Alt+Y/Ctrl+D, 임베드 1.7배, 상세보기 가로/통합 |
| `.claude/skills/moai-workflow-news-production/SKILL.md` | GAN 루프 4차원 점수, Design Quality rubric, anti-pattern cross-check, 신규 토큰 금지 |
| `.moai/specs/SPEC-FRONTEND-UI-001/{spec,acceptance,plan}.md` | 작성/조회 페이지 레이아웃·4탭·60:40·8컬럼·확인창·접근성 Exclusions |
| `.moai/specs/SPEC-NEWS-REVISE-001~007/{spec,acceptance,plan,research}.md` | 상세보기 분리/통합·본문>제목 폰트·임베드 삭제·(끝) 가드·읽기전용 8필드·gray-line 정밀화·블루 D-4 잠금 |
| `.moai/specs/SPEC-UI-EDITOR-001/{spec,plan}.md` | 에디터 구조 파싱, 인라인 임베드 3종, round-trip, yonhap.css 토큰 참조(브랜드 레드 --yh-red) |
| `.moai/specs/SPEC-HARNESS-NEWS-001/{spec,acceptance,plan}.md` | 도메인 스킬 디자인 토큰 6종 캡슐화, grep 검증, GAN 4차원 |
| `.moai/design/*.md` | **빈 TBD 템플릿(값 없음)** — 디자인 브리프 미작성 |
| `.moai/project/brand/*.md` | **빈 TBD 템플릿(값 없음)** — 브랜드 컨텍스트 미작성 (brand-voice.md/visual-identity.md 등) |
