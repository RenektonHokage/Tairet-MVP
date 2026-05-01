begin;

alter table public.ticket_types enable row level security;
alter table public.table_types enable row level security;

revoke all privileges on table public.ticket_types from anon;
revoke all privileges on table public.ticket_types from authenticated;

revoke all privileges on table public.table_types from anon;
revoke all privileges on table public.table_types from authenticated;

commit;
