-- 007_money_bigint.sql
-- Objetivo: estandarizar montos monetarios a BIGINT (Gs enteros)
-- Afecta:
--  - public.ticket_types.price
--  - public.table_types.price
--  - public.orders.total_amount (si existiera aún como numeric en algún entorno)

do $$
begin
  -- ticket_types.price -> BIGINT
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ticket_types'
      and column_name = 'price'
      and data_type <> 'bigint'
  ) then
    alter table public.ticket_types
      alter column price type bigint
      using round(price)::bigint;
  end if;

  -- table_types.price -> BIGINT (nullable)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'table_types'
      and column_name = 'price'
      and data_type <> 'bigint'
  ) then
    alter table public.table_types
      alter column price type bigint
      using case
        when price is null then null
        else round(price)::bigint
      end;
  end if;

  -- orders.total_amount -> BIGINT (si aplica; defensivo por si algún entorno quedó en numeric)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'total_amount'
      and data_type <> 'bigint'
  ) then
    alter table public.orders
      alter column total_amount type bigint
      using round(total_amount)::bigint;
  end if;
end $$;

-- Verificación sugerida (manual):
-- select table_name, column_name, data_type
-- from information_schema.columns
-- where table_schema='public'
--   and (
--     (table_name='ticket_types' and column_name='price') or
--     (table_name='table_types' and column_name='price') or
--     (table_name='orders' and column_name='total_amount')
--   )
-- order by table_name, column_name;
