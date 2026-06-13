# design.md
기사 작성기 디자인 명세서이다.

## 브랜드

- 전체 톤은 보도 화면을 기준으로 한 신문형 UI 아이덴티티를 따른다.
- 배경은 흰색이 지배적이며, UI 크롬은 블루 기조로 한다.
- BLUE(--yh-blue)가 헤더 강조선, 워드마크, 기본 버튼, 활성 탭·네비, 링크, 포커스, 테이블 밑줄을 주도한다.
- RED(--yh-red)는 로고 좌측 룰, 알림 보더, 송고 배지, 임베드 좌측 룰의 포인트 액센트로만 사용한다.
- 헤드라인·제목·브랜드 워드마크·UI 라벨 강조는 파란색(--yh-blue)으로 표시한다.
- 본문 글자색은 검정(--yh-ink)으로 유지한다.
- 스타일시트는 yonhap.css v2.0 단일 파일이며, 구성 순서는 tokens → resets → layout → components이다.
- 디자인 구현의 단일 출처는 web/src/styles/yonhap.css이다.
- 신규 색 토큰 도입은 금지한다.

## 색상 토큰

- --yh-blue: #0a4da6 — primary chrome, 헤더 보더·워드마크, 기본 버튼, 활성 탭·네비, 링크, 포커스, 테이블 밑줄(연합 호환 딥블루)이다.
- --yh-blue-dark: #083d84 — hover·active 강조색이다.
- --yh-blue-light: rgba(10,77,166,0.08) — hover 행·포커스 틴트용 연한 블루 틴트이다.
- --yh-red: #c8102e — accent/point, 연합 브랜드 아이덴티티(로고 룰·알림 보더·송고 배지·임베드 좌측 룰)이다.
- --yh-red-dark: #a50d26 — 알림 텍스트 등 짙은 레드이다.
- --yh-red-light: rgba(200,16,46,0.08) — 삭제 어포던스 hover 배경 등 연한 레드이다.
- --yh-gold: #d4af37 — Alt+Y '(끝)' 엔드 마커 골드색이다.
- --yh-ink: #1a1a1a — 본문 기본 글자색(검정)이다.
- --yh-gray-line: #ddd — yonhap.css 기본 1px 회색 구분선이다.
- --yh-gray-bg: #f5f5f5 — thead 배경, secondary hover 배경이다.
- --yh-gray-mid: #888 — 보조 텍스트·플레이스홀더이다.
- --yh-gray-dark: #444 — 일반 보조 텍스트이다.
- --yh-white: #ffffff — 배경, 카드, 버튼 텍스트이다.

## 상태 배지 색 토큰

- --yh-badge-rds-bg / --yh-badge-rds-fg: #e8e8e8 / #555 — RDS(기사대기·draft)이다.
- --yh-badge-send-bg / --yh-badge-send-fg: #c8102e / #ffffff — 송고(send, *PS/DPS/BPS), 레드이다.
- --yh-badge-hold-bg / --yh-badge-hold-fg: #d97706 / #ffffff — 보류(hold, *RH/*DH), amber이다.
- --yh-badge-kill-bg / --yh-badge-kill-fg: #374151 / #ffffff — KILL(*RK/*DK), slate이다.
- --yh-badge-ok-bg / --yh-badge-ok-fg: #15803d / #ffffff — OK·confirmed(published), green이다.

## 상세보기 팝업 전용 토큰

- 상세보기 새창(articleDetail.js)은 yonhap.css와 분리된 자체 :root 토큰 6종을 정의한다.
- --yh-blue: #0A4DA6 — 강조선·라벨·섹션 헤더이다.
- --yh-blue-deep: #08306B — hover·선택 강조이다.
- --yh-blue-soft: #E8F0FB — 공통정보 셀 배경이다.
- --yh-ink: #08306B — 본문 글자색(팝업은 잉크를 딥블루로 정의)이다.
- --yh-gray-line: #DDE3EC — 1px 구분선(파란빛 회색), 상세보기 팝업 기준 정본이다.
- --yh-gray-mid: #6B7A90 — 빈 필드(em-dash) 약화 텍스트이다.

## 타이포그래피

- --yh-serif: "Nanum Myeongjo", "Noto Serif KR", serif — 헤드라인·제목·에디터 본문(명조)이다.
- --yh-sans: "Noto Sans KR", system-ui, sans-serif — UI·본문 고딕이다.
- 폰트는 Google Fonts에서 3종 로딩한다: Nanum Myeongjo(wght@400;700;800), Noto Sans KR(wght@400;500;600;700), Noto Serif KR(wght@400;700), display=swap 적용이다.
- fonts.googleapis.com·fonts.gstatic.com preconnect 2개로 로딩 최적화한다(gstatic은 crossorigin).
- html font-size는 14px이고, body는 var(--yh-sans), color var(--yh-ink), background var(--yh-white), line-height 1.5이다.
- box-sizing: border-box를 전역 적용한다.
- 제목 h1~h4는 font-family var(--yh-serif), line-height 1.3이다.
- 입력 요소(input·select·textarea)는 font-size 0.9rem(베이스)이며, 컴포넌트별 0.85~0.95rem으로 오버라이드된다.

