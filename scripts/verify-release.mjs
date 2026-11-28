#!/usr/bin/env node
/**
 * dsh-purge-czx 发布门禁：改名一致性、单一 UI 入口、bundle 完整性、体积门禁、语法检查。
 * node scripts/verify-release.mjs
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const notes = [];
const ok = (cond, msg) => { if (cond) notes.push("ok   " + msg); else fails.push("FAIL " + msg); };
const read = (rel) => readFileSync(join(root, rel), "utf8");

const pkg = JSON.parse(read("package.json"));
ok(pkg.name === "dsh-purge-czx", "package name = dsh-purge-czx (" + pkg.name + ")");
ok(/^\d+\.\d+\.\d+/.test(pkg.version), "version is semver (" + pkg.version + ")");
ok(typeof pkg.engines?.dsh === "string" && pkg.engines.dsh.includes("0.2.2"), "engines.dsh declared (" + pkg.engines?.dsh + ")");
ok(!("dshTarget" in pkg), "legacy dshTarget field removed");
ok(pkg.dsh?.bundle?.patch === "./cordis.patch.yml", "dsh.bundle.patch points at cordis.patch.yml");
ok(pkg.dsh?.client?.platform === "web", "dsh.client.platform = web");
for (const key of [
  "@deepseek-ai/dsh-client-connection",
  "@deepseek-ai/dsh-client-runtime",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-settings",
]) ok(Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.includes(key), "client inject " + key);

const urls = JSON.stringify(pkg).match(/https?:\/\/[^"']+/g) || [];
const badUrls = urls.filter((u) => /github\.com\/[^/]+\/dsh-purge(?!-czx)/.test(u));
ok(badUrls.length === 0, "manifest URLs point at dsh-purge-czx" + (badUrls.length ? " :: " + badUrls.join(" ") : ""));

const client = read("client.js");
ok(!client.includes('ctx.slots.inject("shell.overlay"'), "no shell.overlay registration (settings page is the only entry)");
ok(!client.includes("__dshPurgeDrill"), "no embedded drill bundle in client");
ok(!client.includes("drill-grant"), "no drill-grant references in client");
ok(!/h\(WelcomeNotice\)|h\(PurgeLauncher\)|h\(HeroNewSessionMount\)|h\(TabRowPurgeMount\)/.test(client), "no launcher/chip mounts in overlay");
ok(!client.includes('inject("conversation.input.right"'), "composer (input.right) button removed");
ok(client.includes('inject("settings.section"'), "settings.section registered");
ok(client.includes("function PurgeSettingsPage"), "PurgeSettingsPage component present");
ok(client.includes('label: () => t("nav.title")'), "settings section label wired");
ok(!client.includes("__DSH_PURGE_DRILL_BEGIN__"), "drill embed markers removed");
for (const gone of ["lib/redteam", "presets/redteam", "skills/redteam", "lib/drill-grant.js", "scripts/build-client.mjs"]) {
  ok(!existsSync(join(root, gone)), "removed " + gone);
}
ok(!/setInterval\(sync, 1500\)/.test(client), "dock 1.5s theme polling removed");
const bytes = statSync(join(root, "client.js")).size;
ok(bytes < 600 * 1024, "client.js under 600KB (" + Math.round(bytes / 1024) + "KB)");

const yml = read("cordis.patch.yml");
ok(yml.includes("id: dsh-purge-czx"), "bundle patch id renamed");
ok(!/name: '?dsh-purge'?(?!-czx)/.test(yml), "no legacy module name in bundle patch");

const idx = read("lib/index.js");
ok(/name = "dsh-purge-czx"/.test(idx), "plugin export name renamed");
ok(idx.includes("purge_doctor"), "purge_doctor tool registered");
ok(idx.includes("migrateLegacyStateDir"), "state migration wired into apply()");
const core = read("lib/core.js");
ok(core.includes("export function migrateLegacyStateDir"), "core migration helper present");
ok(core.includes("[dsh-purge]") || core.includes("dsh-purge-czx:"), "patch markers preserved for rollback");
const ma = read("lib/model-adapt.js");
ok(ma.includes("export function composeOverlay") && ma.includes("export function overlayForContext"), "model-adapt exports present");
ok(ma.includes("export const FAMILIES"), "model-adapt family table present");
ok(idx.includes('name: "purge_models"'), "purge_models tool registered");
ok(idx.includes("/dsh-purge-czx/model-adapt"), "model-adapt http route registered");
ok(idx.includes("appendModelAdapt"), "model overlay appended in inject path");
const packRoot = join(root, "presets/model-prompts");
for (const f of ["universal.md", "claude.md", "gpt.md", "gemini.md", "grok.md", "deepseek.md", "qwen.md", "kimi.md", "glm.md", "minimax.md", "doubao.md", "llama.md", "mistral.md", "generic.md"]) {
  ok(existsSync(join(packRoot, f)) && statSync(join(packRoot, f)).size > 300, "prompt pack " + f);
}

ok(!existsSync(join(root, "bin/dsh-purge.js")), "old bin/dsh-purge.js removed");
ok(existsSync(join(root, "bin/dsh-purge-czx.js")), "bin/dsh-purge-czx.js present");

for (const f of ["client.js", "lib/index.js", "lib/core.js", "lib/identity.js", "bin/dsh-purge-czx.js", "lib/model-adapt.js", "scripts/test-model-adapt.mjs"]) {
  const r = spawnSync(process.execPath, ["--check", join(root, f)], { encoding: "utf8" });
  ok(r.status === 0, "syntax " + f + (r.status ? " :: " + String(r.stderr || "").split("\n")[0] : ""));
}

console.log(notes.join("\n"));
if (fails.length) {
  console.error("\n" + fails.join("\n"));
  console.error("\nverify-release: " + fails.length + " failure(s)");
  process.exit(1);
}
console.log("\nverify-release: all " + notes.length + " checks passed");
