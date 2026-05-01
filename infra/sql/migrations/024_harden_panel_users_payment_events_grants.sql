begin;

alter table public.panel_users enable row level security;
alter table public.payment_events enable row level security;

revoke all privileges on table public.panel_users from anon;
revoke all privileges on table public.panel_users from authenticated;

revoke all privileges on table public.payment_events from anon;
revoke all privileges on table public.payment_events from authenticated;

commit;
