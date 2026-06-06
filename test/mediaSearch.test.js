// Tests for SPEC-BACKEND-CORE-001 media search proxy (AC-16, AC-17 + type-routing guards).
//
// 2026-06-06 directive: the video tab returns YouTube results ONLY and the image tab returns
// Google Image Search results ONLY. This SUPERSEDES the SPEC-NEWS-REVISE-002 D2-8 "YouTube-first,
// Google fallback" contract -- there is NO cross-provider fallback anymore. The former AC-14/AC-15
// fallback tests and the AC-SEARCH-1/AC-SEARCH-2 fallback guards are replaced by the type-routing
// guards below; AC-16/AC-17 (error indicator + no key leak) are preserved with a type argument.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaSearchService } from '../src/services/mediaSearch.js';

// Fakes for injectable providers -- no real API calls.
function youtubeReturning(items) {
  return { search: async () => items };
}
function googleReturning(items) {
  return { search: async () => items };
}
function failing(message = 'upstream boom') {
  return { search: async () => { throw new Error(message); } };
}

// AC-ROUTE-VIDEO: type 'video' calls YouTube ONLY; Google is NEVER called; youtube-normalized shape.
test('AC-ROUTE-VIDEO: type "video" calls YouTube only and Google is never called', async () => {
  const calls = [];
  const youtube = { search: async (q) => { calls.push(['yt', q]); return [{ title: 'v1', url: 'http://yt/1', thumbnailUrl: 'http://yt/t1' }]; } };
  const google = { search: async (q) => { calls.push(['g', q]); return []; } };
  const svc = createMediaSearchService({ youtube, google });

  const result = await svc.search('뉴스 속보', 'video');
  assert.equal(result.error, false);
  assert.deepEqual(calls, [['yt', '뉴스 속보']]);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], { source: 'youtube', title: 'v1', url: 'http://yt/1', thumbnailUrl: 'http://yt/t1' });
});

// Missing/unknown type normalizes to 'video' (YouTube only).
test('AC-ROUTE-VIDEO: missing type routes to YouTube only (Google never called)', async () => {
  let googleCalled = false;
  const youtube = youtubeReturning([{ title: 'v', url: 'http://yt/1' }]);
  const google = { search: async () => { googleCalled = true; return [{ title: 'g', url: 'http://g/1' }]; } };
  const svc = createMediaSearchService({ youtube, google });

  const result = await svc.search('q');
  assert.equal(googleCalled, false);
  assert.equal(result.items[0].source, 'youtube');
});

// AC-ROUTE-IMAGE: type 'image' calls Google ONLY; YouTube is NEVER called; google-normalized shape.
test('AC-ROUTE-IMAGE: type "image" calls Google only and YouTube is never called', async () => {
  const calls = [];
  const youtube = { search: async (q) => { calls.push(['yt', q]); return [{ title: 'v', url: 'http://yt/1' }]; } };
  const google = { search: async (q) => { calls.push(['g', q]); return [{ title: 'g1', url: 'http://g/1', thumbnailUrl: 'http://g/t1' }]; } };
  const svc = createMediaSearchService({ youtube, google });

  const result = await svc.search('올림픽', 'image');
  assert.equal(result.error, false);
  assert.deepEqual(calls, [['g', '올림픽']]);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], { source: 'google', title: 'g1', url: 'http://g/1', thumbnailUrl: 'http://g/t1' });
});

// AC-ROUTE-ERROR: per-type provider error -> { items: [], error: true }; the other provider is NOT used.
test('AC-ROUTE-ERROR: video provider error -> empty+error, no Google fallback', async () => {
  let googleCalled = false;
  const svc = createMediaSearchService({
    youtube: failing('yt down'),
    google: { search: async () => { googleCalled = true; return [{ title: 'g', url: 'http://g/1' }]; } },
  });
  const result = await svc.search('q', 'video');
  assert.equal(googleCalled, false, 'no cross-provider fallback');
  assert.equal(result.error, true);
  assert.deepEqual(result.items, []);
});

test('AC-ROUTE-ERROR: image provider error -> empty+error, no YouTube fallback', async () => {
  let youtubeCalled = false;
  const svc = createMediaSearchService({
    youtube: { search: async () => { youtubeCalled = true; return [{ title: 'v', url: 'http://yt/1' }]; } },
    google: failing('g down'),
  });
  const result = await svc.search('q', 'image');
  assert.equal(youtubeCalled, false, 'no cross-provider fallback');
  assert.equal(result.error, true);
  assert.deepEqual(result.items, []);
});

// AC-ROUTE-EMPTY: per-type empty result set -> { items: [], error: true } (no fallback to the other side).
test('AC-ROUTE-EMPTY: video empty -> empty+error, Google never consulted', async () => {
  let googleCalled = false;
  const svc = createMediaSearchService({
    youtube: youtubeReturning([]),
    google: { search: async () => { googleCalled = true; return [{ title: 'g', url: 'http://g/1' }]; } },
  });
  const result = await svc.search('q', 'video');
  assert.equal(googleCalled, false);
  assert.equal(result.error, true);
  assert.deepEqual(result.items, []);
});

test('AC-ROUTE-EMPTY: image empty -> empty+error, YouTube never consulted', async () => {
  let youtubeCalled = false;
  const svc = createMediaSearchService({
    youtube: { search: async () => { youtubeCalled = true; return [{ title: 'v', url: 'http://yt/1' }]; } },
    google: googleReturning([]),
  });
  const result = await svc.search('q', 'image');
  assert.equal(youtubeCalled, false);
  assert.equal(result.error, true);
  assert.deepEqual(result.items, []);
});

