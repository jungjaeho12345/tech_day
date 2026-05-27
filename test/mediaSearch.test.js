// Tests for SPEC-BACKEND-CORE-001 media search proxy (AC-14, AC-15, AC-16, AC-17).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMediaSearchService } from '../src/services/mediaSearch.js';

// Fakes for injectable providers — no real API calls.
function youtubeReturning(items) {
  return { search: async () => items };
}
function googleReturning(items) {
  return { search: async () => items };
}
function failing(message = 'upstream boom') {
  return { search: async () => { throw new Error(message); } };
}

// AC-14: YouTube first, normalized shape
test('AC-14: calls YouTube first and returns normalized youtube items', async () => {
  const calls = [];
  const youtube = { search: async (q) => { calls.push(['yt', q]); return [{ title: 'v1', url: 'http://yt/1', thumbnailUrl: 'http://yt/t1' }]; } };
  const google = { search: async (q) => { calls.push(['g', q]); return []; } };
  const svc = createMediaSearchService({ youtube, google });

  const result = await svc.search('뉴스 속보');
  assert.equal(result.error, false);
  assert.equal(calls[0][0], 'yt');
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], { source: 'youtube', title: 'v1', url: 'http://yt/1', thumbnailUrl: 'http://yt/t1' });
});

test('AC-14: does not call Google when YouTube returns results', async () => {
  let googleCalled = false;
  const youtube = youtubeReturning([{ title: 'v', url: 'http://yt/1' }]);
  const google = { search: async () => { googleCalled = true; return []; } };
  const svc = createMediaSearchService({ youtube, google });

  await svc.search('q');
  assert.equal(googleCalled, false);
});

// AC-15: Google fallback on YouTube error OR empty result
test('AC-15: falls back to Google when YouTube errors', async () => {
  const svc = createMediaSearchService({
    youtube: failing(),
    google: googleReturning([{ title: 'g1', url: 'http://g/1' }]),
  });
  const result = await svc.search('q');
  assert.equal(result.error, false);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].source, 'google');
  assert.equal(result.items[0].url, 'http://g/1');
});

test('AC-15: falls back to Google when YouTube returns an empty result set', async () => {
  let googleCalled = false;
  const google = { search: async () => { googleCalled = true; return [{ title: 'g', url: 'http://g/1' }]; } };
  const svc = createMediaSearchService({ youtube: youtubeReturning([]), google });
  const result = await svc.search('q');
  assert.equal(googleCalled, true);
  assert.equal(result.items[0].source, 'google');
});

// AC-16: both fail -> empty set + error indicator, no raw upstream error
test('AC-16: both providers fail -> empty items and error indicator (no raw error propagated)', async () => {
  const svc = createMediaSearchService({ youtube: failing('yt secret'), google: failing('g secret') });
  const result = await svc.search('q');
  assert.equal(result.error, true);
  assert.deepEqual(result.items, []);
  // No raw upstream message leaked.
  assert.ok(!JSON.stringify(result).includes('secret'));
});

test('AC-16: both providers empty -> empty items and error indicator', async () => {
  const svc = createMediaSearchService({ youtube: youtubeReturning([]), google: googleReturning([]) });
  const result = await svc.search('q');
  assert.equal(result.error, true);
  assert.deepEqual(result.items, []);
});

// AC-17: API keys never exposed in the result
test('AC-17: result never contains API keys', async () => {
  const youtube = { search: async () => [{ title: 'v', url: 'http://yt/1' }] };
  const google = googleReturning([]);
  const svc = createMediaSearchService({ youtube, google });
  const result = await svc.search('q');
  const serialized = JSON.stringify(result);
  assert.ok(!/apiKey|api_key|key=/i.test(serialized), 'no API key material in client-bound result');
});

// Default providers read keys from env, server-side only (AC-17 contract surface).
test('AC-17: default providers do not leak env keys onto the service or result', async () => {
  process.env.YOUTUBE_API_KEY = 'SECRET_YT';
  process.env.GOOGLE_API_KEY = 'SECRET_G';
  // Default providers will fail (no network in test) -> error result, but must not leak keys.
  const svc = createMediaSearchService();
  const result = await svc.search('q');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});
