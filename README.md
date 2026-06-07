# 기사 작성기 Prototype (Article Production System)

언론사용 기사 제작 CMS. 기자·데스크·관리자가 기사를 작성·수정·송고·조회하고 기사 생애주기(상태값)를 관리한다.

> **범위 안내** — 전체 제품은 제작 / 수집 / 배부 3개 시스템으로 구성된다. **현재 구현은 기사 작성기만** 포함한다. 수집·배부는 미구현(향후 예정).

## 아키텍처 — 3계층 구조

```
web/ (React + Vite)          ← SPEC-FRONTEND-UI-001
  └─ src/model/contract.js   ← 주입 가능한 Model 인터페이스
        ↓ 의존
src/controllers/index.js     ← SPEC-BACKEND-CORE-001
  └─ src/services/           ← 비즈니스 로직
  └─ src/models/             ← SQL 접근 전용
        ↓ 의존
src/db/                      ← SPEC-DB-FOUNDATION-001
  └─ schema.js / articleId.js / softDelete.js
```

의존 방향: DB 계층 ← 백엔드 계층 ← 프런트엔드 계층 (상위 계층이 하위 계층에 의존).

## 디렉터리 구조

```
tech_day/
├── src/
│   ├── db/
│   │   ├── schema.js          # 테이블 DDL, 컬럼 상수, LIFECYCLE_STATUSES
│   │   ├── articleId.js       # 기사 ID 생성 (AKR+YYYYMMDD+9자리 난수)
│   │   └── softDelete.js      # 소프트 삭제 (KILL 상태 전환)
│   ├── models/
│   │   ├── articleModel.js    # Article/Contents SQL 전담
│   │   └── userModel.js       # User SQL 전담
│   ├── services/
│   │   ├── articleService.js  # 기사 CRUD + 생애주기 오케스트레이션
│   │   ├── userService.js     # 사용자 CRUD + 로그인(bcryptjs)
│   │   ├── lifecycle.js       # 생애주기 상태 머신 (순수 함수)
│   │   └── mediaSearch.js     # 미디어 검색 프록시 (YouTube→Google fallback)
│   └── controllers/
│       └── index.js           # Controller: 요청→서비스 위임 (REST 라우트 미포함)
├── web/                       # React 19 + Vite 7 프런트엔드
│   ├── src/
│   │   ├── model/             # contract.js (인터페이스), editorAdapter.js
│   │   ├── view/              # TopBar, LoginPage, WritePage, ViewPage
│   │   ├── controller/        # use*Controller 훅
│   │   └── app/               # App.jsx (라우팅 + 인증 가드), context.js
│   └── src/test/              # fakeModel.js (테스트용 주입 Model)
├── test/                      # 백엔드 테스트 (node:test)
│   ├── schema.test.js
│   ├── articleId.test.js
│   ├── lifecycle.test.js
│   ├── articleService.test.js
│   ├── userService.test.js
│   ├── mediaSearch.test.js
│   └── controllers.test.js
├── news.md                    # 기사 작성기 기술 명세서 (기준 문서)
├── ArticleVO.md               # Article 테이블 필드 명세
├── ContentsVO.md              # Contents 테이블 필드 명세
├── UserVO.md                  # User 테이블 필드 명세
└── package.json               # node >= 22.5.0, ESM ("type": "module")
```

## 테스트 실행

> **중요** — 이 환경에서는 `node`가 PATH에 없을 수 있다. npm 스크립트 실행 전 Node.js 경로(`C:\Program Files\nodejs`)가 PATH에 포함되어 있는지 확인한다.

```sh
# 백엔드 테스트 (node:test, SQLite node:sqlite 내장 모듈)
npm test

# 프런트엔드 테스트 (Vitest, web/ 한정)
npm run test:web

# 프런트엔드 커버리지
npm run test:web:coverage
```

| 테스트 셋 | 러너 | 테스트 수 | 대상 |
|-----------|------|-----------|------|
| 백엔드 | `node:test` | 73개 | `test/*.test.js` |
| 프런트엔드 | Vitest | 28개 | `web/src/**/*.test.*` |

백엔드와 프런트엔드 테스트는 서로 독립되어 있다. `npm test`는 `web/`의 Vitest/JSX 파일을 실행하지 않는다.

## HARD 규칙

- **UTF-8** — 모든 텍스트는 UTF-8로 작성·저장한다.
- **DB 행 삭제 금지** — DB에 있는 내용은 물리적으로 삭제하지 않는다. 삭제는 `Contents.status`를 KILL 상태(RRK 또는 DDK)로 변경하는 소프트 삭제로 처리한다.

## 기사 생애주기 (상태 전이)

| 현재 상태 | 역할 | 액션 | 다음 상태 |
|-----------|------|------|-----------|
| RDS | R | send | RDS |
| RDS | R | hold | RRH |
| RDS | R | kill | RRK (소프트 삭제) |
| RDS | D | send | DPS |
| RDS | D | hold | DDH |
| RDS | D | kill | DDK (소프트 삭제) |
| RDS | Z | send | DPS (D-mirror) |
| RDS | Z | hold | DDH (D-mirror) |
| RDS | Z | kill | DDK (D-mirror, 소프트 삭제) |

- 최초 생성 상태: **RDS**
- `DPS` 상태에서 고침/포털고침은 **D 권한만** 가능
- 역할 코드: R=기자, D=데스크, Z=관리자
- Z 권한 전이는 D와 동일한 결과 상태를 생성한다 (SPEC-NEWS-REVISE-001 plan.md Decision Lock D-6)

## Run 단계 미구현 항목 (예정)

아래 항목은 현재 구현 범위 밖이며 향후 Run 단계에서 구현 예정이다.

- REST API 라우트 (`controllers/index.js`의 callable 함수는 구현되었으나 HTTP 바인딩 미포함)
- 미디어 검색 실제 HTTP 호출 (YouTube/Google API 키 설정 필요; 현재 인터페이스 및 fallback 로직만 구현)
- 프런트엔드 실시간 전송 (`subscribe` 메서드는 인터페이스 계약에 정의되었으나 WebSocket/SSE 구현 미포함)
- 구체적인 에디터 라이브러리 연동 (`editorAdapter.js` 계약만 정의됨)
- 수집 시스템, 배부 시스템
