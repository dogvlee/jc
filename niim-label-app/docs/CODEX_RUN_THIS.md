# Codex 启动（可改产品代码）

## 文件

- 主文件：`D:/vibecode/jc/niim-label-app/docs/TODAY_DIALOG_AND_CODEX_ACCEPTANCE.md`
  （含昨天 2026-08-08 + 今天 + 更早对话 + 验收步骤）
- 昨天单独：`D:/vibecode/jc/niim-label-app/docs/昨天对话_2026-08-08.md`
- 桌面同名副本也可用

## 启动句（复制给 Codex）

```
仓库：D:/vibecode/jc/niim-label-app
包名：com.jc.niimlabel

先读：
docs/TODAY_DIALOG_AND_CODEX_ACCEPTANCE.md
（含昨天 2026-08-08 原文与 R01-R12）

你的任务：
1. 按第三节 Step1-6 验收（git / npm test / sniff / 横向拖 / APK / 手测）
2. 对照第二节用户原文 + 第四节 R01-R12 打分 PASS/PARTIAL/FAIL
3. **可以改产品代码**：对 FAIL/PARTIAL 给出最小修复并落地，再重跑测试直到相关项变绿
4. 修完后写验收报告到 docs/CODEX_ACCEPTANCE_REPORT.md（第五节格式）
5. 改动说明写清：改了哪些文件、为什么、如何验证

规则：
- 优先满足用户原文意图，不要擅自砍需求
- 最小改动，别无关重构
- 每修完一轮必须 npm test（目标全绿）
- 手测做不到写 SKIPPED + 原因
- 不要 force-push，不要改 git 身份配置
```

## 更短版

```
读 docs/TODAY_DIALOG_AND_CODEX_ACCEPTANCE.md。先验收 R01-R12，对 FAIL/PARTIAL 可以改产品代码修掉，再重测。报告写 docs/CODEX_ACCEPTANCE_REPORT.md。仓库 D:/vibecode/jc/niim-label-app
```
