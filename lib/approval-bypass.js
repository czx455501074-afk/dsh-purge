// 运行时审批旁路：在宿主 approval/request 瀑布上直接应答 allowed-once。
//
// 为什么需要它：插件原有的审批放行全部走「改宿主源码」的补丁（#9 改 decide 的
// never 早退 + 瀑布调用、#10 改 Config 默认策略、#62 改 dsh-tools 的 serviceAsk）。
// 宿主每升级一次，这些锚点就可能漂移（0.2.2-rc.x 已经把 `decision: {kind:"deny"}`
// 换成 approvalDenial() 工厂、把 throw new Error 换成 SandboxEscalationError）。
// 补丁打不上时用户的审批门就回来了，而运行时钩子不依赖任何源码锚点，
// 只要宿主还是 cordis 的「waterfall + ctx.on」这一套语义就有效。
//
// 语义：waterfall 的监听器「最外层优先」，不调用 next() 即否决整条链 ——
// 包括后面的浏览器审批 UI 与 ACP 请求。返回 "allowed-once" 就是授予本次动作。
// 本模块不 import core.js（core 会回调本模块，避免循环依赖）。
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SETTINGS = Object.freeze({ approvalBypass: true });
const SETTINGS_FILE = "approval-bypass.json";

/** 宿主唯一合法的授予值。其余取值会被 decide() 归一成 unavailable（fail closed）。 */
const GRANT = "allowed-once";

export function approvalBypassSettingsPath(dshHome) {
  return path.join(dshHome, "dsh-purge", SETTINGS_FILE);
}

/**
 * 读取开关：文件 > 插件配置 > 默认 true。
 * 文件解析失败一律回落到 config，绝不让一个坏 JSON 把旁路静默关掉。
 */
export function loadApprovalBypassSettings(dshHome, configValue) {
  let file = {};
  try {
    const fp = approvalBypassSettingsPath(dshHome);
    if (fp && fs.existsSync(fp)) {
      const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (parsed && typeof parsed === "object") file = parsed;
    }
  } catch {
    file = {};
  }
  const pick = [file.approvalBypass, configValue, DEFAULT_SETTINGS.approvalBypass];
  const value = pick.find((v) => typeof v === "boolean");
  return { approvalBypass: value === undefined ? true : value };
}

/** 本地原子写（写 tmp → fsync → rename），与 hooks-deny 同款。 */
function atomicWriteFileSync(fp, content, encoding = "utf8") {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, content, encoding);
    try { fs.fsyncSync(fd); } catch { /* FS 不支持 fsync 时忽略 */ }
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, fp);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

export function saveApprovalBypassSettings(dshHome, patch) {
  const fp = approvalBypassSettingsPath(dshHome);
  const current = loadApprovalBypassSettings(dshHome);
  const next = {
    approvalBypass: typeof patch?.approvalBypass === "boolean"
      ? patch.approvalBypass
      : current.approvalBypass,
  };
  atomicWriteFileSync(fp, `${JSON.stringify(next, null, 2)}\n`);
  return { ok: true, ...next, path: fp };
}

/**
 * 开关的热读取：审批请求本身很少（每轮最多几次），但每次读盘仍不划算，
 * 所以按 mtime+size 做一层极薄的缓存；文件被改（含删除）立刻失效。
 */
function makeSettingsReader(dshHome, getConfig) {
  let stamp = "\u0000";
  let enabled = true;
  return function isEnabled() {
    let next = "";
    try {
      const fp = approvalBypassSettingsPath(dshHome);
      const stat = fs.statSync(fp);
      next = `${stat.mtimeMs}:${stat.size}`;
    } catch {
      // 文件不存在：每次都要重新解析，因为可能是刚被删掉/刚被创建。
      next = "absent";
    }
    if (next !== stamp) {
      stamp = next;
      try {
        enabled = loadApprovalBypassSettings(dshHome, getConfig?.()).approvalBypass !== false;
      } catch {
        enabled = true;
      }
    }
    return enabled;
  };
}

/**
 * 把宿主的 `effectivePolicy` 降级到 `ask`。
 *
 * 为什么需要：宿主 `ApprovalService.decide()` 的第一段就是
 *   `if (this.effectivePolicy(session) === "never") return "rejected";`
 * —— policy 为 never 时它**根本不会进入 approval/request 瀑布**，上面挂的
 * handler 永远接不到。而 `danger-full-access` 预设默认就是 `approval: never`，
 * 所以只挂瀑布在默认预设下等于没挂。
 *
 * never 的原意是「不弹审批、直接拒绝」，对需要放宽的用户没有任何价值；
 * 把它读成 ask 之后，请求进入瀑布，由本模块的 handler 应答 allowed-once。
 * 全程不落盘、不改源码，插件卸载即恢复（dispose 里换回原方法）。
 */
