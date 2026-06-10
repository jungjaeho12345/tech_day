// Static guard test for SPEC-NEWS-REVISE-003 REQ-API-LIFECYCLE-RULE / AC-LIFE-4 (토픽 F).
// 생애주기 우회 경로 부재를 정적 텍스트 검사로 단언한다: status를 직접 바꾸는 SQL
// (`UPDATE Contents SET status`)은 데이터 계층(articleModel.js / softDelete.js)에만 존재하고,
// 서비스 계층(articleService.js)·전송 계층(server/index.js)에는 없으며, 등록된 /api 라우트에는
// 알려진 article action / lock / unlock / update 외에 status를 직접 변경하는 라우트가 없다.
//
// 비고: acceptance.md §1 의 "articleService.js 내부 1곳" 예시 표현 대신, 실제 아키텍처(모델/DB
// 계층에 status SQL 집약, 서비스는 model.updateStatus 위임)의 결과적 불변식을 단언한다.
// 새 직접-status-UPDATE 경로가 추가되면 본 테스트가 즉시 FAIL 한다(회귀 알람).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const SERVER_INDEX = path.join(REPO_ROOT, 'server', 'index.js');

/** Recursively collect every .js file under a directory. */
function collectJs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectJs(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

// `UPDATE Contents SET ... status ...` — status를 직접 변경하는 SQL. lockYN/locker/일반 partial
// update 의 `UPDATE Contents` 는 status를 건드리지 않으므로 매치되지 않게 status 토큰을 요구한다.
const STATUS_UPDATE_RE = /UPDATE\s+Contents\s+SET\b[^;]*\bstatus\b/i;

// AC-LIFE-4: status 직접 변경 SQL 은 데이터 계층(articleModel.js / softDelete.js) 에만 존재한다.
test('AC-LIFE-4: "UPDATE Contents SET ... status" 직접 SQL은 데이터 계층(articleModel.js / softDelete.js)에만 존재한다', () => {
  const files = collectJs(SRC_DIR);
  const withStatusUpdate = files
    .filter((f) => STATUS_UPDATE_RE.test(readFileSync(f, 'utf8')))
    .map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'))
    .sort();

  // 정확히 데이터 계층 두 파일에만 — 서비스/컨트롤러 계층에는 없어야 한다.
  assert.deepEqual(withStatusUpdate, ['src/db/softDelete.js', 'src/models/articleModel.js']);
});

// AC-LIFE-4: 서비스 계층(articleService.js)은 status를 직접 UPDATE하지 않고 model.updateStatus로 위임한다.
test('AC-LIFE-4: articleService.js 는 status를 직접 UPDATE하지 않는다 (model.updateStatus 위임)', () => {
  const text = readFileSync(path.join(SRC_DIR, 'services', 'articleService.js'), 'utf8');
  assert.equal(STATUS_UPDATE_RE.test(text), false, 'articleService.js 에 직접 status UPDATE SQL 없음');
  // 위임 경로 존재 확인 — 전이 결과는 model.updateStatus 를 통해서만 영속된다.
  assert.ok(/model\.updateStatus\(/.test(text), 'applyAction은 model.updateStatus로 전이 결과를 영속한다');
});

// AC-LIFE-4: 전송 계층(server/index.js)은 status를 직접 UPDATE하지 않는다 (라우트는 컨트롤러에만 위임).
test('AC-LIFE-4: server/index.js 는 status를 직접 UPDATE하는 SQL을 포함하지 않는다', () => {
  const text = readFileSync(SERVER_INDEX, 'utf8');
  assert.equal(STATUS_UPDATE_RE.test(text), false, 'server/index.js 에 직접 status UPDATE SQL 없음');
});

// AC-LIFE-4: 등록된 /api/articles 라우트 목록에 알려진 엔드포인트 외 status 직접 변경 라우트가 없다.
test('AC-LIFE-4: /api/articles 하위 라우트는 알려진 action/lock/unlock/update/조회 외에 status 직접 변경 라우트가 없다', () => {
  const text = readFileSync(SERVER_INDEX, 'utf8');

  // app.<method>('<path>' 형태로 등록된 모든 라우트를 enumerate.
  // 라우트 등록 목록은 집합(set) 개념이므로 중복을 제거한다 — 주석에 동일 시그니처가 인용된
  // 경우(예: 과거 잘못된 배선 설명) 까지 매치되어 중복되는 것을 방지.
  const routeRe = /app\.(get|post|put|delete)\(\s*'([^']+)'/g;
  const routes = new Set();
  let m;
  while ((m = routeRe.exec(text)) !== null) {
    routes.add(`${m[1].toUpperCase()} ${m[2]}`);
  }

  // /api/articles 하위(검색·락 포함) 라우트만 추린다.
  const articleRoutes = [...routes].filter((r) => / \/api\/articles/.test(r)).sort();

  // 생애주기/상태에 관여하는 article 라우트의 화이트리스트 (SPEC-EDIT-LOCK-001 신설계).
  // - GET    /api/articles            (조회: 전이 없음)
  // - GET    /api/articles/search     (내부 검색: 전이 없음)
  // - POST   /api/articles            (신규 작성 = articleInsert; RDS 적재)
  // - POST   /api/articles/:id/action (유일한 상태 전이 진입점, 인가 게이트 통과)
  // - PUT    /api/articles/:id        (편집 = articleUpdate; assertLockHolder 게이트, status 직접변경 아님)
  // - POST   /api/articles/:id/lock   (락 획득; 신설계 holder = 로그인 세션 id)
  // - POST   /api/articles/:id/unlock (락 해제; DELETE /lock 폐기 → POST /unlock)
  // - POST   /api/articles/:id/force-unlock (SPEC-NEWS-REVISE-012 강제 해제; 락 컬럼만 변경, status 불변)
  const ALLOWED = [
    'GET /api/articles',
    'GET /api/articles/search',
    'POST /api/articles',
    'POST /api/articles/:id/action',
    'POST /api/articles/:id/force-unlock',
    'POST /api/articles/:id/lock',
    'POST /api/articles/:id/unlock',
    'PUT /api/articles/:id',
  ].sort();

  assert.deepEqual(articleRoutes, ALLOWED, '알려진 article 라우트 외 추가 라우트가 없어야 한다');

  // 상태(status)를 바꾸는 유일한 전이 라우트는 /action 하나뿐임을 명시적으로 단언.
  const statusMutatingRoutes = articleRoutes.filter((r) => /\/action$/.test(r));
  assert.deepEqual(statusMutatingRoutes, ['POST /api/articles/:id/action']);
});
