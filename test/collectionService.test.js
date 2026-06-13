// Tests for SPEC-RCV-COLLECT-001 collection pipeline + parser adapter.
// Covers AC-1/2 (FTP-event + API ingest), AC-3 (whitelist reject), AC-4 (title/body extract),
// AC-5 (yh-editor block-JSON), AC-5b (abstract parser + default parser), AC-6 (parse-fail skip),
// AC-7 (transaction + RDS + articleId reuse + rollback), AC-7b (feed-first stamping),
// AC-8 (source='자동기사' mandatory mark).
// All tests use in-memory :memory: SQLite — never the production news.db.
import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema, AUTO_ARTICLE_SOURCE } from '../src/db/schema.js';
import { createCollectionService } from '../src/services/collectionService.js';
import { createReceiverConfigService } from '../src/services/receiverConfigService.js';
import { defaultParser, parse } from '../src/parsers/defaultParser.js';
import {
  buildMarkupVersion, textToBlocks, isParseResultComplete, MARKUP_FORMAT, MARKUP_VERSION,
} from '../src/parsers/parser.js';

// Build a fresh in-memory DB with one whitelisted receive source registered.
function freshCollection({ whitelistSource = 'FEED-A' } = {}) {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const receiverConfigService = createReceiverConfigService(db);
  if (whitelistSource) {
    receiverConfigService.create(
      { kind: 'receive', sourceId: whitelistSource, config: { host: 'ftp.example' } },
      { now: new Date('2026-06-13T00:00:00Z') },
    );
  }
  const svc = createCollectionService(db, { receiverConfigService });
  return { db, svc, receiverConfigService };
}

const OPTS = { now: new Date('2026-06-13T00:00:00Z') };

// --- AC-4: FTP path and API path produce IDENTICAL extraction ---------------
// Round-1 evaluator recommendation: pin that both reception paths run the same
// ingest/parser and yield equal {title, markupVersion} for an identical payload.
describe('AC-4: FTP·API 경로가 동일 payload 에서 동등한 추출 결과를 산출한다 (REQ-RCV-PARSE-001/002)', () => {
  it('동일 payload 를 FTP/API 양 경로로 수신시키면 title + markupVersion(blocks) 이 동등하다', () => {
    const payload = { title: '동일 제목', body: '본문 단락 하나\n본문 단락 둘' };

    // Each path needs its own DB row, but the extraction must be identical.
    const ftpEnv = freshCollection();
    const apiEnv = freshCollection();
    const ftp = ftpEnv.svc.receiveFtpEvent({ sourceId: 'FEED-A', payload }, OPTS);
    const api = apiEnv.svc.receiveApiResponse({ sourceId: 'FEED-A', payload }, OPTS);
    assert.equal(ftp.ok, true);
    assert.equal(api.ok, true);

    const ftpRow = ftpEnv.db
      .prepare('SELECT title, markupVersion FROM Article WHERE articleId = ?').get(ftp.articleId);
    const apiRow = apiEnv.db
      .prepare('SELECT title, markupVersion FROM Article WHERE articleId = ?').get(api.articleId);

    // Title equality.
    assert.equal(ftpRow.title, apiRow.title);
    assert.equal(ftpRow.title, '동일 제목');
    // markupVersion block-JSON equality — same parser, same normalization.
    assert.deepEqual(JSON.parse(ftpRow.markupVersion), JSON.parse(apiRow.markupVersion));
    assert.deepEqual(JSON.parse(ftpRow.markupVersion).blocks, [
      { type: 'text', text: '본문 단락 하나' },
      { type: 'text', text: '본문 단락 둘' },
    ]);
  });

  it('수신 결과 객체(title 미반환이지만 source/status)도 양 경로에서 동등하다', () => {
    const payload = { title: '동일', body: '본문' };
    const ftp = freshCollection().svc.receiveFtpEvent({ sourceId: 'FEED-A', payload }, OPTS);
    const api = freshCollection().svc.receiveApiResponse({ sourceId: 'FEED-A', payload }, OPTS);
    assert.equal(ftp.status, api.status);
    assert.equal(ftp.source, api.source);
  });
});

