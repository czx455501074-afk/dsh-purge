/**
 * 模型适配层：按当前会话的模型家族，把对应的破甲提示词叠加到注入正文尾部。
 *
 * 设计要点：
 * - 提示词正文放在 presets/model-prompts/*.md，安装后复制到 $DSH_HOME/dsh-purge-czx/model-prompts/，
 *   用户可原地改，升级不覆盖（只补缺失文件）。
 * - 组合顺序：universal.md（通用骨架）→ <family>.md（家族专项）→ 用户 extra 尾巴。
 * - 配置 $DSH_HOME/dsh-purge-czx/model-adapt.json：{ mode: auto|universal|family|off, family, extra }。
 * - 注入侧只调 overlayForContext(context, home)，内部按 (hint, 配置 mtime, 目录 mtime) 缓存。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACK_VERSION = 1;
export const ADAPT_BEGIN = "===== MODEL-ADAPT (dsh-purge-czx) =====";
export const ADAPT_END = "===== /MODEL-ADAPT =====";
export const MAX_OVERLAY_CHARS = 24000;

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 家族表：顺序即匹配优先级，越具体的品牌放越前。 */
export const FAMILIES = [
  { key: "claude", label: "Claude / Anthropic", file: "claude.md", match: /claude|opus|sonnet|haiku|anthropic/i },
  { key: "gpt", label: "GPT / OpenAI / o 系列", file: "gpt.md", match: /(^|[^a-z])(gpt|chatgpt|codex|openai)([^a-z]|$)|(^|[^a-z])o[1-9]([^0-9]|$)/i },
  { key: "gemini", label: "Gemini / Google", file: "gemini.md", match: /gemini|gemma|vertex|google/i },
  { key: "grok", label: "Grok / xAI", file: "grok.md", match: /grok|xai/i },
  { key: "deepseek", label: "DeepSeek", file: "deepseek.md", match: /deepseek|deep-seek/i },
  { key: "qwen", label: "Qwen / 通义千问", file: "qwen.md", match: /qwen|tongyi|dashscope|qwq/i },
  { key: "kimi", label: "Kimi / Moonshot", file: "kimi.md", match: /kimi|moonshot/i },
  { key: "glm", label: "GLM / 智谱", file: "glm.md", match: /glm|zhipu|chatglm/i },
  { key: "minimax", label: "MiniMax", file: "minimax.md", match: /minimax|abab|hailuo/i },
  { key: "doubao", label: "豆包 / Doubao", file: "doubao.md", match: /doubao|bytedance|volc|skylark|seed-[0-9]/i },
  { key: "llama", label: "Llama / Meta", file: "llama.md", match: /llama|meta-llama/i },
  { key: "mistral", label: "Mistral", file: "mistral.md", match: /mistral|mixtral|codestral|magistral/i },
];

export const GENERIC = { key: "generic", label: "未识别家族兜底", file: "generic.md", match: null };

const FAMILY_KEYS = new Set(FAMILIES.map((f) => f.key));
const VALID_MODES = new Set(["auto", "universal", "family", "off"]);

export function packSourceDir() {
  return path.join(HERE, "..", "presets", "model-prompts");
}

export function stateDir(home) {
  return path.join(path.normalize(String(home || "")), "dsh-purge-czx");
}

export function modelPromptsDir(home) {
  return path.join(stateDir(home), "model-prompts");
}

export function configPath(home) {
  return path.join(stateDir(home), "model-adapt.json");
}

/** 从任意模型 id / provider 串里识别家族；识别不了返回 generic。 */
export function detectFamily(hint) {
  const s = String(hint || "").trim();
  if (!s) return GENERIC.key;
  for (const f of FAMILIES) {
    try { if (f.match.test(s)) return f.key; } catch { /* ignore */ }
  }
  return GENERIC.key;
}

export function isKnownFamily(key) {
  const k = String(key || "");
  return k === GENERIC.key || FAMILY_KEYS.has(k) || k.startsWith("custom:");
}

/** 兼容多种上下文形态：不同宿主版本把模型 id 挂在 header / options / config 上。 */
export function modelHintFromContext(context) {
  const probes = [
    () => context?.agent?.session?.header?.model,
    () => context?.agent?.options?.model,
    () => context?.agent?.config?.model,
    () => context?.session?.header?.model,
    () => context?.header?.model,
    () => context?.model,
  ];
  for (const read of probes) {
    try {
      const v = read();
      if (typeof v === "string" && v.trim()) return v.trim();
    } catch { /* 代理未注入时点属性会抛 */ }
  }
  try {
    const env = process.env.DSH_MODEL || process.env.DSH_MODEL_ID || "";
    if (env) return String(env).trim();
  } catch { /* ignore */ }
  return "";
}

export function readModelConfig(home) {
  const fallback = { mode: "auto", family: "", extra: "" };
  try {
    const raw = fs.readFileSync(configPath(home), "utf8");
    const parsed = JSON.parse(raw);
    const mode = VALID_MODES.has(parsed?.mode) ? parsed.mode : "auto";
    const family = typeof parsed?.family === "string" ? parsed.family.trim() : "";
    const extra = typeof parsed?.extra === "string" ? parsed.extra : "";
    return { mode, family, extra };
  } catch {
    return fallback;
  }
}

