# UI/UX Accessibility Fixes — Carry Over to Auftragstaktik

These fixes were applied to Sandkasten to support GenX/Boomer users with potential vision issues. Since Auftragstaktik shares the same map renderer, styling system, and Tailwind/CSS variable patterns, these same fixes should be applied there.

---

## 1. Font Size Minimum: 12px (was 10px)

**Problem:** ~45 instances of `text-[10px]` across the app, plus one `text-[9px]` and several `text-[11px]`. Users with presbyopia (age-related farsightedness) cannot read 10px monospace text, especially on high-DPI displays.

**Fix applied:**
- All `text-[10px]` → `text-xs` (12px) — badges, timestamps, labels, data grids, button text
- All `text-[9px]` → `text-xs` (12px) — MessageLog timestamp was the worst offender
- All `text-[11px]` → `text-sm` (14px) — MessageLog body, DetailPanel data

**What to search for in Auftragstaktik:**
```
grep -rn "text-\[1[01]px\]\|text-\[9px\]" src/
```
Replace the same way. The notification badges inside tab bars (the `w-5 h-5 rounded-full` circle spans) can stay at `text-[10px]` since they're just single-digit numbers.

**Components likely affected in Auftragstaktik (shared patterns):**
- ContactList, MessageLog, CombatLog (if present)
- OrderPanel, DetailPanel
- Any data grids with coordinates, timestamps, or sensor specs
- Editor toolbar buttons

---

## 2. Color Contrast Fix: `--color-tactical-text-dim`

**Problem:** The dim text color `#6b6b80` fails WCAG AA contrast ratio (4.5:1 minimum for normal text) on both dark and light theme backgrounds. This color is used extensively for timestamps, labels, inactive tabs, section headers, and status text.

**Fix applied in `globals.css`:**
```css
/* Dark theme: was #6b6b80 (4:1 ratio), now passes 4.5:1 */
--color-tactical-text-dim: #8e8ea2;

/* Light theme: was #6b6b80 (barely passed), now solid 6:1+ */
--color-tactical-text-dim: #52526a;
```

**What to do in Auftragstaktik:**
If you share the same CSS variables (likely, given the shared design language), just update the two `--color-tactical-text-dim` values in your `globals.css`. All components using this variable get the fix automatically.

---

## 3. Button Target Sizes

**Problem:** Several buttons had `py-0.5` padding, making them ~20-24px tall — well below the 44px WCAG AAA recommendation. Difficult to click for users with reduced dexterity.

**Fix applied:** Increased padding on the OllamaStatus toggle from `px-2 py-0.5` to `px-3 py-1`. This is Sandkasten-specific (InfoWar module), but Auftragstaktik should audit for the same pattern.

**What to search for:**
```
grep -rn "py-0\.5" src/components/
```
Bump any interactive elements (buttons, clickable items) to at least `py-1` (8px vertical padding = ~32px total height).

---

## 4. Color-Only Indicators

**Problem:** Status indicators (connected/disconnected) were 8px colored dots with no text label. Color-blind users or users with poor color perception cannot determine status.

**Fix applied:** Enlarged the OllamaStatus dot from `w-2 h-2` (8px) to `w-3 h-3` (12px), and ensured a text label always accompanies it ("Ollama (model)" / "Disconnected" / "Disabled").

**What to check in Auftragstaktik:** Any status indicators (connection status, data feed status, server health) should have both a color AND a text label. Search for small indicator dots:
```
grep -rn "w-2 h-2\|w-1.5 h-1.5" src/
```

---

## 5. ARIA Labels (Still Missing — Future Work)

**Not yet fixed** but flagged: The entire codebase has zero `aria-label`, `aria-selected`, or `role` attributes. This affects:
- Sidebar tab buttons (no `role="tab"` or `aria-selected`)
- Close buttons using `[X]` symbol (no `aria-label`)
- Play/pause buttons (no state description)
- Map interaction elements

Both apps should get an ARIA pass eventually. The most impactful additions:
- `aria-label` on icon-only buttons (`[X]` close, play/pause)
- `role="tab"` + `aria-selected` on sidebar tab buttons
- `aria-live="polite"` on notification areas (unread counts, status messages)

---

## Summary of Files Changed in Sandkasten

| File | Changes |
|------|---------|
| `globals.css` | Bumped `--color-tactical-text-dim` for both themes |
| `CombatLog.tsx` | `text-[10px]` → `text-xs` |
| `ContactList.tsx` | `text-[10px]` → `text-xs` (3 instances) |
| `MessageLog.tsx` | `text-[9px]` → `text-xs`, `text-[10px]` → `text-xs`, `text-[11px]` → `text-sm` |
| `OrderPanel.tsx` | `text-[10px]` → `text-xs` (5 instances) |
| `DetailPanel.tsx` | `text-[10px]` → `text-xs` (4), `text-[11px]` → `text-sm` (1) |
| `OllamaStatus.tsx` | All `text-[10px]` → `text-xs`, dot enlarged, button padded, aria-label added |
| `EditorToolbar.tsx` | `text-[10px]` → `text-xs` |
| `editor/page.tsx` | `text-[10px]` → `text-xs` (3 instances) |
| All InfoWar channel cards | `text-[10px]` → `text-xs` throughout |
