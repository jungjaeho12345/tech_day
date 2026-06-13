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

// Smoke: the default parser is what the service uses by default (no injection needed).
test('default parser wiring: createCollectionService without deps uses defaultParser', () => {
  const { db, svc } = freshCollection();
  const r = svc.ingest({ sourceId: 'FEED-A', payload: '평문 제목\n평문 본문' }, OPTS);
  assert.equal(r.ok, true);
  const parsed = JSON.parse(db.prepare('SELECT markupVersion FROM Article WHERE articleId = ?').get(r.articleId).markupVersion);
  assert.deepEqual(parsed.blocks.map((b) => b.text), ['평문 본문']);
});
