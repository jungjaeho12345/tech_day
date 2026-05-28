# MCP 서버 연결 복구 (Windows spawn 경로 수정)

## Context

`/mcp`에서 `slack`, `context7`, `sequential-thinking`, (이전) `slack-notifier`가 모두 `-32000 Connection closed`로 실패한다. 표준 slack 서버 도구(`mcp__slack__*`)는 이 머신에서 한 번도 노출된 적이 없어, 사실상 이 MCP 서버들은 Claude Code에서 **연결된 적이 없다**(이전 "verified working"은 git bash 수동 실행 검증이었음).

### 확정된 근본 원인 (MCP 로그 stderr 디코딩)

Claude Code CLI(Windows)는 MCP `command`를 **Windows 방식(cmd.exe)으로 spawn**한다. git bash가 아니다.

| 서버 | `command` | stderr (디코딩) | 의미 |
|------|-----------|----------------|------|
| slack / context7 / sequential-thinking | `/bin/bash` | `지정된 경로를 찾을 수 없습니다` | Windows에 `/bin/bash`라는 경로가 없음 |
| slack-notifier | `node` | `'node'은(는) ... 아닙니다` | cmd.exe PATH에 node 없음 |

→ `.bash_profile` PATH 수정은 **git bash 수동 실행만** 고쳤고, Claude Code의 Windows spawn 환경에는 node/npx가 없다.

### 검증된 해결책

`command`를 POSIX `/bin/bash` 대신 **git bash 실행 파일의 Windows 절대경로** `C:\Program Files\Git\bin\bash.exe`로 바꾼다. `-l`(login) 옵션이 `~/.bash_profile`을 source하여 node/npx PATH를 복구하므로 npx가 정상 resolve된다.

검증 완료:
- `"C:\Program Files\Git\bin\bash.exe" -lc 'command -v npx'` → `/c/Program Files/nodejs/npx`, node v24.16.0 ✅
- `C:\Program Files\Git\bin\bash.exe` 존재 확인 ✅

## 변경 대상: `D:\agents\tech_day\.mcp.json`

bash 기반 3개 서버의 `command`만 교체 (args는 그대로 유지):

```jsonc
// context7, sequential-thinking, slack 각 블록
"command": "C:\\Program Files\\Git\\bin\\bash.exe",   // 기존: "/bin/bash"
"args": [ ...기존과 동일... ]
```

- `slack`의 `env` 블록(`${SLACK_BOT_TOKEN}` / `${SLACK_TEAM_ID}`)은 그대로 둔다. 두 변수는 CLI 프로세스 환경에 이미 존재(`SLACK_TEAM_ID=T0B684ZGM9B` 확인)하므로 Claude Code가 치환한다.
- `moai-lsp`(`command: "moai"`)는 보고된 실패 대상이 아니므로 변경하지 않는다.
- `slack-notifier`는 이전 작업에서 이미 제거됨 — 조치 없음.

## 검증 (실행 후)

1. **Claude Code 세션 재시작** — 현재 세션은 옛 설정을 캐싱 중(`slack-notifier`가 제거 후에도 `-32000`으로 잔존하는 것이 증거). `.mcp.json` `command` 변경은 재시작해야 반영된다.
2. 재시작 후 `/mcp` → `context7`, `sequential-thinking`, `slack`이 connected 상태인지 확인.
3. `slack` 연결 시 `mcp__slack__*` 도구가 노출되는지 확인 → tech-day(`C0B69CG59UM`) 전달 규칙 충족.
4. 만약 `slack`만 토큰 문제로 실패하면(다른 둘은 성공) → fallback: `~/.bash_profile`에 `export SLACK_BOT_TOKEN=...` / `export SLACK_TEAM_ID=T0B684ZGM9B` 추가 후 재시작. (현재는 불필요 예상)

## 메모리 갱신

- `mcp-node-path-fix.md` 업데이트: 진짜 원인은 PATH뿐 아니라 **Claude Code가 `/bin/bash`(POSIX 경로)를 Windows에서 spawn 불가**한 것. 해결은 `command`를 `C:\Program Files\Git\bin\bash.exe` 절대경로로 지정.
