BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.reservations
  ADD COLUMN cancel_reason text,
  ADD CONSTRAINT reservations_cancel_reason_valid CHECK (
    cancel_reason IS NULL OR (
      status = 'cancelled'
      AND char_length(cancel_reason) BETWEEN 1 AND 160
      -- Match the API's String.trim(), including tabs and Unicode whitespace.
      AND cancel_reason = btrim(cancel_reason,
        U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
    )
  );

-- The private API owns reservation reads and writes (migration 022).
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.reservations', 'cancel_reason', 'SELECT, INSERT, UPDATE')
     OR has_column_privilege('authenticated', 'public.reservations', 'cancel_reason', 'SELECT, INSERT, UPDATE') THEN
    RAISE EXCEPTION 'Migration 051 requires the reservations Data API boundary from migration 022';
  END IF;
END $$;
COMMIT;
