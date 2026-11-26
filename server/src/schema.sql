CREATE TABLE IF NOT EXISTS leaderboard_invitations (
  id TEXT PRIMARY KEY,
  code_hash CHAR(64) UNIQUE NOT NULL,
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leaderboard_invitations ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS leaderboard_members (
  id TEXT PRIMARY KEY,
  nickname VARCHAR(96) NOT NULL,
  nickname_key VARCHAR(96) UNIQUE NOT NULL,
  token_hash CHAR(64) UNIQUE NOT NULL,
  avatar_file TEXT,
  role TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leaderboard_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'other';

ALTER TABLE leaderboard_members ADD COLUMN IF NOT EXISTS activity_visible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE leaderboard_members ADD COLUMN IF NOT EXISTS recovery_codes_hash TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS leaderboard_members_recovery_codes_idx ON leaderboard_members USING GIN (recovery_codes_hash);

-- The single token_hash on members predates multi-device support. Tokens now
-- live per-device in leaderboard_devices; keep this column nullable as a
-- legacy backfill source only.
ALTER TABLE leaderboard_members ALTER COLUMN token_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS leaderboard_devices (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES leaderboard_members(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leaderboard_devices_member_idx ON leaderboard_devices(member_id);

-- Migrate legacy single-token members into a device row (idempotent).
INSERT INTO leaderboard_devices (id, member_id, token_hash, name)
SELECT ('legacy-' || id), id, token_hash, 'Legacy device'
FROM leaderboard_members
WHERE token_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM leaderboard_devices d WHERE d.token_hash = leaderboard_members.token_hash
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='leaderboard_members' AND column_name='invitation_id'
  ) THEN
    ALTER TABLE leaderboard_members ADD COLUMN invitation_id TEXT REFERENCES leaderboard_invitations(id) ON DELETE SET NULL;
    -- Legacy members cannot be mapped back to their invitation reliably. Keep
    -- the historical usage counts rather than reopening previously consumed
    -- or exhausted invitations. New members are linked and release their slot
    -- when they leave.
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leaderboard_daily_stats (
  member_id TEXT NOT NULL REFERENCES leaderboard_members(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  keyboard BIGINT NOT NULL CHECK (keyboard >= 0 AND keyboard <= 5000000),
  mouse BIGINT NOT NULL CHECK (mouse >= 0 AND mouse <= 5000000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, day)
);

CREATE INDEX IF NOT EXISTS leaderboard_daily_stats_day_idx ON leaderboard_daily_stats(day);