// --- AC-5b: abstract parser adapter + default concrete parser ---------------
describe('AC-5b: 추상 파서 어댑터 + 기본 파서 1종 (REQ-RCV-PARSE-005)', () => {
  it('구조화 입력 {title, body} 에서 {title, bodyBlocks} 를 산출한다', () => {
    const result = parse({ title: '제목', body: '본문 한 줄\n본문 두 줄' });
    assert.equal(result.title, '제목');
    assert.deepEqual(result.bodyBlocks, [
      { type: 'text', text: '본문 한 줄' },
      { type: 'text', text: '본문 두 줄' },
    ]);
  });

  it('평문 입력은 첫 줄=제목, 이후=본문으로 분해된다', () => {
    const result = parse('속보 제목\n첫 단락\n둘째 단락');
    assert.equal(result.title, '속보 제목');
    assert.deepEqual(result.bodyBlocks.map((b) => b.text), ['첫 단락', '둘째 단락']);
  });

  it('defaultParser 는 어댑터 인터페이스(parse 함수)를 만족한다', () => {
    assert.equal(typeof defaultParser.parse, 'function');
    assert.equal(defaultParser.name, 'default');
  });

  // Covers defaultParser.js Array.isArray(payload.body) branch (round-1 uncovered).
  it('body 가 배열이면 단락별 텍스트 블록이 생성된다', () => {
    const result = parse({ title: '제목', body: ['단락1', '단락2'] });
    assert.equal(result.title, '제목');
    assert.deepEqual(result.bodyBlocks, [
      { type: 'text', text: '단락1' },
      { type: 'text', text: '단락2' },
    ]);
  });

  it('body 배열의 비문자열 항목은 무시되고 문자열 단락만 블록이 된다', () => {
    const result = parse({ title: '제목', body: ['단락1', 42, null, '단락2'] });
    assert.deepEqual(result.bodyBlocks.map((b) => b.text), ['단락1', '단락2']);
  });

  it('배열 body 경로가 수집 파이프라인 전체에서 markupVersion 으로 적재된다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: ['p1', 'p2'] } }, OPTS);
    assert.equal(r.ok, true);
    const parsed = JSON.parse(db.prepare('SELECT markupVersion FROM Article WHERE articleId = ?').get(r.articleId).markupVersion);
    assert.deepEqual(parsed.blocks.map((b) => b.text), ['p1', 'p2']);
  });
});

// --- AC-5: yh-editor block-JSON normalization -------------------------------
describe('AC-5: 본문 → yh-editor 블록 JSON 정규화 (REQ-RCV-PARSE-003)', () => {
  it('평문 본문이 최소 1개 텍스트 블록으로 감싸인다', () => {
    const blocks = textToBlocks('한 줄짜리 본문');
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0], { type: 'text', text: '한 줄짜리 본문' });
  });

  it('buildMarkupVersion 이 {"format":"yh-editor","version":1,"blocks":[...]} 봉투를 만든다', () => {
    const json = buildMarkupVersion([{ type: 'text', text: 'x' }]);
    const parsed = JSON.parse(json);
    assert.equal(parsed.format, MARKUP_FORMAT);
    assert.equal(parsed.format, 'yh-editor');
    assert.equal(parsed.version, MARKUP_VERSION);
    assert.equal(parsed.version, 1);
    assert.deepEqual(parsed.blocks, [{ type: 'text', text: 'x' }]);
  });

  it('isParseResultComplete: 제목만 또는 본문만이면 불완전(false)', () => {
    assert.equal(isParseResultComplete({ title: '제목', bodyBlocks: [] }), false);
    assert.equal(isParseResultComplete({ title: '', bodyBlocks: [{ type: 'text', text: 'x' }] }), false);
    assert.equal(isParseResultComplete({ title: '제목', bodyBlocks: [{ type: 'text', text: 'x' }] }), true);
  });

  // Defensive branches in parser.js (round-1 uncovered: parser.js L24-25, L51-52).
  it('textToBlocks 는 비문자열 입력에 대해 빈 블록 배열을 반환한다 (방어 분기)', () => {
    assert.deepEqual(textToBlocks(null), []);
    assert.deepEqual(textToBlocks(undefined), []);
    assert.deepEqual(textToBlocks(123), []);
    assert.deepEqual(textToBlocks(['배열도', '비문자열']), []);
  });

  it('isParseResultComplete 는 null/undefined 직접 호출 시 false 다 (방어 분기)', () => {
    assert.equal(isParseResultComplete(null), false);
    assert.equal(isParseResultComplete(undefined), false);
    assert.equal(isParseResultComplete(), false);
  });
});

