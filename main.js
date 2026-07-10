// soksak-plugin-agent-codex — adds the Codex CLI to the new-tab (+) menu (Agents).
//
// The program contribution (plugin.json) declares everything the menu needs: the
// terminal view it opens, the launch command, and the ensure block (which binary it
// needs + the per-platform install command). Core runs ensure at activation and
// launches the view when the menu item is picked — that view is the human surface.
//
// C2 transparency (command axis): the program's provisioning is otherwise headless-
// invisible — core resolves ensure only at activation, so an agent cannot observe or
// drive it. These commands expose that surface:
//   status  — probe whether the CLI resolves on PATH now, and report what the program
//             would launch and install (the observation surface).
//   install — run the declared platform installer to completion (the same command the
//             consent screen discloses), provisioning the CLI without opening a view.
// Opening the view headlessly is already core (view.open program=codex) — not repeated.
//
// The bin, launch command, and installers are read from ctx.manifest.contributes — the
// manifest is the single source of truth (no second copy in code). Official install
// source (2026-06): https://developers.openai.com/codex/cli

// Which platform installer to run — mirrors the core program registry's detection
// (navigator only; no core import — a three-line rule, not coupling).
function detectPlatform() {
  const s = `${(typeof navigator !== "undefined" && navigator.platform) || ""} ${
    (typeof navigator !== "undefined" && navigator.userAgent) || ""
  }`.toLowerCase();
  if (s.includes("mac")) return "darwin";
  if (s.includes("win")) return "win32";
  return "linux";
}

// Keep only shell-safe bin tokens before interpolating into a probe command.
const BIN_RE = /^[A-Za-z0-9._+-]+$/;

// Tail a stream so the response envelope stays bounded (installers are chatty).
const tail = (s, n) => (s.length > n ? s.slice(s.length - n) : s);

