# Acceptance Report - niim-label-app

Date: 2026-08-09 13:50 +08:00

App: `com.jc.niimlabel` on `emulator-5554`

Release commit: `91546865f0d46fe7ee24dd0807be2ffd79503fcc` (`9154686`)

Remote: `origin/main` is at the same commit after push.

## Commands

| cmd | result |
|-----|--------|
| git | **PASS** `main...origin/main` is clean with no ahead/behind; release commit `9154686` is pushed. Unrelated parent-worktree changes were preserved and excluded. |
| npm test | **PASS** `118/118`, `0` failures. |
| node --check | **PASS** `src/app/main.js`, `src/app/views.js`, `src/core/renderer.js`, `src/core/document.js`, `src/core/borders.js`, `src/core/date-links.js`, and `src/core/text-style.js`. |
| git diff --check | **PASS** for the staged release changes. |
| npm run smoke | **PASS** template/print `14/14` and editor/data `12/12` (`26/26`). |
| build | **PASS** `npm run build` produced `dist/`. |
| sniff | **PASS** all feature booleans true; `materials=129`, `online=153`, `catalogTemplates=189`. |
| horizontal drag | **PASS** temporary document check returned `{"before":2,"after":10,"dx":8,"pass":true}`. |
| APK | **PASS** `npm run android:debug`, install, force-stop, and launch completed. Current process PID `27238`; APK timestamp `2026-08-09 13:39:58`. |
| browser manual | **PASS** `18/18` isolated checks with no page/console errors: blank-panel cycle, first/second tap, long press/drag, tight blue handles, clear style, clear-content persistence, linked date/no VIP, border/shape/table. Screenshots are under `output/playwright/ux/` (local QA artifact, intentionally not committed). |

## Requirements

| ID | status | evidence | notes |
|----|--------|----------|-------|
| R01 | PASS | Material/template catalog tests and sniff counts `129/153/189`; online template import/build paths pass. | Functional catalog and online coverage is verified; source-APK pixel parity was not measured. |
| R02 | PASS | Smoke `12/12` plus browser blank tap cycle: selected element -> add panel -> fold -> expand; first tap selects and second tap opens the content bar/system keyboard. | Editor entry remains idle without initial selection chrome. |
| R03 | PASS | Sniff `noEmptyCta=true`; `views.js` contains no `niim-stage-empty`. | Obsolete empty-canvas CTA is removed. |
| R04 | PASS | Current Debug APK built, installed, force-stopped, and relaunched as `com.jc.niimlabel/.MainActivity`; PID `27238`. | Emulator verification only. |
| R05 | PARTIAL | Long press (`450 ms`), drag, selection frame/handles, panel transitions, and horizontal movement passed the functional checks. | Full visual-fidelity PASS requires a reproducible reference screenshot/video pixel diff, which is not available in the repository. |
| R06 | PASS | Date-link tests cover primary/companion synchronization, offsets, realtime/format fields, and unlink cleanup; browser check found no VIP marker/pill. | Legacy imported `vip` metadata/selectors remain only for compatibility and are not rendered. |
| R07 | PARTIAL | `clear-text-style` resets typography defaults; browser selection chrome and handle hit checks pass. | Exact blue-box/handle pixel parity still lacks a reference-image regression fixture. |
| R08 | PASS | Release commit `91546865f0d46fe7ee24dd0807be2ffd79503fcc` is present on `origin/main`. | Other computers can pull the pushed `main` branch. |
| R09 | PASS | Horizontal drag check returned `dx=8 > 4`; browser long press moved the element by about `7.72 mm`. | Left/right movement remains available with snap and clamp. |
| R10 | PASS | Border/table/shape unit coverage passes for the 20-entry catalog; browser verified picker, shape controls, and editable `3x2` table (six cells). | Narrow-screen border grid remains usable. |
| R11 | PASS | `clear-content` persists an empty string immediately; renderer draws display-only `双击编辑` placeholder instead of an empty box. | Placeholder is excluded from the content input value. |
| R12 | PASS | This report and `TODAY_DIALOG_AND_CODEX_ACCEPTANCE.md` are committed; the source dialog record contains all `72` messages including 2026-08-08. | Required acceptance evidence is recorded above. |

## Failures

1. **R05/R07 PARTIAL:** functional behavior is green, but pixel-level parity cannot be proven without stable reference screenshots/video.

## Test Gaps

- No physical Android device or real NIIM printer run; BLE/print evidence is emulator and browser-adapter based.
- No repository fixture for selection-box/handle visual regression against the original app.
- Legacy optional UI-audit scripts still expect the retired H1 `标签工坊`; required smoke checks use the current `精臣标签` UI.

## Next 5 cuts

1. Add stable reference screenshots/video and automate selection-box/handle pixel comparison.
2. Repeat gesture and print checks on a physical Android device and a real NIIM printer.
3. Update legacy UI-audit scripts to assert `精臣标签`.
4. Remove legacy VIP compatibility metadata/CSS only if a source-level purge is required.
5. Add an executable horizontal-drag check script instead of the temporary one-liner.