// AC-16: provider fails -> empty set + error indicator, no raw upstream error leaked.
test('AC-16: provider failure -> empty items and error indicator (no raw error propagated)', async () => {
  const svcV = createMediaSearchService({ youtube: failing('yt secret'), google: failing('g secret') });
  const rv = await svcV.search('q', 'video');
  assert.equal(rv.error, true);
  assert.deepEqual(rv.items, []);
  assert.ok(!JSON.stringify(rv).includes('secret'));

  const svcI = createMediaSearchService({ youtube: failing('yt secret'), google: failing('g secret') });
  const ri = await svcI.search('q', 'image');
  assert.equal(ri.error, true);
  assert.deepEqual(ri.items, []);
  assert.ok(!JSON.stringify(ri).includes('secret'));
});

test('AC-16: provider empty -> empty items and error indicator', async () => {
  const svc = createMediaSearchService({ youtube: youtubeReturning([]), google: googleReturning([]) });
  const rv = await svc.search('q', 'video');
  assert.equal(rv.error, true);
  assert.deepEqual(rv.items, []);
  const ri = await svc.search('q', 'image');
  assert.equal(ri.error, true);
  assert.deepEqual(ri.items, []);
});

// AC-17: API keys never exposed in the result (both routes).
test('AC-17: result never contains API keys', async () => {
  const youtube = { search: async () => [{ title: 'v', url: 'http://yt/1' }] };
  const google = { search: async () => [{ title: 'g', url: 'http://g/1' }] };
  const svc = createMediaSearchService({ youtube, google });

  const rv = await svc.search('q', 'video');
  const ri = await svc.search('q', 'image');
  for (const result of [rv, ri]) {
    const serialized = JSON.stringify(result);
    assert.ok(!/apiKey|api_key|key=/i.test(serialized), 'no API key material in client-bound result');
  }
});

// AC-17: default providers read keys from env, server-side only -- never leaked onto service/result.
test('AC-17: default providers do not leak env keys onto the service or result', async () => {
  process.env.YOUTUBE_API_KEY = 'SECRET_YT';
  process.env.GOOGLE_API_KEY = 'SECRET_G';
  process.env.GOOGLE_SEARCH_CX = 'SECRET_CX';
  // Default providers will fail (no network in test) -> error result, but must not leak keys.
  const svc = createMediaSearchService();
  const rv = await svc.search('q', 'video');
  const ri = await svc.search('q', 'image');
  assert.ok(!JSON.stringify(rv).includes('SECRET'));
  assert.ok(!JSON.stringify(ri).includes('SECRET'));
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_SEARCH_CX;
});

// SPEC-NEWS-REVISE-002 -- REQ-SEARCH-YOUTUBE-API regression guard, re-anchored to the 2026-06-06
// type-split directive. These guards now assert that the video tab is YouTube-only and the image
// tab is Google-only, SUPERSEDING the D2-8 (B) "YouTube HTTP-fail OR empty -> Google fallback"
// contract. They lock the type-routing so any future edit to mediaSearch.js breaks them immediately.

test('AC-SEARCH-1 (type-split): type "video" uses YouTube only; Google is never called', async () => {
  let youtubeCalls = 0;
  let googleCalls = 0;
  const youtube = { search: async () => { youtubeCalls += 1; return [{ title: 'yt1', url: 'https://yt/1' }]; } };
  const google = { search: async () => { googleCalls += 1; return [{ title: 'g1', url: 'https://g/1' }]; } };
  const svc = createMediaSearchService({ youtube, google });
  const result = await svc.search('query', 'video');
  assert.equal(youtubeCalls, 1);
  assert.equal(googleCalls, 0);
  assert.equal(result.items[0].source, 'youtube');
  assert.equal(result.error, false);
});

test('AC-SEARCH-2 (type-split, supersedes D2-8=B): type "image" uses Google only; YouTube is never called', async () => {
  let youtubeCalls = 0;
  let googleCalls = 0;
  const youtube = { search: async () => { youtubeCalls += 1; return [{ title: 'yt1', url: 'https://yt/1' }]; } };
  const google = { search: async () => { googleCalls += 1; return [{ title: 'g1', url: 'https://g/1' }]; } };
  const svc = createMediaSearchService({ youtube, google });
  const result = await svc.search('query', 'image');
  assert.equal(googleCalls, 1);
  assert.equal(youtubeCalls, 0);
  assert.equal(result.items[0].source, 'google');
  assert.equal(result.error, false);
});

test('AC-SEARCH-4 (NFR-SEC): API key strings never appear in the result payload', async () => {
  process.env.YOUTUBE_API_KEY = 'KEY_SECRET_YT_002';
  process.env.GOOGLE_API_KEY = 'KEY_SECRET_G_002';
  process.env.GOOGLE_SEARCH_CX = 'KEY_SECRET_CX_002';
  const svc = createMediaSearchService();
  const rv = await svc.search('q', 'video');
  const ri = await svc.search('q', 'image');
  const serialized = JSON.stringify(rv) + JSON.stringify(ri);
  assert.ok(!serialized.includes('KEY_SECRET_YT_002'));
  assert.ok(!serialized.includes('KEY_SECRET_G_002'));
  assert.ok(!serialized.includes('KEY_SECRET_CX_002'));
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_SEARCH_CX;
});
