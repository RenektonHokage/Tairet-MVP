\set ON_ERROR_STOP on

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$roles$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Minimal exact FK targets. Only their UUID identities are material to 046–049.
CREATE TABLE public.locals (
  id uuid PRIMARY KEY
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY
);

ALTER TABLE public.locals OWNER TO postgres;
ALTER TABLE public.events OWNER TO postgres;

REVOKE ALL ON TABLE public.locals FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.locals TO service_role;
GRANT SELECT ON TABLE public.events TO service_role;
