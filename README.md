<p align="center">
  <img src="assets/Logo_2.png" alt="Hermes Desktop" width="120">
</p>

<h1 align="center">Hermes Desktop</h1>

<p align="center">
  <em>A native desktop UI for the Hermes Agent — the self-improving AI agent from Nous Research.</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#install">Install</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#development">Development</a> •
  <a href="#credits">Credits</a>
</p>

---

Stop juggling terminals. Talk to your AI, see what it's doing, browse files, run commands, and hear it speak back — all in one native window. Same agent, same skills, same memory as the CLI — just a lot prettier.

---

## Features

| | |
|---|---|
| **Full agent chat** | Streaming responses, live tool activity, structured summaries, full conversation history. |
| **Side-by-side previews** | Render web pages, files, and tool outputs in a right-hand pane while you keep chatting. |
| **File browser** | Explore and preview the working directory without leaving the app. |
| **Terminal** | Built-in xterm terminal for direct shell access. |
| **Voice** | Talk to Hermes and hear it speak back (mic + TTS). |
| **Settings UI** | Manage providers, models, tools, API keys, and credentials from a real interface. |
| **Onboarding** | First-run setup walks you through picking a provider and model in seconds. |
| **Messaging gateway** | Start Telegram, Discord, Slack, WhatsApp, and Signal from the desktop UI. |
| **Cron jobs** | Schedule recurring tasks with delivery to any platform. |
| **Auto-update** | Built-in updates pull the latest agent and rebuild in place. |
| **Cross-platform** | macOS, Windows, and Linux. |

---

## Prerequisites

You only need the **Hermes CLI installed**:

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

The desktop app uses the same config, API keys, sessions, and skills — nothing extra to configure.

---

## Install

### Option 1 — One-line install (Agent + Desktop)

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --include-desktop
```

### Option 2 — Already have Hermes CLI?

```bash
hermes desktop
```

The first time you run it, the app builds itself (Electron + React) and launches. Pick a provider and model on first launch; everything else is already set up.

### Option 3 — Prebuilt installers

Available on the [releases page](https://github.com/NousResearch/hermes-agent/releases) — `.dmg` (macOS), `.exe` / `.msi` (Windows), `.AppImage` / `.deb` / `.rpm` (Linux).

---

## Quick Start

1. **Install** the Hermes CLI (see above).
2. **Run** `hermes desktop`.
3. **Pick** a provider (e.g. OpenRouter) and a model.
4. **Start chatting** — type a message and watch the agent work.

Slash commands like `/model`, `/compress`, `/skills`, and `/personality` all work in the desktop UI too.

---

## Development

```bash
git clone https://github.com/ilan4ever/hermes-desktop.git
cd hermes-desktop
npm install
npm run dev
```

This starts Vite (hot-reload renderer) + Electron, which boots the Python backend.

### Useful flags

```bash
HERMES_DESKTOP_HERMES_ROOT=/path/to/hermes-agent npm run dev   # Point at a specific agent checkout
HERMES_HOME=/tmp/throwaway npm run dev                          # Sandbox config away from your real one
npm run dev:fake-boot                                            # Exercise the startup overlay
```

### Building installers

```bash
npm run dist:mac       # DMG + zip
npm run dist:win       # NSIS + MSI
npm run dist:linux     # AppImage + deb + rpm
npm run pack           # Unpacked app (no installer)
```

### Verify before a PR

```bash
npm run fix && npm run type-check && npm run lint && npm run test:desktop:all
```

---

## Troubleshooting

Boot logs are at `HERMES_HOME/logs/desktop.log` — check there first if the app fails to start.

**macOS / Linux:**

```bash
rm "$HOME/.hermes/hermes-agent/.hermes-bootstrap-complete"     # Force clean re-setup
rm -rf "$HOME/.hermes/hermes-agent/venv"                        # Rebuild Python venv
tccutil reset Microphone com.nousresearch.hermes                 # Reset mic permission
```

**Windows (PowerShell):**

```powershell
Remove-Item "$env:LOCALAPPDATA\hermes\hermes-agent\.hermes-bootstrap-complete"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\hermes\hermes-agent\venv"
```

---

## How It Works

The packaged app ships only the Electron shell. On first launch it installs the Hermes Agent runtime into `HERMES_HOME` (`~/.hermes`, or `%LOCALAPPDATA%\hermes` on Windows) — the same layout a CLI install uses. The React renderer talks to the Hermes Python backend over the standard gateway APIs and reuses the embedded TUI.

---

## Credits

Built and maintained by **ILAN AVIV**. This desktop app is a native UI wrapper around the [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com).

For inquiries, feedback, or collaboration: [onevoiceai.in/contact](https://onevoiceai.in/contact/)

---

## License

MIT — see [LICENSE](LICENSE).
