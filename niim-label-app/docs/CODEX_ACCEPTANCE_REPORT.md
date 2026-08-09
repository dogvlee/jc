# Acceptance Report - niim-label-app

- Date: 2026-08-09 (Asia/Shanghai)
- Acceptance source: `docs/TODAY_DIALOG_AND_CODEX_ACCEPTANCE.md`
- Product commit: `d11515f8903763760e932760a3d255988efcf76c`
- Result: **R01–R12 all PASS within the reproducible acceptance scope stated below.**

## Commands

| cmd | result |
|-----|--------|
| `git rev-parse HEAD`; `git rev-parse origin/main`; `git rev-list --left-right --count HEAD...origin/main` | Product commit pushed; `d11515f8903763760e932760a3d255988efcf76c`; `d11515f8903763760e932760a3d255988efcf76c`; `0 0`. The report commit is pushed and the same sync command is rechecked after this report is committed. |
| `npm run verify` | `Built dist/`; `147/147` tests PASS, `0` fail; exit `0`. |
| `node --check` on `src/app/main.js`, `views.js`, `state.js`, `renderer.js`, `document.js`, `geometry.js`, `materials.js`, `niim-template-import.js`, `text-direction.js`, `image-cache.js`, `editor-gesture.js`, `borders.js` | All 12 files exit `0`. |
| `npm run smoke` | Template-to-print `14/14`; editor/data `12/12`; exit `0`. |
| `node codex-sniff.js` | `blankTap/panelToggle/longPress450/linked/clearStyle/fitHandle/contentBar/noEmptyCta/noVipUi=true`; `materials=144`, `online=153`, `catalogTemplates=189`, `borders=20`, table=`3x2/6/0.4`; exit `0`. |
| `node scripts/codex-horizontal-drag-check.js` | `{"before":2,"after":10,"dx":8,"beforeLeft":10,"afterLeft":4,"leftDx":-6,"pass":true}`; exit `0`. |
| `python scripts/fetch-original-materials.py --check` | All 15 reference-visible original material assets pass magic, dimensions and SHA-256 checks; exit `0`. |
| `node scripts/repair-online-template-assets.js` twice | Both runs: `templates=153`, `images=180`, `removed=0`, `unresolved=0`, `bytes=374038`; identical SHA-256 `55F3AAD0354D0606AA14BD2AE41CF9B29B1B20AC797EB3B9AEFDE9BDAD6CDDB6`; exit `0`. |
| Chromium Playwright, `412x915` | 6 direction modes; popover `x=16,width=380` and does not overflow; arc `81°` persists and visibly curves; console `0` errors / `0` warnings. |
| `npm run android:debug`; `adb install -r`; force-stop; `am start -W` | Build and install PASS; `Status: ok`, `LaunchState: COLD`, app PID `6054`, `topResumedActivity=com.jc.niimlabel/.MainActivity`; exit `0`. APK is `35,451,337` bytes, SHA-256 `0976D44AB13C22602E4E9C16276AAB79EAE58A5C1863AEE7EF31EC8B8676B964`. |
| isolated `git apply` + `artifacts/codex-final-20260809/rollback.ps1` | Patch preflight/apply `0`; rollback `ROLLBACK_APPLIED=true`; final diff exit `0`, remaining paths `0`. |

## Requirements