## 줄 역할 색 규칙

- 에디터 본문은 줄 역할에 따라 색을 입힌다.
- 색 의미는 클래스(span)로 구분하고 실제 텍스트는 변경하지 않는다.
- 색 적용은 표시(presentation)만이며, compositionend·blur·programmatic-load 시 재실행한다(한글 IME 안전).
- 매 키 입력에는 색을 재적용하지 않는다.
- 제목(.yh-line--title): line[0] 항상 제목, 글자색 파란색 var(--yh-blue)이다.
- 부제목(.yh-line--subtitle): 제목 다음 줄~첫 빈 줄 직전까지(MAX_SUBTITLE_LINES=4, 2~5번째 줄), 개행 2회 이상이면 그 시점부터 본문, 글자색 빨간색 var(--yh-red)이다.
- 본문(.yh-line--body): 그 이후 모든 줄(기본값), 글자색 검정 var(--yh-ink)이다.
- (끝) 마커(.yh-end-mark): 본문 끝의 (끝) END_MARKER를 별도 골드 세그먼트로 처리, 글자색 골드 var(--yh-gold)이다.
- 상세보기 팝업의 제목·본문은 모두 명조체이며, 제목은 --yh-blue-deep #08306B, 섹션 헤더·라벨은 --yh-blue #0A4DA6, 본문은 --yh-ink #08306B이다.

## 레이아웃 — 페이지별 구조

- 로그인(login.do): .yh-login-wrap(min-height 100vh, flex center) 안 .yh-card(width 380px), 블루 그라데이션 배경 + 흰 카드이다.
- 공통 셸 헤더: header.yh-topbar, height 48px(--yh-header-height), sticky top 0, z-index 100, 좌측 브랜드(.yh-brand) + 우측 사용자(.yh-user)이다.
- 작성기 셸(writer.do): div.yh-workspace 안 탭 스트립(.yh-edit-tabs) + 탭 패널(.yh-edit-tabpanel)로 멀티탭 구성, 각 패널이 WritePage 60/40 레이아웃을 감싼다.
- 작성기 본문(writer.do): .yh-write-layout grid 60% 40%, 좌측 에디터 영역 60%(.yh-editor-region) + 우측 메타 40%(.yh-meta-region), min-height calc(100vh - var(--yh-header-height) - 40px)이다.
- 조회(list.do): .yh-view-wrap(padding, max-width 1400px, 중앙 정렬), 조회 메뉴 4종 + 공유 8컬럼 그리드 헤더·행이다.
- 상세보기(새창 팝업): 상단 공통정보 12필드 가로 나열 → 하단 통합 '기사' 영역(제목 → 본문 연속)이다.

## 헤더

- position sticky top 0, z-index var(--yh-topbar-z)=100, height 48px, padding 0 var(--yh-sp-xl), flex space-between이다.
- 흰 배경(var(--yh-white)), color var(--yh-ink), border-bottom 3px solid var(--yh-blue)(블루 밑줄), box-shadow var(--yh-shadow-sm)이다.

## 작성 탭 스트립

- .yh-edit-tabs(탭 스트립): display flex, align-items flex-end, gap 2px, padding var(--yh-sp-sm) var(--yh-sp-md) 0, background var(--yh-gray-bg), border-bottom 2px solid var(--yh-blue)(블루 밑줄), overflow-x auto이다.
- .yh-edit-tab(개별 탭): inline-flex, max-width 240px, background #fff, color var(--yh-gray-mid), border 1px solid var(--yh-gray-line), border-bottom none, border-radius 6px 6px 0 0(상단만 둥근 탭형)이다.
- .yh-edit-tab--active(활성 탭): background var(--yh-blue), color #fff(블루 반전)이다.
- .yh-edit-tab__label(탭 라벨 버튼): padding var(--yh-sp-sm), font-size 0.85rem, max-width 190px, 한 줄 말줄임(white-space nowrap, overflow hidden, text-overflow ellipsis)이다.
- .yh-edit-tab__close(× 닫기 버튼): background none, border none, padding 0 var(--yh-sp-sm), font-size 0.9rem, color inherit이다. hover color var(--yh-blue); 활성 탭 내부 close hover는 color #fff + opacity 0.75이다.
- .yh-edit-tabs__add(＋ 새 탭 추가): background none, border 1px dashed var(--yh-gray-line), border-bottom none, border-radius 6px 6px 0 0, padding var(--yh-sp-sm) var(--yh-sp-md), color var(--yh-blue)이다. hover background #fff이다.
- 각 탭은 span.yh-edit-tab 안에 라벨 버튼 button.yh-edit-tab__label(role=tab, aria-selected, aria-controls=writer-panel-{id}) + 닫기 버튼 button.yh-edit-tab__close(aria-label='{label} 탭 닫기')로 구성된다.
- 스트립 끝에 새 탭 추가 버튼 button.yh-edit-tabs__add(aria-label='새 작성 탭')가 있다.
- 모든 탭 에디터는 mounted 상태를 유지하고 비활성 탭만 hidden 처리한다.

