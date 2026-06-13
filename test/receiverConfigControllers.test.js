// Tests for SPEC-RCV-COLLECT-001 rcvMgmt.do controller wiring + Z-only authorization.
// Covers AC-9 (조회/생성/삭제), AC-10 (설정 삭제가 기사 미삭제), AC-11 (Z 전용, R/D 거부).
// All tests use in-memory :memory: SQLite via createControllers — never the production news.db.
import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createControllers } from '../src/controllers/index.js';

function freshControllers() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const media = { search: async () => ({ items: [], error: false }) };
  const c = createControllers(db, { mediaSearch: media });
  return { db, c };
}

function loginAs(c, userId, role) {
  c.user.create({ userId, name: userId, password: 'pw', role });
  return c.auth.login(userId, 'pw').sessionId;
}

// --- AC-9: Z 사용자 설정 조회/생성/삭제 -------------------------------------
describe('AC-9: rcvMgmt.do 설정 조회/생성/삭제 (REQ-RCV-MGMT-001..003, -006, DP-RCV-6)', () => {
  it('Z 세션은 수신처 설정을 생성하고 조회할 수 있다', () => {
    const { c } = freshControllers();
    const sid = loginAs(c, 'admin', 'Z');

    const created = c.receiverConfig.create(sid, {
      kind: 'receive', sourceId: 'FEED-A', config: { host: 'ftp.example', port: 21 },
    });
    assert.equal(created.ok, true);
    assert.match(created.id, /^RCV\d{9}$/);

    const listed = c.receiverConfig.query(sid, {});
    assert.equal(listed.ok, true);
    assert.equal(listed.entries.length, 1);
    assert.equal(listed.entries[0].kind, 'receive');
    assert.equal(listed.entries[0].sourceId, 'FEED-A');
    assert.deepEqual(listed.entries[0].config, { host: 'ftp.example', port: 21 });
  });

  it('Z 세션은 API / FTP 송신 / 수신 설정을 모두 등록·조회할 수 있다', () => {
    const { c } = freshControllers();
    const sid = loginAs(c, 'admin', 'Z');
    c.receiverConfig.create(sid, { kind: 'api', config: { url: 'https://api' } });
    c.receiverConfig.create(sid, { kind: 'ftp-send', config: { host: 'out.ftp' } });
    c.receiverConfig.create(sid, { kind: 'receive', sourceId: 'FEED-B' });
    const all = c.receiverConfig.query(sid, {});
    assert.equal(all.entries.length, 3);
    const byKind = c.receiverConfig.query(sid, { kind: 'receive' });
    assert.equal(byKind.entries.length, 1);
    assert.equal(byKind.entries[0].sourceId, 'FEED-B');
  });

  it('Z 세션은 설정 엔트리를 삭제할 수 있다', () => {
    const { c } = freshControllers();
    const sid = loginAs(c, 'admin', 'Z');
    const { id } = c.receiverConfig.create(sid, { kind: 'receive', sourceId: 'FEED-A' });
    const removed = c.receiverConfig.remove(sid, id);
    assert.equal(removed.ok, true);
    assert.equal(c.receiverConfig.query(sid, {}).entries.length, 0);
  });

  it('receive 설정에 sourceId 가 없으면 거부된다(화이트리스트 멤버 요건)', () => {
    const { c } = freshControllers();
    const sid = loginAs(c, 'admin', 'Z');
    const res = c.receiverConfig.create(sid, { kind: 'receive' });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'missing-sourceId');
  });

  it('알 수 없는 kind 는 거부된다', () => {
    const { c } = freshControllers();
    const sid = loginAs(c, 'admin', 'Z');
    const res = c.receiverConfig.create(sid, { kind: 'bogus' });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'invalid-kind');
  });
});

// --- AC-11: Z 전용 권한 게이트 (R/D 거부) -----------------------------------
describe('AC-11: 관리 권한 Z 전용 — R/D 거부 (REQ-RCV-MGMT-005, DP-RCV-6)', () => {
  for (const role of ['R', 'D']) {
    it(`${role} 세션은 조회/생성/삭제가 모두 forbidden 으로 거부된다`, () => {
      const { c } = freshControllers();
      const sid = loginAs(c, `user-${role}`, role);
      const q = c.receiverConfig.query(sid, {});
      assert.equal(q.ok, false);
      assert.equal(q.reason, 'forbidden');
      const cr = c.receiverConfig.create(sid, { kind: 'receive', sourceId: 'X' });
      assert.equal(cr.ok, false);
      assert.equal(cr.reason, 'forbidden');
      const rm = c.receiverConfig.remove(sid, 'RCV000000001');
      assert.equal(rm.ok, false);
      assert.equal(rm.reason, 'forbidden');
    });
  }

  it('미인증(세션 없음) 호출은 unauthenticated 로 거부된다', () => {
    const { c } = freshControllers();
    const res = c.receiverConfig.query('no-such-session', {});
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unauthenticated');
  });

  it('R/D 거부 시 설정이 생성되지 않는다 (상태 불변)', () => {
    const { c } = freshControllers();
    const rSid = loginAs(c, 'reporter', 'R');
    c.receiverConfig.create(rSid, { kind: 'receive', sourceId: 'X' });
    // Z 로 확인 — R 의 생성 시도가 반영되지 않았어야 한다.
    const zSid = loginAs(c, 'admin', 'Z');
    assert.equal(c.receiverConfig.query(zSid, {}).entries.length, 0);
  });
});

// --- AC-10: 설정 삭제가 이미 수집된 기사를 삭제하지 않음 --------------------
describe('AC-10: 설정 삭제가 기사 데이터를 삭제하지 않는다 (REQ-RCV-MGMT-004)', () => {
  it('수신처 설정을 삭제해도 그 출처로 수집된 Article/Contents 는 보존된다', () => {
    const { db, c } = freshControllers();
    const sid = loginAs(c, 'admin', 'Z');
    const { id } = c.receiverConfig.create(sid, { kind: 'receive', sourceId: 'FEED-A' });

    // 그 출처로 자동기사 수집.
    const ingested = c.collection.receiveFtpEvent(
      { sourceId: 'FEED-A', payload: { title: '수집 기사', body: '본문' } },
      { now: new Date('2026-06-13T00:00:00Z') },
    );
    assert.equal(ingested.ok, true);
    const beforeArticles = db.prepare('SELECT COUNT(*) AS n FROM Article').get().n;
    const beforeContents = db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n;
    assert.equal(beforeArticles, 1);
    assert.equal(beforeContents, 1);

    // 설정 엔트리 삭제.
    const removed = c.receiverConfig.remove(sid, id);
    assert.equal(removed.ok, true);

    // 기사 데이터는 하나도 줄지 않는다.
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Article').get().n, beforeArticles);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Contents').get().n, beforeContents);
    const row = db.prepare('SELECT title, source FROM Contents WHERE articleId = ?').get(ingested.articleId);
    assert.equal(row.title, '수집 기사', '수집 기사는 설정 삭제 후에도 보존된다');
    assert.equal(row.source, '자동기사');
  });
});

// Smoke: removing a missing config id returns not-found (no throw).
test('remove of a missing config id returns not-found', () => {
  const { c } = freshControllers();
  const sid = loginAs(c, 'admin', 'Z');
  const res = c.receiverConfig.remove(sid, 'RCV999999999');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not-found');
});
