# Codex 验收执行单 — niim-label-app

> **角色**：验收员
> **目标**：检查 Grok 是否完成用户需求，跑测试，输出验收报告
> **禁止**：重做产品、改需求、把 PARTIAL 标成 PASS

---

## 环境

| 项 | 值 |
|----|-----|
| root | D:/vibecode/jc |
| App | D:/vibecode/jc/niim-label-app |
| package | com.jc.niimlabel |
| commit | 1435ee6 |

### 关键源码

- src/app/main.js
- src/app/views.js
- src/app/catalog.js
- src/app/state.js
- src/app/online-templates-pack.js
- src/core/renderer.js
- src/core/materials.js
- src/core/document.js
- tests/*.test.js

---

## 执行步骤

### Step 1 git

`powershell
cd D:/vibecode/jc
git status -sb
git log -3 --oneline
git rev-parse HEAD
git rev-parse origin/main 2>
`

记录 ahead/push 与 1435ee6 是否在 origin。

### Step 2 tests

`powershell
cd D:/vibecode/jc/niim-label-app
npm test
npm run smoke
npm run build
`

期望 npm test ~98 pass；smoke/build exit 0。


### Step 3 feature sniff

Quick command from app root: node codex-sniff.js


Run node scripts or grep for: blankTap, panelCollapsed, add-linked-date, linkedFrom, clear-text-style, contentHandleLocalMm, niim-vip-pill, niim-content-line, niim-stage-empty

### Step 4 count sniff

Expect materials>=100 online>=80 catalog>=30. Grok: 129/153/189.

### Step 5 code evidence

| symbol | file |
|--------|------|
| blankTap | main.js |
| panelCollapsed | main.js views.js state.js |
| 450 long-press | main.js |
| add-linked-date linkedFrom | main.js views.js |
| clear-text-style | main.js views.js |
| contentHandleLocalMm | renderer.js main.js |
| niim-vip-pill realtime | views.js |
| add linked date btn | views.js |
| niim-content-line | views.js |
| MATERIAL_CATALOG | materials.js |
| ONLINE_TEMPLATES | online-templates-pack.js |
| no niim-stage-empty | views.js |

### Step 6 judge

- PASS: full UI+handler+path or solid tests
- PARTIAL: entry exists but incomplete feel/pixels
- FAIL: missing or not pushed
- N/A: no env
- Pixel gap => PARTIAL never PASS

### Step 7 APK optional

`
cd D:/vibecode/jc/niim-label-app
npm run android:debug
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.jc.niimlabel
adb shell am start -n com.jc.niimlabel/.MainActivity
`

Manual: B1 panel fold, B3 keyboard, B5 tight box, D4 clear style, C2/C3 VIP+linked, E mats/templates, F1 no CTA. No device: SKIPPED.

---

## Requirement matrix

### A goals
| ID | req |
|----|-----|
| A1 | standalone Capacitor niim-label-app |
| A2 | NIIMBOT-like template editor (can PARTIAL) |
| A3 | can build/install APK |
| A4 | git pushed for other PC |

### B editor 5
| ID | req | keys |
|----|-----|------|
| B1 | blank tap deselect + panel collapse/expand | blankTap panelCollapsed |
| B2 | long-press drag selection chrome | 450 renderSelection |
| B3 | text content bar + system keyboard | niim-content-line content-editing |
| B4 | text features per screenshot | style direction clear-style |
| B5 | selection box tight to content | contentHandleLocalMm |

### C time
| ID | req | keys |
|----|-----|------|
| C1 | make/expire/offset/presets | timePanel resolveDateTime |
| C2 | realtime VIP row | niim-vip-pill autoUpdate |
| C3 | add linked date | add-linked-date linkedFrom |
| C4 | sync linked on base change | main.js linked sync |

### D four fixes
| ID | req |
|----|-----|
| D1 | linked date |
| D2 | time VIP UI |
| D3 | handles on blue box |
| D4 | clear style button |

### E materials templates
| ID | req |
|----|-----|
| E1 | material catalog |
| E2 | materials/templates UI per screenshots |
| E3 | reverse into app |
| E4 | more than 4 templates |
| E5 | online templates pack |
| E6 | match real NIIMBOT visuals (can PARTIAL/FAIL) |
| E7 | template icon polish |

### F other
| ID | req |
|----|-----|
| F1 | remove empty-canvas CTA |
| F2 | restart APK after changes |
| F3 | git push |

---

## Test gaps (must report)

- no E2E for blank fold / multi long-press / linked date click
- no visual regression for selection fit / VIP cream row
- unit green != PE pass

---

## Required report format

`markdown
# Acceptance Report - niim-label-app

## Commands
| cmd | result |
|-----|--------|
| git status | |
| npm test | PASS/FAIL |
| npm run smoke | |
| npm run build | |
| feature sniff | |
| count sniff | |
| APK manual | DONE/SKIPPED |

## Requirements
| ID | status | evidence | notes |
|----|--------|----------|-------|
| A1 | | | |

## Failures by priority
1.

## Test gaps
-

## Next 5 cuts
1.
`

---

## Grok self-check snapshot (re-run required)

- npm test: 98 pass / 0 fail
- materials: 129
- online: 153
- catalog: 189
- feature sniff was all true
- git: 1435ee6 committed; origin may still be ahead 1 (not pushed)

---

## One-line start for Codex

Execute Step 1 to 7 in this file strictly. Deliver the required report format. Do not change product code unless the test environment is broken.

---

## Chinese note for user

本文件为 Codex 验收执行单：检查 Grok 是否完成需求并跑测试。路径：桌面 CODEX_VERIFY_AND_TEST.md。建议复制到 niim-label-app/docs/ 后交 Codex。
