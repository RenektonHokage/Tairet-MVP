begin;

alter table public.panel_users
  add column if not exists display_name text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.panel_users'::regclass
      and conname = 'panel_users_display_name_chk'
  ) then
    alter table public.panel_users
      add constraint panel_users_display_name_chk
      check (
        display_name is null
        or char_length(trim(display_name)) between 1 and 80
      );
  end if;
end $$;

commit;
