begin;

alter table public.locals enable row level security;

drop policy if exists locals_select_public on public.locals;

revoke all privileges on table public.locals from anon;
revoke all privileges on table public.locals from authenticated;

commit;
