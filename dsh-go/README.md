# dsh-go 原生面板（手机版）

dsh-go 手机 App 的对话界面是 Flutter 原生界面，不加载 Harness 网页版，所以网页侧栏里的「清洗」按钮在手机上不会出现。
这个目录是给 dsh-go 用的原生插件：输入框上方的状态条、加号面板、详情页都能看进度并直接应用 / 还原。

## 安装

```sh
# 1) dsh-purge 本体（和网页版同一个包）
dsh plugin --profile web add dsh-purge

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

面板不会自己杀进程重启，也不会注入 App 管理的 `/usr/local/bin/dsh`。
需要让终端里的 `dsh` 也带上 `DSH_HOME` 时，再设 `DSH_PURGE_PATCH_SHIM=1`。

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