// --- AC-1/AC-2: FTP-event + API ingest enter the pipeline -------------------
describe('AC-1/AC-2: FTP event + API 수신이 파이프라인에 진입한다 (REQ-RCV-RECEIVE-001/002)', () => {
  it('AC-1: 화이트리스트 통과 FTP event 수신 → 등록 성공', () => {
    const { db, svc } = freshCollection();
    const r = svc.receiveFtpEvent(
      { sourceId: 'FEED-A', payload: { title: 'FTP 기사', body: '본문' } }, OPTS,
    );
    assert.equal(r.ok, true);
    assert.match(r.articleId, /^AKR\d{8}\d{9}$/);
    const row = db.prepare('SELECT title, status FROM Contents WHERE articleId = ?').get(r.articleId);
    assert.equal(row.title, 'FTP 기사');
    assert.equal(row.status, 'RDS');
  });

  it('AC-2: 화이트리스트 통과 API 응답 수신 → 등록 성공 (FTP 와 동일 추출 결과)', () => {
    const { db, svc } = freshCollection();
    const r = svc.receiveApiResponse(
      { sourceId: 'FEED-A', payload: { title: 'API 기사', body: '본문' } }, OPTS,
    );
    assert.equal(r.ok, true);
    const article = db.prepare('SELECT title, markupVersion FROM Article WHERE articleId = ?').get(r.articleId);
    assert.equal(article.title, 'API 기사');
    const parsed = JSON.parse(article.markupVersion);
    assert.equal(parsed.format, 'yh-editor');
    assert.deepEqual(parsed.blocks, [{ type: 'text', text: '본문' }]);
  });
});

// --- AC-3: unregistered ID is rejected --------------------------------------
describe('AC-3: 미등록 ID 수신 거부 (REQ-RCV-WHITELIST-001/002)', () => {
  it('미등록 sourceId 데이터는 거부되고 어떤 행도 생성되지 않는다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'UNKNOWN', payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'rejected-whitelist');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Article').get().n, 0);
  });

  it('sourceId 누락도 거부된다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'rejected-whitelist');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
  });

  it('User 테이블이 아닌 receive-kind 설정만 화이트리스트 출처다 (DP-RCV-3)', () => {
    const { db, svc, receiverConfigService } = freshCollection({ whitelistSource: null });
    // api/ftp-send 설정은 화이트리스트가 아니다 — 등록해도 수신은 거부된다.
    receiverConfigService.create({ kind: 'api', sourceId: 'FEED-B', config: {} }, OPTS);
    const r = svc.ingest({ sourceId: 'FEED-B', payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'rejected-whitelist');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
  });
});

// --- AC-6: parse failure → no partial article ------------------------------
describe('AC-6: 제목/본문 추출 실패 시 미등록 (REQ-RCV-PARSE-004)', () => {
  it('본문이 비면 등록되지 않는다 (제목만)', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: '제목만', body: '' } }, OPTS);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'parse-failed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Article').get().n, 0);
  });

  it('제목이 비면 등록되지 않는다 (본문만)', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: '', body: '본문만' } }, OPTS);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'parse-failed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Article').get().n, 0);
  });

  it('알 수 없는 포맷(숫자)은 파싱 실패로 간주 (부분 등록 금지)', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: 12345 }, OPTS);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'parse-failed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
  });
});

// --- AC-7: transaction + RDS + articleId reuse + rollback -------------------
describe('AC-7: 등록 — 트랜잭션 + RDS + 기사 ID 재사용 + 롤백 (REQ-RCV-REGISTER-001..004)', () => {
  it('AKR+YYYYMMDD+난수9 형식 articleId 로 Article+Contents 가 동일 ID 로 적재된다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } }, OPTS);
    assert.match(r.articleId, /^AKR\d{8}\d{9}$/);
    assert.match(r.articleId, /^AKR20260613\d{9}$/);
    assert.ok(db.prepare('SELECT 1 FROM Article WHERE articleId = ?').get(r.articleId));
    assert.ok(db.prepare('SELECT 1 FROM Contents WHERE articleId = ?').get(r.articleId));
  });

  it('초기 status 가 RDS 다 (DP-RCV-2)', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(r.status, 'RDS');
    assert.equal(db.prepare('SELECT status FROM Contents WHERE articleId = ?').get(r.articleId).status, 'RDS');
  });

  it('트랜잭션 중 Contents INSERT 실패 시 Article 도 롤백되어 부분 행이 남지 않는다', () => {
    const { db, svc } = freshCollection();
    const origPrepare = db.prepare.bind(db);
    // Contents INSERT 만 실패시키고 Article INSERT 는 통과시킨다.
    db.prepare = function patched(sql) {
      if (sql.startsWith('INSERT INTO Contents')) {
        return { run() { throw new Error('simulated Contents INSERT failure'); } };
      }
      return origPrepare(sql);
    };
    assert.throws(
      () => svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } }, OPTS),
      /simulated Contents INSERT failure/,
    );
    db.prepare = origPrepare;
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Article').get().n, 0, 'Article INSERT 도 롤백된다');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
  });
});

