begin;

create or replace function public.check_in_event_entry_manually(
  p_event_id uuid,
  p_actor_auth_user_id uuid,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_title text;
  v_event_status text;
  v_checkin_valid_from timestamptz;
  v_checkin_valid_to timestamptz;
  v_now timestamptz := now();
  v_entry_id uuid;
  v_entry_status text;
  v_entry_checkin_status text;
  v_entry_used_at timestamptz;
  v_attendee_name text;
  v_attendee_last_name text;
  v_attendee_document text;
  v_ticket_name text;
  v_updated_id uuid;
  v_updated_checkin_status text;
  v_updated_used_at timestamptz;
begin
  if p_event_id is null
    or p_actor_auth_user_id is null
    or p_entry_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_input',
        'message', 'Invalid manual check-in input'
      )
    );
  end if;

  select
    events.title,
    events.status,
    events.checkin_valid_from,
    events.checkin_valid_to
  into
    v_event_title,
    v_event_status,
    v_checkin_valid_from,
    v_checkin_valid_to
  from public.events
  where events.id = p_event_id;

  if v_event_status is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'event_not_found',
        'message', 'Event not found'
      )
    );
  end if;

  if not exists (
    select 1
    from public.event_panel_users
    where event_panel_users.event_id = p_event_id
      and event_panel_users.auth_user_id = p_actor_auth_user_id
      and event_panel_users.role in ('owner', 'staff')
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'forbidden',
        'message', 'User not authorized for event manual check-in'
      )
    );
  end if;

  select
    event_order_entries.id,
    event_order_entries.status,
    event_order_entries.checkin_status,
    event_order_entries.used_at,
    event_order_entries.attendee_name,
    event_order_entries.attendee_last_name,
    event_order_entries.attendee_document,
    coalesce(event_order_items.ticket_name, event_ticket_types.name)
  into
    v_entry_id,
    v_entry_status,
    v_entry_checkin_status,
    v_entry_used_at,
    v_attendee_name,
    v_attendee_last_name,
    v_attendee_document,
    v_ticket_name
  from public.event_order_entries
  left join public.event_order_items
    on event_order_items.id = event_order_entries.event_order_item_id
    and event_order_items.event_id = event_order_entries.event_id
  left join public.event_ticket_types
    on event_ticket_types.id = event_order_entries.event_ticket_type_id
    and event_ticket_types.event_id = event_order_entries.event_id
  where event_order_entries.id = p_entry_id
    and event_order_entries.event_id = p_event_id;

  if v_entry_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'entry_not_found',
        'message', 'Entry not found'
      )
    );
  end if;

  if v_event_status not in ('draft', 'published') then
    return jsonb_build_object(
      'ok', true,
      'status', 'event_not_operable',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  if v_entry_status = 'voided' then
    return jsonb_build_object(
      'ok', true,
      'status', 'voided',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  if v_entry_status <> 'issued' then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_valid_status',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  if v_entry_checkin_status = 'used' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_used',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  if v_now < v_checkin_valid_from
    or v_now > v_checkin_valid_to then
    return jsonb_build_object(
      'ok', true,
      'status', 'outside_window',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  update public.event_order_entries
  set
    checkin_status = 'used',
    used_at = v_now,
    used_by_auth_user_id = p_actor_auth_user_id,
    updated_at = v_now
  where id = p_entry_id
    and event_id = p_event_id
    and status = 'issued'
    and checkin_status = 'unused'
    and used_at is null
    and used_by_auth_user_id is null
  returning
    id,
    checkin_status,
    used_at
  into
    v_updated_id,
    v_updated_checkin_status,
    v_updated_used_at;

  if v_updated_id is not null then
    return jsonb_build_object(
      'ok', true,
      'status', 'valid',
      'entry', jsonb_build_object(
        'id', v_updated_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_updated_checkin_status,
        'used_at', v_updated_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  v_entry_id := null;
  v_entry_status := null;
  v_entry_checkin_status := null;
  v_entry_used_at := null;
  v_attendee_name := null;
  v_attendee_last_name := null;
  v_attendee_document := null;
  v_ticket_name := null;

  select
    event_order_entries.id,
    event_order_entries.status,
    event_order_entries.checkin_status,
    event_order_entries.used_at,
    event_order_entries.attendee_name,
    event_order_entries.attendee_last_name,
    event_order_entries.attendee_document,
    coalesce(event_order_items.ticket_name, event_ticket_types.name)
  into
    v_entry_id,
    v_entry_status,
    v_entry_checkin_status,
    v_entry_used_at,
    v_attendee_name,
    v_attendee_last_name,
    v_attendee_document,
    v_ticket_name
  from public.event_order_entries
  left join public.event_order_items
    on event_order_items.id = event_order_entries.event_order_item_id
    and event_order_items.event_id = event_order_entries.event_id
  left join public.event_ticket_types
    on event_ticket_types.id = event_order_entries.event_ticket_type_id
    and event_ticket_types.event_id = event_order_entries.event_id
  where event_order_entries.id = p_entry_id
    and event_order_entries.event_id = p_event_id;

  if v_entry_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'entry_not_found',
        'message', 'Entry not found'
      )
    );
  end if;

  if v_entry_status = 'voided' then
    return jsonb_build_object(
      'ok', true,
      'status', 'voided',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  if v_entry_status <> 'issued' then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_valid_status',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  if v_entry_checkin_status = 'used' then
    return jsonb_build_object(
      'ok', true,
      'status', 'already_used',
      'entry', jsonb_build_object(
        'id', v_entry_id,
        'ticket_name', v_ticket_name,
        'checkin_status', v_entry_checkin_status,
        'used_at', v_entry_used_at
      ),
      'attendee', jsonb_build_object(
        'name', v_attendee_name,
        'last_name', v_attendee_last_name,
        'document', v_attendee_document
      ),
      'event', jsonb_build_object(
        'id', p_event_id,
        'title', v_event_title
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'not_valid_status',
    'entry', jsonb_build_object(
      'id', v_entry_id,
      'ticket_name', v_ticket_name,
      'checkin_status', v_entry_checkin_status,
      'used_at', v_entry_used_at
    ),
    'attendee', jsonb_build_object(
      'name', v_attendee_name,
      'last_name', v_attendee_last_name,
      'document', v_attendee_document
    ),
    'event', jsonb_build_object(
      'id', p_event_id,
      'title', v_event_title
    )
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'manual_checkin_failed',
        'message', 'Event manual check-in failed'
      )
    );
end;
$$;

revoke execute on function public.check_in_event_entry_manually(uuid, uuid, uuid) from public;
revoke execute on function public.check_in_event_entry_manually(uuid, uuid, uuid) from anon;
revoke execute on function public.check_in_event_entry_manually(uuid, uuid, uuid) from authenticated;
grant execute on function public.check_in_event_entry_manually(uuid, uuid, uuid) to service_role;

commit;
