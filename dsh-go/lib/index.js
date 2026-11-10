// dsh-purge 的 dsh-go 手机原生面板。
// 运行在引擎（Node）里；App 只画 package.json 的 dshGo 清单和这里返回的视图。
// 实际清洗逻辑复用 dsh-purge 包的 lib/core.js，避免两套补丁表。
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const name = 'local-dsh-purge'

const PANEL_ID = 'purge'
const PLUGIN_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function dshHome() {
  const home = String(process.env.DSH_HOME || '').trim()
  return home || path.join(os.homedir(), '.dsh')
}

/** 找 dsh-purge 包根：环境变量 → 各 profile 的 node_modules → 本插件旁边 → dsh-go/plugins。 */
function purgeRoots() {
  const home = dshHome()
  const roots = []
  const env = String(process.env.DSH_PURGE_ROOT || '').trim()
  if (env) roots.push(env)
  try {
    for (const name of fs.readdirSync(path.join(home, 'profiles'))) {
      roots.push(path.join(home, 'profiles', name, 'node_modules', 'dsh-purge'))
    }
  } catch { /* 没有 profiles */ }
  // 仓库 / 解压目录布局：插件在 dsh-purge/dsh-go/ 下。
  roots.push(path.resolve(PLUGIN_DIR, '..'))
  roots.push(path.resolve(PLUGIN_DIR, '..', 'dsh-purge'))
  roots.push(path.join(home, 'dsh-go', 'plugins', 'dsh-purge'))
  roots.push(path.join(home, 'plugins', 'dsh-purge'))
  return roots
}

let corePromise = null
let patchNames = new Map()

async function loadCore() {
  if (corePromise) return corePromise
  corePromise = (async () => {
    for (const root of purgeRoots()) {
      const entry = path.join(root, 'lib', 'core.js')
      if (!fs.existsSync(entry)) continue
      const core = await import(pathToFileURL(entry).href)
      try {
        patchNames = new Map((core.ALL_PATCHES || []).map((p) => [String(p.id), p.name || '']))
      } catch { /* 老版本没有 ALL_PATCHES 也不挡主流程 */ }
      return core
    }
    throw new Error('没有找到 dsh-purge 包（先 dsh plugin --profile web add dsh-purge）')
  })()
  try {
    return await corePromise
  } catch (err) {
    corePromise = null
    throw err
  }
}

let cache = { at: 0, state: null }

async function readState(force = false) {
  if (!force && cache.state && Date.now() - cache.at < 60_000) return cache.state
  const core = await loadCore()
  const state = await core.gatherState()
  cache = { at: Date.now(), state }
  return state
}

/** 面板数据：一次推完整对象，App 自己算差量。 */
function summarize(state) {
  const status = state?.patch_status || {}
  const values = Object.values(status)
  const applied = values.filter((v) => v === 'applied').length
  // 只统计「该做且还没做」的补丁：na / missing_file / skipped 不参与分母，
  // 否则进度永远到不了 100。
  const pending = values.filter((v) => v === 'pending').length
  const total = applied + pending
  const todo = []
  for (const [id, st] of Object.entries(status)) {
    if (st !== 'pending') continue
    todo.push({ title: '#' + id + ' ' + (patchNames.get(String(id)) || ''), subtitle: '待清洗' })
  }
  return {
    applied,
    total,
    percent: total > 0 ? Math.round((applied / total) * 100) : 0,
    pending: todo.slice(0, 10),
    pendingCount: todo.length,
    host: state?.ai_base || '未定位',
    home: state?.dsh_home || dshHome(),
    note: state?.ai_base
      ? '应用后到 App「引擎」页重启引擎才生效'
      : '没找到 @deepseek-ai。先装 dsh-purge，再回来点应用',
  }
}

async function runApply() {
  const core = await loadCore()
  const state = await core.gatherState()
  if (!state.ai_base) throw new Error('没找到宿主 @deepseek-ai')
  const { report } = await core.applyPatchesAllHosts(core.ALL_PATCHES, { forApply: true })
  const applied = report.filter((r) => r.status === 'applied').length
  const failed = report.filter((r) => r.status === 'pattern_not_found' || r.status === 'read_error')
  cache = { at: 0, state: null }
  if (failed.length > 0) return { applied, failed: failed.length }
  return { applied, failed: 0 }
}

async function runRevert() {
  const core = await loadCore()
  const { reverted, errors } = await core.revertAllHosts({ discover: true })
  cache = { at: 0, state: null }
  return { reverted: reverted.length, failed: errors.length }
}

function localeIsEn(caps) {
  return String(caps?.locale || '').toLowerCase().startsWith('en')
}

