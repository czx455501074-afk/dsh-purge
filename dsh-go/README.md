# dsh-go 原生面板（手机版）

dsh-go 手机 App 的对话界面是 Flutter 原生界面，不加载 Harness 网页版，所以网页侧栏里的「清洗」按钮在手机上不会出现。
这个目录是给 dsh-go 用的原生插件：输入框上方的状态条、加号面板、详情页都能看进度并直接应用 / 还原。

## 安装

```sh
# 1) dsh-purge 本体（和网页版同一个包）
dsh plugin --profile web add https://github.com/czx455501074-afk/dsh-purge

# 2) 原生面板：复制到 dsh-go 的插件目录再装
P="${DSH_HOME:-$HOME/.dsh}/dsh-go/plugins/dsh-go-purge"
mkdir -p "$(dirname "$P")"
cp -r <本仓库>/dsh-go "$P"
dsh plugin --profile web add "$P"
```

装上即生效，不用重启。之后在 App 里：

- 输入框上方出现 **清洗 x/y** 状态条，点开是「破甲清洗」面板；
- 输入框「+」面板里多了 **应用清洗** / **还原**；
- 详情页 / 全部功能里能直接打开「破甲清洗」。

## 应用之后

补丁写进的是磁盘上的 `@deepseek-ai`，当前引擎进程要先重启才会加载新代码：
到 App 的 **设置 → 引擎 → 重启引擎**（或直接重开 App）。

面板不会自己杀进程重启。

## 补丁在手机上的坑：每次启动会被还原

App 启动引擎时会先用自带运行时还原 `/opt/dsh`，所以 `--apply` 写进去的补丁到下次启动就没了（面板状态会回到全 pending）。装一个启动钩子解决：

```sh
dsh-purge --boot-hook-install
```

它在启动器 `/usr/local/bin/dsh` 的 `node` 后面加了一个 `--import=$DSH_HOME/dsh-purge-boot.mjs`，位置在官方的 boot-cache 之前。每次引擎启动时，钩子先重打补丁、再让 DSH 加载模块，所以**同一轮启动就是补丁后的宿主**（约 2 秒开销）。

- 日志：`$DSH_HOME/dsh-purge/boot-hook.log`（每次启动一行 applied / failed / ms）；
- App 升级运行时会重写启动器，升级后重新执行一次 `--boot-hook-install`；
- 移除：`dsh-purge --boot-hook-remove`（从 `.dshpurge.bak` 逐字节还原启动器）；
- 临时跳过：`DSH_PURGE_BOOT_HOOK=0 dsh web ...`；
- 状态：`dsh-purge --boot-hook-status`。

面板不会注入 App 管理的启动器其他内容；需要终端里的 `dsh` 也带 `DSH_HOME` 时，仍可设 `DSH_PURGE_PATCH_SHIM=1`。

## 卸载

```sh
dsh plugin --profile web remove local-dsh-purge
rm -rf "${DSH_HOME:-$HOME/.dsh}/dsh-go/plugins/dsh-go-purge"
```

先还原再卸载：面板 → 还原，或 `dsh-purge --revert`。

## 开发自查

```sh
node "${DSH_HOME:-$HOME/.dsh}/skills/dsh-go-plugin/kit/bin/check.mjs" dsh-go --load
```

改了 `lib/` 里的代码后，要在 App 的「引擎」页重启引擎才生效。
