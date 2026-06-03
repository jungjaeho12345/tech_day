// Regression guard tests for SPEC-NEWS-REVISE-003 REQ-MEDIA-TAB-SEARCH (토픽 A).
// AC-MEDIA-1..4 — 이미지/영상 탭은 mediaSearch (Youtube-first, Google 폴백), 글기사 탭은 내부
// articleService.searchArticles (외부 API 미호출), 그리고 API 키가 응답에 절대 노출되지 않음을 단언한다.
// Δ-only: mediaSearch.js / articleService.js 는 변경하지 않는다.
//
// 비고: SPEC 의 searchMedia({tab}) 예시 API는 실제 코드에 없다. 실제 아키텍처는
//   - 이미지/영상 탭 → createMediaSearchService({youtube, google}).search(query)
//   - 글기사 탭     → createArticleService(db).searchArticles(query)  (model.searchByText, 내부 LIKE)
// 이므로 결과적 동작(글기사 검색 경로가 youtube/google provider를 절대 호출하지 않음)을 단언한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createSchema } from '../src/db/schema.js';
import { createArticleService } from '../src/services/articleService.js';
import { createMediaSearchService } from '../src/services/mediaSearch.js';

function callCounter(impl) {
  const fn = async (...args) => {
    fn.calls += 1;
    return impl(...args);
  };
  fn.calls = 0;
  return fn;
}

// AC-MEDIA-1: 이미지/영상 탭 검색 → Youtube provider 1회 호출, Google 0회, 정규화 카드 페이로드.
test('AC-MEDIA-1: 이미지/영상 탭 검색은 Youtube provider를 1회 호출하고 Google은 호출하지 않으며 정규화 카드를 반환한다', async () => {
  const youtubeSearch = callCounter(async () => [
    { title: '올림픽 하이라이트', url: 'https://yt/1', thumbnailUrl: 'https://yt/t1' },
  ]);
  const googleSearch = callCounter(async () => []);
  const svc = createMediaSearchService({
    youtube: { search: youtubeSearch },
    google: { search: googleSearch },
  });

  const result = await svc.search('올림픽');
  assert.equal(youtubeSearch.calls, 1, 'Youtube provider 정확히 1회 호출');
  assert.equal(googleSearch.calls, 0, 'Youtube 성공 시 Google 미호출');
  assert.equal(result.error, false);
  assert.equal(result.items.length, 1);
  // 정규화된 임베딩 카드 페이로드 {source, title, url, thumbnailUrl}.
  assert.deepEqual(result.items[0], {
    source: 'youtube',
    title: '올림픽 하이라이트',
    url: 'https://yt/1',
    thumbnailUrl: 'https://yt/t1',
  });
});

// AC-MEDIA-2: Youtube throws/5xx → Google 폴백 호출, 정규화 결과.
test('AC-MEDIA-2: Youtube가 실패하면 Google 폴백이 호출되고 정규화된 결과를 반환한다', async () => {
  const youtubeSearch = callCounter(async () => { throw new Error('http 503'); });
  const googleSearch = callCounter(async () => [
    { title: '올림픽 기사', url: 'https://g/1', thumbnailUrl: 'https://g/t1' },
  ]);
  const svc = createMediaSearchService({
    youtube: { search: youtubeSearch },
    google: { search: googleSearch },
  });

  const result = await svc.search('올림픽');
  assert.equal(youtubeSearch.calls, 1, 'Youtube provider 호출됨');
  assert.equal(googleSearch.calls, 1, 'Youtube 실패 시 Google 폴백 호출');
  assert.equal(result.error, false);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    source: 'google',
    title: '올림픽 기사',
    url: 'https://g/1',
    thumbnailUrl: 'https://g/t1',
  });
});

