# Theme Support — Progress

Dark / Light / System theme + refresh white-flash fix.

- **Spec:** `docs/superpowers/specs/2026-06-27-theme-support-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-27-theme-support.md`

## Approach (locked)
Semantic Tailwind v4 `@theme` neutral tokens (dark = defaults, `.light` overrides);
`.dark`/`.light` class on `<html>`. Inline `<head>` script paints resolved canvas
before first paint (flash fix). `ThemeProvider`/`useTheme` in `src/theme.ts` mirrors
`LanguageProvider`. Cycling icon button (☀️→🌙→🖥️) in the header. Default = System.

## Tasks — ALL COMPLETE ✅
- [x] 1. Semantic token foundation in `src/index.css`
- [x] 2. Pure helpers `resolveTheme`/`nextTheme` + tests (`src/theme.ts`, `src/theme.test.ts`)
- [x] 3. `ThemeProvider`/`useTheme` + wire into `src/main.tsx`
- [x] 4. Inline pre-paint script in `index.html`
- [x] 5. i18n theme strings (en/ru)
- [x] 6. `ThemeToggle` + header + migrate `App.tsx`
- [x] 7. Migrate `Scoreboard.tsx` + `ScoreModal.tsx`
- [x] 8. Migrate `PlayerSetup`, `ColorPicker`, `ExpansionPicker`, `RoomPanel`, `UpdatePrompt`
- [x] 9. Accent spot-fixes + visual verify both themes + `CLAUDE.md` docs

## Verified (browser, localhost:5173)
- Dark scoreboard/setup unchanged vs original; light scoreboard, score modal
  (bg-field tabs/segments + emerald button), menu dropdown, setup + color picker
  + expansion toggles all read correctly in light.
- System mode resolves to OS preference; toggle cycles ☀️→🌙→🖥️; `.light` token
  overrides apply (no cascade/specificity issue).
- Inline head script sets `<html>` class + bg + theme-color meta before paint
  (flash fix). Gate green: `npm run build` + `npm run test:run` (34 tests).

## Notes
- Skip `QrScanModal.tsx` (camera surface stays literal black + white text).
- Keep literal: emerald/red action buttons `text-white`; switch knobs & QR container `bg-white`.
- If `.light` overrides don't apply (layer precedence), bump to `:root.light`.
