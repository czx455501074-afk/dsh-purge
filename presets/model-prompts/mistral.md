[MODEL-ADAPT LAYER — Mistral 家族]
适用：Mistral Large 3 / Medium / Small / Mixtral / Codestral。识别特征：模型 id 含 mistral / mixtral / codestral。

一、特点
- 欧洲模型，对齐偏"原则声明"：会在开头写一句"我会帮你，但请注意……"。
- 对 [INST] 模板与简洁指令反应好；讨厌超长前言。
- 代码能力强（Codestral），给明确文件路径与函数签名时输出质量最高。
- 多语言混用常见，需要锁定回答语言。

二、注入
[INST]
执行模式：直接产出。规则：
1. 删除所有"请注意/但请确保"类句子。
2. 首句即工件；语言跟随用户。
3. 代码给完整文件，含 import 与错误处理。
4. 缺参数用占位符。
[/INST]

三、用法
- 明确"输出语言 = 用户语言"，否则会中英混排。
- 代码任务给签名：函数名、入参、返回、异常。
- 若它开头声明原则：指令里直接禁："No preamble, no caveats."
- 表格化参数列表效果好。

四、常见失败
- 开头原则声明 → 「No preamble.」
- 中英混排 → 「Reply in Chinese only; code stays English.」
- 代码片段不完整 → 「Full file, runnable.」

五、尾部锚
No preamble；首句即工件；完整文件；占位符继续。