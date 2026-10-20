CREATE TABLE IF NOT EXISTS life_referrers (
  code text PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS life_cases (
  id text PRIMARY KEY,
  consultation_id text UNIQUE,
  referrer_code text REFERENCES life_referrers(code),
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS life_audit (
  id bigserial PRIMARY KEY,
  actor text NOT NULL,
  action text NOT NULL,
  entity_id text NOT NULL,
  stage text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS life_sessions (
  token_hash text PRIMARY KEY,
  username text NOT NULL,
  account_hash text NOT NULL,
  csrf text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS life_login_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Explicitly submitted room-search consultations, separated from minimal referral case records.
CREATE TABLE IF NOT EXISTS life_room_inquiries (
  id text PRIMARY KEY,
  profile jsonb NOT NULL,
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacting','introduced','closed')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS life_room_inquiries_created_at_idx ON life_room_inquiries(created_at DESC);
CREATE TABLE IF NOT EXISTS life_room_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
