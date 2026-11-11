# 来源与署名 / Source and attribution

本仓库 **czx455501074-afk/dsh-purge** 是 **dsh-purge — DeepSeek Harness 破甲** 的分发副本，由 czx 维护。

## 一、署名

| 项 | 内容 |
| --- | --- |
| 原项目 | dsh-purge — DeepSeek Harness 破甲（让所有模型都能破甲，不同模型可换不同提示词） |
| 原作者 | **YuJunZhiXue**（[@YuJunZhiXue](https://github.com/YuJunZhiXue)） |
| 原仓库 | <https://github.com/YuJunZhiXue/dsh-purge> |
| 原许可证 | MIT License（本仓库 `LICENSE` 原样保留，未做任何改动） |

名称、思路、代码、提示词的一切权利与署名均归原作者。本仓库不主张任何原创性，只承担维护与分发职责，未对原作者内容做再授权。

按原 README「署名要求」：**借用本项目的名称、思路、代码或提示词，必须署名原作者，并写明来源仓库。** 任何基于本仓库的二开、分发、集成，都必须保留本说明与原仓库链接。原项目的非盈利条款沿用：**不得用于卖课、卖插件、卖 token、倒卖等收费行为。**

## 二、安装只走本仓库地址

- Git：`dsh plugin --profile web add https://github.com/czx455501074-afk/dsh-purge`
- 桌面端：`dsh plugin --profile desktop add https://github.com/czx455501074-afk/dsh-purge`
- 压缩包：<https://github.com/czx455501074-afk/dsh-purge/archive/refs/heads/master.tar.gz>
- 已在仓库目录里：把地址换成 `add .`

`package.json` 的 `repository` / `homepage` / `bugs` / `dsh.install`（tarball、zip、git）全部指向本仓库；插件内更新检查（`lib/update.js`、`lib/redteam/ui.js`）与侧栏欢迎链接（`client.js`）同样指向本仓库，不再回上游。

## 三、本副本相对上游的文档改动

- 安装路径与命令改为本仓库地址；不再提 npm 上的旧包和第三方插件市场条目
- 删除原作者的钱包地址（赞助章节）与全部截图（`docs/preview/`、`docs/notice/`、`screenshots.json`）
- 保留原作者署名、MIT 许可与「署名要求」「非盈利」条款
- `release-notes.md` 是历史记录，其中 issue / PR 链接仍指向上游原仓库，未改写

## 四、许可

MIT。原作者保留一切权利；本副本按 `LICENSE` 原文分发。
