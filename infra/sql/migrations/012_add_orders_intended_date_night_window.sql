-- Migration: add intended_date and night-window SQL helpers for club orders
-- Scope:
--   - Add intended_date DATE to public.orders
--   - Add index for local/day queries
--   - Add SQL functions:
--       public.get_night_window(intended_date)
--       public.get_active_night_window(base_now)

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS intended_date DATE;

COMMENT ON COLUMN public.orders.intended_date IS 'Intended attendance date for club orders (YYYY-MM-DD, America/Asuncion context)';

CREATE INDEX IF NOT EXISTS idx_orders_local_intended_date
ON public.orders(local_id, intended_date);

CREATE OR REPLACE FUNCTION public.get_night_window(
  intended_date DATE
)
RETURNS TABLE (
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  window_key TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF intended_date IS NULL THEN
    RAISE EXCEPTION 'intended_date is required'
      USING ERRCODE = '22004';
  END IF;

  valid_from := (intended_date + TIME '18:00') AT TIME ZONE 'America/Asuncion';
  valid_to := ((intended_date + 1) + TIME '12:00') AT TIME ZONE 'America/Asuncion';
  window_key := TO_CHAR(intended_date, 'YYYY-MM-DD') || '_night';

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_night_window(DATE)
IS 'Returns night validity window (18:00 to next day 12:00) in America/Asuncion for an intended date.';

CREATE OR REPLACE FUNCTION public.get_active_night_window(
  base_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  intended_date DATE,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  window_key TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  local_date DATE;
BEGIN
  local_date := (base_now AT TIME ZONE 'America/Asuncion')::DATE;

  intended_date := local_date;

  SELECT w.valid_from, w.valid_to, w.window_key
  INTO valid_from, valid_to, window_key
  FROM public.get_night_window(local_date) AS w;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_active_night_window(TIMESTAMPTZ)
IS 'Returns active night window for the current date in America/Asuncion.';
