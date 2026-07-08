begin;

create or replace function public.save_access_ticket_availability(
  p_actor_auth_user_id uuid,
  p_local_id uuid,
  p_access_ticket_type_id uuid,
  p_valid_from date,
  p_valid_to date,
  p_weekdays jsonb,
  p_exceptions jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_today date := (now() at time zone 'America/Asuncion')::date;
  v_local_type text;
  v_ticket public.access_ticket_types%rowtype;
  v_previous_rule public.access_ticket_availability_rules%rowtype;
  v_has_previous_rule boolean := false;
  v_rule_id uuid;
  v_weekday jsonb;
  v_exception jsonb;
  v_iso_weekday_text text;
  v_iso_weekday integer;
  v_stock_mode text;
  v_exception_mode text;
  v_capacity_text text;
  v_capacity_numeric numeric;
  v_capacity integer;
  v_reason text;
  v_access_date_text text;
  v_access_date date;
  v_weekday_days integer[] := array[]::integer[];
  v_weekday_modes text[] := array[]::text[];
  v_weekday_capacities integer[] := array[]::integer[];
  v_exception_dates date[] := array[]::date[];
  v_exception_modes text[] := array[]::text[];
  v_exception_capacities integer[] := array[]::integer[];
  v_exception_reasons text[] := array[]::text[];
  v_previous_dates date[] := array[]::date[];
  v_materialized_dates date[] := array[]::date[];
  v_materialized_modes text[] := array[]::text[];
  v_materialized_capacities integer[] := array[]::integer[];
  v_materialized_closed boolean[] := array[]::boolean[];
  v_new_effective_count integer := 0;
  v_sellable_count integer := 0;
  v_materialized_count integer := 0;
  v_closed_count integer := 0;
  v_conflicts jsonb := '[]'::jsonb;
  v_blocked_count bigint := 0;
  v_existing_index integer;
  v_day_offset integer;
  v_weekday_index integer;
  v_start date;
  v_date date;
begin
  if p_actor_auth_user_id is null
    or p_local_id is null
    or p_access_ticket_type_id is null
    or p_valid_from is null
    or p_valid_to is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_date',
        'message', 'Invalid availability request'
      )
    );
  end if;

  if not exists (
    select 1
    from public.panel_users
    where panel_users.auth_user_id = p_actor_auth_user_id
      and panel_users.local_id = p_local_id
      and panel_users.role = 'owner'
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'forbidden',
        'message', 'User not authorized to manage ticket availability'
      )
    );
  end if;

  select locals.type
  into v_local_type
  from public.locals
  where locals.id = p_local_id;

  if v_local_type is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'local_not_found',
        'message', 'Local not found'
      )
    );
  end if;

  if v_local_type <> 'club' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'forbidden',
        'message', 'Only clubs can manage ticket availability'
      )
    );
  end if;

  select *
  into v_ticket
  from public.access_ticket_types
  where access_ticket_types.id = p_access_ticket_type_id
  for update;

  if v_ticket.id is null
    or v_ticket.source_type <> 'local'
    or v_ticket.local_id is distinct from p_local_id
    or v_ticket.event_id is not null
    or v_ticket.payment_kind <> 'paid'
    or v_ticket.currency <> 'PYG' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'ticket_not_found',
        'message', 'Ticket type not found'
      )
    );
  end if;

  if p_valid_from > p_valid_to then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_range',
        'message', 'valid_from must be before or equal to valid_to'
      )
    );
  end if;

  if p_valid_from < v_today then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_range',
        'message', 'valid_from cannot be before today'
      )
    );
  end if;

  if (p_valid_to - p_valid_from + 1) > 93 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_range',
        'message', 'Availability range cannot exceed 93 days'
      )
    );
  end if;

  if p_weekdays is null
    or jsonb_typeof(p_weekdays) <> 'array'
    or jsonb_array_length(p_weekdays) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_weekdays',
        'message', 'weekdays must be a non-empty array'
      )
    );
  end if;

  for v_weekday in
    select value
    from jsonb_array_elements(p_weekdays) as weekdays(value)
  loop
    if jsonb_typeof(v_weekday) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_weekdays',
          'message', 'Invalid weekday item'
        )
      );
    end if;

    v_iso_weekday_text := v_weekday ->> 'iso_weekday';
    if v_iso_weekday_text is null or v_iso_weekday_text !~ '^[1-7]$' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_weekdays',
          'message', 'iso_weekday must be between 1 and 7'
        )
      );
    end if;

    v_iso_weekday := v_iso_weekday_text::integer;
    if array_position(v_weekday_days, v_iso_weekday) is not null then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_weekdays',
          'message', 'Duplicate iso_weekday'
        )
      );
    end if;

    v_stock_mode := v_weekday ->> 'stock_mode';
    if v_stock_mode not in ('limited', 'unlimited') then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_weekdays',
          'message', 'Invalid stock_mode'
        )
      );
    end if;

    v_capacity := null;
    v_capacity_text := v_weekday ->> 'capacity';
    if v_stock_mode = 'limited' then
      if v_capacity_text is null or v_capacity_text !~ '^[0-9]+$' then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'invalid_capacity',
            'message', 'Limited stock requires capacity greater than 0'
          )
        );
      end if;

      v_capacity_numeric := v_capacity_text::numeric;
      if v_capacity_numeric <= 0
        or v_capacity_numeric > 2147483647
        or v_capacity_numeric <> trunc(v_capacity_numeric) then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'invalid_capacity',
            'message', 'Limited stock requires capacity greater than 0'
          )
        );
      end if;

      v_capacity := v_capacity_numeric::integer;
    elsif v_capacity_text is not null then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_capacity',
          'message', 'Unlimited stock requires null capacity'
        )
      );
    end if;

    v_weekday_days := array_append(v_weekday_days, v_iso_weekday);
    v_weekday_modes := array_append(v_weekday_modes, v_stock_mode);
    v_weekday_capacities := array_append(v_weekday_capacities, v_capacity);
  end loop;

  if p_exceptions is null or jsonb_typeof(p_exceptions) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_date',
        'message', 'exceptions must be an array'
      )
    );
  end if;

  for v_exception in
    select value
    from jsonb_array_elements(p_exceptions) as exceptions(value)
  loop
    if jsonb_typeof(v_exception) <> 'object' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_date',
          'message', 'Invalid exception item'
        )
      );
    end if;

    v_access_date_text := v_exception ->> 'access_date';
    if v_access_date_text is null or v_access_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_date',
          'message', 'Invalid exception access_date'
        )
      );
    end if;

    begin
      v_access_date := v_access_date_text::date;
    exception
      when others then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'invalid_date',
            'message', 'Invalid exception access_date'
          )
        );
    end;

    if to_char(v_access_date, 'YYYY-MM-DD') <> v_access_date_text then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_date',
          'message', 'Invalid exception access_date'
        )
      );
    end if;

    if v_access_date < p_valid_from or v_access_date > p_valid_to then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_range',
          'message', 'Exception access_date must be within availability range'
        )
      );
    end if;

    if array_position(v_exception_dates, v_access_date) is not null then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'duplicate_exception_date',
          'message', 'Duplicate exception access_date'
        )
      );
    end if;

    v_exception_mode := v_exception ->> 'exception_mode';
    if v_exception_mode not in ('closed', 'limited', 'unlimited') then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_capacity',
          'message', 'Invalid exception_mode'
        )
      );
    end if;

    v_capacity := null;
    v_capacity_text := v_exception ->> 'capacity';
    if v_exception_mode = 'limited' then
      if v_capacity_text is null or v_capacity_text !~ '^[0-9]+$' then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'invalid_capacity',
            'message', 'Limited exception requires capacity greater than 0'
          )
        );
      end if;

      v_capacity_numeric := v_capacity_text::numeric;
      if v_capacity_numeric <= 0
        or v_capacity_numeric > 2147483647
        or v_capacity_numeric <> trunc(v_capacity_numeric) then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'invalid_capacity',
            'message', 'Limited exception requires capacity greater than 0'
          )
        );
      end if;

      v_capacity := v_capacity_numeric::integer;
    elsif v_capacity_text is not null then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'invalid_capacity',
          'message', 'Closed and unlimited exceptions require null capacity'
        )
      );
    end if;

    v_reason := nullif(trim(coalesce(v_exception ->> 'reason', '')), '');
    v_exception_dates := array_append(v_exception_dates, v_access_date);
    v_exception_modes := array_append(v_exception_modes, v_exception_mode);
    v_exception_capacities := array_append(v_exception_capacities, v_capacity);
    v_exception_reasons := array_append(v_exception_reasons, v_reason);
  end loop;

  for v_day_offset in 0..(p_valid_to - p_valid_from) loop
    v_date := p_valid_from + v_day_offset;
    v_iso_weekday := extract(isodow from v_date)::integer;
    v_weekday_index := array_position(v_weekday_days, v_iso_weekday);

    if v_weekday_index is not null then
      v_materialized_dates := array_append(v_materialized_dates, v_date);
      v_materialized_modes := array_append(v_materialized_modes, v_weekday_modes[v_weekday_index]);
      v_materialized_capacities := array_append(
        v_materialized_capacities,
        v_weekday_capacities[v_weekday_index]
      );
      v_materialized_closed := array_append(v_materialized_closed, false);
      v_new_effective_count := v_new_effective_count + 1;
    end if;
  end loop;

  if array_length(v_exception_dates, 1) is not null then
    for v_weekday_index in 1..array_length(v_exception_dates, 1) loop
      v_date := v_exception_dates[v_weekday_index];
      v_existing_index := array_position(v_materialized_dates, v_date);

      if v_exception_modes[v_weekday_index] = 'closed' then
        v_stock_mode := 'limited';
        v_capacity := 0;
      elsif v_exception_modes[v_weekday_index] = 'limited' then
        v_stock_mode := 'limited';
        v_capacity := v_exception_capacities[v_weekday_index];
      else
        v_stock_mode := 'unlimited';
        v_capacity := null;
      end if;

      if v_existing_index is null then
        v_materialized_dates := array_append(v_materialized_dates, v_date);
        v_materialized_modes := array_append(v_materialized_modes, v_stock_mode);
        v_materialized_capacities := array_append(v_materialized_capacities, v_capacity);
        v_materialized_closed := array_append(
          v_materialized_closed,
          v_exception_modes[v_weekday_index] = 'closed'
        );
      else
        v_materialized_modes[v_existing_index] := v_stock_mode;
        v_materialized_capacities[v_existing_index] := v_capacity;
        v_materialized_closed[v_existing_index] := v_exception_modes[v_weekday_index] = 'closed';
      end if;

      if v_exception_modes[v_weekday_index] <> 'closed'
        or v_existing_index is null then
        v_new_effective_count := v_new_effective_count + 1;
      end if;
    end loop;
  end if;

  if v_new_effective_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_weekdays',
        'message', 'No availability dates selected'
      )
    );
  end if;

  if array_length(v_materialized_dates, 1) is not null then
    for v_weekday_index in 1..array_length(v_materialized_dates, 1) loop
      if v_materialized_closed[v_weekday_index] is not true
        and (
          v_materialized_modes[v_weekday_index] = 'unlimited'
          or coalesce(v_materialized_capacities[v_weekday_index], 0) > 0
        ) then
        v_sellable_count := v_sellable_count + 1;
      end if;
    end loop;
  end if;

  if v_sellable_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_weekdays',
        'message', 'No sellable availability dates selected'
      )
    );
  end if;

  select *
  into v_previous_rule
  from public.access_ticket_availability_rules
  where access_ticket_availability_rules.access_ticket_type_id = p_access_ticket_type_id
    and access_ticket_availability_rules.active = true
    and access_ticket_availability_rules.deleted_at is null
  for update;
  v_has_previous_rule := found;

  if v_has_previous_rule then
    v_start := greatest(v_previous_rule.valid_from, v_today);
    if v_start <= v_previous_rule.valid_to then
      for v_day_offset in 0..(v_previous_rule.valid_to - v_start) loop
        v_date := v_start + v_day_offset;
        v_iso_weekday := extract(isodow from v_date)::integer;

        if exists (
          select 1
          from public.access_ticket_availability_rule_weekdays
          where access_ticket_availability_rule_weekdays.rule_id = v_previous_rule.id
            and access_ticket_availability_rule_weekdays.iso_weekday = v_iso_weekday
        ) and array_position(v_previous_dates, v_date) is null then
          v_previous_dates := array_append(v_previous_dates, v_date);
        end if;
      end loop;
    end if;
  end if;

  for v_access_date in
    select access_ticket_availability_exceptions.access_date
    from public.access_ticket_availability_exceptions
    where access_ticket_availability_exceptions.access_ticket_type_id = p_access_ticket_type_id
      and access_ticket_availability_exceptions.active = true
      and access_ticket_availability_exceptions.deleted_at is null
      and access_ticket_availability_exceptions.access_date >= v_today
    order by access_ticket_availability_exceptions.access_date
  loop
    if array_position(v_previous_dates, v_access_date) is null then
      v_previous_dates := array_append(v_previous_dates, v_access_date);
    end if;
  end loop;

  for v_access_date in
    select access_stock_limits.access_date
    from public.access_stock_limits
    where access_stock_limits.access_ticket_type_id = p_access_ticket_type_id
      and access_stock_limits.access_date >= v_today
    order by access_stock_limits.access_date
  loop
    if array_position(v_previous_dates, v_access_date) is null then
      v_previous_dates := array_append(v_previous_dates, v_access_date);
    end if;
  end loop;

  if array_length(v_previous_dates, 1) is not null then
    for v_weekday_index in 1..array_length(v_previous_dates, 1) loop
      v_date := v_previous_dates[v_weekday_index];
      if array_position(v_materialized_dates, v_date) is null then
        v_materialized_dates := array_append(v_materialized_dates, v_date);
        v_materialized_modes := array_append(v_materialized_modes, 'limited');
        v_materialized_capacities := array_append(v_materialized_capacities, 0);
        v_materialized_closed := array_append(v_materialized_closed, true);
      end if;
    end loop;
  end if;

  perform 1
  from public.access_stock_limits
  where access_stock_limits.access_ticket_type_id = p_access_ticket_type_id
    and access_stock_limits.access_date = any(v_materialized_dates)
  order by access_stock_limits.access_date
  for update;

  if array_length(v_materialized_dates, 1) is not null then
    for v_weekday_index in 1..array_length(v_materialized_dates, 1) loop
      if v_materialized_modes[v_weekday_index] = 'limited'
        and coalesce(v_materialized_capacities[v_weekday_index], 0) > 0
        and v_materialized_closed[v_weekday_index] is not true then
        select coalesce(sum(access_stock_reservations.quantity), 0)
        into v_blocked_count
        from public.access_stock_reservations
        where access_stock_reservations.access_ticket_type_id = p_access_ticket_type_id
          and access_stock_reservations.access_date = v_materialized_dates[v_weekday_index]
          and (
            access_stock_reservations.status in ('consumed', 'manual_hold')
            or (
              access_stock_reservations.status = 'reserved'
              and access_stock_reservations.expires_at > v_now
            )
          );

        if v_materialized_capacities[v_weekday_index] < v_blocked_count then
          v_conflicts := v_conflicts || jsonb_build_array(
            jsonb_build_object(
              'access_date', v_materialized_dates[v_weekday_index],
              'blocked_count', v_blocked_count,
              'capacity', v_materialized_capacities[v_weekday_index]
            )
          );
        end if;
      end if;
    end loop;
  end if;

  if jsonb_array_length(v_conflicts) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'capacity_below_reserved',
        'message', 'Capacity is below existing sold or reserved stock',
        'conflicts', v_conflicts
      )
    );
  end if;

  if v_has_previous_rule then
    update public.access_ticket_availability_rules
    set
      active = false,
      deleted_at = v_now,
      updated_at = v_now
    where access_ticket_availability_rules.id = v_previous_rule.id;
  end if;

  insert into public.access_ticket_availability_rules (
    access_ticket_type_id,
    source_type,
    local_id,
    event_id,
    valid_from,
    valid_to,
    active,
    created_at,
    updated_at
  )
  values (
    p_access_ticket_type_id,
    'local',
    p_local_id,
    null,
    p_valid_from,
    p_valid_to,
    true,
    v_now,
    v_now
  )
  returning id into v_rule_id;

  for v_weekday_index in 1..array_length(v_weekday_days, 1) loop
    insert into public.access_ticket_availability_rule_weekdays (
      rule_id,
      iso_weekday,
      stock_mode,
      capacity,
      created_at,
      updated_at
    )
    values (
      v_rule_id,
      v_weekday_days[v_weekday_index],
      v_weekday_modes[v_weekday_index],
      v_weekday_capacities[v_weekday_index],
      v_now,
      v_now
    );
  end loop;

  update public.access_ticket_availability_exceptions
  set
    active = false,
    deleted_at = v_now,
    updated_at = v_now
  where access_ticket_availability_exceptions.access_ticket_type_id = p_access_ticket_type_id
    and access_ticket_availability_exceptions.active = true
    and access_ticket_availability_exceptions.deleted_at is null;

  if array_length(v_exception_dates, 1) is not null then
    for v_weekday_index in 1..array_length(v_exception_dates, 1) loop
      insert into public.access_ticket_availability_exceptions (
        access_ticket_type_id,
        source_type,
        local_id,
        event_id,
        access_date,
        exception_mode,
        capacity,
        reason,
        active,
        created_at,
        updated_at
      )
      values (
        p_access_ticket_type_id,
        'local',
        p_local_id,
        null,
        v_exception_dates[v_weekday_index],
        v_exception_modes[v_weekday_index],
        v_exception_capacities[v_weekday_index],
        v_exception_reasons[v_weekday_index],
        true,
        v_now,
        v_now
      );
    end loop;
  end if;

  insert into public.access_stock_limits (
    access_ticket_type_id,
    source_type,
    local_id,
    event_id,
    access_date,
    stock_mode,
    capacity,
    created_at,
    updated_at
  )
  select
    p_access_ticket_type_id,
    'local',
    p_local_id,
    null::uuid,
    rows.access_date,
    rows.stock_mode,
    rows.capacity,
    v_now,
    v_now
  from unnest(
    v_materialized_dates,
    v_materialized_modes,
    v_materialized_capacities
  ) as rows(access_date, stock_mode, capacity)
  on conflict on constraint access_stock_limits_ticket_type_date_unique
  do update set
    source_type = excluded.source_type,
    local_id = excluded.local_id,
    event_id = excluded.event_id,
    stock_mode = excluded.stock_mode,
    capacity = excluded.capacity,
    updated_at = excluded.updated_at;

  v_materialized_count := coalesce(array_length(v_materialized_dates, 1), 0);
  if array_length(v_materialized_closed, 1) is not null then
    for v_weekday_index in 1..array_length(v_materialized_closed, 1) loop
      if v_materialized_closed[v_weekday_index] then
        v_closed_count := v_closed_count + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'rule_id', v_rule_id,
    'materialized_count', v_materialized_count,
    'closed_count', v_closed_count,
    'valid_from', p_valid_from,
    'valid_to', p_valid_to
  );
exception
  when deadlock_detected or serialization_failure then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'availability_materialization_failed',
        'message', 'Availability materialization failed'
      )
    );
end;
$$;

revoke all on function public.save_access_ticket_availability(
  uuid,
  uuid,
  uuid,
  date,
  date,
  jsonb,
  jsonb
) from public;
revoke all on function public.save_access_ticket_availability(
  uuid,
  uuid,
  uuid,
  date,
  date,
  jsonb,
  jsonb
) from anon;
revoke all on function public.save_access_ticket_availability(
  uuid,
  uuid,
  uuid,
  date,
  date,
  jsonb,
  jsonb
) from authenticated;
grant execute on function public.save_access_ticket_availability(
  uuid,
  uuid,
  uuid,
  date,
  date,
  jsonb,
  jsonb
) to service_role;

commit;
