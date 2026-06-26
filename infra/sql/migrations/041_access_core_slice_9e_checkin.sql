begin;

create or replace function public.check_in_access_entry_by_token(
  p_checkin_token uuid,
  p_actor_auth_user_id uuid,
  p_local_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_entry_id uuid;
  v_entry_status text;
  v_entry_checkin_status text;
  v_entry_used_at timestamptz;
  v_entry_used_by uuid;
  v_entry_access_date date;
  v_entry_unit_index integer;
  v_attendee_name text;
  v_attendee_last_name text;
  v_ticket_name text;
  v_order_public_ref text;
  v_order_source_type text;
  v_order_local_id uuid;
  v_order_status text;
  v_updated_checkin_status text;
  v_updated_used_at timestamptz;
begin
  if p_checkin_token is null
    or p_actor_auth_user_id is null
    or p_local_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_request',
        'message', 'Invalid check-in request'
      )
    );
  end if;

  if not exists (
    select 1
    from public.panel_users
    where panel_users.auth_user_id = p_actor_auth_user_id
      and panel_users.local_id = p_local_id
      and panel_users.role in ('owner', 'staff')
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'forbidden',
        'message', 'User not authorized for access check-in'
      )
    );
  end if;

  select
    access_entries.id,
    access_entries.status,
    access_entries.checkin_status,
    access_entries.used_at,
    access_entries.used_by,
    access_entries.access_date,
    access_entries.unit_index,
    access_entries.attendee_name,
    access_entries.attendee_last_name,
    access_order_items.name_snapshot,
    access_orders.public_ref,
    access_orders.source_type,
    access_orders.local_id,
    access_orders.status
  into
    v_entry_id,
    v_entry_status,
    v_entry_checkin_status,
    v_entry_used_at,
    v_entry_used_by,
    v_entry_access_date,
    v_entry_unit_index,
    v_attendee_name,
    v_attendee_last_name,
    v_ticket_name,
    v_order_public_ref,
    v_order_source_type,
    v_order_local_id,
    v_order_status
  from public.access_entries
  join public.access_orders
    on access_orders.id = access_entries.order_id
  join public.access_order_items
    on access_order_items.id = access_entries.order_item_id
  where access_entries.checkin_token = p_checkin_token
  for update of access_entries;

  if v_entry_id is null
    or v_order_source_type <> 'local'
    or v_order_local_id is distinct from p_local_id then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'entry_not_found',
        'message', 'Access entry not found'
      )
    );
  end if;

  if v_entry_status = 'voided' then
    return jsonb_build_object(
      'ok', true,
      'status', 'voided',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  if v_order_status <> 'paid' then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_paid',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  if v_entry_status <> 'issued' then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_valid_status',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  if v_entry_checkin_status = 'used' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_used',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  if v_entry_checkin_status <> 'unused'
    or v_entry_used_at is not null
    or v_entry_used_by is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_valid_status',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  update public.access_entries
  set
    checkin_status = 'used',
    used_at = v_now,
    used_by = p_actor_auth_user_id
  where access_entries.id = v_entry_id
    and access_entries.status = 'issued'
    and access_entries.checkin_status = 'unused'
    and access_entries.used_at is null
    and access_entries.used_by is null
  returning
    access_entries.checkin_status,
    access_entries.used_at
  into
    v_updated_checkin_status,
    v_updated_used_at;

  if v_updated_checkin_status is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'used',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_updated_checkin_status,
        'used_at', v_updated_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  select
    access_entries.status,
    access_entries.checkin_status,
    access_entries.used_at,
    access_entries.used_by
  into
    v_entry_status,
    v_entry_checkin_status,
    v_entry_used_at,
    v_entry_used_by
  from public.access_entries
  where access_entries.id = v_entry_id
  for update;

  if v_entry_status = 'voided' then
    return jsonb_build_object(
      'ok', true,
      'status', 'voided',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  if v_entry_status = 'issued' and v_entry_checkin_status = 'used' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_used',
      'entry', jsonb_build_object(
        'status', v_entry_status,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at,
        'access_date', v_entry_access_date,
        'unit_index', v_entry_unit_index,
        'ticket_name', v_ticket_name
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name
      ),
      'order', jsonb_build_object(
        'public_ref', v_order_public_ref
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'not_valid_status',
    'entry', jsonb_build_object(
      'status', v_entry_status,
      'checkin_status', v_entry_checkin_status,
      'used_at', v_entry_used_at,
      'access_date', v_entry_access_date,
      'unit_index', v_entry_unit_index,
      'ticket_name', v_ticket_name
    ),
    'attendee', jsonb_build_object(
      'name', v_attendee_name,
      'last_name', v_attendee_last_name
    ),
    'order', jsonb_build_object(
      'public_ref', v_order_public_ref
    )
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'checkin_failed',
        'message', 'Access check-in failed'
      )
    );
end;
$$;

revoke all on function public.check_in_access_entry_by_token(uuid, uuid, uuid) from public;
revoke all on function public.check_in_access_entry_by_token(uuid, uuid, uuid) from anon;
revoke all on function public.check_in_access_entry_by_token(uuid, uuid, uuid) from authenticated;
grant execute on function public.check_in_access_entry_by_token(uuid, uuid, uuid) to service_role;

commit;