export function apply(ctx) {
  ctx.inject(['dshGo'], (ctx) => {
    // 状态条：清洗进度，点开面板。
    ctx.dshGo.strip('status', (scope, emit, caps) => {
      const zh = !localeIsEn(caps)
      let alive = true
      const paint = async (force) => {
        try {
          const state = await readState(force)
          if (!alive) return
          const values = Object.values(state?.patch_status || {})
          const done = values.filter((v) => v === 'applied').length
          const total = done + values.filter((v) => v === 'pending').length
          if (!state?.ai_base) {
            emit({ text: zh ? '清洗：未找到宿主' : 'Purge: no host', icon: 'warning', tone: 'bad' })
          } else if (done >= total && total > 0) {
            emit({ text: zh ? '清洗 ' + done + '/' + total : 'Purged ' + done + '/' + total, icon: 'wrench', tone: 'good' })
          } else {
            emit({ text: zh ? '清洗 ' + done + '/' + total : 'Purge ' + done + '/' + total, icon: 'wrench', tone: 'warn' })
          }
        } catch {
          if (alive) emit({ text: zh ? '清洗：插件未装' : 'Purge: not installed', icon: 'warning', tone: 'bad' })
        }
      }
      void paint(false)
      const timer = setInterval(() => void paint(true), 60_000)
      if (typeof timer.unref === 'function') timer.unref()
      return () => { alive = false; clearInterval(timer) }
    })

    // 详情面板：进度 + 待清洗清单 + 应用 / 还原。
    ctx.dshGo.panel(PANEL_ID, {
      view: () => ({
        type: 'stack',
        title: '破甲清洗',
        children: [
          { type: 'metric', label: '已清洗', value: { $: 'data.applied' } },
          { type: 'progress', value: { $: 'data.percent' }, label: '进度' },
          { type: 'callout', text: { $: 'data.note' }, tone: 'info' },
          { type: 'list', items: { $: 'data.pending' } },
          {
            type: 'actions',
            items: [
              { label: '应用清洗', action: 'apply', icon: 'check', style: 'primary' },
              { label: '还原', action: 'revert', icon: 'refresh' },
              { label: '刷新', action: 'refresh', icon: 'retry' },
            ],
          },
          { type: 'text', text: { $: 'data.host' }, tone: 'muted' },
        ],
      }),
      data: async (scope, emit, caps) => {
        const zh = !localeIsEn(caps)
        let alive = true
        const paint = async (force) => {
          try {
            const state = await readState(force)
            if (!alive) return
            emit(summarize(state))
          } catch {
            if (alive) emit({ applied: 0, total: 0, percent: 0, pending: [], pendingCount: 0, host: '—', home: '—', note: zh ? '没找到 dsh-purge 包' : 'dsh-purge package not found' })
          }
        }
        void paint(false)
        return () => { alive = false }
      },
      actions: {
        apply: () => ({
          pending: { label: '正在写入', timeoutMs: 60_000 },
          result: async () => {
            try {
              const r = await runApply()
              const state = await readState(true)
              const text = r.failed > 0
                ? '有 ' + r.failed + ' 条对不上，已写 ' + r.applied
                : '已写入 ' + r.applied + ' 条，重启引擎生效'
              return [
                { type: 'toast', text },
                { type: 'patch', id: PANEL_ID, data: summarize(state) },
              ]
            } catch (err) {
              return { type: 'toast', text: '应用失败：' + String(err?.message || err).slice(0, 24) }
            }
          },
        }),
        revert: () => ({
          pending: { label: '正在还原', timeoutMs: 60_000 },
          result: async () => {
            try {
              const r = await runRevert()
              const state = await readState(true)
              return [
                { type: 'toast', text: '已还原 ' + r.reverted + ' 个文件，重启引擎恢复' },
                { type: 'patch', id: PANEL_ID, data: summarize(state) },
              ]
            } catch (err) {
              return { type: 'toast', text: '还原失败：' + String(err?.message || err).slice(0, 24) }
            }
          },
        }),
        refresh: () => {
          void readState(true)
          return { type: 'refresh', id: PANEL_ID }
        },
      },
    })

    // 输入框「+」面板里的两个快捷动作。
    ctx.dshGo.on('apply', () => ({
      pending: { label: '正在写入', timeoutMs: 60_000 },
      result: async () => {
        try {
          const r = await runApply()
          await readState(true)
          const text = r.failed > 0
            ? '有 ' + r.failed + ' 条对不上，已写 ' + r.applied
            : '已写入 ' + r.applied + ' 条，重启引擎生效'
          return { type: 'toast', text }
        } catch (err) {
          return { type: 'toast', text: '应用失败：' + String(err?.message || err).slice(0, 24) }
        }
      },
    }))
    ctx.dshGo.on('revert', () => ({
      pending: { label: '正在还原', timeoutMs: 60_000 },
      result: async () => {
        try {
          const r = await runRevert()
          return { type: 'toast', text: '已还原 ' + r.reverted + ' 个文件，重启引擎恢复' }
        } catch (err) {
          return { type: 'toast', text: '还原失败：' + String(err?.message || err).slice(0, 24) }
        }
      },
    }))
  })
}
