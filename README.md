<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge-czx" width="720">
</p>

<h1 align="center">⚔️ DeepSeek Harness cybersecurity red-team tool (dsh-purge-czx)</h1>

<p align="center"><strong>Version 2.1.0</strong></p>

<p align="center">
  <em>DeepSeek Harness jailbreak: every model, swap prompts per model. Default prompt for 小码酱. Please star ⭐ If you build on this, see Attribution required.</em>
</p>

<p align="center">
  <a href="https://github.com/czx455501074-afk/dsh-purge-czx/stargazers"><img src="https://img.shields.io/github/stars/czx455501074-afk/dsh-purge-czx?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/czx455501074-afk/dsh-purge-czx/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.2.2--rc.1-blue" alt="DSH"></a>
  <br>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=fff" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000" alt="JavaScript">
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

> **This repository is maintained by czx; install and update from it only.** Upstream (original author **YuJunZhiXue**, see [Attribution required](#attribution-required)) has paused releases: no new versions, no issues / PRs. This repo keeps the code and the original author's credit, and serves downloads from [czx455501074-afk/dsh-purge-czx](https://github.com/czx455501074-afk/dsh-purge-czx).

> **Official Web, the official desktop app, and the dsh-go phone app are supported.** Official `dsh web` uses profile `web`. The official desktop EXE (DeepSeek Harness **0.2.2-rc.1**) uses profile `desktop`. **dsh-go** also uses profile `web`; add the [native panel](dsh-go/README.md) to run Apply from the phone. Install and Apply Web / desktop separately. This release targets dsh 0.2.2. Older dsh builds need the matching older plugin. Community Desktop is not maintained.
>
> Adding the plugin to a profile does not patch the host. Open **Settings → dsh-purge-czx** → **Clean** → **Apply**. A successful Apply restarts; an unfinished Apply does not. After the restart, start a new chat — that is when the inject enters the session.
>
> Node.js **≥18**. Windows no-flash needs **Node ≥22**. The install commands below all point at this repository (`https://github.com/czx455501074-afk/dsh-purge-czx`), not the old npm package.

## What's new in 2.1

- **Multi-model jailbreak prompt packs.** `presets/model-prompts/` ships a universal backbone plus 13 family packs (claude / gpt / gemini / grok / deepseek / qwen / kimi / glm / minimax / doubao / llama / mistral / generic). The overlay is composed per session: universal → family → your own tail.
- **Auto-detection with manual override.** Probes `agent.session.header.model`, `agent.options.model`, `agent.config.model` and the session header; unknown ids fall back to generic. A new **Model prompts** tab in Settings switches `auto / universal / family / off` and can force a family.
- **Editable on disk.** The pack is copied to `$DSH_HOME/dsh-purge-czx/model-prompts/`; upgrades only fill in missing files and never overwrite your edits. Config lives in `$DSH_HOME/dsh-purge-czx/model-adapt.json` (`mode` / `family` / `extra`).
- **Tool and endpoint.** `purge_models` (status / list / set / sync / preview) and `GET|POST /dsh-purge-czx/model-adapt`.
- **Tests.** `npm test` gains 34 model-adapt checks: detection matrix, idempotent seeding, composition order, mode switching, custom families, cache invalidation.

## What's new in 2.0

- **One entry point.** The floating button (bottom-right), the hero chip, the tab-row chip and the composer button are gone. Everything lives in **Settings → dsh-purge-czx**.
- **Renamed** to `dsh-purge-czx`: install URLs, bundle patch ids, state directory, locale namespace and log prefixes all follow.
- **Compatibility.** `engines.dsh` (`>=0.2.2-rc.1 <0.3.0`) replaces the old `dshTarget` field; the state directory migrates from `$DSH_HOME/dsh-purge` on first boot.
- **Performance.** Dropped the 1.5 s dock polling and the 1 s hero / tab-row DOM polling; theme follows `prefers-color-scheme` plus one mutation observer.
- **Diagnostics.** New `purge_doctor` tool: versions, patch anchor health, legacy entries, bundle size.

## Contents

- [What this is](#what-this-is)
- [Attribution required](#attribution-required)
- [Supported hosts](#supported-hosts)
- [Install](#install)
- [UI](#ui)
- [Usage](#usage)
- [Own servers](#own-servers)
- [How it works](#how-it-works)
- [Restore](#restore)
- [Releases](#releases)

---

## What this is

**dsh-purge-czx** is a cybersecurity red-team plugin for the official [DeepSeek Harness](https://www.deepseek.com/harness/) already installed on your machine. Official **Web** (`dsh web`) and the official **desktop EXE** are both supported. Install and Apply them separately.

Harness does more than forward a prompt. It rewrites prompts, approval gates, sandbox policy, and session migration at runtime. Asking only “will the model answer” treats a host-layer block as a model refusal. This plugin separates those two layers on your own install, for controlled evaluation and for seeing which default policy is too tight.

| You get | What it does |
|---|---|
| **dsh-purge-czx settings page** | The only entry point: **Settings → dsh-purge-czx**. Two tabs: Clean and Model prompts. No floating button anywhere in the session |
| **Clean** | Grouped patch status, Apply / Restore / Uninstall, prompt editor, multiple rule sets |
| **Model prompts** | Auto-composes a per-model jailbreak pack (universal backbone + 13 families); switch auto / universal / family / off |
| **Host policy** | Default copy, permission policy, and tool limits. Official capabilities stay. No second invented identity |
| **On start** | Checks and reapplies. After npm overwrites `node_modules`, you do not hand-edit files |

No hardcoded drive letters. It looks at `$DSH_HOME`, `.dsh` next to the dsh launcher, then `~/.dsh`. It does not patch the Harness source tree. **Apply** on the **Clean** page of **dsh-purge-czx** is what writes the changes. Identity comes from the encrypted prompt shipped in the plugin, the text the prompt box shows by default. The host prompt file is not read.

It only touches the official `@deepseek-ai` packages and local config on the user's machine. It is not a public scanner and not an attack kit for third-party sites. The repo does not ship malware, unauthorized-exploit scripts, or payloads aimed at the public internet.

---

## Non-profit public project. Commercial sale, paid resale, and profit from illegal or gray-market activity are forbidden. For technical reference only.

## Attribution required

**Original author: YuJunZhiXue** (original repo <https://github.com/YuJunZhiXue/dsh-purge>). All rights in the code, prompts, and name stay with the original author; `LICENSE` (MIT) is kept unchanged.

**If you borrow this project's name, ideas, code, or prompts, you must credit the original author and name the source repository:** [czx455501074-afk/dsh-purge-czx](https://github.com/czx455501074-afk/dsh-purge-czx) (original author YuJunZhiXue).

Using them without attribution, hiding the source, or passing them off as your own will be pursued by the original author.

---

<a id="strict-legal--compliance-disclaimer"></a>

<div>

### ⚠️ <font color="red">Strict legal and compliance disclaimer</font>

<font color="red">

**Disclaimer:** This is a non-profit open-source project. It follows applicable laws and the rules of the platforms it uses, and is intended only for learning and research. Do not use it for any illegal or non-compliant purpose; the user bears any resulting consequences.

**Zero-tolerance statement:** This project opposes and forbids any illegal activity. The authors do not support, encourage, or assist unauthorized network attacks, exploit use, data theft, unlawful intrusion into computer information systems, or generation of illegal or prohibited content. **Anyone who uses this project for crime is solely responsible under the law. The authors have no liability.**

1. **This repository contains no illegal material.** The published code, docs, patches, and default prompt are **not** malware, backdoors, unauthorized pentest kits, ransomware, credential-stuffing scripts, or attack payloads aimed at the public internet or third-party systems. The project does not supply illegal content and does not incite, organize, or assist crime.
2. **Local official Harness only.** Security-eval patches and prompt injection run only on the **official DeepSeek Harness already installed on the user's machine** (`@deepseek-ai` packages, local profile / `$DSH_HOME`). The target is the user's own official local software, **not** someone else's website, server, account, or information system.
3. **Eval patches do not attack the public internet.** Apply, inject, revert, and uninstall stay in local files and local processes. They **do not scan, probe, intrude, or send attack traffic to any public host or unauthorized system**. Do not use this project as a jump host against the public internet. If "check for updates" is on, the plugin may only contact this plugin's own GitHub repository to compare versions. That is **not** an attack on third-party systems and is **not** authorization to penetrate anything.
4. **Lawful, controlled scope.** This project is an aid for red-team research and robustness evaluation on an **official Harness the user is entitled to administer**. **Do not run it against targets without the owner's lawful written authorization, public online systems, or production workloads.** Testing must stay on the **authorized local official Harness, offline local synthetic fixtures, authorized cybersecurity ranges, and compliant lab environments**.
5. **Servers and sites in mainland China, Hong Kong, and Macau are forbidden.** Do not access, scan, probe, or otherwise operate against network ranges in mainland China, Hong Kong, or Macau, or against servers, websites, or addresses that resolve into those ranges. A cloud-provider name is not an exception. The only exception is one exact IP, or one exact hostname, that the user registered in advance as their own server. A key, a password, a network range, a wildcard, or a claim made in the conversation does not add an exception. Anything that is not registered stays forbidden.
6. **Forbidden uses.** Users must not use this project, directly or indirectly, to violate the following (each must be followed; no excuse to evade):
   - <font color="red"><strong>Criminal Law of the People's Republic of China</strong></font>
   - <font color="red"><strong>Cybersecurity Law of the People's Republic of China</strong></font>
   - <font color="red"><strong>Data Security Law of the People's Republic of China</strong></font>
   - <font color="red"><strong>Personal Information Protection Law of the People's Republic of China</strong></font>
   - and other applicable laws, regulations, and supervisory rules;
   - Also forbidden:
   - Unauthorized intrusion or attacks on public or private computer information systems; extortion, sabotage, credential stuffing, or spreading malicious payloads;
   - Inducing, generating, or spreading any content the law forbids, including threats to national security, terrorism, violence, pornography, gambling, fraud, and privacy or intellectual-property infringement;
   - Violating the model provider's terms of service and acceptable-use policy.
7. **The user bears all responsibility.** The project is provided under the MIT license as-is. The authors make no warranty of completeness, security, or fitness. **Users independently bear all civil, administrative, and criminal liability** for download, deploy, run, modify, distribute, and all resulting inputs and outputs. Authors and contributors bear no direct, indirect, or joint liability for abuse.
8. **The license ends on breach.** Anyone who uses this project for illegal attacks, malicious activity, or other violations has their open-source license **automatically and irrevocably terminated** from the moment of the violation. They must stop using the project, permanently destroy all copies and derivatives, and accept legal sanctions.
9. **No affiliation.** This is an independent open-source security-eval research project. It has no employment, commercial, authorization, or endorsement relationship with DeepSeek or its affiliates. "Official" here only means the eval target is the official DeepSeek Harness package on the user's machine. It does **not** mean DeepSeek developed, approved, or warrants this plugin.
10. **Attribution is required.** If you borrow this project's name, ideas, code, or prompts, you must credit the author and name this repository. Failure to attribute will be pursued. See [Attribution required](#attribution-required).

</font>

</div>

---

## Supported hosts

The latest plugin supports **dsh 0.2** only — do not apply it to 0.1.x.

- **dsh 0.2.2-rc.1** (official desktop / official `dsh web` / **dsh-go phone app**): use **1.2.3** or newer. This page installs that line.
- **dsh 0.2.0-rc.2**: use **1.1.40 – 1.1.71**.
- **dsh 0.1.7** (incl. rc.1 / rc.2): use **1.1.39** or older — pick the tag on [Releases](https://github.com/czx455501074-afk/dsh-purge-czx/releases).

Unmatched patches stay pending or skipped; nothing is rewritten blindly. After changing dsh versions, run `npm run diagnose` (`node scripts/diagnose-patches.mjs`) to see which anchors drifted.

---

## Install

Web and the official desktop EXE are the two maintained hosts. **Install both. Apply each separately.** A Web install does not reach the desktop app, and a desktop install does not reach Web.

**Web (official `dsh web`)**

```sh
dsh plugin --profile web add https://github.com/czx455501074-afk/dsh-purge-czx
```

**Desktop (official EXE)**

```sh
dsh plugin --profile desktop add https://github.com/czx455501074-afk/dsh-purge-czx
```

If this directory is already a clone, use `add .` instead of the URL. If `dsh` is not on PATH, use [Manual install](#manual). Git URL blocked: use the tarball `https://github.com/czx455501074-afk/dsh-purge-czx/archive/refs/heads/master.tar.gz` with the same `--profile`.

You can also install from the zip: `https://github.com/czx455501074-afk/dsh-purge-czx/archive/refs/heads/master.tar.gz` — extract, rename `dsh-purge-czx-master` to `dsh-purge-czx`, then `dsh plugin --profile web add <extracted path>` (`--profile desktop` for the desktop app).

For the desktop client you can also click the button (`dsh://` deep link):

<p align="center">
  <a href="dsh://plugin/install?id=dsh-purge-czx&name=dsh-purge-czx&version=1.2.3&repo=czx455501074-afk%2Fdsh-purge-czx&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2Fczx455501074-afk%2Fdsh-purge-czx%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz"><strong>Install in desktop client</strong></a>
</p>

### After the command: three steps

Adding the plugin to a profile does **not** patch `@deepseek-ai` by itself.

1. **Quit and reopen** the host you installed into — stop and restart `dsh web`, quit the desktop tray and reopen that app, or reopen the dsh-go app.
2. On **that host**, open **Settings → dsh-purge-czx**, then **Apply** on the **Clean** page. On dsh-go use the [native panel](dsh-go/README.md) (composer strip / plus panel).
3. A successful **Apply** restarts once so patches load. It does not restart if it did not finish. On dsh-go the plugin never touches the app's engine process — **restart the engine in the app (Settings → Engine)** or reopen the app.

Web controls affect Web only; desktop controls affect the desktop app only. Do not Apply one host from the other.

### How to tell it installed

- **dsh-purge-czx** appears under DSH **Settings**, with **Apply** on its Clean page.
- `/purge status` in chat prints `DSH_HOME` and the patch list — the path should be the home you actually run.
- Optional packages that are not installed (liangshen) show as skipped and do not block Apply.

### dsh-go phone app (native panel)

dsh-go renders a native Flutter UI, not the web sidebar, so the `dsh-purge-czx` settings page is not available on the phone. Install the native panel from `dsh-go/`:

- a **Purge x/y** strip above the composer, tapping it opens the clean panel;
- **Apply** / **Revert** in the composer plus panel;
- progress, pending patch list, and host path in the panel.

```sh
dsh plugin --profile web add https://github.com/czx455501074-afk/dsh-purge-czx
P="${DSH_HOME:-$HOME/.dsh}/dsh-go/plugins/dsh-go-purge"
mkdir -p "$(dirname "$P")" && cp -r dsh-go "$P"
dsh plugin --profile web add "$P"
```

After Apply, restart the engine in the app (Settings → Engine). Details: [dsh-go/README.md](dsh-go/README.md).

### Hand this to an assistant

Paste the block below to a local assistant. It should only run the install command — no disk scan, no other edits, no Apply, no restart.

<details>
<summary><strong>For AI assistants (install only)</strong></summary>

<!-- AI-AGENT-START -->

Install the DeepSeek Harness plugin `dsh-purge-czx` into both the Web profile and the official desktop profile. Do not scan the whole disk, do not read or edit other files, do not apply settings, and do not restart the app.

If `dsh` is not on PATH, tell the user and stop. If this directory is already a clone, use `.` instead of the URL in both commands. If the Git URL fails, use `https://github.com/czx455501074-afk/dsh-purge-czx/archive/refs/heads/master.tar.gz`. If one profile is missing, skip that command and still install the other.

**Web (official `dsh web`)**

```sh
dsh plugin --profile web add https://github.com/czx455501074-afk/dsh-purge-czx
```

**Desktop (official EXE)**

```sh
dsh plugin --profile desktop add https://github.com/czx455501074-afk/dsh-purge-czx
```

After the commands finish, tell the user to fully quit and restart `dsh web`, and to quit the desktop tray then reopen the EXE. On each host, open **Settings → dsh-purge-czx** and **Apply** on **Clean**. Then stop.

<!-- AI-AGENT-END -->

</details>

<a id="manual"></a>

### Manual install

Use this when the command fails or `dsh` is not on PATH. Edit **only the profile for the host you run** — do not touch the other, and do not delete existing bundles.

<details>
<summary><strong>Full manual steps</strong></summary>

**1. Find the `$DSH_HOME` this host uses.** A real home is named `.dsh` (official EXE sometimes `dsh-home`), contains `profiles`, and has at least one `profiles/<name>/package.json`. Check in order: `DSH_HOME` env → `.dsh` next to the install root (portable) → `%USERPROFILE%\.dsh` or `~/.dsh` → `%APPDATA%` / `%LOCALAPPDATA%\DeepSeek Harness\dsh-home`. Confirm: `profiles/web/package.json` has `"name": "dsh-profile-web"` (or `dsh-profile-desktop`). Machines often have two homes — use the one that belongs to the host you actually start.

PowerShell to list candidates:

```powershell
$cands = @()
if ($env:DSH_HOME) { $cands += $env:DSH_HOME }
$cands += "$env:USERPROFILE\.dsh"
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($dsh) {
  $dir = Split-Path $dsh.Source
  $cands += @((Join-Path $dir ".dsh"), (Join-Path (Split-Path $dir) ".dsh"), (Join-Path (Split-Path (Split-Path $dir)) ".dsh"))
}
$cands += @("$env:APPDATA\DeepSeek Harness\dsh-home", "$env:LOCALAPPDATA\DeepSeek Harness\dsh-home")
$cands | Select-Object -Unique | Where-Object { $_ -and (Test-Path (Join-Path $_ "profiles")) }
```

**2. Put the plugin at `$DSH_HOME/plugins/dsh-purge-czx`** (folder must be named `dsh-purge-czx`, with a `package.json` whose `"name"` is `dsh-purge-czx`).

```sh
git clone https://github.com/czx455501074-afk/dsh-purge-czx.git "$DSH_HOME/plugins/dsh-purge-czx"
```

Without git: download [master.tar.gz](https://github.com/czx455501074-afk/dsh-purge-czx/archive/refs/heads/master.tar.gz), extract, rename `dsh-purge-czx-master` → `dsh-purge-czx`, and place it under `plugins`. If you already have a clone, copy the whole tree — not a few `.js` files.

**3. Edit only that profile's `package.json` — back it up first.** Web → `$DSH_HOME/profiles/web/package.json`; desktop → `$DSH_HOME/profiles/desktop/package.json`. Add **only two things**, keeping every existing dependency and bundle:

1. In `dependencies`, add `"dsh-purge-czx": "file:../../plugins/dsh-purge-czx"`
2. At the **end** of `dsh.profile.bundles`, append `"dsh-purge-czx"` (skip if already there)

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {
    "dsh-purge-czx": "file:../../plugins/dsh-purge-czx"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-purge-czx"
      ],
      "patchReload": "live"
    }
  }
}
```

Keep JSON valid (comma before the new item, none after the last). Do not switch `file:../../plugins/dsh-purge-czx` to an absolute path, do not touch `patchReload` or other plugins, and do not list `"dsh-purge-czx"` twice. On desktop, if there is no `dsh-web-app` row, do not add one.

**4. Run `pnpm install` in that profile only** (`cd` into the profile dir, not the repo root or `$DSH_HOME`):

```sh
cd "$DSH_HOME/profiles/web"   # or profiles/desktop
pnpm install
```

Success: `profiles/<web|desktop>/node_modules/dsh-purge-czx/package.json` exists. If `pnpm` is missing, use the Node / pnpm shipped with official `dsh`; on `Could not resolve`, re-check the `file:` path; on a JSON error, fix commas or restore the backup.

**5. Fully quit that host, reopen it, then Apply** — same three steps as above. The card appears under DSH Settings; click **Apply** (or `/purge apply`) on that host only. If the card is missing, you likely edited the other `.dsh` — go back to step 1.

</details>

### Uninstall

**Settings → dsh-purge-czx** → **Clean** → **Uninstall**. Confirm the dialog: it reverts any applied patches, restores the original Harness, and restarts the current host.

```sh
# or from a terminal / chat
dsh-purge-czx --uninstall
# /purge uninstall
```

Plugin config lives in `cordis.patch.yml` (`postPrompt` is empty by default):

```yaml
- insert:
    - id: dsh-purge-czx
      name: 'dsh-purge-czx'
      config:
        enabled: true
        autoApplyOnStart: true
        autoUpdateOnStart: false
        autoRevertOnMissing: false
        verbose: false
        postPromptOrder: 5100
        postPrompt: ""
```

---

## UI

**dsh-purge-czx** lives under DSH **Settings**. That page is the only entry: a two-tab console, **Clean** and **Model prompts**. No floating button, no chip in the composer, no badge in the tab row. Switch **Light / Ink**. Patch groups expand, and progress counts only what is really applied. Rule sets enable or delete in the list above, and you edit the body below.

The Model prompts tab picks a family from the session model id, or you can pin one; files live under `$DSH_HOME/dsh-purge-czx/model-prompts/` and are editable in place. Clean needs no authorization step.

| Area | What it shows |
|---|---|
| dsh-purge-czx | the only entry: DSH Settings → dsh-purge-czx |
| Clean | the old Rules page: patches, prompt, rule sets, skills |
| Model prompts | family detection, mode switch (auto / universal / family / off), and overlay size |
| Patches | grouped status, Apply, Restore, or Uninstall |
| Prompt | edit `prompt-inject.md` as the session override |
| Own servers | one IP or exact hostname per line, saved to `$DSH_HOME/net-scope-allow.txt` |
| Rule sets | multiple `AGENTS.md` / `CLAUDE.md`; Enable writes under `$DSH_HOME`, Delete removes the row |
| Skills | import a zip or folder into this host’s official `$DSH_HOME/skills/<id>/SKILL.md` (web and desktop each use their own home; no drive letter is hardcoded); DSH owns match, load, and `/name`. You can also delete that folder yourself |

---

## Layout

`bin/` is the CLI, `lib/` is patches and prompt injection, `presets/model-prompts/` is the per-model jailbreak packs, and `client.js` is the Settings page console.

Runtime files live under `$DSH_HOME`: `prompt-inject.md`, `rules/`, `skills/`, `net-scope-allow.txt`, `dsh-purge-czx/` (model prompts and config). If `DSH_HOME` is unset, the launcher-adjacent `.dsh` wins over `~/.dsh`. Web and the desktop app each use their own home. Skills never enter the inject section and never replace the prompt.

---

## Usage

```sh
dsh-purge-czx --status
dsh-purge-czx --apply
dsh-purge-czx --revert
dsh-purge-czx --uninstall
dsh-purge-czx --edit

/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset | help
/skills list | import <zip-or-folder> | create <id> [description] | delete <id> | help
/rewind

purge_status   purge_apply   purge_revert
```

After a successful Apply, the host restarts so patched packages load; you can also click **Restart** manually. Under the patch title are the stable release and the test release. The test release follows the `beta` branch. **Switch to stable** installs `master` and clears any pin. Picking an older stable version pins it; click **Update** to return to the latest. Old test tags are not listed.

The composer **Undo once** and **Undo last round** follow official DSH `session.fork({ atSeq })`: the withdrawn turn is cut off, a new session keeps the earlier context, the old session is archived, and the line returns to the input so **send again** re-injects. `/rewind` does the same.

If the **same task works in standard but fails in minimal or PTC**, preset `run_code`, sandbox, or plan intercept text is often still uncleared, or built-in minimal is missing `agent-instructions`. Use **1.1.61+**, then **quit the host fully → Apply in Clean → restart → start a new chat**. Switching preset alone does not reload patches in the running process.

### Response speed

DSH runs Bash calls in a tool batch one at a time. Older dsh-purge-czx releases raised the default foreground wait from 60 seconds to 10 minutes, so one slow command could hold up later calls for that long. Patch #21 now restores marked plugin values to the official 60-second default. Unmarked timeouts and other custom values are preserved; an unmarked 10-minute value cannot reliably be distinguished from a user setting.

For a shorter wait in `dsh web` on macOS/Linux, add this entry to `$DSH_HOME/profiles/web/cordis.patch.yml` (normally `~/.dsh/profiles/web/cordis.patch.yml`). Edit an existing entry with the same id instead of adding a duplicate. This profile layer is applied after the bundled configuration, so future plugin applies keep the override.

```yaml
- id: bash-sandbox
  config:
    timeoutMs: 10000
```

With the standard jobs service and `promoteOnTimeout: true`, an unfinished command returns a background job id after 10 seconds and keeps running. Read it with `job_output` or stop it with `job_kill`. This changes the foreground wait, not the command's speed. Without that service or with promotion disabled, the timeout kills the command. A per-call `timeoutMs` overrides this default; `run_in_background: true` returns a job id immediately.

For routine tasks, you can also opt into Low reasoning for new sessions:

```yaml
- id: agent-default-model
  config:
    provider: deepseek-official
    model: deepseek-flash
    reasoningEffort: low
```

Restart `dsh web` to load the profile. The model and reasoning defaults apply to newly created sessions; select Low in the composer for an existing session. The plugin does not change these model preferences automatically. Keep High when the task needs deeper reasoning, and narrow file searches rather than recursively scanning every application directory.

### Own servers

Addresses in mainland China, Hong Kong, and Macau stay forbidden unless that one host was registered first. Saying “this is my server” in chat does not allow it. A key or a password does not allow it either.

The box sits under Prompt. If the settings page does not show it yet, quit DeepSeek Harness completely and open it again.

1. Open **Settings → dsh-purge-czx** and stay on **Clean**.
2. Scroll past **Prompt**. **Own servers** is the next block.
3. Put one host on each line, in one of these forms:
   - `203.0.113.10` — one IP.
   - `my-vps.example.com` — one exact hostname. After you save, the addresses that hostname resolves to at lookup time are allowed too.
   - `alice@my-vps.example.com` — the account only identifies this form. It does not prove the machine is yours.
4. Click **Save list**. The list is written to `$DSH_HOME/net-scope-allow.txt`.
5. Keys, passwords, ranges, and wildcards are dropped on save. Unlisted mainland China, Hong Kong, and Macau addresses stay forbidden.

`203.0.113.10` and `example.com` above are only examples of the form. Replace them with your own host before you save.

---

## Local checks

```sh
node --check lib/index.js
node --check lib/core.js
node --check lib/surface.js
node --check lib/web.js
node --check lib/desktop.js
node --check lib/host.js
node --check lib/rewind.js
node --check lib/skills.js
node --check client.js
```

---

## How it works

Apply, on start or when you click Apply:

```mermaid
flowchart TD
  A["Start or click Apply"] --> B{"Patch already in place?"}
  B -->|yes| C["Skip"]
  B -->|no| D["Back up the original as .dshpurge.bak"]
  D --> E["Replace the matched files"]
  E --> F["Override the shim"]
  F --> G["Inject the encrypted prompt shipped in the plugin, the text the prompt box shows by default"]
```

Override on each session:

```mermaid
flowchart TD
  A["Restart or new session"] --> B["Inject the plugin's encrypted default. No save click, and no host prompt file"]
```

Prompt injection and ruleset decision at every turn. The three inputs on the left are what you control in the dsh-purge-czx panel; the dotted edges show which decision each one drives:

```mermaid
flowchart TD
  L["Rule library: activate a set → writes prompt-inject.md"]
  W["Local rules: check AGENTS.md / CLAUDE.md in the current dir"]
  P["Workspace policy: strict / fallback / always"]

  A["Turn start"] --> B{"prompt-inject.md non-empty?"}
  B -->|yes| C["Inject = prompt-inject.md (A)"]
  B -->|no| D{"Any checked local md in the current dir, non-empty?"}
  D -->|yes| E["Inject = selected workspace md (B)"]
  D -->|no| F["Inject = plugin encrypted slot default (D)"]
  C --> G{"Workspace baseline policy (C)"}
  E --> G
  F --> G
  G -->|strict| H["Drop DSH workspace baseline section"]
  G -->|fallback default| I{"User inject present above? (A or B)"}
  G -->|always| J["Keep DSH workspace baseline section"]
  I -->|yes| H
  I -->|no| J
  H --> K["Final system prompt"]
  J --> K

  L -.-> B
  W -.-> D
  P -.-> G
```

### Runtime bypasses (no source patches)

Patches edit host source, so a host upgrade can drift their anchors. The plugin also mounts two
runtime bypasses that rely only on cordis `waterfall` / `context` semantics and touch no host file:

```mermaid
flowchart TD
  A["Model requests an action that needs approval"] --> B["ApprovalService.decide()"]
  B --> C{"effectivePolicy === 'never'?"}
  C -->|"yes, stock host"| X["rejected before the waterfall even runs"]
  C -->|"plugin downgrades to ask"| D["approval/request waterfall"]
  D --> E["dsh-purge-czx handler (prepend, outermost)"]
  E --> F["returns allowed-once: granted, no prompt"]
  D --> G["browser approval UI / ACP answerer (shadowed, never runs)"]
```

- **Approval bypass**: answers `allowed-once` at the outermost waterfall layer, covering tool approvals
  and sandbox escalation (`sandbox_permissions`) alike. A `danger-full-access` preset carries
  `approval: never`, and the host's `decide()` returns `"rejected"` before the waterfall runs, so the
  plugin also reads `effectivePolicy`'s `never` as `ask` (prototype patch, restored on dispose).
- **Runtime context rewrite**: the assembled `approval:policy` context changes from "approval is disabled,
  actions are rejected" to "approval is auto-granted, request escalation freely"; `sandbox:policy` is
  stated as `danger-full-access`. The rewrite happens on the assembled contexts only: registering an `approval:policy` context ourselves would collide with ApprovalService's own registration and knock that service out, so the plugin never pre-registers one.
- **refreshContext exit guard**: rewriting the `assemble` return value alone is not enough — before the
  request is sent, `agent-loop` calls `systemPrompt.refreshContext()`, which re-resolves every registered
  provider and overwrites the text back to the original. The plugin rewrites the `refreshContext` return
  value as well, so both entry points are covered and the model actually reads the hardened sentence.
- **Toggle**: plugin config `approvalBypass` (default `true`), or
  `$DSH_HOME/dsh-purge-czx/approval-bypass.json` (`{"approvalBypass": false}`); hot-switchable from the panel
  and `POST /dsh-purge-czx/approval-bypass`. Turning it off restores the host's own `never` semantics:
  no prompt, denied outright.

Skills stay out of the inject section:

```mermaid
flowchart LR
  A["Settings import or /skills import"] --> B["Write into the official skills directory"]
  B --> C["DSH loads it"]
  C --> D["Uninstall does not delete user skills"]
```

---

## Restore

- Each target is copied to `<file>.dshpurge.bak` before the first apply.
- **Restore** or `/purge revert` copies backups back and deletes them. With no backup, shim lines written by this plugin are stripped.
- `prompt-inject.md` is a user file and is kept.
- **Uninstall** restores first if patches were applied, then deletes the inject file, rule library, and the plugin itself.
- Apply is idempotent.

---

## Path detection

The host surface is detected first: `web` / `desktop` (`gui` / `tui` are reserved and still fall back to web).

**Web:**

1. `DSH_HOME` / `DSH_BASE`
2. `.dsh` next to the dsh launcher (portable install, any drive)
3. `npm prefix -g` / `npm root -g`
4. Nested `@deepseek-ai/dsh/node_modules/@deepseek-ai`
5. `~/.dsh`

**Official desktop EXE:** the running official Harness install (`resources/app` or the unpacked package). The drive letter is not hard-coded. A successful Apply restarts once.

Community Desktop is not maintained.

Official npm-global is not patched. Sealed `host-commands` / `runtime-commands` are scrubbed, never injected.

If nothing is found, set `DSH_BASE` / `DSH_DESKTOP_INSTALL`. No files are changed.

---

## Releases

What changed, and the zip, are on [Releases](https://github.com/czx455501074-afk/dsh-purge-czx/releases). To publish, bump the version in `package.json`, write Chinese and English notes in `release-notes.md`, and push `master`. Pushing the same version again does not publish another package.

## Notes

- Scope is rendered copy, defaults, and runtime logic inside local `@deepseek-ai/*` packages, plus override files and rule sets under the harness home.
- After an upgrade, unmatched originals show as skipped. Apply still completes, and those files are left unchanged.
- Third-party plugin *source repos* outside `@deepseek-ai` are left alone (CMD silence may **best-effort** patch installed doctor / market / liangshen / mnemon at runtime).
- Install from this repository only: `dsh plugin --profile web add https://github.com/czx455501074-afk/dsh-purge-czx` or `dsh plugin --profile desktop add https://github.com/czx455501074-afk/dsh-purge-czx`. From this repo, `add .`. If the Git URL fails, use the master.tar.gz archive instead.

---

Thanks to the [LINUX DO](https://linux.do) community