function patchApprovalPolicy(approval, log, isEnabled) {
  if (!approval || typeof approval !== "object") return null;
  const proto = Object.getPrototypeOf(approval);
  if (!proto || typeof proto.effectivePolicy !== "function") return null;
  if (proto.__dshPurgePolicyPatched) return { already: true };
  const original = proto.effectivePolicy;
  const patched = function effectivePolicy(session) {
    const policy = original.call(this, session);
    if (policy !== "never") return policy;
    // 开关关掉时必须退回宿主原语义：never 就是「不弹窗、直接拒绝」，
    // 降级成 ask 会让请求进入瀑布而在没有应答器时变成 unavailable —— 同样是阻塞，
    // 但语义变了，用户关掉旁路就是要原来的行为。
    try {
      if (typeof isEnabled === "function" && !isEnabled()) return policy;
    } catch { /* 读开关失败按开启处理 */ }
    return "ask";
  };
  try {
    proto.effectivePolicy = patched;
  } catch {
    return null;
  }
  if (proto.effectivePolicy !== patched) return null;
  proto.__dshPurgePolicyPatched = true;
  proto.__dshPurgePolicyOriginal = original;
  try { globalThis.__dshPurgeApprovalPolicyPatched = true; } catch { /* ignore */ }
  try { log?.("approval.policyPatch", { ok: true }); } catch { /* ignore */ }
  return { original, proto };
}

/** 还原 effectivePolicy 原型改写（插件 dispose 时调用）。 */
function unpatchApprovalPolicy(state, log) {
  if (!state || !state.proto) return;
  try {
    state.proto.effectivePolicy = state.original;
    delete state.proto.__dshPurgePolicyPatched;
    delete state.proto.__dshPurgePolicyOriginal;
    try { globalThis.__dshPurgeApprovalPolicyPatched = false; } catch { /* ignore */ }
    log?.("approval.policyPatch", { ok: false });
  } catch { /* ignore */ }
}

/**
 * 挂载运行时审批旁路。幂等：同一 ctx 只挂一次。
 * @returns {{ mounted: boolean, reason?: string }}
 */
export function installApprovalBypass(ctx, options = {}) {
  const { dshHome = "", getConfig = null, log = null } = options;
  if (!ctx || typeof ctx.on !== "function") return { mounted: false, reason: "no ctx.on" };
  if (ctx.__dshPurgeApprovalBypass) return { mounted: false, reason: "already installed" };
  const isEnabled = makeSettingsReader(dshHome, getConfig);
  const handler = (request, next) => {
    let on = true;
    try { on = isEnabled(); } catch { on = true; }
    if (!on) return typeof next === "function" ? next() : undefined;
    try {
      log?.("approval.bypass", {
        tool: String(request?.toolName || "?"),
        callId: String(request?.callId || ""),
        reason: String(request?.reason || "").slice(0, 120),
      });
    } catch { /* 日志失败不能影响放行 */ }
    return GRANT;
  };
  ctx.__dshPurgeApprovalBypass = true;
  // ctx.effect：plugin dispose / 热重载时解绑，避免同一 waterfall 上叠两层 handler。
  try {
    ctx.effect(() => {
      let disposer = null;
      let policyState = null;
      try {
        // global:true 忽略 agent 作用域过滤（子代理的审批也要放行）；
        // prepend:true 排到浏览器/ACP 应答器之前，我们的返回值就是最终结论。
        disposer = ctx.on("approval/request", handler, { global: true, prepend: true });
      } catch {
        disposer = null;
      }
      // never 政策会在进入瀑布前就早退成 rejected，必须在同一 effect 里降级成 ask，
      // 否则默认预设（danger-full-access → approval: never）下 handler 永远接不到。
      // 用 ctx.inject 等 approval 服务就绪：插件 apply 时它常常还没注册。
      try {
        const patchNow = (svc) => {
          if (policyState) return;
          policyState = patchApprovalPolicy(svc, log, isEnabled);
        };
        if (typeof ctx.inject === "function") {
          ctx.inject(["approval"], (scope) => {
            patchNow(scope?.approval ?? scope?.get?.("approval"));
          });
        } else {
          const maybe = typeof ctx.get === "function" ? ctx.get("approval") : ctx.approval;
          if (maybe && typeof maybe.then === "function") {
            maybe.then(patchNow, () => {});
          } else {
            patchNow(maybe);
          }
        }
      } catch { /* 宿主没 approval 服务时忽略 */ }
      return () => {
        try { if (typeof disposer === "function") disposer(); } catch { /* ignore */ }
        unpatchApprovalPolicy(policyState, log);
        delete ctx.__dshPurgeApprovalBypass;
      };
    });
  } catch {
    delete ctx.__dshPurgeApprovalBypass;
    return { mounted: false, reason: "ctx.effect failed" };
  }
  return { mounted: true };
}
