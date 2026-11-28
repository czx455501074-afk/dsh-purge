/**
 * 一次性改名脚本：dsh-purge → dsh-purge-czx
 *
 * 保留不动的锚点（回滚兼容）：
 *   - "[dsh-purge]"  宿主补丁标记，purge_revert 靠它识别已打补丁
 *   - "dsh-purge-work" 本地工作目录名
 *   - "dshpg" 历史别名
 */
import { readdirSync, readFileSync, statSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SKIP_DIRS = new Set([".git", "node_modules", ".github-work", "dist"]);
const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".json", ".yml", ".yaml", ".md", ".html", ".svg", ".txt", ".sh", ".ps1", ".cmd"]);
const SKIP_FILES = new Set(["lib/asset-table.js", "scripts/rename-brand.mjs", "package-lock.json", "pnpm-lock.yaml"]);

const RE = /(?<!\[)dsh-purge(?!-czx)(?!-work)(?!\])/g;
let changed = 0;
const report = [];

function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    const rel = relative(ROOT, full).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full);
      continue;
    }
    if (!ent.isFile()) continue;
    if (SKIP_FILES.has(rel)) continue;
    if (!TEXT_EXT.has(extname(ent.name).toLowerCase())) continue;
    const before = readFileSync(full, "utf8");
    const after = before.replace(RE, "dsh-purge-czx");
    if (after !== before) {
      writeFileSync(full, after, "utf8");
      const n = (before.match(RE) || []).length;
      changed += n;
      report.push(rel + "  x" + n);
    }
  }
}

walk(ROOT);

// 文件改名
const binFrom = join(ROOT, "bin", "dsh-purge.js");
const binTo = join(ROOT, "bin", "dsh-purge-czx.js");
if (existsSync(binFrom) && !existsSync(binTo)) { renameSync(binFrom, binTo); report.push("renamed bin/dsh-purge.js → bin/dsh-purge-czx.js"); }

console.log(report.sort().join("\n"));
console.log("total replacements:", changed);
