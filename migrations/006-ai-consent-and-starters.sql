CREATE TABLE IF NOT EXISTS ai_settings (owner_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), consented_at INTEGER, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ai_starter_cache (cache_key TEXT PRIMARY KEY, job_title TEXT NOT NULL, seniority TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), prompt_version TEXT NOT NULL, model TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ai_starter_cache_created ON ai_starter_cache(created_at);
