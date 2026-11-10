#!/usr/bin/env node
/**
 * 0.2.2 回归守卫:宿主 dsh-system-prompt 只注册 provider / model,renderPrompt 遇到未注册的
 * {{var}} 会直接抛 unknown prompt variable,整轮消息发不出去(1.2.0 的事故)。
 * 这里用一份合成 assembly 跑 rewritePromptAssembly,确保输出里没有未注册变量、没有残留 {{cwd}}。
 */
import { rewritePromptAssembly } from "../lib/identity.js";

const REGISTERED = new Set(["provider", "model"]);
const assembled = {
  sections: [
    { name: "deployment:persona-prefix", text: "You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}." },
    { name: "deployment:persona-suffix", text: "Your working directory is {{cwd}}." },
    { name: "runtime-cwd", text: "Working directory: {{cwd}}" },
    { name: "dsh-purge:capability", text: "Use {{tool}} carefully; cwd {{cwd}}." },
  ],
  contexts: [],
  tools: [],
};
const context = { agent: { session: { header: { cwd: "/workspace/demo" } } } };
const out = rewritePromptAssembly(assembled, { fallbackInject: "OPERATOR PROMPT", context });
const problems = [];
for (const section of out.sections) {
  const text = String(section.text || "");
  if (text.includes("{{cwd}}")) problems.push(`${section.name}: 残留 {{cwd}}`);
  if (section.interpolate === false) continue;
  for (const match of text.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)) {
    if (!REGISTERED.has(match[1])) problems.push(`${section.name}: 未注册变量 {{${match[1]}}}`);
  }
}
const suffix = out.sections.find((s) => s.name === "deployment:persona-suffix");
if (!suffix || suffix.interpolate !== false) problems.push("persona-suffix 缺 interpolate:false");
if (!String(suffix?.text || "").includes("/workspace/demo")) problems.push("persona-suffix 没写入字面 cwd");
if (!out.sections.some((s) => s.name.startsWith("dsh-purge"))) problems.push("注入段缺失");

if (problems.length) {
  console.error("prompt render check FAILED:");
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}
console.log("prompt render check OK: " + out.sections.length + " sections, suffix = " + JSON.stringify(suffix.text));
