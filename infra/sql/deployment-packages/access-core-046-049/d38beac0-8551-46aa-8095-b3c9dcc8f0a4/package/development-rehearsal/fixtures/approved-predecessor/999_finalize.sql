\set ON_ERROR_STOP on

ALTER TABLE public.access_ticket_types OWNER TO postgres;
ALTER TABLE public.access_orders OWNER TO postgres;
ALTER TABLE public.access_order_items OWNER TO postgres;
ALTER TABLE public.access_entries OWNER TO postgres;
ALTER TABLE public.payment_attempts OWNER TO postgres;

REVOKE ALL ON TABLE public.access_ticket_types
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.access_orders
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.access_order_items
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.access_entries
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.payment_attempts
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.access_ticket_types TO service_role;
GRANT SELECT ON TABLE public.access_orders TO service_role;
GRANT SELECT ON TABLE public.access_order_items TO service_role;
GRANT SELECT ON TABLE public.access_entries TO service_role;
GRANT SELECT ON TABLE public.payment_attempts TO service_role;

ALTER FUNCTION public.create_access_paid_checkout(
  text, uuid, uuid, date, jsonb, jsonb, text, text, integer
) OWNER TO postgres;
ALTER FUNCTION public.get_access_checkin_window_status(date, timestamptz)
  OWNER TO postgres;
ALTER FUNCTION public.check_in_access_entry_by_token(uuid, uuid, uuid)
  OWNER TO postgres;

SET check_function_bodies = true;
