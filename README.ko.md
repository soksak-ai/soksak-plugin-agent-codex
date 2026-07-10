# soksak-plugin-agent-codex

새 탭(+) 메뉴의 **에이전트** 카테고리에 **Codex CLI** 를 추가하는 soksak
플러그인.

## 동작

**활성화(동의) 시점**에 `codex` 설치 여부를 사용자 셸 PATH 기준으로
확인하고, 미설치면 공식 설치 명령이 새 터미널 탭에서 그대로 실행된다(동의
화면에 고지된 그 명령). 메뉴에서 항목을 선택하면 터미널 뷰가 열리고
`codex` 가 깨끗하게 실행된다.

## 공식 설치 명령(멀티플랫폼)

| 플랫폼 | 명령 |
|---|---|
| macOS / Linux / WSL | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` |
| Windows (PowerShell) | `irm https://chatgpt.com/codex/install.ps1 \| iex` |

출처: [Codex CLI 공식 문서](https://developers.openai.com/codex/cli)

## 명령

프로그램의 설치 처리를 헤드리스로도 노출한다 — 뷰를 열지 않고 에이전트가 관찰하고
실행할 수 있다.

| 명령 | 동작 |
|---|---|
| `status` | `codex` 가 지금 PATH 에 있는지(로그인 셸로 조회), 실행 명령, 이 플랫폼의 설치 명령을 보고한다. |
| `install` | 이 플랫폼의 공식 설치 명령(프로그램 ensure 선언)을 끝까지 실행한 뒤 PATH 를 다시 확인한다. |

```bash
sok plugin.soksak-plugin-agent-codex.status
sok plugin.soksak-plugin-agent-codex.install
```

뷰 열기는 사람 확인 표면으로 남으며, 코어 명령으로 연다.

```bash
sok view.open '{"program":"codex"}'
sok program.list
```

## 권한

- `programs` — + 메뉴 프로그램 등록(선택 시 터미널 명령 자동 실행 포함)
- `commands` — `status`·`install` 명령 등록
- `process` — PATH 바이너리 조회·설치 명령 실행
