// @MX:ANCHOR: [AUTO] Collection service — the receive→whitelist→parse→register pipeline for the
// 수집(자동기사) system (REQ-RCV-RECEIVE/WHITELIST/PARSE/REGISTER/AUTOMARK, expected fan_in >= 3).
// @MX:REASON: single orchestration seam for auto-article ingestion; the FTP-event adapter, the API
// adapter, the parser adapter, and the registration transaction all converge here. Mis-ordering the
// whitelist/parse/register steps would let unregistered or partial articles persist.
//
// Collection business logic for SPEC-RCV-COLLECT-001. Source reception is abstracted behind an
// adapter envelope { sourceId, payload } so FTP-event and API ingestion share one pipeline and tests
// can inject in-memory inputs (no real FTP server / network). Reuses SPEC-DB-FOUNDATION-001 article
// ID generation and SPEC-BACKEND-CORE-001 article model + transaction pattern.

import { generateArticleId } from '../db/articleId.js';
import { createArticleModel } from '../models/articleModel.js';
import { createReceiverConfigService } from './receiverConfigService.js';
import { defaultParser } from '../parsers/defaultParser.js';
import { buildMarkupVersion, isParseResultComplete } from '../parsers/parser.js';
import { AUTO_ARTICLE_SOURCE } from '../db/schema.js';

const INITIAL_STATUS = 'RDS'; // DP-RCV-2: collected articles enter at desk pre-submission review.
const DEFAULT_AUTHOR = '자동수집'; // DP-RCV-4: system-default author when the feed carries none.

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ parser?: { parse: Function }, receiverConfigService?: object }} [deps]
 */
export function createCollectionService(db, deps = {}) {
  const model = createArticleModel(db);
  const parser = deps.parser ?? defaultParser;
  const receiverConfig = deps.receiverConfigService ?? createReceiverConfigService(db);

  /**
   * Register one parsed article across Article + Contents in a single transaction
   * (REQ-RCV-REGISTER-001..004). On any failure the whole write rolls back so no partial row remains.
   * The source mark (REQ-RCV-AUTOMARK-001) and feed-first stamping (REQ-RCV-REGISTER-005) are applied
   * here so every path through registration is consistent.
   */
  function register(parseResult, options = {}) {
    const markupVersion = buildMarkupVersion(parseResult.bodyBlocks);
    const articleId = generateArticleId(db, options);
    const createdAt = (options.now ?? new Date()).toISOString();

    // DP-RCV-4 feed-first stamping: use feed author/department when present, else system defaults.
    const feedMeta = parseResult.feedMeta ?? {};
    const author = feedMeta.author ?? DEFAULT_AUTHOR;
    const department = feedMeta.department ?? '';
    const departmentCode = feedMeta.departmentCode ?? '';

    db.exec('BEGIN');
    try {
      model.insert(articleId, {
        title: parseResult.title,
        content: null,
        markupVersion,
        author,
        department,
        departmentCode,
        createdAt,
        status: INITIAL_STATUS,
        // REQ-RCV-AUTOMARK-001/002: the mark is mandatory and lives in the dedicated source column.
        source: AUTO_ARTICLE_SOURCE,
      });
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return { ok: true, articleId, status: INITIAL_STATUS, source: AUTO_ARTICLE_SOURCE };
  }

  /**
   * Ingest one source envelope { sourceId, payload } through the full pipeline. Used by both the
   * FTP-event path and the API path so they share whitelist → parse → register exactly.
   *
   * Order is load-bearing (REQ-RCV-RECEIVE-003): the whitelist check runs BEFORE any parse/register,
   * so an unregistered source never produces a parse attempt or a row (REQ-RCV-WHITELIST-002).
   *
   * @param {{ sourceId?: string, payload?: object|string }} envelope
   * @param {object} [options] injectable now/randomFn for deterministic tests
   * @returns {{ ok: true, articleId: string, status: string, source: string }
   *           | { ok: false, reason: 'rejected-whitelist' | 'parse-failed' }}
   */
  function ingest(envelope, options = {}) {
    const { sourceId, payload } = envelope ?? {};

    // 1) Whitelist gate (REQ-RCV-WHITELIST-001/002) — reject unregistered sources before parsing.
    if (!receiverConfig.isWhitelisted(sourceId)) {
      return { ok: false, reason: 'rejected-whitelist' };
    }

    // 2) Parse (REQ-RCV-PARSE-001/002/005). A title-only or body-only result is incomplete.
    const parseResult = parser.parse(payload);
    if (!isParseResultComplete(parseResult)) {
      // REQ-RCV-PARSE-004: do not persist a partially-formed/malformed article.
      return { ok: false, reason: 'parse-failed' };
    }

    // 3) Register transactionally (REQ-RCV-REGISTER-001..005, AUTOMARK).
    return register(parseResult, options);
  }

  return {
    /** REQ-RCV-RECEIVE-001 — FTP event reception: a received file envelope enters the pipeline. */
    receiveFtpEvent(envelope, options = {}) {
      return ingest(envelope, options);
    },

    /** REQ-RCV-RECEIVE-002 — API reception: an API response envelope enters the same pipeline. */
    receiveApiResponse(envelope, options = {}) {
      return ingest(envelope, options);
    },

    // Shared pipeline entry, exposed for tests and direct callers.
    ingest,
  };
}