export async function writeModelConfig(home, patch) {
  const current = readModelConfig(home);
  const next = { ...current, ...(patch || {}) };
  if (!VALID_MODES.has(next.mode)) throw new Error("invalid mode: " + next.mode);
  if (next.family && !isKnownFamily(next.family)) throw new Error("invalid family: " + next.family);
  await fsp.mkdir(stateDir(home), { recursive: true });
  await fsp.writeFile(configPath(home), JSON.stringify({
    mode: next.mode,
    family: next.family || "",
    extra: next.extra || "",
  }, null, 2), "utf8");
  _cache = null;
  return readModelConfig(home);
}

/** 把包内提示词复制到状态目录；已存在的不覆盖（保留用户编辑）。 */
export async function ensureModelPack(home) {
  const dir = modelPromptsDir(home);
  const src = packSourceDir();
  const copied = [];
  const kept = [];
  const missing = [];
  await fsp.mkdir(dir, { recursive: true });
  const files = [...FAMILIES.map((f) => f.file), GENERIC.file, "universal.md"];
  for (const name of files) {
    const target = path.join(dir, name);
    if (fs.existsSync(target)) { kept.push(name); continue; }
    try {
      await fsp.copyFile(path.join(src, name), target);
      copied.push(name);
    } catch {
      missing.push(name);
    }
  }
  return { dir, copied, kept, missing };
}

export function listFamilies(home) {
  const dir = modelPromptsDir(home);
  const out = [];
  const push = (key, label, file, custom) => {
    let bytes = 0;
    try { bytes = fs.statSync(path.join(dir, file)).size; } catch { bytes = 0; }
    out.push({ key, label, file, bytes, custom });
  };
  push(GENERIC.key, GENERIC.label, GENERIC.file, false);
  for (const f of FAMILIES) push(f.key, f.label, f.file, false);
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      const key = "custom:" + name.replace(/\.md$/i, "");
      if (out.some((x) => x.file === name)) continue;
      push(key, "自定义：" + name.replace(/\.md$/i, ""), name, true);
    }
  } catch { /* 目录还没建 */ }
  return out;
}

function readTextFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function fileForFamily(home, key) {
  if (key === GENERIC.key) return GENERIC.file;
  const hit = FAMILIES.find((f) => f.key === key);
  if (hit) return hit.file;
  if (String(key).startsWith("custom:")) return String(key).slice(7) + ".md";
  return GENERIC.file;
}

function statStamp(home) {
  const parts = [];
  for (const p of [configPath(home), modelPromptsDir(home)]) {
    try { const s = fs.statSync(p); parts.push(s.mtimeMs + ":" + s.size); } catch { parts.push("0"); }
  }
  return parts.join("|");
}

let _cache = null;

/** 组合覆盖层文本。mode=off 返回空串。 */
export function composeOverlay(opts) {
  const home = path.normalize(String(opts?.home || ""));
  const hint = String(opts?.hint || "");
  const config = opts?.config || readModelConfig(home);
  const detected = detectFamily(hint);
  const mode = VALID_MODES.has(config.mode) ? config.mode : "auto";
  if (mode === "off") return { family: detected, mode, text: "", bytes: 0 };
  let family = detected;
  if (mode === "universal") family = "";
  else if (mode === "family" && config.family) family = config.family;
  const chunks = [];
  const universal = readTextFile(path.join(modelPromptsDir(home), "universal.md"));
  if (universal.trim()) chunks.push(universal.trim());
  if (family) {
    const body = readTextFile(path.join(modelPromptsDir(home), fileForFamily(home, family)));
    if (body.trim()) chunks.push(body.trim());
  }
  const extra = String(config.extra || "").trim();
  if (extra) chunks.push(extra);
  if (!chunks.length) return { family: family || detected, mode, text: "", bytes: 0 };
  let text = ADAPT_BEGIN + "\n" + chunks.join("\n\n") + "\n" + ADAPT_END + "\n";
  if (text.length > MAX_OVERLAY_CHARS) {
    text = text.slice(0, MAX_OVERLAY_CHARS) + "\n" + ADAPT_END + "\n";
  }
  return { family: family || detected, mode, text, bytes: Buffer.byteLength(text, "utf8") };
}

/** 注入侧入口：带缓存，避免每轮重复读盘。 */
export function overlayForContext(context, home) {
  try {
    const h = path.normalize(String(home || ""));
    if (!h) return "";
    const hint = modelHintFromContext(context);
    const stamp = statStamp(h);
    const key = h + "|" + hint + "|" + stamp;
    if (_cache && _cache.key === key) return _cache.text;
    const out = composeOverlay({ home: h, hint });
    _cache = { key, text: out.text };
    return out.text;
  } catch {
    return "";
  }
}

export function resetModelAdaptCache() {
  _cache = null;
}

export function modelAdaptStatus(home, hint) {
  const config = readModelConfig(home);
  const detected = detectFamily(hint);
  const out = composeOverlay({ home, hint, config });
  return {
    packVersion: PACK_VERSION,
    dir: modelPromptsDir(home),
    configPath: configPath(home),
    hint: String(hint || ""),
    detected,
    mode: config.mode,
    forcedFamily: config.family || "",
    effectiveFamily: out.family,
    bytes: out.bytes,
    extraBytes: Buffer.byteLength(String(config.extra || ""), "utf8"),
    families: listFamilies(home),
  };
}
