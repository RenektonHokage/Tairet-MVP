create or replace function public.guard_access_email_delivery_attempts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if tg_op = 'DELETE' then
    if session_user = 'postgres'
      and current_setting('app.access_core_allow_fulfillment_cleanup', true) = 'on' then
      return old;
    end if;

    raise exception using
      errcode = '55000',
      message = 'Access email delivery attempts are append-only';
  end if;

  if new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.generation is distinct from old.generation
    or new.trigger_type is distinct from old.trigger_type
    or new.idempotency_key is distinct from old.idempotency_key
    or new.idempotency_expires_at is distinct from old.idempotency_expires_at
    or new.provider is distinct from old.provider
    or new.entry_ids is distinct from old.entry_ids
    or new.entry_count is distinct from old.entry_count
    or new.entry_snapshot_hash is distinct from old.entry_snapshot_hash
    or new.request_payload_hash is distinct from old.request_payload_hash
    or new.template_version is distinct from old.template_version
    or new.requested_by_auth_user_id is distinct from old.requested_by_auth_user_id
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '55000',
      message = 'Immutable access email delivery attempt fields cannot change';
  end if;

  if old.status in ('accepted', 'failed') then
    raise exception using
      errcode = '55000',
      message = 'Terminal access email delivery attempts cannot change';
  end if;

  if old.status = 'processing' and new.status in ('accepted', 'failed', 'ambiguous') then
    if new.provider_call_count is distinct from old.provider_call_count
      or new.last_provider_call_at is distinct from old.last_provider_call_at then
      raise exception using
        errcode = '55000',
        message = 'Provider call counters cannot change while recording an outcome';
    end if;
    return new;
  end if;

  if old.status = 'ambiguous' and new.status = 'processing' then
    if v_now >= old.idempotency_expires_at then
      raise exception using
        errcode = '55000',
        message = 'Expired idempotency window cannot be retried';
    end if;

    if new.provider_call_count <> old.provider_call_count + 1
      or new.last_provider_call_at <= old.last_provider_call_at
      or new.last_provider_call_at > v_now + interval '1 second'
      or new.last_provider_call_at >= old.idempotency_expires_at
      or new.error_code is not null
      or new.provider_message_id is not null
      or new.finished_at is not null then
      raise exception using
        errcode = '55000',
        message = 'Invalid ambiguous delivery retry transition';
    end if;
    return new;
  end if;

  raise exception using
    errcode = '55000',
    message = 'Invalid access email delivery attempt transition';
end;
$$;