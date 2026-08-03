create trigger access_entries_freeze_after_fulfillment
before insert or update or delete
on public.access_entries
for each row
execute function public.guard_access_entries_fulfilled();