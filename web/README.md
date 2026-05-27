# 기사 제작 시스템 — 프런트엔드 UI (SPEC-FRONTEND-UI-001)

React 19 + Vite 기반 클라이언트. 클라이언트 측 MVC 구조.

## 구조 (MVC)

- `src/view/` — View: 화면/컴포넌트 (LoginPage, WritePage, ViewPage, TopBar).
- `src/controller/` — Controller: 사용자 액션 처리, Model 호출, 상태 조정 (use*Controller, useSearchController).
- `src/model/` — Model: **주입 가능한 서버 데이터 인터페이스 계약** (`contract.js`) + 에디터 어댑터 계약 (`editorAdapter.js`).
- `src/app/` — App 셸: Model 주입(Context), 세션 상태, 3개 페이지 클라이언트 라우팅 + 인증 가드.
- `src/test/` — Vitest setup + **주입용 FAKE Model** (`fakeModel.js`).

## Model 인터페이스 [HARD]

Model 계층은 실제 REST/HTTP/WebSocket이 아니라 **주입 가능한 인터페이스**(`src/model/contract.js`)입니다.
구체 전송 방식(REST 라우트, search-proxy 엔드포인트, 실시간 전송)은 Run 단계 소관입니다.
테스트는 `createFakeModel()`을 주입하고, `src/main.jsx`도 현재는 placeholder fake를 주입합니다.

계약은 확정된 백엔드 서비스 계약(SPEC-BACKEND-CORE-001)에 정렬:
`login`, `queryUsers`(부서 데이터-소스, DP-F4), `queryArticles`, `searchArticles`(글기사),
`searchMedia`(YouTube→Google 프록시, DP-F3), `applyAction`(send/hold, DP-F5),
`saveArticle`(DTO 조립·영속), `subscribe`(실시간 구독, DP-F2).

## 테스트 러너 구성 결정

- 백엔드는 `node:test` (루트 `test/*.test.js`), 프런트엔드는 **Vitest** (`web/` 한정).
- 루트 `package.json`의 `test`/`coverage` 스크립트를 `test/*.test.js`로 **좁혀서** node:test 러너가
  `web/`의 Vitest/JSX 파일을 실행하지 않도록 했습니다(상호 비간섭).
- 프런트엔드 실행: 루트에서 `npm run test:web` (또는 `npm run test:web:coverage`).
- 백엔드 실행: 루트에서 `npm test`.

## 명령

```
npm test                 # 백엔드 (node:test)
npm run test:web         # 프런트엔드 (vitest, web/ 한정)
npm run test:web:coverage
```
