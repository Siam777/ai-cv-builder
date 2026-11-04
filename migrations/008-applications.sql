-- Application tracker (career roadmap step 2, phase A). Job capture columns
-- (employment_type to switch_to) are created now so later phases need no
-- second migration. Do not use semicolons inside comments: npm run db:setup
-- splits statements on them.
CREATE TABLE IF NOT EXISTS applications (
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  company TEXT NOT NULL CHECK(length(company) BETWEEN 1 AND 200),
  role TEXT NOT NULL CHECK(length(role) BETWEEN 1 AND 200),
  job_url TEXT, location TEXT, source TEXT,
  stage TEXT NOT NULL CHECK(stage IN ('saved','applied','assessment','interview','offer','accepted','rejected','withdrawn')),
  stage_changed_at TEXT NOT NULL, applied_at TEXT,
  next_action_at TEXT, next_action TEXT,
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 5000),
  job_post TEXT CHECK(job_post IS NULL OR length(job_post) <= 30000),
  contacts TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(contacts) AND json_type(contacts) = 'array'),
  resume_id TEXT,
  request_hash TEXT NOT NULL,
  employment_type TEXT, salary_text TEXT, deadline_at TEXT,
  requirements TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(requirements) AND json_type(requirements) = 'array'),
  captured_via TEXT NOT NULL DEFAULT 'manual' CHECK(captured_via IN ('manual','paste','bookmarklet','extension','suggested')),
  referral_contact_id TEXT,
  switch_from TEXT, switch_to TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, id));
CREATE INDEX IF NOT EXISTS applications_owner_stage ON applications(owner_id, stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS applications_owner_due ON applications(owner_id, next_action_at);

CREATE TABLE IF NOT EXISTS application_events (
  owner_id TEXT NOT NULL, application_id TEXT NOT NULL, id TEXT NOT NULL,
  at TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('created','stage','sent')),
  from_stage TEXT, to_stage TEXT,
  submission_id TEXT,
  CHECK((kind = 'sent') = (submission_id IS NOT NULL)),
  PRIMARY KEY(owner_id, id),
  FOREIGN KEY(owner_id, application_id) REFERENCES applications(owner_id, id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS application_events_application ON application_events(owner_id, application_id, at);

CREATE TABLE IF NOT EXISTS application_documents (
  owner_id TEXT NOT NULL, application_id TEXT NOT NULL, id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('cv','cover_letter')),
  name TEXT NOT NULL, source_resume_id TEXT, source_revision INTEGER,
  export_snapshot_id TEXT,
  content TEXT NOT NULL CHECK(json_valid(content)),
  sha256 TEXT NOT NULL, created_at TEXT NOT NULL,
  request_id TEXT NOT NULL, request_hash TEXT NOT NULL,
  PRIMARY KEY(owner_id, id),
  UNIQUE(owner_id, application_id, request_id),
  FOREIGN KEY(owner_id, application_id) REFERENCES applications(owner_id, id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS application_submissions (
  owner_id TEXT NOT NULL, application_id TEXT NOT NULL, id TEXT NOT NULL,
  sent_at TEXT NOT NULL, stage_at_send TEXT NOT NULL,
  cv_document_id TEXT NOT NULL, letter_document_id TEXT,
  request_id TEXT NOT NULL, request_hash TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, id),
  UNIQUE(owner_id, application_id, request_id),
  FOREIGN KEY(owner_id, application_id) REFERENCES applications(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY(owner_id, cv_document_id) REFERENCES application_documents(owner_id, id),
  FOREIGN KEY(owner_id, letter_document_id) REFERENCES application_documents(owner_id, id));

CREATE TABLE IF NOT EXISTS export_snapshots (
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('cv','cover_letter')),
  format TEXT NOT NULL, source_resume_id TEXT, source_revision INTEGER,
  content TEXT NOT NULL CHECK(json_valid(content)), sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, claimed_at TEXT,
  PRIMARY KEY(owner_id, id));
CREATE INDEX IF NOT EXISTS export_snapshots_expiry ON export_snapshots(expires_at);
CREATE INDEX IF NOT EXISTS export_snapshots_owner_unclaimed ON export_snapshots(owner_id, claimed_at, created_at);
