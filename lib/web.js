import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDshGoHost } from "./surface.js";
import * as core from "./core.js";

export function restartNote() {
  // dsh-go：引擎归 App 管，这里不能自己杀进程再 spawn，否则 App 会显示断连，
  // 还可能起第二个服务器抢 3080。改成提示用户去「引擎」页重启。
  if (isDshGoHost()) return "已写入。请到 App「引擎」页重启引擎";
  return "正在重启 dsh web…";
}

export function portFromRequest(request) {
  const host = String(request?.headers?.host || "");
  const m = host.match(/:(\d+)$/);
  if (m) return Number(m[1]);
  return Number(process.env.PORT) || 3080;
}

export function hostFromRequest(request) {
  const hostHeader = String(request?.headers?.host || "127.0.0.1");
  return hostHeader.replace(/:\d+$/, "") || "127.0.0.1";
}

export function restartArgv({
  argv = process.argv,
  findBinRoot = core.findDshBinRoot,
} = {}) {
  const root = findBinRoot();
  const binJs = root ? path.join(root, "lib", "bin.js") : null;
  if (binJs && fs.existsSync(binJs)) {
    const rest = argv.slice(2).filter((arg) => arg !== "--no-open");
    if (!rest.includes("web") && !rest.includes("desktop")) {
      const port = Number(process.env.PORT) || 3080;
      rest.unshift("web", "--port", String(port));
    }
    rest.push("--no-open");
    return [binJs, ...rest];
  }
  const next = argv.slice(1).filter((arg) => arg !== "--no-open");
  if (next[0] && /\.(cmd|bat)$/i.test(next[0])) {
    const dir = path.dirname(next[0]);
    const candidates = [
      path.resolve(dir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
      path.resolve(dir, "..", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    if (hit) next[0] = hit;
  }
  next.push("--no-open");
  return next;
}

function spawnRestartHelper(helper, payload, exitAfter = 250) {
  try {
    core.silenceCmdFlash();
  } catch {}
  const child = spawn(process.execPath, [helper], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
    env: {
      ...core.envForDetachedSpawn(),
      DSH_PURGE_RESTART: JSON.stringify(payload),
    },
  });
  child.unref();
  setTimeout(() => process.exit(0), exitAfter);
}

/**
 * @param {object} [request]
 * @param {unknown} [_ctx]
 * @param {{ openBrowser?: boolean }} [options]
 * settle / 自愈重启传 request=null → 默认不弹浏览器，避免关窗后仍被反复拉起新窗口（#59/#61）。
 */
export function scheduleRestart(request, _ctx, options = {}) {
  if (isDshGoHost()) {
    // 不杀进程、不 spawn：让 App 的「引擎」页负责重启，补丁在重启后生效。
    return { restarting: false, manual: true, clean: true, note: restartNote() };
  }
  const openBrowser = options.openBrowser ?? (request != null);
  const helper = fileURLToPath(new URL("./restart-web.js", import.meta.url));
  spawnRestartHelper(helper, {
    kind: "web",
    execPath: process.execPath,
    argv: restartArgv(),
    cwd: process.cwd(),
    host: hostFromRequest(request),
    port: portFromRequest(request),
    pid: process.pid,
    openBrowser: openBrowser !== false,
  });
}

export function scheduleCleanupRestart({ request, restartArgv: argv, cleanup = [] } = {}) {
  if (isDshGoHost()) return { skipped: true, manual: true, note: restartNote() };
  const src = fileURLToPath(new URL("./uninstall-restart.js", import.meta.url));
  const dest = path.join(os.tmpdir(), `dsh-purge-uninst-${process.pid}.mjs`);
  fs.copyFileSync(src, dest);
  spawnRestartHelper(dest, {
    kind: "web",
    execPath: process.execPath,
    argv: argv || restartArgv(),
    cwd: process.cwd(),
    host: hostFromRequest(request),
    port: portFromRequest(request),
    cleanup,
    helper: dest,
    openBrowser: request != null,
  }, 400);
}
