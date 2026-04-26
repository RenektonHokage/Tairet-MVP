begin;

alter table public.local_daily_ops enable row level security;

drop policy if exists local_daily_ops_insert_by_local on public.local_daily_ops;
drop policy if exists local_daily_ops_select_by_local on public.local_daily_ops;
drop policy if exists local_daily_ops_update_by_local on public.local_daily_ops;

revoke all privileges on table public.local_daily_ops from anon;
revoke all privileges on table public.local_daily_ops from authenticated;

commit;
