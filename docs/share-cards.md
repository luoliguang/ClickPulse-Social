# Daily share cards

ClickPulse daily cards turn one day of local input statistics into a shareable image. The feature is local-first: statistics stay in the desktop process, the WebView creates an SVG and rasterizes it in memory, and only the finished PNG crosses the native IPC boundary for saving or copying.

## Architecture

The implementation has four boundaries:

1. `ShareCardData` is created by `ClickPulseShare.build` in `ui/share.js`. Templates never read the page DOM, database, or desktop preferences directly.
2. Versioned share preferences are owned by `ShareCardPreferences` in `src/presentation.rs` and persist through the existing view-preference file.
3. `ClickPulseShare.render` combines data, preferences, localized copy, and theme tokens into one self-contained SVG. The on-screen preview and PNG export use this exact SVG.
4. `src/desktop/share.rs` accepts only bounded, valid PNG data. It opens the native save dialog or copies decoded RGBA pixels to the system clipboard.

The resulting flow is:

```text
Snapshot -> ShareCardData -> template + theme + preferences -> SVG
                                                            -> preview
                                                            -> PNG -> save / clipboard
```

## Current data contract

The first template consumes:

- ISO local date;
- keyboard, mouse, and total counts;
- a 24-hour activity signal when the selected date is today;
- peak interval when measured hourly data exists;
- consecutive active-day count.

The regular snapshot contains measured hourly buckets only for the trailing current-day view. Historical rows contain daily keyboard and mouse totals. To avoid presenting invented hourly activity as fact, a historical card uses a deterministic abstract signature derived from its date and real daily total; it has no peak-hour value. A future per-day hourly query can replace that signal without changing the template or export layers.

## Preference contract

`ShareCardPreferences` is serialized with a `version` field. Version 1 contains:

- `template`: currently `fingerprint`;
- `theme`: one of the five application themes;
- `ratio`: `portrait`, `square`, or `story`;
- keyboard, mouse, peak-time, QR, and branding visibility;
- privacy mode.

Unknown native preference fields are rejected at the IPC boundary. The frontend normalizes unsupported theme and ratio values to safe defaults. Future migrations should happen in `ShareCardPreferences::normalize` while preserving the versioned wire format.

Branding and the QR code are deliberately independent. The version 1 QR target is the ClickPulse website and is embedded as a static, tested SVG path. Future targets belong in a target registry; templates should receive a rendered QR fragment and must not decide where it links.

## Template and theme extension points

`render` is the version 1 fingerprint template. When a second layout is added, move template functions under a template registry keyed by `settings.template`; keep `build`, theme tokens, and PNG export shared. A template must:

- accept only normalized card data, settings, localized copy, and theme tokens;
- return a self-contained SVG;
- escape all dynamic text;
- support all declared ratios or explicitly declare its supported ratios;
- never perform I/O or read global UI state.

Themes are token maps, not layout variants. Adding a theme should require colors only: background, ink, accent, secondary, muted, and paper.

## Privacy and safety

- No statistics are uploaded.
- Exported PNGs contain rendered pixels only; no paths, database identifiers, profile data, or EXIF metadata are added.
- Privacy mode hides exact keyboard, mouse, total, and peak-time values while retaining the visual signature and date.
- The native decoder rejects empty, oversized, non-PNG, and excessive-dimension payloads before file or clipboard access.
- Save filenames are reduced to a bounded ASCII basename and the user chooses the final location in the native dialog.

## Testing

`tests/share.test.cjs` covers data normalization, measured-versus-historical signals, stable historical signatures, all rendering controls, dimensions, and SVG escaping. Rust tests cover filename sanitation and malformed image rejection. UI rendering tests verify that the page and controls remain connected to the application shell.

For visual regression, use fixed data for a day with a strong peak, a zero day, a long translated date, privacy mode, no QR, and each aspect ratio. The same fixtures should be retained when new templates are added.
