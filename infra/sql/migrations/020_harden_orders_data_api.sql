begin;

alter table public.orders enable row level security;

drop policy if exists orders_insert_by_local on public.orders;
drop policy if exists orders_select_by_local on public.orders;

revoke all privileges on table public.orders from anon;
revoke all privileges on table public.orders from authenticated;

commit;
