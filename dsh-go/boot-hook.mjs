#!/usr/bin/env node
/**
 * dsh-purge boot hook (dsh-go).
 *
 * The dsh-go app restores /opt/dsh from its bundled runtime on every engine start, so the file
 * patches written by `dsh-purge --apply` are gone by the next launch. This preload runs before
 * DSH imports its own modules, re-applies the patches to disk, and lets the same boot load the
 * patched files.
 *
 * Installed as `--import` in the /usr/local/bin/dsh shim by `dsh-purge --boot-hook-install`.
 * Every failure is swallowed: a broken hook must never keep the engine from starting.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const LOG = path.join(HOME, "dsh-purge", "boot-hook.log");
const LOCK = path.join(HOME, "dsh-purge", "boot-hook.lock");
const LOCK_TTL_MS = 300_000;

function log(line) {
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* logging must never fail the boot */ }
}

function resolveRoot() {
  const probe = (dir) => {
    const entry = path.join(dir, "lib", "core.js");
    return fs.existsSync(entry) ? dir : "";
  };
  const direct = process.env.DSH_PURGE_ROOT ? probe(process.env.DSH_PURGE_ROOT) : "";
  if (direct) return direct;
  try {
    const profiles = fs.readdirSync(path.join(HOME, "profiles"));
    for (const name of profiles) {
      const found = probe(path.join(HOME, "profiles", name, "node_modules", "dsh-purge"));
      if (found) return found;
    }
  } catch { /* no profiles yet */ }
  return probe(path.join(HOME, "plugins", "dsh-purge"));
}

function takeLock() {
  try {
    fs.mkdirSync(path.dirname(LOCK), { recursive: true });
    const stat = fs.statSync(LOCK, { throwIfNoEntry: false });
    if (stat && Date.now() - stat.mtimeMs < LOCK_TTL_MS) return false;
    fs.writeFileSync(LOCK, String(process.pid));
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK); } catch { /* already gone */ }
}

if (process.env.DSH_PURGE_BOOT_HOOK !== "0" && !process.env.DSH_PURGE_BOOT_HOOKED) {
  process.env.DSH_PURGE_BOOT_HOOKED = "1";
  if (takeLock()) {
    try {
      const root = resolveRoot();
      if (!root) {
        log("skip: dsh-purge not found");
      } else {
        const mod = await import(pathToFileURL(path.join(root, "lib", "core.js")).href);
        // applyPatchesAllHosts 会往 stdout 打进度,Web 启动时那会污染 DSH 的输出解析。
        const savedLog = console.log;
        const savedInfo = console.info;
        console.log = () => {};
        console.info = () => {};
        try {
          const started = Date.now();
          const result = await mod.applyPatchesAllHosts(mod.ALL_PATCHES, { forApply: true });
          const applied = result.report.filter((r) => r.status === "applied").length;
          const failed = result.report.filter((r) => r.status === "failed" || r.status === "pattern_not_found");
          log(`root=${root} applied=${applied} failed=${failed.length} hosts=${result.hosts.length} ms=${Date.now() - started}`);
          for (const row of failed.slice(0, 8)) log(`  #${row.patch_id} ${row.name}: ${row.status}`);
        } finally {
          console.log = savedLog;
          console.info = savedInfo;
        }
      }
    } catch (err) {
      log("error: " + String(err?.message || err));
    } finally {
      releaseLock();
    }
  }
}