// --- AC-7b: feed-first stamping → system default ----------------------------
describe('AC-7b: 작성자·부서 스탬핑 — 피드 우선 → 시스템 기본 (REQ-RCV-REGISTER-005, DP-RCV-4)', () => {
  it('피드에 작성자/부서가 있으면 그 값을 사용한다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({
      sourceId: 'FEED-A',
      payload: { title: 't', body: 'b', author: '연합기자', department: '국제부', departmentCode: 'INT' },
    }, OPTS);
    const row = db.prepare('SELECT author, department, departmentCode FROM Contents WHERE articleId = ?')
      .get(r.articleId);
    assert.equal(row.author, '연합기자');
    assert.equal(row.department, '국제부');
    assert.equal(row.departmentCode, 'INT');
  });

  it('피드에 작성자/부서가 없으면 시스템 기본(author=자동수집, 부서 빈 값)으로 스탬프한다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } }, OPTS);
    const row = db.prepare('SELECT author, department, departmentCode FROM Contents WHERE articleId = ?')
      .get(r.articleId);
    assert.equal(row.author, '자동수집');
    assert.equal(row.department, '');
    assert.equal(row.departmentCode, '');
  });
});

// --- AC-8: source='자동기사' mandatory mark ---------------------------------
describe('AC-8: 자동기사 표지 필수 (REQ-RCV-AUTOMARK-001/002, DP-RCV-1)', () => {
  it('등록된 자동기사는 Contents.source=\'자동기사\' 표지를 갖는다', () => {
    const { db, svc } = freshCollection();
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(r.source, AUTO_ARTICLE_SOURCE);
    const row = db.prepare('SELECT source, attribute FROM Contents WHERE articleId = ?').get(r.articleId);
    assert.equal(row.source, '자동기사');
    // 사용자 편집 항목 attribute 는 표지에 사용되지 않는다 (NULL).
    assert.equal(row.attribute, null);
  });

  it('표지는 모든 자동 등록 경로(FTP+API)에서 부여된다', () => {
    const { db, svc } = freshCollection();
    const ftp = svc.receiveFtpEvent({ sourceId: 'FEED-A', payload: { title: 'f', body: 'b' } }, OPTS);
    const api = svc.receiveApiResponse({ sourceId: 'FEED-A', payload: { title: 'a', body: 'b' } }, OPTS);
    for (const id of [ftp.articleId, api.articleId]) {
      assert.equal(db.prepare('SELECT source FROM Contents WHERE articleId = ?').get(id).source, '자동기사');
    }
  });
});

// --- collectionService uncovered branches (round-1: 78.95% → target 85%+) ---
describe('collectionService 미커버 분기 보강', () => {
  it('options.now 미주입 시 실제 new Date() 경로로 createdAt 이 기록된다 (프로덕션 경로)', () => {
    const { db, svc } = freshCollection();
    const before = Date.now();
    // No options → register() falls through to `options.now ?? new Date()` real branch.
    const r = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } });
    const after = Date.now();
    assert.equal(r.ok, true);
    // articleId date segment must reflect a real current date (not the fixed test clock).
    assert.match(r.articleId, /^AKR\d{8}\d{9}$/);
    const row = db.prepare('SELECT createdAt FROM Contents WHERE articleId = ?').get(r.articleId);
    const created = Date.parse(row.createdAt);
    assert.ok(Number.isFinite(created), 'createdAt is a valid ISO timestamp');
    assert.ok(created >= before && created <= after, 'createdAt falls in the real-time window');
  });

  it('receiverConfigService 미주입 시 db 로 직접 생성한 화이트리스트 게이트가 동작한다', () => {
    // Exercises `deps.receiverConfigService ?? createReceiverConfigService(db)` fallback branch.
    const db = new DatabaseSync(':memory:');
    createSchema(db);
    // Register the whitelist source directly (no injected service handed to createCollectionService).
    createReceiverConfigService(db).create(
      { kind: 'receive', sourceId: 'FEED-A', config: {} }, OPTS,
    );
    const svc = createCollectionService(db); // no deps → builds its own receiverConfigService.
    const ok = svc.ingest({ sourceId: 'FEED-A', payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(ok.ok, true);
    const rejected = svc.ingest({ sourceId: 'NOPE', payload: { title: 't', body: 'b' } }, OPTS);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, 'rejected-whitelist');
  });

  it('envelope 가 null/undefined 면 sourceId 없음으로 거부된다 (envelope ?? {} 분기)', () => {
    const { db, svc } = freshCollection();
    for (const bad of [null, undefined]) {
      const r = svc.ingest(bad, OPTS);
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'rejected-whitelist');
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, 0);
  });
});

// Smoke: the default parser is what the service uses by default (no injection needed).
test('default parser wiring: createCollectionService without deps uses defaultParser', () => {
  const { db, svc } = freshCollection();
  const r = svc.ingest({ sourceId: 'FEED-A', payload: '평문 제목\n평문 본문' }, OPTS);
  assert.equal(r.ok, true);
  const parsed = JSON.parse(db.prepare('SELECT markupVersion FROM Article WHERE articleId = ?').get(r.articleId).markupVersion);
  assert.deepEqual(parsed.blocks.map((b) => b.text), ['평문 본문']);
});
