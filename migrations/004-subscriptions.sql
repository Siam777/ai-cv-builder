CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE REFERENCES user(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_customer ON subscriptions(stripe_customer_id);

CREATE TABLE IF NOT EXISTS subscription_usage (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL,
  tailored_resumes_generated INTEGER DEFAULT 0,
  ai_bullet_rewrites INTEGER DEFAULT 0,
  UNIQUE(user_id, period_month)
);
