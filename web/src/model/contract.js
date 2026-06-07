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

// SPEC-EDIT-LOCK-001 REQ-EDIT-LOCK — 편집 락 획득/해제 endpoint pair. holder는 로그인 세션 id다
// (page-scoped UUID 폐기). userId/holder는 서버가 검증된 x-session-id 세션에서 도출하므로 (NFR-SEC)
// 클라이언트는 body 없이 articleId만 넘긴다.
//   lockArticle(articleId)   -> { ok:true, article? } | { ok:false, reason }   POST /api/articles/:id/lock
//   unlockArticle(articleId) -> { ok:true, released:boolean }                  POST /api/articles/:id/unlock
export const MODEL_KEYS = Object.freeze([
  'login',
  'logout',
  'queryUsers',
  'queryArticles',
  'searchArticles',
  'searchMedia',
  'applyAction',
  'saveArticle',
  'lockArticle',
  'unlockArticle',
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
