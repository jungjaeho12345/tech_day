// @MX:ANCHOR: [AUTO] Frontend Model contract — injectable service interface consumed by every Controller (fan_in >= 3).
// @MX:REASON: SPEC-FRONTEND-UI-001 [HARD] requires the Model to be a mockable/injectable interface; the whole UI
// depends on this shape, and tests substitute fakes here instead of real HTTP/WebSocket transports.
//
// This module defines ONLY the interface contract (no real REST/HTTP/WebSocket). Concrete transports
// (REST routes, search-proxy endpoint, realtime transport) are Run-stage per the SPEC Exclusions.
//
// The contract mirrors the confirmed backend service contracts (SPEC-BACKEND-CORE-001):
//   - userService.login / query
//   - articleService.query / searchArticles / applyAction
//   - mediaSearch.search (type-routed: video=YouTube, image=Google Images, server-side)
//
// @typedef {object} AuthUser              normalized identity returned by login (NEVER includes password hash)
// @property {string} userId
// @property {string} name
// @property {'R'|'D'|'Z'} role
// @property {string} [department]
// @property {string} [departmentCode]
//
// @typedef {object} ArticleModel          the injectable Model passed via React context
// @property {(userId:string,password:string)=>Promise<{ok:boolean,user?:AuthUser}>} login
// @property {()=>Promise<{ok:boolean}>} logout                              // end the session (server /api/logout)
// @property {(filters:object)=>Promise<Array<object>>} queryUsers           // used for department data-source (DP-F4)
// @property {(filters:object)=>Promise<Array<object>>} queryArticles        // AND-combined metadata filters
// @property {(queryText:string)=>Promise<Array<object>>} searchArticles     // internal text-article search (글기사)
// @property {(query:string,type:'image'|'video')=>Promise<{items:Array<object>,error:boolean}>} searchMedia // proxy: type-routed (video=YouTube, image=Google Images)
// @property {(articleId:string,role:string,action:'send'|'hold'|'kill',options?:{sessionId?:string})=>Promise<{ok:boolean,status?:string,reason?:string}>} applyAction
// @property {(articleId:string,dto:object)=>Promise<{ok:boolean,articleId?:string}>} saveArticle // assemble+persist DTO
// @property {(filter:object,onChange:(payload:object)=>void)=>{unsubscribe:()=>void, connected:boolean}} subscribe // realtime (DP-F2)

// SPEC-NEWS-REVISE-002 REQ-EDIT-LOCK — 편집 락 획득/해제 endpoint pair (D2-4 = C: beforeunload +
// visibilitychange:hidden 이중 채널). userId는 서버 세션에서 가져오므로 (NFR-SEC) 클라이언트는
// page-scoped sessionId만 함께 전달한다.
//   acquireEditLock(articleId, { sessionId }) -> { ok, reason? }   POST /api/articles/:id/lock
//   releaseEditLock(articleId, { sessionId }) -> { ok }            DELETE /api/articles/:id/lock
export const MODEL_KEYS = Object.freeze([
  'login',
  'logout',
  'queryUsers',
  'queryArticles',
  'searchArticles',
  'searchMedia',
  'applyAction',
  'saveArticle',
  'acquireEditLock',
  'releaseEditLock',
  'subscribe',
]);

/** Validate that an injected object implements every Model method (cheap guard for wiring mistakes). */
export function assertModel(model) {
  for (const key of MODEL_KEYS) {
    if (typeof model?.[key] !== 'function') {
      throw new Error(`Model is missing required method "${key}"`);
    }
  }
  return model;
}
