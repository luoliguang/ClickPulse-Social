CREATE TABLE IF NOT EXISTS leaderboard_invitations (
  id TEXT PRIMARY KEY,
  code_hash CHAR(64) UNIQUE NOT NULL,
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_members (
  id TEXT PRIMARY KEY,
  nickname VARCHAR(96) NOT NULL,
  nickname_key VARCHAR(96) UNIQUE NOT NULL,
  token_hash CHAR(64) UNIQUE NOT NULL,
  avatar_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_daily_stats (
  member_id TEXT NOT NULL REFERENCES leaderboard_members(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  keyboard BIGINT NOT NULL CHECK (keyboard >= 0 AND keyboard <= 5000000),
  mouse BIGINT NOT NULL CHECK (mouse >= 0 AND mouse <= 5000000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (member_id, day)
);

CREATE INDEX IF NOT EXISTS leaderboard_daily_stats_day_idx ON leaderboard_daily_stats(day);
