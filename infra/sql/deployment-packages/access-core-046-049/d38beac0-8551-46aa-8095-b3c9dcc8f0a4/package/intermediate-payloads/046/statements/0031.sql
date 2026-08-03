create trigger access_order_items_freeze_after_approval
before insert or update or delete
on public.access_order_items
for each row
execute function public.guard_access_order_items_frozen();