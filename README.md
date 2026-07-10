# soksak-plugin-agent-codex

A soksak plugin that adds **Codex CLI** to the **Agents** category in the new-tab (+) menu.

## Behavior

At **activation (consent) time**, the plugin checks whether `codex` is installed via the
user's shell PATH. If it is not installed, the official install command is run directly in a
new terminal tab (the same command disclosed on the consent screen). Selecting the menu item
opens a terminal view and launches `codex` cleanly.

## Official Install Commands (Multi-platform)

| Platform | Command |
|---|---|
| macOS / Linux / WSL | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` |
| Windows (PowerShell) | `irm https://chatgpt.com/codex/install.ps1 \| iex` |

Source: [Codex CLI official docs](https://developers.openai.com/codex/cli)

## Commands

The program's provisioning is also exposed headlessly, so an agent can observe and drive
it without opening the view:

| Command | What it does |
|---|---|
| `status` | Reports whether `codex` resolves on PATH now (probed via a login shell), the launch command, and this platform's install command. |
| `install` | Runs the official platform installer (the command declared in the program's ensure block) to completion, then re-checks PATH. |

```bash
sok plugin.soksak-plugin-agent-codex.status
sok plugin.soksak-plugin-agent-codex.install
```

Opening the view stays the human surface, reachable by the core command:

```bash
sok view.open '{"program":"codex"}'
sok program.list
```

## Permissions

- `programs` — registers the program in the + menu (including automatic terminal command execution on selection)
- `commands` — registers the `status` and `install` commands
- `process` — probes the binary on PATH and runs the installer
