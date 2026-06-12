// Regression guard for AC-VW-2 (SPEC-NEWS-REVISE-015 §4) — SSE 자동 재연결 배선.
//
// news.md 흡수: 조회 모델은 EventSource 를 채택하고 open/error 핸들러로 연결 상태를 추적한다.
// 우리 코드는 폴링/타이머/커스텀 재연결 루프를 구현하지 않는다 — 끊긴 연결의 *재연결 자체* 는
// 브라우저(EventSource) 가 위임받아 수행한다. 코드 근거: web/src/model/httpModel.js:249-279.
//
// ── 위임 한계 (단위 테스트 불가 영역, 명시) ─────────────────────────────────────────────
// EventSource 의 자동 재연결(error 후 일정 시간 뒤 재접속하여 open 재발화)은 브라우저 내장 동작이며,
// jsdom/Node 환경에는 실제 EventSource 구현이 없다(테스트는 FakeEventSource 스텁을 주입). 따라서
// "끊긴 뒤 다시 붙는다"는 동작 자체는 본 단위 테스트로 *완전 검증 불가* 다. 본 가드는 우리 코드가
// 위임에 필요한 *배선* 만 갖췄는지를 단언한다:
//   (1) 폴링/타이머가 아니라 EventSource 를 생성한다,
//   (2) error 핸들러를 등록해 연결-끊김 상태를 추적/전파한다,
//   (3) open 핸들러를 등록해 (재)연결 시 상태를 복구한다,
//   (4) EventSource 부재 환경에서는 안전한 no-op 구독으로 떨어진다.
// 재연결 타이밍·재시도 백오프는 브라우저 책임이므로 단언하지 않는다(흡수 SPEC §6.3 결정).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpModel } from './httpModel.js';

const BASE = 'http://127.0.0.1:3001';

describe('AC-VW-2: SSE 재연결 배선 가드 (재연결 자체는 브라우저 위임)', () => {
  let originalEventSource;
  let originalFetch;

  beforeEach(() => {
    originalEventSource = global.EventSource;
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    try { sessionStorage.clear(); } catch { /* no storage in this env */ }
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    try { sessionStorage.clear(); } catch { /* no storage in this env */ }
  });

  it('폴링/타이머가 아니라 EventSource 를 생성하고 open+error 핸들러를 등록한다', () => {
    const listeners = {};
    let constructed = 0;
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    class FakeEventSource {
      static OPEN = 1;
      constructor(url) {
        constructed += 1;
        this.url = url;
        this.readyState = FakeEventSource.OPEN;
        this.addEventListener = (type, cb) => { listeners[type] = cb; };
        this.close = vi.fn();
      }
    }
    global.EventSource = FakeEventSource;

    const model = createHttpModel();
    model.subscribe({}, vi.fn());

    // (1) Transport is EventSource — exactly one stream opened, no polling timers spun up.
    expect(constructed).toBe(1);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    // (2)+(3) Both lifecycle handlers wired so the browser's reconnect (error→…→open) is observable.
    expect(typeof listeners.open).toBe('function');
    expect(typeof listeners.error).toBe('function');
  });

  it('error 는 연결-끊김, open 은 (재)연결을 상태로 전파한다 (재연결 가시성의 토대)', () => {
    const listeners = {};
    class FakeEventSource {
      static OPEN = 1;
      constructor() {
        this.readyState = FakeEventSource.OPEN;
        this.addEventListener = (type, cb) => { listeners[type] = cb; };
        this.close = vi.fn();
      }
    }
    global.EventSource = FakeEventSource;

    const model = createHttpModel();
    const onChange = vi.fn();
    model.subscribe({}, onChange);

    // Simulate the browser's transport lifecycle: drop, then auto-reconnect re-fires open.
    listeners.error();
    expect(onChange).toHaveBeenLastCalledWith({ connected: false });
    listeners.open(); // EventSource auto-reconnects and re-opens — our wiring restores the status.
    expect(onChange).toHaveBeenLastCalledWith({ connected: true });
  });

  it('EventSource 가 없는 환경에서는 안전한 no-op 구독으로 떨어진다 (크래시 없음)', () => {
    global.EventSource = undefined;
    const model = createHttpModel();
    const sub = model.subscribe({}, vi.fn());

    expect(sub.connected).toBe(false);
    expect(() => sub.unsubscribe()).not.toThrow();
  });

  it('구독은 EventSource 스트림 URL(/api/stream)을 사용한다 (폴링 엔드포인트 아님)', () => {
    const opened = [];
    class FakeEventSource {
      static OPEN = 1;
      constructor(url) {
        opened.push(url);
        this.readyState = FakeEventSource.OPEN;
        this.addEventListener = () => {};
        this.close = vi.fn();
      }
    }
    global.EventSource = FakeEventSource;

    const model = createHttpModel();
    model.subscribe({}, vi.fn());
    expect(opened.at(-1)).toBe(`${BASE}/api/stream`);
  });
});
