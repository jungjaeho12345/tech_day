# Structure — 프로젝트 구조

## 현재 상태

3계층(DB / 백엔드 / 프런트엔드) 구현 완료. 총 101개 테스트 통과(백엔드 73 + 프런트엔드 28).

## 디렉터리 구조

```
tech_day/
├── src/                        # 백엔드 (NodeJS, ESM)
│   ├── db/                     # DB 계층 (SPEC-DB-FOUNDATION-001)
│   │   ├── schema.js           # DDL + 컬럼·상태 상수
│   │   ├── articleId.js        # 기사 ID 생성 (AKR+YYYYMMDD+9자리)
│   │   └── softDelete.js       # 소프트 삭제 (KILL 상태 전환)
│   ├── models/                 # SQL 접근 전담 (비즈니스 로직 없음)
│   │   ├── articleModel.js     # Article/Contents SQL
│   │   └── userModel.js        # User SQL
│   ├── services/               # 비즈니스 로직
│   │   ├── articleService.js   # 기사 CRUD + 생애주기 오케스트레이션 (KILL_BY_ROLE 셋에 Z 포함)
│   │   ├── userService.js      # 사용자 CRUD + 로그인 (bcryptjs)
│   │   ├── lifecycle.js        # 상태 머신 순수 함수 (Z 권한: D-mirror 전이 RDS→DPS/DDH/DDK)
│   │   └── mediaSearch.js      # 미디어 검색 프록시 (YouTube→Google)
│   └── controllers/
│       └── index.js            # Controller: 요청→서비스 위임
├── web/                        # 프런트엔드 (React 19 + Vite 7, SPEC-FRONTEND-UI-001)
│   ├── src/
│   │   ├── model/              # 주입 가능한 Model 인터페이스
│   │   │   ├── contract.js     # 8개 메서드 계약 + assertModel
│   │   │   └── editorAdapter.js# 에디터 어댑터 계약
│   │   ├── view/               # 페이지 컴포넌트 + 에디터 유틸
│   │   │   ├── TopBar.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── WritePage.jsx
│   │   │   ├── ViewPage.jsx
│   │   │   ├── ContextMenu.jsx     # 우클릭 컨텍스트 메뉴 (상세보기 진입)
│   │   │   ├── InlineEmbed.jsx     # 본문 인라인 임베드 컴포넌트 (SPEC-NEWS-REVISE-001 AC-EMB-INLINE-*)
│   │   │   ├── articleDetail.js    # 상세보기 HTML 생성 (buildArticleDetailHtml)
│   │   │   ├── clipboardEmbed.js   # 클립보드 이미지 임베드 처리
│   │   │   ├── editorCaret.js      # 캐럿 위치 보정 (M3 임베드 모델)
│   │   │   ├── editorColoring.js   # 에디터 구문 강조
│   │   │   ├── editorNewline.js    # Enter 줄바꿈 처리 (IME 합성 가드 포함, plan.md D-7)
│   │   │   └── editorShortcuts.js  # 단축키 핸들러 (Ctrl+D 라인 삭제, Alt+Y "(끝)" 삽입)
│   │   ├── controller/         # React 훅 (use*Controller)
│   │   ├── app/                # App.jsx + context.js
│   │   └── test/               # fakeModel.js
│   ├── index.html
│   ├── vite.config.js
│   └── vitest.config.js
├── test/                       # 백엔드 테스트 (node:test)
│   ├── schema.test.js
│   ├── articleId.test.js
│   ├── lifecycle.test.js
│   ├── articleService.test.js
│   ├── userService.test.js
│   ├── mediaSearch.test.js
│   └── controllers.test.js
├── news.md                     # 제작 시스템 기술 명세서 (기준 문서)
├── ArticleVO.md                # Article 테이블 필드 명세
├── ContentsVO.md               # Contents 테이블 필드 명세
├── UserVO.md                   # User 테이블 필드 명세
├── claude.md                   # 프로젝트 지침
├── README.md                   # 프로젝트 개요 및 실행 방법
├── package.json                # node >= 22.5.0, "type": "module"
├── .moai/                      # MoAI-ADK 워크스페이스
│   ├── project/                # product/structure/tech, db/, brand/, codemaps/
│   ├── specs/                  # SPEC-DB-FOUNDATION-001, SPEC-BACKEND-CORE-001, SPEC-FRONTEND-UI-001
│   └── config/                 # 설정 섹션
└── .claude/                    # Claude Code 설정 (skills, commands, agents, rules)
```

## 모듈 구성 (도메인 관점)

- **기사 도메인**: DB(schema/articleId/softDelete) → Model(articleModel) → Service(articleService + lifecycle)
- **사용자 도메인**: DB(schema) → Model(userModel) → Service(userService + bcryptjs 해싱)
- **미디어 검색**: Service(mediaSearch) — YouTube 우선, 실패 시 Google fallback, API 키 서버사이드
- **페이지**: 로그인 / 기사 작성(에디터+메타) / 기사 조회

## 의존 방향

```
web/ → src/controllers/ → src/services/ → src/models/ → src/db/ → SQLite (node:sqlite)
```

각 계층은 하위 계층에만 의존하며, 역방향 의존 없음.