| ID | status | evidence | notes |
|----|--------|----------|-------|
| R01 | PASS | The 15 materials visible in the supplied original screenshot are bundled in exact order as real PNG/JPEG assets and pass format/dimension/SHA checks. Runtime catalog=`144`; online templates=`153` with `180` valid bundled image paths and `unresolved=0`; default template pool is deduplicated from `378` to `189`. Browser evidence shows all first 15 cards load as real images, persist their asset paths and render on canvas. | PASS is scoped to the 15 original materials visible in the supplied reference plus the currently captured 153 online templates; this does not claim a mirror of every item in the upstream remote catalog. The invalid duplicated image layer in `online-482306420` is removed rather than replaced by its sibling. |
| R02 | PASS | Sniff reports `blankTap`, `panelToggle` and `contentBar=true`; browser sequence passes selected element → blank/add panel → collapsed panel → expanded panel → content editor. Android IME test reports native inset `336px`; panel bottom `579.047≈915.047-336`. | Tabs, input and `完成` remain above the system keyboard even when Capacitor WebView does not shrink `visualViewport`. |
| R03 | PASS | `noEmptyCta=true`; runtime source has no `niim-stage-empty`; initial editor contains only the blank canvas and add-element panel. | Old empty-canvas CTA removed. |
| R04 | PASS | Final APK builds, installs over the app, force-stops to an empty PID, then cold-starts with `Status: ok`; actual PID `6054` and foreground Activity are correct. APK bundle verification finds the current app core and all 15 original material entries. | APK path and hash are recorded under Commands and in the artifact verification record. |
| R05 | PASS | Six original text-direction modes and arc `0–180°` are implemented. Tests verify native X/Y flow and CJK/Latin rotations for all six modes; browser verifies 6 controls, no overflow and real arc at `81°`. A hold on the sole selected element retains the ordinary six-button toolbar; only holding a different second element enters multi-select. | Direction semantics were checked against the bundled original SVGs. Arc slider edits create one undo step. |
| R06 | PASS | Date-link tests cover primary/companion synchronization, offsets, format, live fields, orphan normalization and unlinking from either side. Sniff reports `linked=true` and `noVipUi=true`; browser/material tests find no VIP chip, badge or gate. | Non-rendered historical source metadata is not a UI label or entitlement gate. |
| R07 | PASS | Clear-style tests restore font/style defaults and use `changeTextMode(..., 'horizontal')` to restore geometry. Content-fit selection is promoted to real geometry on first handle movement: a visible E handle dragged `+3mm` follows the pointer; rotations `37/90/143°` preserve visible coordinates; undo restores the old box. | Temporary `_fit` is non-enumerable and is absent from serialized documents. |
| R08 | PASS | Product commit `d11515f8903763760e932760a3d255988efcf76c` and this report are committed and pushed to `origin/main`; final `HEAD` and `origin/main` are equal and ahead/behind is `0/0`. | Only `niim-label-app` delivery files are committed; unrelated parent-repository working changes remain untouched. |
| R09 | PASS | Horizontal drag script returns right `dx=8`, left `leftDx=-6`, `pass=true`; the browser pointer probe also moved `+8mm` and `-6mm` through the production snap/clamp path. | Left/right drag works on a new 50×30 label. |
| R10 | PASS | Tests cover 20 borders across 8 category chips, five shapes, and table defaults `3x2`, six editable cells, line width `0.4`; sniff confirms the same catalog/defaults. | Border, shape and table entry/render/edit paths pass. |
| R11 | PASS | Clearing text persists `text=''`; renderer shows a display-only `双击编辑` placeholder while the content input remains empty. Renderer regression passes. | Placeholder never writes back into user data. |
| R12 | PASS | This report is rewritten from the final product state. The source document contains continuous `U001–U072` (`72` total; `29/6/4/26/7` by day). Its 2026-08-08 section exactly matches `docs/DIALOG_YESTERDAY_2026-08-08.md` (`Y001–Y026`). | The report, original-dialog source and yesterday document are tracked. |

## Failures

1. None.

## Next 5 cuts

1. Add a versioned offline synchronization pipeline and integrity manifest for the complete remote material catalog.
2. Commit approved original screenshots as golden fixtures and automate pixel diffs for materials, text-direction UI and selection chrome.
3. Promote blank-panel cycling, long-hold selection, handle dragging and undo/redo combinations into continuously run Playwright gesture tests.
4. Repeat keyboard, BLE direction and sustained-print tests on representative physical Android devices and real printers.
5. Add CI gates for material SHA checks, online-template determinism, APK bundle contents and the isolated rollback probe.
