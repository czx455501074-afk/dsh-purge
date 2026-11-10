#!/usr/bin/env node
/**
 * dsh-purge 补丁漂移诊断
 *
 * 逐个补丁、逐个文件、逐条 replacement 检查在当前宿主 @deepseek-ai 上
 * 是「已应用（marker 命中）」「可应用（pattern 命中）」「漂移（pattern 找不到）」
 * 还是「文件缺失」，并给漂移项标出最接近的原文行，方便跟着新版 dsh 改锚点。
 *
 * 只读，不写任何宿主文件。
 *
 *   node scripts/diagnose-patches.mjs [--base <@deepseek-ai 目录>] [--id 3,4,5] [--json] [--drift]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as core from "../lib/core.js";

const args = process.argv.slice(2);
function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : "";
}
const baseArg = argValue("--base") || process.env.DSH_PURGE_DIAG_BASE || "";
const onlyIds = new Set(
  argValue("--id")
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
);
const asJson = args.includes("--json");
const showDrift = args.includes("--drift") ||!asJson;

const aiBase = baseArg || core.findAiBase();
if (!aiBase) {
  console.error("[诊断] 没找到 @deepseek-ai 插件根；用 --base 指定，或设置 DSH_BASE。");
  process.exit(1);
}
const realBase = (() => {
  try { return fs.realpathSync.native(aiBase); } catch { return aiBase; }
})();

const filesTable = core.targetFiles(aiBase);
const asLf = (s) => String(s || "").replace(/\r\n/g, "\n");

function filePathsOf(key) {
  const v = filesTable[key];
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v];
}

function patchReplacements(p) {
  if (Array.isArray(p.replacements)) return p.replacements;
  return (p.patterns || []).map((pattern) => ({ pattern, replace: p.replace }));
}

function markerHit(text, p) {
  const hay = asLf(text);
  if (Array.isArray(p.forbid) && p.forbid.some((m) => hay.includes(asLf(m)))) return false;
  if (Array.isArray(p.markers) && p.markers.length) {
    const fn = p.markersAny ? "some" : "every";
    return p.markers[fn]((m) => hay.includes(asLf(m)));
  }
  if (p.marker) return hay.includes(asLf(p.marker));
  return false;
}

function patternHit(text, pattern) {
  const hay = asLf(text);
  if (pattern instanceof RegExp) {
    return new RegExp(pattern.source, String(pattern.flags || "").replace("g", "")).test(hay);
  }
  return hay.includes(asLf(pattern));
}

/** 归一化空白后做行级相似度，找最像 pattern 的原文窗口。 */
function driftCandidate(text, pattern) {
  const needle = asLf(pattern);
  if (!needle || needle.length < 24) return null;
  const needleLines = needle.split("\n").map((s) => s.trim()).filter(Boolean);
  if (needleLines.length === 0) return null;
  const hayLines = asLf(text).split("\n");
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const first = norm(needleLines[0]);
  if (first.length < 8) return null;
  const scored = [];
  for (let i = 0; i < hayLines.length; i += 1) {
    const line = norm(hayLines[i]);
    if (!line) continue;
    let score = 0;
    if (line === first) score = 100;
    else if (line.startsWith(first.slice(0, Math.min(24, first.length)))) score = 80;
    else if (first.startsWith(line.slice(0, Math.min(24, line.length))) && line.length > 12) score = 60;
    if (!score) continue;
    let matched = 0;
    for (let k = 0; k < needleLines.length && i + k < hayLines.length; k += 1) {
      if (norm(hayLines[i + k]) === norm(needleLines[k])) matched += 1;
    }
    scored.push({ index: i, score: score + matched * 10, matched, total: needleLines.length, line: hayLines[i] });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    lineNo: best.index + 1,
    matched: best.matched,
    total: best.total,
    exact: best.matched === best.total,
    upstream: best.line.trim().slice(0, 220),
    needle: needleLines[0].trim().slice(0, 220),
  };
}

