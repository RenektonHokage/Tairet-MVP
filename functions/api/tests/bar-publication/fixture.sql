-- Synthetic relational fixture. Loaded only into a new disposable PostgreSQL container.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE panel_users (
  id uuid PRIMARY KEY, auth_user_id uuid UNIQUE, email text, local_id uuid REFERENCES locals(id), role text
);
CREATE TABLE local_daily_ops (local_id uuid REFERENCES locals(id), day date, is_open boolean);
ALTER TABLE promos ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE promos ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), venue_id uuid REFERENCES locals(id),
  venue_type text, display_name text, rating integer, title text, comment text, created_at timestamptz DEFAULT now(),
  fingerprint text, ip_hash text, user_agent text
);
CREATE TABLE ticket_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), local_id uuid REFERENCES locals(id), name text,
  price bigint, description text, is_active boolean DEFAULT true, sort_order integer DEFAULT 0
);
CREATE TABLE table_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), local_id uuid REFERENCES locals(id), name text,
  price bigint, capacity integer, includes text[], is_active boolean DEFAULT true, sort_order integer DEFAULT 0
);
-- Read-only catalog shape used by the unchanged public endpoint. No Access workflows run here.
CREATE TABLE access_ticket_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), source_type text, local_id uuid REFERENCES locals(id),
  name text, description text, price_gs bigint, currency text, payment_kind text,
  entries_per_unit integer DEFAULT 1, sort_order integer DEFAULT 0, active boolean DEFAULT true
);
INSERT INTO locals(id, name, slug, type) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Bar Sintético Nuevo', 'b01-nuevo', 'bar'),
  ('10000000-0000-4000-8000-000000000002', 'Demo oculto B01', 'mckharthys-bar', 'bar'),
  ('10000000-0000-4000-8000-000000000003', 'Bar sin datos', 'b01-vacio', 'bar'),
  ('10000000-0000-4000-8000-000000000004', 'Club sintético', 'morgan', 'club');
INSERT INTO panel_users VALUES
  ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','owner@example.invalid','10000000-0000-4000-8000-000000000001','owner'),
  ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','staff@example.invalid','10000000-0000-4000-8000-000000000001','staff');
INSERT INTO reviews(venue_id,venue_type,display_name,rating,comment) VALUES
  ('10000000-0000-4000-8000-000000000001','bar','Visitante sintético',4,'Reseña visible tras publicar'),
  ('10000000-0000-4000-8000-000000000002','bar','Visitante demo',1,'Reseña que debe permanecer oculta'),
  ('10000000-0000-4000-8000-000000000004','club','Visitante club',5,'Reseña club preservada');
INSERT INTO promos(id,local_id,title,description) VALUES
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Promo de Prueba','Descripción sintética desde B2B');
INSERT INTO promos(local_id,title,is_active) VALUES
  ('10000000-0000-4000-8000-000000000001','Promoción inactiva',false);
INSERT INTO promos(local_id,title,end_date) VALUES
  ('10000000-0000-4000-8000-000000000001','Promoción vencida','2000-01-01');
INSERT INTO ticket_types(local_id,name,price) VALUES
  ('10000000-0000-4000-8000-000000000004','Entrada sintética club',50000);
INSERT INTO table_types(local_id,name,price,capacity,includes) VALUES
  ('10000000-0000-4000-8000-000000000004','Mesa sintética club',150000,4,ARRAY['Servicio sintético']);
INSERT INTO access_ticket_types(source_type,local_id,name,price_gs,currency,payment_kind) VALUES
  ('local','10000000-0000-4000-8000-000000000004','Entrada Access sintética',60000,'PYG','paid');
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
