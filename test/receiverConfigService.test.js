// Unit tests for SPEC-RCV-COLLECT-001 receiverConfigService — defensive safeParse branch.
// Round-1 evaluator INFO recommendation: a malformed JSON config string already persisted in the DB
// must NOT crash query(); it falls back to the raw string. We seed the invalid config directly via
// the model (bypassing the service's JSON.stringify) to reach safeParse's catch branch.
// All tests use in-memory :memory: SQLite — never the production news.db.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createReceiverConfigService } from '../src/services/receiverConfigService.js';
import { createReceiverConfigModel } from '../src/models/receiverConfigModel.js';

function freshService() {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  return { db, svc: createReceiverConfigService(db), model: createReceiverConfigModel(db) };
}

describe('receiverConfigService.query — safeParse 방어 분기 (INFO)', () => {
  it('DB 에 저장된 유효하지 않은 JSON config 문자열이어도 크래시 없이 raw 문자열을 반환한다', () => {
    const { svc, model } = freshService();
    // Seed a row whose config column is NOT valid JSON (e.g. a legacy/corrupted value).
    model.insert({
      id: 'RCV000000001', kind: 'receive', sourceId: 'FEED-A',
      config: '{not valid json', createdAt: '2026-06-13T00:00:00.000Z',
    });

    let listed;
    assert.doesNotThrow(() => { listed = svc.query({}); }, 'query must not throw on bad JSON');
    assert.equal(listed.length, 1);
    // Fallback contract: the raw string is returned unchanged when parsing fails.
    assert.equal(listed[0].config, '{not valid json');
    assert.equal(listed[0].sourceId, 'FEED-A');
  });

  it('유효한 JSON config 는 객체로 파싱되어 반환된다 (대비 케이스)', () => {
    const { svc } = freshService();
    svc.create(
      { kind: 'receive', sourceId: 'FEED-B', config: { host: 'ftp.example', port: 21 } },
      { now: new Date('2026-06-13T00:00:00Z') },
    );
    const listed = svc.query({});
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].config, { host: 'ftp.example', port: 21 });
  });

  it('config 가 NULL 이면 null 로 반환된다 (파싱 시도 없음)', () => {
    const { svc, model } = freshService();
    model.insert({
      id: 'RCV000000002', kind: 'api', sourceId: null,
      config: null, createdAt: '2026-06-13T00:00:00.000Z',
    });
    const listed = svc.query({});
    assert.equal(listed.length, 1);
    assert.equal(listed[0].config, null);
  });
});