## 작성기 60/40 분할

- 좌측 에디터 영역(.yh-editor-region, data-testid=editor-region) 60% + 우측 메타데이터 영역(.yh-meta-region, data-testid=metadata-region) 40%이다.
- 좌측은 본문 에디터이고, 우측은 송고·보류·KILL 액션 버튼 + 읽기전용 메타 + 탭 4종(공통정보·이미지·영상·글기사)이다.
- 탭 위에 송고·보류 버튼을 배치한다.

## 조회 8컬럼 그리드

- 조회 4개 메뉴(데스크 미송고·부서별 작성·부서별 송고·개인별 수정) 공용이다.
- grid-template-columns: 11rem minmax(0,1fr) 6rem 6rem 8.5rem 8.5rem 4.5rem 4rem = 기사아이디 | 제목(flex) | 작성자 | 수정자 | 작성시간 | 수정시간 | 기사상태 | LockYN이다.
- gap var(--yh-sp-sm), 헤더 padding var(--yh-sp-xs) var(--yh-sp-sm), border-bottom 2px solid var(--yh-blue), color var(--yh-blue), font-size 0.8rem, font-weight 700이다.
- 행은 grid-auto-flow:column + grid-auto-columns:max-content로 9번째 액션 버튼(부서별 송고 DPS 행 고침·포털고침)을 같은 줄 암시 컬럼에 배치한다.
- 정렬은 시간 내림차순이며, 페이지당 10개(PAGE_SIZE=10)이다.

## 상세보기 팝업 레이아웃