const rows = [];
for (const p of core.ALL_PATCHES) {
  if (onlyIds.size && !onlyIds.has(p.id)) continue;
  const applies = core.patchAppliesHere(p);
  const keys = Array.isArray(p.file) ? p.file : [p.file];
  const reps = patchReplacements(p);
  const fileRows = [];
  for (const key of keys) {
    const fps = filePathsOf(key);
    if (fps.length === 0) {
      fileRows.push({ key, file: "", state: "missing_file" });
      continue;
    }
    for (const fp of fps) {
      let text = "";
      try {
        text = fs.readFileSync(fp, "utf8");
      } catch {
        fileRows.push({ key, file: fp, state: "read_error" });
        continue;
      }
      const marker = markerHit(text, p);
      const hits = [];
      const drifts = [];
      for (let i = 0; i < reps.length; i += 1) {
        const { pattern, replace } = reps[i];
        if (!pattern || typeof replace !== "string") continue;
        if (patternHit(text, pattern)) hits.push(i + 1);
        else drifts.push(i + 1);
      }
      const drift = [];
      if (showDrift && drifts.length && !marker) {
        for (const idx of drifts.slice(0, 2)) {
          const cand = driftCandidate(text, reps[idx - 1].pattern);
          if (cand) drift.push({ replacement: idx, ...cand });
        }
      }
      fileRows.push({
        key,
        file: fp,
        state: marker ? "applied" : hits.length ? "pending" : drifts.length ? "drift" : "clean",
        markers: marker,
        hitReplacements: hits,
        driftReplacements: drifts,
        drift,
      });
    }
  }
  const states = fileRows.map((f) => f.state);
  // 有些补丁「没有锚点」本身就是完成态：还原型补丁（上游已经没有旧产物）、
  // 布局软补丁（审批句/身份段换写法）和 0.1.5 兼容补丁。别把它们报成漂移。
  const settlesWithoutAnchor =
    core.isLayoutSoftPatch(p) || p.softSettle === true || p.reverse === true || /^0\.1\.5/.test(String(p.layer || ""));
  const state = states.includes("pending")
    ? "pending"
    : states.includes("applied")
      ? "applied"
      : states.includes("drift")
        ? (settlesWithoutAnchor ? "settled" : "drift")
        : states.includes("missing_file")
          ? (applies ? "missing_file" : "na")
          : "clean";
  rows.push({
    id: p.id,
    name: p.name,
    layer: p.layer,
    applies,
    optional: !!p.optional,
    state,
    files: fileRows.filter((f) => f.state !== "clean" || f.markers || f.driftReplacements.length),
  });
}

const summary = rows.reduce((acc, r) => {
  acc[r.state] = (acc[r.state] || 0) + 1;
  return acc;
}, {});

if (asJson) {
  console.log(JSON.stringify({ base: aiBase, realBase, summary, rows }, null, 2));
} else {
  console.log("dsh-purge 补丁诊断 / patch diagnosis");
  console.log("  插件根 / base  " + aiBase);
  if (realBase !== aiBase) console.log("  realpath       " + realBase);
  console.log("  汇总 / summary " + Object.entries(summary).map(([k, v]) => k + "=" + v).join(" "));
  console.log("");
  for (const r of rows) {
    const mark = r.state === "applied" ? "✓" : r.state === "pending" ? "✗" : r.state === "drift" ? "⚠" : r.state === "na" ? "·" : "?";
    console.log(mark + " [#" + String(r.id).padEnd(2) + "] " + r.name + "  (" + r.layer + (r.optional ? ", optional" : "") + ") — " + r.state);
    if (!showDrift) continue;
    for (const f of r.files) {
      if (f.state === "clean") continue;
      const rel = f.file ? path.relative(realBase, f.file) : f.key + " (未映射)";
      console.log("      " + f.state + "  " + rel);
      for (const d of f.drift || []) {
        console.log("        · replacement #" + d.replacement + " 近似行 " + d.lineNo + " (" + d.matched + "/" + d.total + " 行相同)");
        console.log("          原锚点: " + d.needle);
        console.log("          新原文: " + d.upstream);
      }
      if ((f.driftReplacements || []).length && (!f.drift || f.drift.length === 0)) {
        console.log("        · 未命中 replacement: " + f.driftReplacements.join(", "));
      }
    }
  }
  console.log("");
  console.log("说明：applied=marker 已在；pending=锚点还在、可应用；drift=锚点漂移需更新；clean=无锚点无标记；na=宿主面不适用。");
}
process.exit(rows.some((r) => r.state === "drift" || r.state === "pending") ? 2 : 0);
