# Opt-in leaderboard

The community leaderboard is separate from local recording. ClickPulse remains offline for activity data until a user explicitly joins with an invitation code and nickname.

## Data boundary

When joined, the client may upload only:

- the member's chosen nickname and optional processed avatar;
- the Shanghai calendar date;
- absolute daily keyboard and mouse totals;
- the membership token needed to authenticate the request.

The client does not upload typed text, specific key identities, application names, pointer positions, minute-level events, the local SQLite database, or historical lifetime totals. Avatars are cropped locally, re-encoded as WebP without source metadata, and bounded to 200 KiB before upload.

The first release offers a Shanghai-calendar today ranking and Monday-through-Sunday week ranking. It does not offer a lifetime ranking, so imported history cannot create a permanent advantage. Absolute daily values make retries idempotent; the service rejects decreasing totals and implausibly large daily values.

Membership credentials are generated randomly. The server stores only their SHA-256 hashes. Invitation codes are also stored only as hashes and can expire, have limited active-member capacity, or be revoked. Joining occupies one slot; leaving releases that slot so a still-valid invitation can be used again. The maintainer creates and manages them through the password-protected `/admin` page; plaintext codes are returned only once at creation. A member can remove their avatar or leave the leaderboard; leaving deletes the member, daily totals, and avatar from the service.

## Service boundary

The API runs independently at `clickpulse.fangdutex.cn` with a dedicated PostgreSQL database, process, port, deployment directory, and private avatar directory. It does not share the pinyin application's database or files. See [`server/README.md`](../server/README.md) for deployment details.

Server-side rate limits and anomaly bounds discourage accidental or casual abuse. Administrator login uses a memory-hard password hash, a short-lived secure cookie, same-origin checks, and rate limiting. A desktop client ultimately controls the numbers it reports, so this is a community feature rather than a cheat-proof competition.
