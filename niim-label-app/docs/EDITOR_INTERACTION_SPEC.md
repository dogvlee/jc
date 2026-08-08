# Editor interaction spec (from domestic app video)

Source: `b93b0ce8c77484385d2f8f4e1a71feae.mp4` (~70s, 1284×2778, 29.74fps)

## Scenes observed

| t | Scene |
|---|--------|
| 0–5s | Control center noise / home exit |
| ~5s | Idle editor: 添加元素 · 模板 · 数据源, label with「双击编辑」, no selection chrome |
| ~10s | Selected + **float bar** + Style tab |
| ~15–25s | Style: B/U active, reverse red fill, fontSize 22→25, snap guides while resize |
| ~30s | Float bar full (edit/delete/copy/rotate/对齐/lock) |
| ~35s | Locked: float bar shortens (edit/delete/copy only), lock icon on box |
| ~40s | Deselect → add-elements panel again |
| ~45s | Second text + **content** tab + keyboard + 完成 |
| ~50s | Style live updates (wordWrap on, lineSpacing 0.1) |
| ~55s | Font tab: categories + font list (鸿蒙 checked) |
| ~60–70s | Align/镜像 panel |

## Interaction rules (P0)

### I1 Single-select float bar
- When exactly 1 element selected and **not** in content keyboard mode:
  - Black pill above selection: **编辑 · 删除 · 复制 · 旋转 · 对齐 · 锁定**
  - Caret points down toward element
- When **locked**: only **编辑 · 删除 · 复制** (no rotate / 对齐 / lock; unlock via panel or long-press if added later)
- When multi-select: compact/loose bubble instead
- When content editing (键盘): **hide** float bar

### I2 Content edit mode
- Double-tap text **or** float「编辑」→ tab=内容, focus input, system keyboard
- Bar: single-line input · clear × · **完成**
- Footer 保存/打印 **hidden** while content mode for text/barcode/qr/date
- **完成** → leave content mode, tab=样式, keyboard dismisses
- Typing must **not** remount the input (soft update canvas only)

### I3 Style live
- B/U/S/I, color, size slider, align, letter/line spacing, wordWrap
- Size slider updates canvas every frame; readout under thumb
- **Reverse / 反白**: star color dots set reverse fill = color, text white

### I4 Snap guides while move/resize
- Blue dashed crosshair on snap
- mm scale labels along axes (like original)
- Guides clear on pointer up

### I5 Selection chrome
- Solid blue rect
- Mid-right + mid-bottom blue dots
- SE rotate (white disc + curved arrow)

### I6 Panel tabs
- Selected text: 内容 | 样式 | 字体 | 对齐/镜像
- Idle: 添加元素 | 模板 | 数据源
- Active tab red + underline

## Implementation status

| ID | Status |
|----|--------|
| I1 float bar | done (black pill; locked shortens) |
| I2 content soft input | done (softUpdate, no remount) |
| I3 reverse + live size | done (★ color dots = 反白; slider live) |
| I4 snap labels | done (blue dashed + mm ticks) |
| I5 handles | done |
| I6 tabs | done (layout) |
| Font store VIP | skip (placeholder list ok) |
| Float bar follows element | done |
| Tab underline slide anim | done |
| Panel body enter anim + tab patch | done |
| Hide float while dragging | done |
| Haptics | P1 |
| Barcode style (format/style/size/color) | done (video2) |
| QR color + dual-color tip | done (video2) |
| Serial 数值 panel | done (video2) |
| Element page2 icons | done (video2) |
| Shape panel (kind/dash/width/color) | done (video2) |
| Advanced QR empty sheet | done (video2) |
| Real camera scan | stub only |
| 3-mode: add / selected / content | done |
| Content-keyboard only text/barcode/qr | done (P0 multi-agent) |
| softCommit style (no full remount) | done |
| Live content clear × | done |
| Fixed selected panel height | done |
| visualViewport --kb-inset | done |
| Hit handles = drawn E/S/rotate only | done |
| Undo keeps selection when possible | done |
| Fixed 6-key bar (no +多选) | done |
| Blank → add mode | done |
| Content 完成 → selected+style | done |
| Select patch chrome (no full remount) | done |
| Move deadzone 0.4mm | done |
| Undo on pointerup after real drag | done |
