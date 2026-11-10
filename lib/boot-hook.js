import fs from "node:fs";
import path from "node:path";
import { findDshHome, atomicWriteSync } from "./core.js";

const HOOK_BASENAME = "dsh-purge-boot.mjs";
const MARK = "dsh-purge-boot.mjs";

function shimPath() {
  if (process.env.DSH_PURGE_SHIM) return process.env.DSH_PURGE_SHIM;
  for (const candidate of ["/usr/local/bin/dsh", "/usr/bin/dsh", "/bin/dsh"]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function hookPath(dshHome = findDshHome()) {
  return path.join(dshHome, HOOK_BASENAME);
}

function readShim(fp) {
  try { return fs.readFileSync(fp, "utf8"); } catch { return ""; }
}

function sourceHook() {
  // 安装时把 hook 脚本复制到 DSH_HOME,shim 只引用这个稳定路径,
  // 插件升级 / profile 重装都不会把 --import 指丢。
  const here = path.dirname(new URL(import.meta.url).pathname);
  const src = path.join(here, "..", "dsh-go", "boot-hook.mjs");
  if (!fs.existsSync(src)) throw new Error("boot-hook.mjs not found at " + src);
  return fs.readFileSync(src, "utf8");
}

export function bootHookStatus(dshHome = findDshHome()) {
  const shim = shimPath();
  const hook = hookPath(dshHome);
  const text = shim ? readShim(shim) : "";
  return {
    shim,
    hook,
    hook_present: fs.existsSync(hook),
    shim_injected: text.includes(MARK),
    backup: shim ? fs.existsSync(shim + ".dshpurge.bak") : false,
  };
}

export function installBootHook(dshHome = findDshHome()) {
  const shim = shimPath();
  if (!shim) return { ok: false, error: "dsh launcher not found (/usr/local/bin/dsh)" };
  const hook = hookPath(dshHome);
  if (/\s/.test(hook)) return { ok: false, error: "DSH_HOME contains spaces, --import quoting unsupported: " + hook };
  const text = readShim(shim);
  if (!text) return { ok: false, error: "cannot read " + shim };
  if (!text.includes("dsh-app shim")) {
    return { ok: false, error: shim + " does not look like the dsh-app launcher; refusing to edit" };
  }
  atomicWriteSync(hook, sourceHook());
  if (text.includes(MARK)) return { ok: true, shim, hook, changed: false, backup: shim + ".dshpurge.bak" };

  const bak = shim + ".dshpurge.bak";
  if (!fs.existsSync(bak)) fs.copyFileSync(shim, bak);

  let next = text;
  // hook 必须在 boot-cache 之前:先改盘,再让缓存的宿主模块读补丁后的内容。
  if (next.includes("--import=/opt/dsh-go/boot-cache.mjs")) {
    next = next.replace("--import=/opt/dsh-go/boot-cache.mjs", `--import=${hook} --import=/opt/dsh-go/boot-cache.mjs`);
  }
  // 非 web 子命令(直接跑 CLI)也走一遍,便于状态/诊断时保持一致。
  next = next.replace(/^(exec \/opt\/node\/bin\/node )(?!-)/gm, (m) => m + `--import=${hook} `);
  if (!next.includes(MARK)) return { ok: false, error: "launcher layout not recognized; nothing changed" };

  fs.chmodSync(shim, 0o755);
  atomicWriteSync(shim, next);
  fs.chmodSync(shim, 0o755);
  return { ok: true, shim, hook, changed: true, backup: bak };
}

export function removeBootHook(dshHome = findDshHome()) {
  const shim = shimPath();
  const hook = hookPath(dshHome);
  let restored = false;
  if (shim) {
    const bak = shim + ".dshpurge.bak";
    const text = readShim(shim);
    if (fs.existsSync(bak)) {
      const original = readShim(bak);
      if (original.includes("dsh-app shim") && text.includes(MARK)) {
        atomicWriteSync(shim, original);
        fs.chmodSync(shim, 0o755);
        fs.unlinkSync(bak);
        restored = true;
      }
    }
    if (!restored && text.includes(MARK)) {
      const hook = hookPath(dshHome);
      const stripped = text
        .split(`--import=${hook} `).join("")
        .split(`--import=${hook}`).join("")
        .replace(/--import=\s+/g, "");
      atomicWriteSync(shim, stripped);
      fs.chmodSync(shim, 0o755);
      restored = true;
    }
  }
  let removed = false;
  try { fs.unlinkSync(hook); removed = true; } catch { removed = false; }
  return { ok: true, restored, removed };
}
