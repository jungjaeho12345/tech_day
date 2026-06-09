import { describe, it, expect } from 'vitest';
import { routeFromPath, pathForRoute, ROUTES } from './routing.js';

// Client-side URL <-> route mapping (news.md .do naming). routeFromPath/pathForRoute are the single
// source of truth; both fall back to LOGIN for unknown inputs so the SPA never lands on a dead route.
describe('routeFromPath', () => {
  it('maps each known .do path to its route', () => {
    expect(routeFromPath('/login.do')).toBe(ROUTES.LOGIN);
    expect(routeFromPath('/writer.do')).toBe(ROUTES.WRITE);
    expect(routeFromPath('/list.do')).toBe(ROUTES.VIEW);
  });

  it('falls back to LOGIN for an unknown path', () => {
    expect(routeFromPath('/unknown.do')).toBe(ROUTES.LOGIN);
    expect(routeFromPath('/')).toBe(ROUTES.LOGIN);
  });

  it('falls back to LOGIN when pathname is undefined', () => {
    expect(routeFromPath()).toBe(ROUTES.LOGIN);
  });
});

describe('pathForRoute', () => {
  it('builds the canonical path for each route', () => {
    expect(pathForRoute(ROUTES.LOGIN)).toBe('/login.do');
    expect(pathForRoute(ROUTES.WRITE)).toBe('/writer.do');
    expect(pathForRoute(ROUTES.VIEW)).toBe('/list.do');
  });

  it('appends an encoded ?id= when an id param is given', () => {
    expect(pathForRoute(ROUTES.VIEW, { id: 'A 1&2' }))
      .toBe(`/list.do?id=${encodeURIComponent('A 1&2')}`);
  });

  it('omits the id when it is falsy', () => {
    expect(pathForRoute(ROUTES.VIEW, { id: '' })).toBe('/list.do');
    expect(pathForRoute(ROUTES.VIEW, {})).toBe('/list.do');
  });

  it('falls back to the LOGIN path for an unknown route', () => {
    expect(pathForRoute('bogus-route')).toBe('/login.do');
  });
});
