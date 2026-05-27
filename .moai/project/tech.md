# Tech — 기술 스택

## 개요

서버/클라이언트 분리 구조. 양쪽 모두 **MVC 패턴**으로 구현되었다.

## 서버

| 항목 | 선택 | 비고 |
|------|------|------|
| 런타임 | NodeJS >= 22.5.0 | `node:sqlite` 내장 모듈 사용 (22.5+에서 실험적 제공) |
| 모듈 시스템 | ESM (`"type": "module"`) | `import`/`export` 사용 |
| 아키텍처 | MVC Pattern | controllers / services / models / db 계층 분리 |
| DB | SQLite via `node:sqlite` | 단일 파일 DB, 외부 드라이버 없음 |
| 비밀번호 해싱 | bcryptjs ^3.0.3 | 서버사이드 전용; 해시는 API 응답 미포함 |
| 테스트 러너 | `node:test` (built-in) | `--experimental-sqlite`, `--experimental-test-coverage` 플래그 필요 |

### DB 테이블

모든 컬럼 타입 **VARCHAR** (SQLite TEXT affinity 사용).

- **Article** (PK=articleId): articleId, title, content, markupVersion, modifier
- **Contents** (PK=articleId): articleId, title, content, author, modifier, sender, department, departmentCode, createdAt, editedAt, sentAt, distributedAt, embargoAt, secondEmbargoAt, **status**
- **User** (PK=userId): userId, name, password, role, department, departmentCode

> 상세 스키마/마이그레이션/쿼리는 `.moai/project/db/`(`schema.md`, `erd.mmd`, `migrations.md`, `queries.md`) 참조.
> DB 내용은 삭제하지 않는다 — 상태값(KILL: RRK/DDK) 변경으로 소프트 삭제 처리.

### 기사 ID 생성

형식: `AKR` + `YYYYMMDD` + 9자리 0-패딩 난수 = 총 20자. 충돌 시 난수 부분 재생성 (애플리케이션 함수로 구현, `src/db/articleId.js`).

## 클라이언트

| 항목 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | React 19 | JSX, Hooks |
| 빌드 도구 | Vite 7 | `web/vite.config.js` |
| 아키텍처 | MVC Pattern | model / view / controller / app 디렉터리 분리 |
| 테스트 러너 | Vitest ^3.2.4 | jsdom 환경, `@testing-library/react` |
| 커버리지 | `@vitest/coverage-v8` | |

### 페이지 (구현 완료)

- 로그인 페이지
- 기사 작성 페이지 (에디터 + 메타데이터 탭 구조)
- 기사 조회 페이지

### Model 인터페이스

프런트엔드 Model은 **주입 가능한 인터페이스 계약**(`src/model/contract.js`)으로 정의됨. 구체 HTTP/WebSocket 전송은 Run 단계 예정 (현재 `main.jsx`는 placeholder fake 주입).

### 외부 연동 (인터페이스 구현, HTTP 실호출 미구현/예정)

- 이미지·영상 검색: YouTube API 우선 → 실패 시 Google Custom Search fallback
- 글기사 검색: 내부 기사 제목·본문 검색

## 개발 환경 요건

- Node.js >= 22.5.0 (LTS 권장) — `C:\Program Files\nodejs` PATH 등록 확인
- npm (루트 `package.json`에서 백엔드/프런트엔드 스크립트 통합 관리)
- SQLite (node:sqlite 내장, 별도 설치 불필요)

## 빌드 / 배포 (미구현/예정)

- 클라이언트: `vite build` (web/ 디렉터리에서 실행)
- 서버: NodeJS 직접 실행 (`src/controllers/index.js`의 REST 바인딩 구현 후)
- REST 라우터, 외부 API 키 환경변수 설정 필요: `YOUTUBE_API_KEY`, `GOOGLE_API_KEY`, `GOOGLE_SEARCH_CX`

## 개발 방법론

- `development_mode`: **tdd** (TDD RED-GREEN-REFACTOR)
- SPEC: SPEC-DB-FOUNDATION-001 → SPEC-BACKEND-CORE-001 → SPEC-FRONTEND-UI-001 순서로 구현 완료
