import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createArticleModel } from '../src/models/articleModel.js';

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE Article (
      articleId TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      markupVersion TEXT,
      modifier TEXT
    );
    CREATE TABLE Contents (
      articleId TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      author TEXT,
      modifier TEXT,
      sender TEXT,
      department TEXT,
      departmentCode TEXT,
      createdAt TEXT,
      editedAt TEXT,
      sentAt TEXT,
      distributedAt TEXT,
      embargoAt TEXT,
      secondEmbargoAt TEXT,
      status TEXT,
      lockYN TEXT DEFAULT 'N',
      lockedAt TEXT,
      lockerUserId TEXT,
      lockerSessionId TEXT,
      coAuthor TEXT,
      region TEXT,
      attribute TEXT,
      keyword TEXT,
      internalComment TEXT,
      externalComment TEXT,
      attachmentFile TEXT,
      referenceFile TEXT
    );
  `);
  return db;
}

function freshModel() {
  const db = freshDb();
  const model = createArticleModel(db);
  return { db, model };
}

describe('articleModel.searchByText — lockYN/lockedAt 별칭 (Issue #13 Low)', () => {
  test('AC-SEARCH-1: searchByText 결과에 lockYN 키가 소문자로 포함된다', () => {
    const { db, model } = freshModel();
    db.prepare(`INSERT INTO Article (articleId, title) VALUES ('A-S1', '검색 테스트')`).run();
    db.prepare(
      `INSERT INTO Contents (articleId, title, content, status, lockYN) VALUES ('A-S1', '검색 테스트', '본문 내용', 'RDS', 'Y')`,
    ).run();
    const results = model.searchByText('검색');
    assert.ok(results.length > 0, '결과가 1건 이상이어야 한다');
    const row = results[0];
    assert.equal(typeof row.lockYN, 'string', 'lockYN 키가 존재해야 한다');
    assert.equal(row.lockYN, 'Y', 'lockYN 값이 Y여야 한다');
  });

  test('AC-SEARCH-2: searchByText 결과에 lockedAt 키가 포함된다', () => {
    const { db, model } = freshModel();
    db.prepare(`INSERT INTO Article (articleId, title) VALUES ('A-S2', '잠금 테스트')`).run();
    db.prepare(
      `INSERT INTO Contents (articleId, title, content, status, lockYN, lockedAt) VALUES ('A-S2', '잠금 테스트', '잠금 본문', 'RDS', 'Y', '2026-01-01T00:00:00Z')`,
    ).run();
    const results = model.searchByText('잠금');
    assert.ok(results.length > 0, '결과가 1건 이상이어야 한다');
    const row = results[0];
    assert.equal(row.lockedAt, '2026-01-01T00:00:00Z', 'lockedAt 값이 올바르게 반환되어야 한다');
  });

  test('AC-SEARCH-3: lockYN이 N인 기사는 lockYN이 N으로 반환된다', () => {
    const { db, model } = freshModel();
    db.prepare(`INSERT INTO Article (articleId, title) VALUES ('A-S3', '비잠금')`).run();
    db.prepare(
      `INSERT INTO Contents (articleId, title, content, status, lockYN) VALUES ('A-S3', '비잠금', '일반 본문', 'RDS', 'N')`,
    ).run();
    const results = model.searchByText('비잠금');
    assert.ok(results.length > 0);
    assert.equal(results[0].lockYN, 'N');
  });
});