- 새창 body: margin 0, padding 24px, font-family 'Noto Sans KR', system-ui, sans-serif, color var(--yh-ink)(#08306B), background #fff, line-height 1.6, box-sizing border-box이다.
- 상단 공통정보 12필드는 .yh-detail__info(display flex, flex-wrap wrap, gap 8px)로 가로 나열한다.
- 하단은 단일 .yh-detail__article 통합 영역(제목 → 본문 연속)이다.
- 두 섹션 aria-label은 "공통정보"/"기사"이다.
- 상세보기 구조는 통합 1섹션 aria-label '기사'이다(제목+본문 단일 .yh-detail__article로 통합).

## 버튼

- .yh-btn 베이스: inline-flex center, padding var(--yh-sp-xs) var(--yh-sp-md), font-size 0.85rem, font-weight 500, border-radius 3px, border 1px solid transparent, transition background·border-color 0.15s이다.
- .yh-btn--sm: padding 2px var(--yh-sp-sm), font-size 0.8rem이다.
- :disabled: opacity 0.45, cursor not-allowed이다.
- .yh-btn--primary(Primary): bg var(--yh-blue), color var(--yh-white), border var(--yh-blue), letter-spacing 0.02em이다. hover bg var(--yh-blue-dark) + box-shadow 0 2px 6px rgba(10,77,166,0.3), active translateY(1px)이다. 송고·로그인 제출에 사용한다.
- .yh-btn--secondary(Secondary): bg var(--yh-white), color var(--yh-gray-dark), border var(--yh-gray-line)이다. hover bg var(--yh-gray-bg)이다. 조회·고침·페이지네이션·검색·삽입에 사용한다.
- .yh-btn--hold(Hold): bg #fff7ed, color #92400e, border #fcd34d이다. hover bg #fef3c7이다. 보류에 사용한다.
- .yh-btn--kill(KILL): bg #374151(--yh-badge-kill-bg), color var(--yh-white)이다. hover bg #1f2937, border #1f2937이다. KILL에 사용한다.
- 크기 수식자 .yh-btn--sm(소형)은 검색·삽입·조회·페이지네이션 버튼에 공통 적용한다.
- 송고·보류·KILL 노출 조건은 역할(R/D/Z) + 상태 RDS이며, KILL은 추가로 articleId가 생성된 편집 컨텍스트에서만 표시한다(신규 초안 A-DRAFT 비표시).
- 권한별 색 구분은 없다.

## 폼

- .yh-field: flex column, gap 2px, label font-size 0.78rem, color var(--yh-gray-mid), weight 600이다. input·select·textarea width 100%, padding var(--yh-sp-sm), border 1px solid var(--yh-gray-line), border-radius var(--yh-radius-sm)(2px), font-size 0.88rem이다. focus: border-color var(--yh-blue) + box-shadow 0 0 0 3px rgba(10,77,166,0.12)(soft blue glow), outline none이다.
- .yh-field-row: grid 6rem 1fr, align center, gap var(--yh-sp-sm), label 우측 정렬 0.78rem var(--yh-gray-mid) weight 600이다. input·select padding 2px var(--yh-sp-sm), focus border var(--yh-blue)이다. 공통정보 입력 폼·엠바고 datetime-local에 사용한다.
- .yh-readonly-meta: 편집 컨텍스트 8필드 읽기전용이다. 컨테이너 border-top 2px solid var(--yh-blue), border-bottom 1px solid var(--yh-gray-line)이다. __row grid 6rem 1fr, __label 0.78rem weight 600 우측정렬 color var(--yh-blue)(연합 라벨 파란색), __value 0.88rem var(--yh-ink) word-break break-all이다.
- 읽기전용 8필드: 기사아이디·수정자·송고자·부서·부서코드·작성시간·편집시간·송고시간이다.
- dl class=yh-readonly-meta(aria-label 기사 정보), 각 행 __row, dt __label, dd __value로 표기하며 입력창이 아닌 display-only이다.

## 테이블·목록

- .yh-table: width 100%, border-collapse collapse, font-size 0.88rem이다. thead bg var(--yh-gray-bg), th padding var(--yh-sp-xs) var(--yh-sp-sm), border-bottom 2px solid var(--yh-blue)(블루 헤더 밑줄), 0.78rem weight 700 color var(--yh-gray-dark)이다. td border-bottom 1px solid var(--yh-gray-line), color var(--yh-ink)이다. tr:hover td bg var(--yh-blue-light)이다.
- .yh-article-list / .yh-article-row: ul 기반(table 아님), list-style none, border-top 2px solid var(--yh-blue)(블루 주도 상단 룰)이다. row flex, gap var(--yh-sp-sm), padding var(--yh-sp-sm), border-bottom 1px solid var(--yh-gray-line), 0.88rem, border-left 3px solid transparent(hover 액센트 공간 예약), cursor pointer이다.
- 목록 컬럼 텍스트: __id/__status/__lock color var(--yh-gray-dark) 0.82rem 말줄임, __title flex 1 명조체 var(--yh-ink) 말줄임, __author/__modifier width 6rem var(--yh-gray-dark) 0.82rem 말줄임, __time width 9rem var(--yh-gray-mid) 0.78rem 우측 정렬이다.
- 인라인 액션 __actions flex gap var(--yh-sp-xs)이다.

## 상태 배지

- .yh-badge 기본: inline-block, padding 1px 6px, border-radius 3px, font-size 0.7rem, font-weight 700, letter-spacing 0.04em, white-space nowrap이다.
- --rds(기사대기·draft): 배경 #e8e8e8 / 글자 #555이다.
- --send(송고 *PS/DPS/BPS): 배경 #c8102e / 글자 #ffffff(레드)이다.
- --hold(보류 *RH/*DH): 배경 #d97706 / 글자 #ffffff(amber)이다.
- --kill(*RK/*DK): 배경 #374151 / 글자 #ffffff(slate)이다.
- --ok(확정·published): 배경 #15803d / 글자 #ffffff(green)이다.

## 탭·네비

- .yh-nav(사이트 네비): flex, padding 0 var(--yh-sp-xl), bg var(--yh-white), border-bottom 1px solid var(--yh-gray-line)이다. __link padding var(--yh-sp-sm) var(--yh-sp-md), 0.85rem, color var(--yh-gray-dark), border-bottom 2px solid transparent이다. hover color var(--yh-blue), --active color var(--yh-blue) border-bottom-color var(--yh-blue) weight 600이다.
- .yh-tabs / .yh-tab(메타 탭 4종): tabs border-bottom 1px solid var(--yh-gray-line)이다. tab padding var(--yh-sp-sm) var(--yh-sp-md), 0.85rem, border-bottom 2px solid transparent, color var(--yh-gray-mid), margin-bottom -1px이다. hover color var(--yh-blue), --active color var(--yh-blue) border-bottom-color var(--yh-blue) weight 600 + aria-selected=true이다.
- .yh-view-menu / __btn(조회 4메뉴): menu flex, padding var(--yh-sp-sm) 0, border-bottom 2px solid var(--yh-blue)이다. btn padding var(--yh-sp-xs) var(--yh-sp-md), 0.82rem, border 1px solid var(--yh-gray-line), border-radius var(--yh-radius-sm), bg var(--yh-white), color var(--yh-gray-dark)이다. hover bg var(--yh-blue-light) color var(--yh-blue) border rgba(10,77,166,0.2), --active bg var(--yh-blue) color var(--yh-white) border var(--yh-blue) weight 600 box-shadow 0 1px 4px rgba(10,77,166,0.25) + aria-pressed=true이다.

## 컨텍스트 메뉴

- .yh-ctxmenu: position fixed, z-index calc(var(--yh-topbar-z)+10), padding var(--yh-sp-xs) 0, list-style none, min-width 11rem, bg var(--yh-white), border 1px solid var(--yh-gray-line), border-top 3px solid var(--yh-blue)(BLUE-LED 상단 라인), border-radius var(--yh-radius-md), box-shadow var(--yh-shadow-lg), font-size 0.85rem이다.
- 커서 위치를 추종한다(인라인 style top/left = clientX/clientY).
- __item: flex space-between, width 100%, padding var(--yh-sp-xs) var(--yh-sp-md), border 0, bg transparent, color var(--yh-ink), var(--yh-sans), role=menuitem이다.
- hover(:not(:disabled)): bg var(--yh-blue-light)(BLUE-LED hover)이다. :focus-visible outline 2px solid var(--yh-blue) offset -2px이다.
- --disabled / :disabled: color var(--yh-gray-mid), cursor not-allowed이다.
- __hint(준비중 마커): color var(--yh-red)(RED 포인트 액센트), 0.72rem, 텍스트 '(준비중)'이다.
- 부서별 작성·송고·개인별 수정 메뉴 항목: 상세보기·이력보기·송고이력보기·본문복사·제목만복사·번역·매핑·후속기사작성·계속기사작성·고침(포털제외)·포털고침·삭제요청·재송이다.
- 데스크 미송고 항목: 편집·상세보기·이력보기·본문복사·제목만복사이다.
- 부서별 송고에는 편집 항목이 추가로 있다.
- 고침·포털고침은 DPS 기사에서 D 권한만 활성이다.

## 에디터

- .yh-editor-region: flex column, padding var(--yh-sp-md), border-right 1px solid var(--yh-gray-line)이다.
- v0.3.0부터 '본문' 라벨 텍스트는 비표시하며, aria-label만 유지한다.
- 본문(contentEditable div, id=editor-body): flex 1, min-height 50vh, padding var(--yh-sp-md) var(--yh-sp-sm), border 1px solid var(--yh-gray-line), border-radius var(--yh-radius-sm), font-family var(--yh-serif), font-size 0.95rem, line-height 1.8, color var(--yh-ink), bg var(--yh-white), white-space pre-wrap, overflow-wrap anywhere이다.
- role=textbox, aria-multiline=true, aria-label=본문으로 표시한다.
- 줄바꿈은 모델('\n')로 관리하며, trailing '\n'은 보이지 않는 마지막 줄 위해 br로 패딩 렌더한다(textContent 미영향).
- 포커스: outline none, border-color var(--yh-blue), box-shadow 0 0 0 3px rgba(10,77,166,0.1)(파란 포커스 링)이다.

## 임베드

- 이미지·영상·글기사 검색 결과를 본문 커서 위치에 인라인 삽입한다.
- 임베드 span은 textContent에 기여하지 않아 캐럿 오프셋·글자수가 byte-stable하게 유지된다.
- .yh-embed-inline: display block, margin var(--yh-sp-md) 0, border-left-color var(--yh-blue)이다. 래퍼 색은 디자인 토큰(파랑·회색)만 사용하며 #C8102E는 금지한다(AC-EMB-INLINE-3 잠금).
- .yh-embed(카드 베이스): position relative, flex column, gap var(--yh-sp-xs), max-width 612px(사진·영상 figure 폭 = 기존 360px × 1.7), padding var(--yh-sp-sm) var(--yh-sp-md), border 1px solid var(--yh-gray-line), border-left 3px solid var(--yh-red)(D-4 잠금 레드 액센트), border-radius 3px, bg var(--yh-white), var(--yh-sans) 0.85rem이다.
- .yh-embed--article(기사 참조): flex row, align center, max-width 480px(배지+제목 한 줄 가로형)이다. 1.7배(612px) 미적용, 480px 유지이다.
- .yh-embed--clipboard(클립보드): max-width 17% / max-height 17%(에디터 100% 대비 가로×세로, 기존 10%×10%에 1.7배 적용)이다.
- .yh-embed__img: width 100%(figure 폭 채움), height auto(비율 유지), object-fit cover, border-radius 2px, border 1px solid var(--yh-gray-line)이다. 캡션(.yh-embed__caption)은 렌더링하지 않으며, title은 img alt로만 접근성을 유지한다.
- .yh-embed__title: var(--yh-sans), color var(--yh-gray-dark), 한 줄 말줄임이다.
- .yh-embed__link: 0.78rem, color var(--yh-red), 한 줄 말줄임이다.
- .yh-embed__video-mark / __article-mark: flex-shrink 0, padding 1px 6px, border-radius 3px, bg var(--yh-red)(브랜드 레드), color var(--yh-white), 0.7rem weight 700이다.
- .yh-embed__delete(× 삭제): position absolute top 2px right 4px, padding 0 4px, border none, bg transparent, color var(--yh-gray-mid), 1rem이다. hover·focus color var(--yh-red) + bg var(--yh-red-light)이다. aria-label='임베드 삭제', type=button, mousedown preventDefault로 캐럿을 안정시킨다.
- 임베드 렌더 구조: 이미지=.yh-embed--image + img.yh-embed__img; 영상=.yh-embed--video + 썸네일 img + __video-mark + __title + __link; 기사=.yh-embed--article + __article-mark + __title이다.
- 모두 contenteditable=false, tabindex=0으로 설정한다.

## 상세보기 팝업 컴포넌트

- .yh-detail__section: margin 0 0 24px, padding 16px, bg #fff, border 1px solid var(--yh-gray-line)(#DDE3EC), border-left 4px solid var(--yh-blue)(#0A4DA6 좌측 강조선), border-radius 4px이다.
- .yh-detail__section-title: 0.95rem weight 700, color var(--yh-blue)(#0A4DA6), border-bottom 1px solid var(--yh-gray-line)이다.
- .yh-detail__info: 공통정보 12필드 가로 나열, flex, flex-wrap wrap, gap 8px이다.
- .yh-detail__row: flex 1 1 9rem, min-width 9rem, flex column, padding 6px 8px, border 1px solid var(--yh-gray-line), border-radius 4px, bg var(--yh-blue-soft)(#E8F0FB), 0.9rem이다. dt color var(--yh-blue) weight 600, dd var(--yh-ink) overflow-wrap anywhere이다.
- .yh-detail__row--empty: 빈 필드는 em-dash '—'(EMPTY_PLACEHOLDER) 표시 + dd color var(--yh-gray-mid)(#6B7A90) 약화이다. 12행은 항상 렌더한다.
- .yh-detail__title: 명조('Nanum Myeongjo','Noto Serif KR',serif), font-size 1.3rem, weight 700, color var(--yh-blue-deep)(#08306B), border-bottom 1px solid var(--yh-gray-line)이다. 빈 제목 시 '(제목 없음)' 플레이스홀더를 표시한다.
- .yh-detail__content: 명조, font-size 1.75rem(제목 1.3rem보다 크게 — REQ-DETAIL-FONT-EMPHASIS 시각 강조), line-height 1.8, color var(--yh-ink)(#08306B), white-space pre-wrap이다.
- 본문 폰트(1.75rem) > 제목 폰트(1.3rem) 관계는 테스트로 단언되며, 빈 제목 placeholder 케이스에서도 동일 관계가 유지된다.
- XSS 방어로 escapeHtml을 적용한다(script·img 노드 0개, 문자열로만 표시).

## 기타 컴포넌트

- .yh-card(로그인): bg var(--yh-white), border 1px solid rgba(10,77,166,0.15), border-radius var(--yh-radius-lg)(6px), box-shadow var(--yh-shadow-lg) + 0 0 0 1px rgba(255,255,255,0.1), padding 2rem 2rem 1.75rem, width 380px이다.
- .yh-card::before: 상단 브랜드 바 height 5px, linear-gradient(90deg, --yh-blue-dark 0%, --yh-blue 50%, --yh-red 100%)(블루→레드)이다.
- .yh-card::after: 우하단 블루 틴트 원 120px, radial-gradient(circle, rgba(10,77,166,0.06) 0%, transparent 70%)이다.
- .yh-login-wrap 배경: linear-gradient(160deg, --yh-blue-dark 0%, --yh-blue 60%, #1a6acf 100%)(딥네이비→블루 그라데이션)이다.
- .yh-alert(경고·에러): padding var(--yh-sp-xs) var(--yh-sp-sm), border-left 3px solid var(--yh-red), bg #fff5f5, 0.85rem, color var(--yh-red-dark)이다. role=alert·status를 사용한다.
- .yh-lock-banner(편집 잠금): role=alert, aria-live=assertive이다. '해당 기사는 다른 페이지/세션에서 편집 중입니다.' 표시 + 에디터 contentEditable=false 비활성이다.
- .yh-pagination: flex center, gap var(--yh-sp-md), padding var(--yh-sp-md) 0이다. __indicator 0.82rem weight 600 min-width 4rem '{page} / {pageCount}'이다.
- .yh-dept-filter: flex align center, gap var(--yh-sp-sm), label var(--yh-gray-mid) weight 600 0.78rem, select 0.85rem border var(--yh-gray-line)이다. 부서별 송고·작성에서만 노출한다.
- .yh-search-bar / .yh-result-list / __row: search-bar flex gap var(--yh-sp-xs); input flex 1, :focus border var(--yh-blue)이다. result-row flex space-between, border-bottom 1px solid var(--yh-gray-line), 말줄임이다.
- .yh-result-thumb: width 56px, height 40px, object-fit cover, border 1px solid var(--yh-gray-line), border-radius 2px이다.
- 유틸리티: .yh-divider border-top 1px var(--yh-gray-line); .yh-page-content padding var(--yh-sp-md) var(--yh-sp-lg); .yh-text-red color var(--yh-red); .yh-text-muted color var(--yh-gray-mid) 0.82rem; .yh-tabpanel padding-top var(--yh-sp-sm)이다.

## 브랜드·사용자 영역

- .yh-brand__logo: '연합' 블루 레터링, 명조 1.15rem weight 700, letter-spacing -0.02em, color var(--yh-blue), border-left 3px solid var(--yh-red)(레드 좌측 룰), padding 3px var(--yh-sp-sm)이다.
- .yh-brand__title: 0.8rem weight 600, color var(--yh-blue), opacity 0.9이다. 텍스트 '기사 작성기'이다.
- .yh-user: flex gap var(--yh-sp-md), 0.8rem이다. __name weight 600 color var(--yh-blue)(userId 브랜드 블루), __dept color var(--yh-gray-dark), __role color var(--yh-gray-mid) 0.75rem이다. ' · ' 구분자로 표시한다.
- .yh-logout-btn: padding 2px var(--yh-sp-sm), 0.75rem weight 600, color var(--yh-blue), bg var(--yh-white), border 1px solid var(--yh-blue), border-radius 3px이다. hover bg var(--yh-blue) color var(--yh-white)이다. focus-visible outline 2px solid var(--yh-blue)이다. aria-label='로그아웃'이다.
- 로그인 카드 로고 .yh-card__logo: 명조 1.9rem weight 800(최중량), color var(--yh-blue), letter-spacing -0.04em, border-left 4px solid var(--yh-red)이다.
- .yh-card__subtitle: Noto Serif KR 0.82rem weight 400, color var(--yh-blue), opacity 0.7, letter-spacing 0.1em이다.

## 간격 토큰

- --yh-sp-xs: 0.25rem이다.
- --yh-sp-sm: 0.5rem이다.
- --yh-sp-md: 0.75rem이다.
- --yh-sp-lg: 1rem이다.
- --yh-sp-xl: 1.5rem이다.

## 그림자 토큰

- --yh-shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)이다.
- --yh-shadow-md: 0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)이다.
- --yh-shadow-lg: 0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)이다.

## Radius·Transition·레이아웃 토큰

- --yh-radius-sm: 2px이다.
- --yh-radius-md: 4px이다.
- --yh-radius-lg: 6px이다.
- --yh-transition: 0.15s ease이다.
- --yh-header-height: 48px이다.
- --yh-topbar-z: 100이다.

## 인터랙션 — 호버

- 링크: a color var(--yh-blue) text-decoration none, hover underline이다.
- 테이블·목록 행: tr:hover td 또는 .yh-article-row:hover bg var(--yh-blue-light) + 목록 행은 border-left-color var(--yh-blue)(파란 좌측 액센트)이다.
- 버튼: primary hover var(--yh-blue-dark) + 블루 box-shadow; secondary hover var(--yh-gray-bg); 조회 메뉴 btn hover var(--yh-blue-light)이다.

## 인터랙션 — 포커스

- 폼·에디터: border-color var(--yh-blue) + box-shadow 0 0 0 3px rgba(10,77,166,0.12~0.1)(파란 포커스 링), outline none이다.
- 클릭 가능 행·버튼·메뉴: :focus-visible outline 2px solid var(--yh-blue), offset 1px 또는 -2px이다.

## 인터랙션 — 활성

- 탭·네비·조회메뉴 활성: color var(--yh-blue) + border-bottom-color var(--yh-blue) + weight 600이다(조회메뉴는 bg var(--yh-blue) 반전 + box-shadow).
- aria-selected·aria-pressed=true로 표시한다.
- 버튼 active: primary translateY(1px)이다.

## 연결 상태 점

- .yh-status-bar: flex, 0.75rem, padding var(--yh-sp-xs) var(--yh-sp-sm), border-radius 3px, bg var(--yh-blue-light)(연한 블루 틴트 칩), color var(--yh-gray-dark)이다.
- 상태 점(::before) 7px 원형: connected #4ade80(green dot), disconnected #fbbf24(amber dot)이다.
- 연결 시 '실시간 연결됨', 미연결 시 '비-실시간 (재연결 중)'으로 표시한다.
- 헤더 우측 상단에 위치한다.

## (끝) 마커

- Alt+Y로 본문 끝(임베드 뒤 최종 블록)에 정확히 '(끝)'을 1회 골드색(--yh-gold #d4af37)으로 삽입한다.
- 최종 시각 순서: 본문 텍스트 → 임베드 → '(끝)'이다.
- 이미 존재 시 noop이다.
- 골드 마킹은 .yh-end-mark 클래스(또는 data-end-marker·data-token=end-marker·color:gold 동등)로 표시한다.
- 판정: trimEnd() 후 '(끝)'으로 끝나는지 확인한다(공백·개행 허용, '(끝) 본문'처럼 중간만 있으면 미인정).

## 단축키·가드

- Alt+Y: '(끝)' 골드 마커를 삽입한다.
- Ctrl+D: 현재 라인을 제거한다(에디터 포커스 한정, preventDefault, 전역 핸들러 금지).
- 송고 가드: 본문이 '(끝)'로 끝나지 않으면 표준 window.alert('본문에 (끝) 표시가 없어 송고할 수 없습니다.') 1회 후 차단한다.
- 보류·KILL은 (끝) 없이 진행된다.
- 제목 가드('제목이 없어 송고/보류할 수 없습니다.')가 (끝) 가드보다 우선한다.
- 송고·보류·KILL: 확인창('송고하시겠습니까?'/'보류하시겠습니까?'/'KILL하시겠습니까?') 선행, 확인 시에만 진행한다.
- 성공 시 상태 메시지를 미표시하고 작성 페이지를 초기화한다.

## 접근성

- WCAG AA 준수(대비율·키보드 내비·ARIA 라벨)가 Craft & Functionality must-pass 조건이다.
- 모든 버튼은 visible text 또는 aria-label을 보유한다.
- 상세보기 섹션 aria-label은 '공통정보'·'기사'이다.
- 키보드만으로 송고·보류·KILL을 트리거할 수 있다(Tab → Enter).
- 임베드 × 어포던스 aria-label='임베드 삭제' + 키보드(Backspace·Delete) 삭제를 지원한다.
- 락 거부 안내는 aria-live='assertive'로 표시한다.
- 폰트 크기 차이는 시각 강조 수단으로만 작용하며, 정보 의미를 색·크기에만 의존하지 않는다.
- Responsive breakpoints(mobile·tablet·desktop) 테스트가 must-pass이다.
- 모든 인터랙티브 요소에 hover·focus·active 상태가 필수이다.

## 평가 루브릭

- evaluator-active는 4차원 점수로 평가하며, 각 차원은 0.0~1.0이다.
- pass_threshold 0.75(종합 PASS), max_iterations 5, escalation_after 3, improvement_threshold 0.05, floor 0.60(FROZEN)이다.
- Originality 40%: 고유·의도적 디자인, 커스텀 토큰, AI-slop 미감지가 1.00 기준이다.
- Design Quality 30%: 일관 타이포 위계 + 일관 색 적용 + 의도적 spacing 리듬이 1.00 기준이다.
- Craft & Functionality 30%: WCAG AA 통과 + 전 breakpoint 반응형 + 모든 인터랙티브 상태 + 콘솔 에러 없음이 1.00 기준이다.
- Design Quality rubric: 0.25=토큰 미사용·임의 색; 0.50=일부 토큰·본문 색 규칙 부분 위반; 0.75=토큰 일관 + 색 규칙(제목 파랑·부제 빨강·본문 검정) 준수 + 1px 회색선; 1.0=토큰 + 신문형 밀도 + 헤더 블루 밑줄·로고 레드 룰 완벽 정합이다.

## AI-Slop 안티패턴

- 3개 이상 감지 시 Originality FAIL, 1~2개 감지 시 0.50 캡이다.
- Stock card layouts: 커스텀 토큰 없는 기본 Bootstrap·Tailwind 카드 그리드이다.
- Default utility-only styling: 커스텀 CSS 변수·토큰 없이 유틸 클래스만 사용하는 경우이다.
- Purple/blue gradient backgrounds: 브랜드 정합 없는 보라·파랑 그라디언트 hero이다(본 프로젝트의 블루 그라데이션은 --yh-blue 계열 브랜드 정합 의도적 배경이므로 해당하지 않는다).
- Generic placeholder text: Lorem ipsum, 'Welcome to our platform' 등이다.
- Identical component structure: 무관한 섹션 2개 이상이 동일 레이아웃인 경우이다.
- Missing interactive states: 버튼·링크·입력·카드의 hover·focus·active가 누락된 경우이다.
- .moai/research/observations/의 anti-pattern과 일치 시 해당 차원 점수를 0.50 이하로 제한한다(편향 방지 메커니즘).
