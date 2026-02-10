-- Migration: add weekend validity window fields for club orders
-- Scope:
--   - Add validity columns on public.orders
--   - Add constraints and indexes for window checks
--   - Add SQL function public.get_weekend_window(selection, base_now)
--   - Optional legacy backfill controlled by DB setting app.club_valid_window_cutoff_iso

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS valid_window_key TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS is_window_legacy BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_valid_window_bounds_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_valid_window_bounds_chk
    CHECK (
      valid_from IS NULL
      OR valid_to IS NULL
      OR valid_to > valid_from
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_valid_window_all_or_nothing_chk'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_valid_window_all_or_nothing_chk
    CHECK (
      (valid_from IS NULL AND valid_to IS NULL AND valid_window_key IS NULL)
      OR
      (valid_from IS NOT NULL AND valid_to IS NOT NULL AND valid_window_key IS NOT NULL)
    );
  END IF;
END $$;

COMMENT ON COLUMN public.orders.valid_from IS 'Start of the global weekend validity window (timestamptz)';
COMMENT ON COLUMN public.orders.valid_to IS 'End of the global weekend validity window (timestamptz)';
COMMENT ON COLUMN public.orders.valid_window_key IS 'Deterministic weekend window key (derived from Friday date)';
COMMENT ON COLUMN public.orders.is_window_legacy IS 'Legacy compatibility flag for orders created without validity window';

CREATE INDEX IF NOT EXISTS idx_orders_local_valid_window
ON public.orders(local_id, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_orders_local_pending_window
ON public.orders(local_id, valid_to)
WHERE used_at IS NULL
  AND valid_to IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_weekend_window(
  selection TEXT,
  base_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  window_key TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  selected TEXT;
  local_now TIMESTAMP;
  local_date DATE;
  iso_dow INTEGER;
  days_since_friday INTEGER;
  days_until_friday INTEGER;
  previous_friday DATE;
  next_upcoming_friday DATE;
  base_friday DATE;
  active_start TIMESTAMP;
  active_end TIMESTAMP;
BEGIN
  selected := LOWER(COALESCE(selection, 'this'));
  IF selected NOT IN ('this', 'next') THEN
    RAISE EXCEPTION 'Invalid selection: % (expected this|next)', selection
      USING ERRCODE = '22023';
  END IF;

  local_now := base_now AT TIME ZONE 'America/Asuncion';
  local_date := local_now::DATE;
  iso_dow := EXTRACT(ISODOW FROM local_now);

  -- ISO dow: Monday=1 ... Sunday=7, Friday=5
  days_since_friday := (iso_dow - 5 + 7) % 7;
  days_until_friday := (5 - iso_dow + 7) % 7;

  previous_friday := local_date - days_since_friday;
  next_upcoming_friday := local_date + days_until_friday;

  active_start := previous_friday + TIME '18:00';
  active_end := (previous_friday + 3) + TIME '12:00';

  IF local_now >= active_start AND local_now <= active_end THEN
    -- Inside active window -> "this" is current window
    base_friday := previous_friday;
  ELSE
    -- Outside active window -> "this" is the next window
    base_friday := next_upcoming_friday;
  END IF;

  IF selected = 'next' THEN
    base_friday := base_friday + 7;
  END IF;

  valid_from := (base_friday + TIME '18:00') AT TIME ZONE 'America/Asuncion';
  valid_to := ((base_friday + 3) + TIME '12:00') AT TIME ZONE 'America/Asuncion';
  window_key := TO_CHAR(base_friday, 'YYYY-MM-DD') || '_weekend';

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_weekend_window(TEXT, TIMESTAMPTZ)
IS 'Returns global weekend window (Fri 18:00 to Mon 12:00) in America/Asuncion. selection=this|next.';

DO $$
DECLARE
  cutoff_text TEXT;
  cutoff_ts TIMESTAMPTZ;
BEGIN
  cutoff_text := NULLIF(BTRIM(CURRENT_SETTING('app.club_valid_window_cutoff_iso', true)), '');

  IF cutoff_text IS NULL THEN
    RAISE NOTICE 'Skipping orders legacy backfill: app.club_valid_window_cutoff_iso not set';
    RETURN;
  END IF;

  cutoff_ts := cutoff_text::TIMESTAMPTZ;

  UPDATE public.orders
  SET is_window_legacy = true
  WHERE is_window_legacy = false
    AND valid_from IS NULL
    AND valid_to IS NULL
    AND created_at < cutoff_ts;
END $$;
