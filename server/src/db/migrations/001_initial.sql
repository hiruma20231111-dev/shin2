-- ============================================================
-- Hub Workspace — Initial Database Migration
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  name          text        NOT NULL,
  role          text        NOT NULL DEFAULT 'operator'
                            CHECK (role IN ('admin', 'operator')),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── clients ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text        NOT NULL,
  industry      text        NOT NULL,
  status        text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive', 'paused')),
  tags          text[]      NOT NULL DEFAULT '{}',
  contact_email text,
  contact_phone text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── client_dna ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_dna (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category   text        NOT NULL,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── project_templates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_templates (
  id          text        PRIMARY KEY,
  name        text        NOT NULL,
  industry    text        NOT NULL DEFAULT '汎用',
  description text        NOT NULL DEFAULT '',
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── projects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'planning'
              CHECK (status IN ('planning', 'active', 'review', 'completed', 'cancelled')),
  template_id text,
  start_date  date,
  end_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── tasks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'todo'
                            CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority      text        NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_tool text,
  start_date    date,
  due_date      date,
  order_index   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── task_dependencies ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_dependencies (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id             uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE (task_id, depends_on_task_id)
);

-- ── tools ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tools (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier        text        NOT NULL UNIQUE,
  name              text        NOT NULL,
  description       text        NOT NULL DEFAULT '',
  endpoint_url      text        NOT NULL,
  health_endpoint   text        NOT NULL,
  capabilities      jsonb       NOT NULL DEFAULT '{}',
  status            text        NOT NULL DEFAULT 'offline'
                                CHECK (status IN ('online', 'offline', 'degraded')),
  last_health_check timestamptz,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── tool_context_packets ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_context_packets (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tool_identifier text        NOT NULL,
  schema_version  text        NOT NULL,
  direction       text        NOT NULL CHECK (direction IN ('sent', 'received')),
  payload         jsonb       NOT NULL,
  result          jsonb,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sent', 'received', 'error')),
  error_code      text,
  error_message   text,
  sent_at         timestamptz,
  received_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── activity_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES users(id),
  client_id   uuid        REFERENCES clients(id) ON DELETE SET NULL,
  project_id  uuid        REFERENCES projects(id) ON DELETE SET NULL,
  task_id     uuid        REFERENCES tasks(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   uuid        NOT NULL,
  changes     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── template_tasks ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_tasks (
  id              uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     text    NOT NULL REFERENCES project_templates(id) ON DELETE CASCADE,
  title           text    NOT NULL,
  tool_identifier text,
  priority        text    NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  duration_days   integer NOT NULL DEFAULT 1,
  order_index     integer NOT NULL DEFAULT 0
);

-- ── invoices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           uuid          NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id          uuid          REFERENCES projects(id) ON DELETE SET NULL,
  title               text          NOT NULL,
  amount              numeric(12,2) NOT NULL,
  tax_rate            numeric(5,2)  NOT NULL DEFAULT 10.00,
  status              text          NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date          date          NOT NULL,
  due_date            date          NOT NULL,
  paid_date           date,
  notes               text,
  external_invoice_id text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

-- ── workflows ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  status      text        NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── workflow_steps ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id     uuid        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  task_id         uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_order      integer     NOT NULL,
  tool_identifier text,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'error')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── refresh_tokens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_status       ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_industry     ON clients(industry);

CREATE INDEX IF NOT EXISTS idx_projects_client_id   ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id     ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_tool  ON tasks(assigned_tool);

CREATE INDEX IF NOT EXISTS idx_task_deps_task_id         ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on      ON task_dependencies(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_tcp_task_id          ON tool_context_packets(task_id);
CREATE INDEX IF NOT EXISTS idx_tcp_tool_identifier  ON tool_context_packets(tool_identifier);

CREATE INDEX IF NOT EXISTS idx_activity_client_id   ON activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_project_id  ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id     ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at  ON activity_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id   ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON invoices(status);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'clients', 'client_dna', 'projects', 'tasks',
    'tools', 'project_templates', 'invoices', 'workflows'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END;
$$;