// AC-MEDIA-3: 글기사 탭 경로 → articleService.searchArticles 사용, youtube/google mock은 절대 미호출.
test('AC-MEDIA-3: 글기사 탭 검색은 내부 articleService.searchArticles만 사용하고 youtube/google provider를 호출하지 않는다', async () => {
  // youtube/google mock 은 호출되면 즉시 실패하도록 설정 (호출 자체가 회귀 신호).
  const youtubeSearch = callCounter(async () => { throw new Error('글기사 탭에서 youtube가 호출되면 안 된다'); });
  const googleSearch = callCounter(async () => { throw new Error('글기사 탭에서 google이 호출되면 안 된다'); });
  // mediaSearch 서비스 인스턴스(존재하더라도 글기사 경로에서는 사용되지 않음).
  createMediaSearchService({
    youtube: { search: youtubeSearch },
    google: { search: googleSearch },
  });

  // 글기사 탭 검색은 내부 기사 DB(Article/Contents) LIKE 검색으로만 수행된다.
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const articleService = createArticleService(db);
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202606040000000010', '올림픽 개막', '본문', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202606040000000011', '무관 기사', '올림픽 관련 본문', 'RDS');
  db.prepare('INSERT INTO Contents (articleId, title, content, status) VALUES (?,?,?,?)')
    .run('AKR202606040000000012', '무관', '무관', 'RDS');

  const hits = articleService.searchArticles('올림픽');

  // 내부 검색이 1회 수행되고(결과 2건), 외부 provider 는 0회 호출.
  assert.equal(youtubeSearch.calls, 0, '글기사 경로는 youtube를 호출하지 않는다');
  assert.equal(googleSearch.calls, 0, '글기사 경로는 google을 호출하지 않는다');
  const ids = hits.map((r) => r.articleId).sort();
  assert.deepEqual(ids, ['AKR202606040000000010', 'AKR202606040000000011']);
  // 내부 기사 카드 페이로드 — 외부 source 태그가 아닌 기사 레코드.
  assert.ok(hits.every((r) => r.articleId.startsWith('AKR')));
});

// AC-MEDIA-4: provider가 응답에 키를 악의적으로 심어도, 정규화 결과에 키/키-필드가 노출되지 않는다.
test('AC-MEDIA-4: 악성 provider 응답에 API 키가 포함돼도 정규화 결과 직렬화에 키가 노출되지 않는다', async () => {
  process.env.YOUTUBE_API_KEY = 'AIza-FAKE-DO-NOT-LEAK-TOKEN';
  process.env.GOOGLE_API_KEY = 'AIza-FAKE-DO-NOT-LEAK-GOOGLE';
  try {
    // Youtube provider 가 응답 아이템에 키와 키-필드를 의도적으로 포함시킨다 (악성 응답 시뮬레이션).
    const youtube = {
      search: async () => [{
        title: '제목',
        url: 'https://yt/1',
        thumbnailUrl: 'https://yt/t1',
        apiKey: process.env.YOUTUBE_API_KEY,
        key: process.env.YOUTUBE_API_KEY,
        accessToken: process.env.GOOGLE_API_KEY,
        leaked: `embedded ${process.env.YOUTUBE_API_KEY}`,
      }],
    };
    const google = { search: async () => [] };
    const svc = createMediaSearchService({ youtube, google });

    const result = await svc.search('x');
    const serialized = JSON.stringify(result);

    // 키 토큰 문자열이 결과 직렬화 어디에도 나타나지 않는다 (normalize 가 화이트리스트 필드만 통과).
    assert.equal(serialized.includes(process.env.YOUTUBE_API_KEY), false, 'YOUTUBE_API_KEY 미노출');
    assert.equal(serialized.includes(process.env.GOOGLE_API_KEY), false, 'GOOGLE_API_KEY 미노출');

    // 응답 어떤 항목에도 apiKey / key / accessToken 필드가 존재하지 않는다.
    for (const item of result.items) {
      assert.equal(Object.prototype.hasOwnProperty.call(item, 'apiKey'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(item, 'key'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(item, 'accessToken'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(item, 'leaked'), false);
    }
  } finally {
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  }
});

// AC-MEDIA-4 (보완): 기본(default) provider가 키를 env에서 읽더라도 결과에 키가 새어 나오지 않는다.
test('AC-MEDIA-4 (default providers): env 키를 사용하는 기본 provider도 결과 직렬화에 키를 노출하지 않는다', async () => {
  process.env.YOUTUBE_API_KEY = 'KEY_SECRET_YT_003';
  process.env.GOOGLE_API_KEY = 'KEY_SECRET_G_003';
  try {
    // 네트워크가 없으므로 기본 provider 는 실패(error 결과) 하지만 키를 노출해서는 안 된다.
    const svc = createMediaSearchService();
    const result = await svc.search('q');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('KEY_SECRET_YT_003'), false);
    assert.equal(serialized.includes('KEY_SECRET_G_003'), false);
  } finally {
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  }
});
