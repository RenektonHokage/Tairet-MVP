-- Minimal isolated B02 fixture; no Events, payment, ticket or Access tables.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE panel_users (
  id uuid PRIMARY KEY, auth_user_id uuid UNIQUE, email text,
  local_id uuid REFERENCES locals(id), role text
);
CREATE TABLE local_daily_ops (local_id uuid REFERENCES locals(id), day date, is_open boolean NOT NULL, PRIMARY KEY(local_id, day));
ALTER TABLE promos ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE promos ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
INSERT INTO locals(id,name,slug,type) VALUES
  ('10000000-0000-4000-8000-000000000001','Bar sintético B02','b01-nuevo','bar'),
  ('10000000-0000-4000-8000-000000000002','Demo oculto B02','mckharthys-bar','bar'),
  ('10000000-0000-4000-8000-000000000004','Club sintético','morgan','club');
INSERT INTO panel_users VALUES
  ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','owner@example.invalid','10000000-0000-4000-8000-000000000001','owner');
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