export default {
  activate(ctx) {
    const app = ctx.app;
    const manifest = ctx.manifest || {};

    // message / validation errors are the human surface — resolve by locale
    // ({en,ko}, docs/I18N.md). Non-ko locales fall back to en; a host without
    // locale() falls back to ko.
    const msg = (en, ko) =>
      (typeof app.locale === "function" ? app.locale() : "ko") === "ko" ? ko : en;

    // Program facts = single source of truth from the manifest. This plugin
    // contributes exactly one program (codex).
    const prog = (manifest.contributes && manifest.contributes.programs) ?
      manifest.contributes.programs[0] : null;
    const programId = prog?.id || "codex";
    const bin = prog?.ensure?.bin || prog?.command || programId;
    const launch = prog?.command || bin;
    const installMap = prog?.ensure?.install || {};

    // Probe whether the bin resolves on PATH. Uses the process capability with a
    // login shell (-lc) so a Finder-launched bundle sees the user's real PATH —
    // the same reason ACP/core wrap spawns in a login shell. One short-lived
    // process per call (on-demand observation, bounded by timeout — not polling).
    const isWin = detectPlatform() === "win32";
    async function probeInstalled(timeoutMs) {
      const proc = app.process;
      if (!proc) return { installed: null, path: null };
      if (!BIN_RE.test(bin)) return { installed: null, path: null };
      const dec = new TextDecoder();
      let out = "";
      let handle;
      try {
        handle = isWin
          ? await proc.spawn("cmd", ["/d", "/s", "/c", `where ${bin}`], {})
          : await proc.spawn("/bin/sh", ["-lc", `command -v ${bin} 2>/dev/null`], {});
      } catch {
        return { installed: null, path: null };
      }
      proc.onData(handle, (b) => {
        out += dec.decode(b, { stream: true });
      });
      const code = await new Promise((resolve) => {
        let settled = false;
        const done = (c) => {
          if (settled) return;
          settled = true;
          resolve(c);
        };
        proc.onExit(handle, (c) => done(c));
        setTimeout(() => {
          void proc.kill(handle);
          done(null);
        }, timeoutMs || 5000);
      });
      const path = out.trim().split(/\r?\n/)[0]?.trim() || "";
      return { installed: code === 0 && path !== "", path: path || null };
    }

    const reg = (name, spec) =>
      ctx.subscriptions.push(app.commands.register(name, spec));

    reg("status", {
      description:
        "Report the codex agent program surface: the CLI binary it launches, whether that binary resolves on PATH right now (probed via a login shell), the launch command, and the install command for this platform. Use to decide whether to install before opening the codex view.",
      triggers: { ko: "코덱스 에이전트 설치 여부 상태 확인 조회 있는지" },
      params: {},
      returns:
        "{ program, bin, installed: bool|null, binPath, launch, platform, install: { available, command } }",
      examples: ["sok plugin.soksak-plugin-agent-codex.status"],
      message: (d) =>
        d.installed
          ? msg(`codex is installed — ${d.binPath}`, `codex 설치됨 — ${d.binPath}`)
          : d.installed === null
            ? msg("codex install state unknown — no process capability", "codex 설치 상태 불명 — process 권한 없음")
            : msg("codex is not installed on PATH", "codex 가 PATH 에 설치돼 있지 않습니다"),
      hint: (d) => {
        const out = [];
        if (d.installed === false && d.install && d.install.available)
          out.push({
            cmd: "sok plugin.soksak-plugin-agent-codex.install",
            why: msg("install codex now", "지금 codex 설치"),
          });
        out.push({
          cmd: `sok view.open '{"program":"${d.program}"}'`,
          why: msg("open codex in a view", "codex 를 뷰로 열기"),
        });
        return out;
      },
      handler: async () => {
        const platform = detectPlatform();
        const command = installMap[platform] || null;
        const probe = await probeInstalled(5000);
        return {
          program: programId,
          bin,
          installed: probe.installed,
          binPath: probe.path,
          launch,
          platform,
          install: { available: !!command, command },
        };
      },
    });

    reg("install", {
      description:
        "Run the official codex installer for this platform (the command declared in the program's ensure block) and wait for it to finish. Provisions the CLI headlessly without opening a terminal view. Safe to re-run — the official installer updates in place.",
      triggers: { ko: "코덱스 에이전트 설치 실행 지금 내려받기" },
      params: {
        timeoutMs: {
          type: "number",
          description: "Maximum wait in ms before the installer is killed (default 300000)",
        },
      },
      returns:
        "{ ran, platform, command, exitCode: number|null, timedOut, installed, binPath, stdout, stderr }",
      examples: ["sok plugin.soksak-plugin-agent-codex.install"],
      message: (d) =>
        d.installed
          ? msg(
              `Installed codex (exit ${d.exitCode}) — ${d.binPath}`,
              `codex 설치 완료 (종료 ${d.exitCode}) — ${d.binPath}`,
            )
          : d.timedOut
            ? msg("codex installer timed out", "codex 설치가 시간 초과됐습니다")
            : msg(
                `codex installer finished (exit ${d.exitCode}) but the binary is not on PATH`,
                `codex 설치가 끝났지만 (종료 ${d.exitCode}) 바이너리가 PATH 에 없습니다`,
              ),
      hint: (d) =>
        d.installed
          ? [
              {
                cmd: `sok view.open '{"program":"${programId}"}'`,
                why: msg("open codex in a view", "codex 를 뷰로 열기"),
              },
            ]
          : [],
      handler: async (p) => {
        const proc = app.process;
        if (!proc)
          return {
            ok: false,
            code: "NO_CAPABILITY",
            message: msg(
              'no process capability — re-consent to "process"',
              'process 권한 없음 — "process" 재동의 필요',
            ),
          };
        const platform = detectPlatform();
        const command = installMap[platform] || null;
        if (!command)
          return {
            ok: false,
            code: "UNSUPPORTED_PLATFORM",
            message: msg(
              `no codex installer declared for ${platform}`,
              `${platform} 용 codex 설치 명령이 선언돼 있지 않습니다`,
            ),
          };
        const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 300000;
        const dec = new TextDecoder();
        let out = "";
        let err = "";
        let handle;
        try {
          handle = isWin
            ? await proc.spawn("powershell", ["-NoProfile", "-Command", command], {})
            : await proc.spawn("/bin/sh", ["-lc", command], {});
        } catch (e) {
          return {
            ok: false,
            code: "SPAWN_FAILED",
            message: msg(`installer spawn failed: ${String(e)}`, `설치 실행 실패: ${String(e)}`),
          };
        }
        proc.onData(handle, (b) => {
          out += dec.decode(b, { stream: true });
        });
        proc.onStderr(handle, (b) => {
          err += dec.decode(b, { stream: true });
        });
        let timedOut = false;
        const exitCode = await new Promise((resolve) => {
          let settled = false;
          const done = (c) => {
            if (settled) return;
            settled = true;
            resolve(c);
          };
          proc.onExit(handle, (c) => done(c));
          setTimeout(() => {
            timedOut = true;
            void proc.kill(handle);
            done(null);
          }, timeoutMs);
        });
        const probe = await probeInstalled(5000);
        return {
          ran: true,
          platform,
          command,
          exitCode,
          timedOut,
          installed: probe.installed === true,
          binPath: probe.path,
          stdout: tail(out, 2000),
          stderr: tail(err, 2000),
        };
      },
    });
  },

  deactivate() {
    // Subscriptions (registered commands) are released by ctx.subscriptions /
    // the host tracker on deactivation — no extra cleanup.
  },
};
