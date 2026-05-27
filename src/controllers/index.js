// @MX:NOTE: [AUTO] Thin controllers — callable handlers delegating to services (REQ-ARCH-001, DP-2 defers REST).
//
// Controller layer for SPEC-BACKEND-CORE-001. Controllers carry no business logic and no SQL;
// they only wire requests to the service layer. Concrete REST routes are deferred to the Run stage (DP-2),
// so these are plain callable functions.

import { createArticleService } from '../services/articleService.js';
import { createUserService } from '../services/userService.js';
import { createMediaSearchService } from '../services/mediaSearch.js';

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ mediaSearch?: { search: (q: string) => Promise<object> } }} [deps]
 */
export function createControllers(db, deps = {}) {
  const articleService = createArticleService(db);
  const userService = createUserService(db);
  const mediaService = deps.mediaSearch ?? createMediaSearchService();

  return {
    article: {
      create: (data, options) => articleService.create(data, options),
      query: (filters) => articleService.query(filters),
      search: (queryText) => articleService.searchArticles(queryText),
      updateStatus: (articleId, status) => articleService.updateStatus(articleId, status),
      remove: (articleId, role) => articleService.remove(articleId, role),
      applyAction: (articleId, role, action) => articleService.applyAction(articleId, role, action),
    },
    user: {
      create: (user) => userService.create(user),
      query: (filters) => userService.query(filters),
      update: (userId, fields) => userService.update(userId, fields),
      remove: (userId) => userService.remove(userId),
      login: (userId, password) => userService.login(userId, password),
    },
    media: {
      search: (queryText) => mediaService.search(queryText),
    },
  };
}
