# Changelog

## 0.4.8 · 2026-11-26

### New

- Recover a leaderboard account on another installation with one-time recovery codes, including missing daily totals.
- View every device signed in to a leaderboard account and revoke devices that are no longer used.

### Improved

- Keep leaderboard activity, profile changes and background refreshes consistent during fast navigation.
- Refresh the visible leaderboard automatically after periodic statistics syncs.
- Make account recovery, invitation capacity, avatar cleanup and update-cache cleanup more reliable.

### Security

- Bound server-side rate limiting and reduce unnecessary authentication writes.
- Validate uploaded WebP containers, dimensions and animation flags before publishing avatars.
- Preserve historical invitation usage during database upgrades instead of reopening consumed capacity.

## 0.4.7 · 2026-11-21

### New

- Paginated leaderboard with load-more button and accurate rank display.
- Member activity history: view any member's 30-day keyboard and mouse activity through an interactive chart.
- Privacy control: opt-in to share your activity history with other community members (default off).
- Self entry remains visible and pinned regardless of your actual rank position.

### Improved

- Leaderboard gracefully degrades when the server has not been updated yet, hiding unavailable features.
- Leaderboard cache now stores the complete ranked list with deterministic tie-breaking.

## 0.4.6 · 2026-11-17

### Improved

- Present the independently maintained app as ClickPulse Social throughout the interface and platform metadata.
- Use a compact two-line brand lockup in the sidebar and remove the repeated footer name.
- Keep a visible update action in the full window after an automatic check finds a new version.

### Fixed

- Store statistics, preferences, caches, process locks, and login startup entries separately from upstream ClickPulse.
- Copy existing ClickPulse Social history and preferences once into the new private data folder without changing the original files.
- Migrate only startup entries that launch this installation, leaving an upstream ClickPulse installation untouched.

## 0.4.5 · 2026-11-17

### New

- Create a local daily card with a distinctive input fingerprint for today or any recorded date.
- Customize cards with five themes, three aspect ratios, content controls, website QR code, branding, and privacy mode.
- Save a high-resolution PNG or copy the finished card directly to the system clipboard.

### Improved

- Recover Simplified Chinese update notes from the installed changelog when an older updater could not preserve the localized field.
- Wait for the saved interface language before showing an update-complete notice, and relocalize an open notice when the language changes.
- Keep card statistics local and validate image format, dimensions, payload size, and filename before native export.

## 0.4.4 · 2026-11-17

### New

- Add a pink theme across the full and Mini interfaces.
- Show the complete Windows and Linux keyboard heatmap, including navigation keys and the numeric keypad.

### Improved

- Use a clear switch for launch at login.
- Refresh leaderboard results without positional movement.
- Show Simplified Chinese release notes when the app uses Simplified Chinese.
- Keep the extended keyboard aligned and readable at narrower window sizes.

## 0.4.3 · 2026-11-17

### Improved

- Show available updates directly in Mini, with options to update now or defer the reminder for three days.
- Let demo users explore all leaderboard roles without changing a real profile or contacting the service.

### Fixed

- Populate and refresh leaderboard role menus when their options or availability change.
- Show uploaded leaderboard avatars without retaining the fallback initial underneath.

## 0.4.2 · 2026-11-16

### Improved

- Switch and refresh leaderboard periods with smoother transitions.
- Edit leaderboard nicknames directly from the profile card.
- Complete an in-app update from one click, including download, verification, installation, and restart.
- Repair incomplete portable folders from the authenticated update payload instead of sending users to a ZIP download.
- Fall back to the trusted GitHub Release when the domestic update metadata service is unavailable.
- Show an in-app summary of changes after a successful update.

## 0.4.1 · 2026-11-16

### New

- Download verified application updates directly from the domestic ClickPulse service.
- Manage readable, grouped leaderboard invitation codes from a password-protected mobile-friendly web page.

### Improved

- Use polished in-app confirmation dialogs for joining and leaving the leaderboard.
- Release an invitation slot when a member leaves, allowing a valid code to be used again.
- Clarify invitation capacity and status in the redesigned administration console.

### Security

- Keep update package checksums and source provenance verification in the desktop updater.
- Store only invitation-code hashes and a memory-hard administrator password hash on the server.

## 0.4.0 · 2026-11-16

### New

- Join an opt-in community leaderboard with an invitation code and nickname.
- Upload only daily keyboard and mouse totals; the app stays offline by default.
- See today and this-week rankings with default or custom avatars.
- Leave the leaderboard or delete your profile at any time.

## 0.3.2 · 2026-11-15

### Changed

- Check for updates from the ClickPulse-Social repository.

## 0.3.1 · 2026-11-14

### Improved

- Download updates automatically; install and restart only when you confirm.
- Keep WinGet installations current through `winget upgrade --id endNone.ClickPulse --exact`.

### Fixed

- Keep Windows launch-at-login working through WinGet upgrades.
- Repair missing startup paths when opening ClickPulse, without enabling disabled startup.
- Explain when the current app location requires a manual update.
- Keep data controls available while updates download in the background.
- Refresh downloaded updates when their release files change.

## 0.3.0 · 2026-11-12

### New

- Track keyboard and mouse activity on Ubuntu 22.04 and 24.04.

### Improved

- Read consistent navigation labels, icons and Settings controls across platforms.
- Use a cleaner Linux window without the extra title bar.
- Keep Scoop installations current with `scoop update clickpulse`.
- Reduce background refreshes and disk activity.

### Fixed

- Open Mini with inactive Sport effects hidden from the first frame.
- See a clear, consistent checkmark when remembering your close preference.
- Switch between Mini and full view without carrying over text selection.
- Count physical Caps Lock presses correctly on macOS.

## 0.2.1 · 2026-11-11

### New

- Find updates in Settings, or automatically each day; daily checks can be disabled.
- Choose when to install with **Update & restart**.

### Improved

- Read larger Settings controls and translated system time zones.
- Enjoy smoother Sport previews.
- Keep your history and preferences when updating.

### Fixed

- Browse long histories without slow calendar loading.
- Download Windows updates successfully.
- Receive each new-version reminder once.

> Upgrading from 0.2.0 or earlier? Download 0.2.1 manually once; later updates install inside the app.

## 0.2.0 · 2026-11-05

### New

- Turn typing and clicking into Sport effects, with ranks from C to SS.
- Explore your last 24 hours and compare 14-, 30- or 90-day trends.
- Use eight languages and choose your preferred time zone.
- Move your data anywhere or merge history from another computer, with automatic backups.

### Improved

- Keep recording smoothly while importing or browsing long histories.
- Copy live counts as they continue updating.
- Reach Settings sections faster with clearer controls and shortcuts.

### Fixed

- Import history reliably without opening the same database twice.
- Keep dropdown choices and scroll position during refreshes.

CSV export has been removed; history imports and backups remain available.

## 0.1.0 — Preview · 2026-10-10

### New

- Track keyboard and mouse activity locally, with complete daily history.
- Discover patterns through trends, calendars, keyboard heatmaps and treemaps.
- Keep live counts nearby with a floating, pinnable Mini window.
- Personalize your view with four themes and English or Simplified Chinese.
- Continue recording in the background and start automatically when you log in.

### Improved

- Reach window controls while scrolling.
- See the complete Windows keyboard at smaller window sizes.
- Keep history when updating or removing the app.

### Fixed

- Open the dashboard on macOS 12.
- Count special Windows keys correctly without repeated held-key counts.
- Switch between Mini and the full window without misplaced borders.
- Recover preferences when a saved settings file cannot be read.
