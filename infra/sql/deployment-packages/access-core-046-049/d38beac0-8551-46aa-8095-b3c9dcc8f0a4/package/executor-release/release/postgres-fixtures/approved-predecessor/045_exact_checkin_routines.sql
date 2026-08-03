begin;

create or replace function public.get_access_checkin_window_status(
  p_access_date date,
  p_decision_at timestamptz
)
returns text
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_local_decision timestamp without time zone;
  v_window_start_local timestamp without time zone;
  v_window_end_local timestamp without time zone;
begin
  if p_access_date is null or p_decision_at is null then
    raise exception using
      errcode = '22004',
      message = 'Invalid access check-in window input';
  end if;

  -- The target Supabase tzdata predates Paraguay's permanent UTC-03 rule
  -- for dates after March 2025. Present and future access windows therefore
  -- use explicit UTC-03 civil time; a future legal change requires a new migration.
  v_local_decision :=
    (p_decision_at at time zone 'UTC') - interval '3 hours';
  v_window_start_local := p_access_date + time '18:00:00';
  v_window_end_local := (p_access_date + 1) + time '06:00:00';

  if v_local_decision < v_window_start_local then
    return 'too_early';
  end if;

  if v_local_decision >= v_window_end_local then
    return 'expired_window';
  end if;

  return 'valid';
end;
$$;

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
  v_decision_at timestamptz;
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
  v_window_status text;
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

  v_decision_at := clock_timestamp();

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

  v_window_status := public.get_access_checkin_window_status(
    v_entry_access_date,
    v_decision_at
  );

  if v_window_status not in ('valid', 'too_early', 'expired_window') then
    raise exception using
      errcode = '22000',
      message = 'Invalid access check-in window status';
  end if;

  if v_window_status <> 'valid' then
    return jsonb_build_object(
      'ok', true,
      'status', v_window_status,
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
      ),
      'warnings', '[]'::jsonb
    );
  end if;

  update public.access_entries
  set
    checkin_status = 'used',
    used_at = v_decision_at,
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

revoke all on function public.get_access_checkin_window_status(date, timestamptz) from public;
revoke all on function public.get_access_checkin_window_status(date, timestamptz) from anon;
revoke all on function public.get_access_checkin_window_status(date, timestamptz) from authenticated;
revoke all on function public.get_access_checkin_window_status(date, timestamptz) from service_role;
grant execute on function public.get_access_checkin_window_status(date, timestamptz) to postgres;

revoke all on function public.check_in_access_entry_by_token(uuid, uuid, uuid) from public;
revoke all on function public.check_in_access_entry_by_token(uuid, uuid, uuid) from anon;
revoke all on function public.check_in_access_entry_by_token(uuid, uuid, uuid) from authenticated;
grant execute on function public.check_in_access_entry_by_token(uuid, uuid, uuid) to service_role;

commit;
