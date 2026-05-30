begin;

do $$
declare
  v_event_id uuid;
  v_ticket_id uuid;
  v_missing_emails text[];
  v_ticket record;
  v_user record;
begin
  with required_users(email, role, display_name, sort_order) as (
    values
      ('owner.ibiza@tairet.com.py', 'owner', 'Owner Ibiza', 1),
      ('staff1.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 1', 2),
      ('staff2.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 2', 3),
      ('staff3.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 3', 4),
      ('staff4.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 4', 5)
  )
  select array_agg(required_users.email order by required_users.sort_order)
  into v_missing_emails
  from required_users
  left join auth.users
    on lower(auth.users.email) = lower(required_users.email)
  where auth.users.id is null;

  if coalesce(array_length(v_missing_emails, 1), 0) > 0 then
    raise exception
      'Missing required auth.users for Ibiza event provisioning: %',
      array_to_string(v_missing_emails, ', ');
  end if;

  select events.id
  into v_event_id
  from public.events
  where lower(trim(events.slug)) = 'ibiza'
  limit 1;

  if v_event_id is null then
    insert into public.events (
      title,
      slug,
      description,
      starts_at,
      ends_at,
      checkin_valid_from,
      checkin_valid_to,
      timezone,
      location_name,
      address,
      organizer_name,
      local_id,
      status,
      cover_image_url,
      metadata
    )
    values (
      'Ibiza',
      'ibiza',
      null,
      '2026-08-01 20:00:00'::timestamp at time zone 'America/Asuncion',
      '2026-08-02 06:00:00'::timestamp at time zone 'America/Asuncion',
      '2026-08-01 18:00:00'::timestamp at time zone 'America/Asuncion',
      '2026-08-02 06:00:00'::timestamp at time zone 'America/Asuncion',
      'America/Asuncion',
      'Centro de Eventos de Mariscal López',
      null,
      'Tahiel',
      null,
      'draft',
      null,
      '{}'::jsonb
    )
    returning id into v_event_id;
  else
    update public.events
    set
      title = 'Ibiza',
      slug = 'ibiza',
      description = null,
      starts_at = '2026-08-01 20:00:00'::timestamp at time zone 'America/Asuncion',
      ends_at = '2026-08-02 06:00:00'::timestamp at time zone 'America/Asuncion',
      checkin_valid_from = '2026-08-01 18:00:00'::timestamp at time zone 'America/Asuncion',
      checkin_valid_to = '2026-08-02 06:00:00'::timestamp at time zone 'America/Asuncion',
      timezone = 'America/Asuncion',
      location_name = 'Centro de Eventos de Mariscal López',
      address = null,
      organizer_name = 'Tahiel',
      local_id = null,
      status = 'draft',
      cover_image_url = null,
      metadata = '{}'::jsonb,
      updated_at = now()
    where id = v_event_id;
  end if;

  for v_ticket in
    select *
    from (
      values
        ('General Preventa 1', 140000::bigint, 'PYG', 900, true, 1, 'single_entry', 1),
        ('General Preventa 2', 180000::bigint, 'PYG', 1000, true, 2, 'single_entry', 1),
        ('General Precio Final', 220000::bigint, 'PYG', 500, true, 3, 'single_entry', 1),
        ('VIP Preventa 1', 350000::bigint, 'PYG', 200, true, 4, 'single_entry', 1),
        ('VIP Preventa 2', 440000::bigint, 'PYG', 250, true, 5, 'single_entry', 1),
        ('VIP Precio Final', 520000::bigint, 'PYG', 150, true, 6, 'single_entry', 1),
        ('Mesa VIP Preventa 1', 3200000::bigint, 'PYG', 6, true, 7, 'package', 10),
        ('Mesa VIP Preventa 2', 3800000::bigint, 'PYG', 8, true, 8, 'package', 10),
        ('Mesa VIP Precio Final', 4500000::bigint, 'PYG', 6, true, 9, 'package', 10)
    ) as ticket_types(
      name,
      price_amount,
      currency,
      stock,
      active,
      sort_order,
      sales_unit_type,
      entries_per_unit
    )
  loop
    select event_ticket_types.id
    into v_ticket_id
    from public.event_ticket_types
    where event_ticket_types.event_id = v_event_id
      and lower(trim(event_ticket_types.name)) = lower(trim(v_ticket.name))
    limit 1;

    if v_ticket_id is null then
      insert into public.event_ticket_types (
        event_id,
        name,
        description,
        price_amount,
        currency,
        stock,
        active,
        sales_start,
        sales_end,
        sort_order,
        sales_unit_type,
        entries_per_unit
      )
      values (
        v_event_id,
        v_ticket.name,
        null,
        v_ticket.price_amount,
        v_ticket.currency,
        v_ticket.stock,
        v_ticket.active,
        null,
        null,
        v_ticket.sort_order,
        v_ticket.sales_unit_type,
        v_ticket.entries_per_unit
      );
    else
      update public.event_ticket_types
      set
        name = v_ticket.name,
        description = null,
        price_amount = v_ticket.price_amount,
        currency = v_ticket.currency,
        stock = v_ticket.stock,
        active = v_ticket.active,
        sales_start = null,
        sales_end = null,
        sort_order = v_ticket.sort_order,
        sales_unit_type = v_ticket.sales_unit_type,
        entries_per_unit = v_ticket.entries_per_unit,
        updated_at = now()
      where id = v_ticket_id;
    end if;
  end loop;

  for v_user in
    with required_users(email, role, display_name, sort_order) as (
      values
        ('owner.ibiza@tairet.com.py', 'owner', 'Owner Ibiza', 1),
        ('staff1.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 1', 2),
        ('staff2.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 2', 3),
        ('staff3.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 3', 4),
        ('staff4.ibiza@tairet.com.py', 'staff', 'Staff Ibiza 4', 5)
    )
    select
      auth.users.id as auth_user_id,
      required_users.role,
      required_users.display_name
    from required_users
    join auth.users
      on lower(auth.users.email) = lower(required_users.email)
    order by required_users.sort_order
  loop
    insert into public.event_panel_users (
      event_id,
      auth_user_id,
      role,
      display_name
    )
    values (
      v_event_id,
      v_user.auth_user_id,
      v_user.role,
      v_user.display_name
    )
    on conflict (event_id, auth_user_id)
    do update set
      role = excluded.role,
      display_name = excluded.display_name,
      updated_at = now();
  end loop;
end $$;

commit;
