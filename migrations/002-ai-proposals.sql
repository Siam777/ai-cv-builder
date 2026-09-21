CREATE TABLE IF NOT EXISTS ai_requests (owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, id TEXT NOT NULL, resume_id TEXT NOT NULL, request_hash TEXT NOT NULL, base_revision INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('generating','review','applied','rejected','failed')), proposal TEXT, result_revision INTEGER, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(owner_id,id), FOREIGN KEY(owner_id,resume_id) REFERENCES resumes(owner_id,id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS ai_requests_created ON ai_requests(created_at);
CREATE INDEX IF NOT EXISTS ai_requests_owner_created ON ai_requests(owner_id,created_at);
CREATE TABLE IF NOT EXISTS ai_owner_usage (owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(owner_id,day));
CREATE TABLE IF NOT EXISTS ai_global_usage (day TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL);
