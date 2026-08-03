create or replace function public.access_core_entry_snapshot(p_order_id uuid)
returns table (
  entry_ids uuid[],
  entry_count integer,
  entry_snapshot_hash text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with snapshot_material as (
    select
      coalesce(
        array_agg(
          access_entries.id
          order by
            access_entries.order_item_id,
            access_entries.unit_index,
            access_entries.id
        ),
        array[]::uuid[]
      ) as entry_ids,
      count(*)::integer as entry_count,
      coalesce(
        jsonb_agg(
          jsonb_build_array(
            access_entries.id,
            access_entries.order_item_id,
            access_entries.access_ticket_type_id,
            access_entries.unit_index,
            access_entries.checkin_token,
            access_entries.attendee_name,
            access_entries.attendee_last_name,
            access_entries.access_date,
            access_entries.status,
            access_order_items.name_snapshot
          )
          order by
            access_entries.order_item_id,
            access_entries.unit_index,
            access_entries.id
        ),
        '[]'::jsonb
      ) as material
    from public.access_entries
    join public.access_order_items
      on access_order_items.id = access_entries.order_item_id
      and access_order_items.order_id = access_entries.order_id
      and access_order_items.access_ticket_type_id
        = access_entries.access_ticket_type_id
    where access_entries.order_id = p_order_id
  )
  select
    snapshot_material.entry_ids,
    snapshot_material.entry_count,
    pg_catalog.encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(snapshot_material.material::text, 'UTF8')
      ),
      'hex'
    )
  from snapshot_material;
$$;