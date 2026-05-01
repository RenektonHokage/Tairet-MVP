begin;

alter table public.reservations enable row level security;

drop policy if exists reservations_insert_public on public.reservations;
drop policy if exists reservations_select_by_local on public.reservations;

revoke all privileges on table public.reservations from anon;
revoke all privileges on table public.reservations from authenticated;

commit;
