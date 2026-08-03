do $$
begin
  if exists (
    with
    approved_ranked as (
      select
        payment_attempts.order_id,
        payment_attempts.id as payment_attempt_id,
        payment_attempts.provider,
        payment_attempts.provider_operation,
        count(*) over (
          partition by payment_attempts.order_id
        )::integer as approved_count,
        row_number() over (
          partition by payment_attempts.order_id
          order by
            payment_attempts.confirmed_at asc nulls last,
            payment_attempts.attempt_number asc,
            payment_attempts.id asc
        ) as approved_rank
      from public.payment_attempts
      join public.access_orders
        on access_orders.id = payment_attempts.order_id
      where access_orders.status = 'paid'
        and payment_attempts.status = 'approved'
    ),
    approved_selected as (
      select *
      from approved_ranked
      where approved_rank = 1
    ),
    item_totals as (
      select
        access_order_items.order_id,
        count(*)::integer as item_count,
        coalesce(sum(
          access_order_items.quantity::bigint
          * access_order_items.entries_per_unit::bigint
        ), 0) as expected_entries
      from public.access_order_items
      group by access_order_items.order_id
    ),
    expected_units as (
      select
        access_order_items.order_id,
        count(*)::integer as expected_unit_count,
        count(*) filter (
          where not exists (
            select 1
            from public.access_entries
            where access_entries.order_item_id = access_order_items.id
              and access_entries.unit_index::bigint = generated_unit.unit_index
          )
        )::integer as missing_expected_unit_count
      from public.access_order_items
      cross join lateral generate_series(
        1::bigint,
        access_order_items.quantity::bigint
          * access_order_items.entries_per_unit::bigint
      ) as generated_unit(unit_index)
      group by access_order_items.order_id
    ),
    entry_totals as (
      select
        access_entries.order_id,
        count(*)::integer as issued_entries,
        count(*) filter (
          where access_entries.email_status = 'sent'
        )::integer as sent_count,
        count(*) filter (
          where access_entries.email_status = 'sent'
            and access_entries.email_sent_at is not null
        )::integer as valid_sent_count,
        count(*) filter (
          where access_entries.email_status = 'not_sent'
        )::integer as not_sent_count,
        count(*) filter (
          where access_entries.email_status = 'failed'
        )::integer as failed_count,
        count(distinct access_entries.email_status)::integer
          as email_status_count,
        count(*) filter (
          where access_entries.unit_index::bigint
            > access_order_items.quantity::bigint
              * access_order_items.entries_per_unit::bigint
        )::integer as invalid_unit_count,
        max(access_entries.email_sent_at) as max_email_sent_at
      from public.access_entries
      join public.access_order_items
        on access_order_items.id = access_entries.order_item_id
      group by access_entries.order_id
    ),
    source_state as (
      select
        access_orders.id as order_id,
        approved_selected.payment_attempt_id,
        approved_selected.provider,
        approved_selected.provider_operation,
        approved_selected.approved_count,
        coalesce(item_totals.item_count, 0) as item_count,
        coalesce(item_totals.expected_entries, 0) as expected_entries,
        coalesce(expected_units.expected_unit_count, 0)
          as expected_unit_count,
        coalesce(expected_units.missing_expected_unit_count, 0)
          as missing_expected_unit_count,
        coalesce(entry_totals.issued_entries, 0) as issued_entries,
        coalesce(entry_totals.sent_count, 0) as sent_count,
        coalesce(entry_totals.valid_sent_count, 0) as valid_sent_count,
        coalesce(entry_totals.not_sent_count, 0) as not_sent_count,
        coalesce(entry_totals.failed_count, 0) as failed_count,
        coalesce(entry_totals.email_status_count, 0)
          as email_status_count,
        coalesce(entry_totals.invalid_unit_count, 0)
          as invalid_unit_count,
        entry_totals.max_email_sent_at,
        transaction_timestamp() as observed_at
      from public.access_orders
      join approved_selected
        on approved_selected.order_id = access_orders.id
      left join item_totals
        on item_totals.order_id = access_orders.id
      left join expected_units
        on expected_units.order_id = access_orders.id
      left join entry_totals
        on entry_totals.order_id = access_orders.id
      where access_orders.status = 'paid'
    ),
    classified as (
      select
        source_state.*,
        case
          when approved_count > 1 then 'manual_review'
          when provider <> 'bancard'
            or provider_operation <> 'single_buy' then 'manual_review'
          when item_count = 0 then 'manual_review'
          when invalid_unit_count > 0 then 'manual_review'
          when issued_entries > expected_entries then 'manual_review'
          when issued_entries = expected_entries
            and expected_entries > 0 then 'complete'
          when issued_entries = 0 then 'pending'
          else 'partial'
        end as expected_issuance_status,
        case
          when approved_count > 1
            then 'multiple_approved_payment_attempts'
          when provider <> 'bancard'
            or provider_operation <> 'single_buy'
            then 'unsupported_approved_provider'
          when item_count = 0 then 'items_not_found'
          when invalid_unit_count > 0
            or issued_entries > expected_entries
            then 'entries_count_mismatch'
          when issued_entries > 0 and issued_entries < expected_entries
            then 'backfill_partial_entries'
          else null
        end as expected_issuance_error_code
      from source_state
    ),
    expected_state as (
      select
        classified.*,
        case
          when expected_issuance_status <> 'complete' then 'pending'
          when sent_count > 0 and valid_sent_count <> sent_count
            then 'manual_review'
          when email_status_count > 1 then 'manual_review'
          when sent_count = issued_entries and issued_entries > 0 then 'sent'
          when not_sent_count = issued_entries and issued_entries > 0
            then 'pending'
          when failed_count > 0 then 'manual_review'
          else 'manual_review'
        end as expected_email_status,
        case
          when expected_issuance_status <> 'complete' then null
          when sent_count > 0 and valid_sent_count <> sent_count
            then 'legacy_sent_without_timestamp'
          when email_status_count > 1 then 'legacy_email_mixed_state'
          when failed_count > 0 then 'legacy_email_failed_ambiguous'
          when sent_count = issued_entries
            or not_sent_count = issued_entries then null
          else 'legacy_email_mixed_state'
        end as expected_email_error_code
      from classified
    )
    select 1
    from expected_state
    full join public.access_order_fulfillments as fulfillment
      on fulfillment.order_id = expected_state.order_id
    where expected_state.order_id is null
      or fulfillment.order_id is null
      or fulfillment.approved_payment_attempt_id
        is distinct from expected_state.payment_attempt_id
      or fulfillment.expected_entries
        is distinct from expected_state.expected_entries::integer
      or fulfillment.issued_entries
        is distinct from expected_state.issued_entries
      or fulfillment.issuance_status
        is distinct from expected_state.expected_issuance_status
      or fulfillment.issuance_attempt_count is distinct from 0
      or fulfillment.issuance_last_attempt_at is not null
      or fulfillment.issuance_next_attempt_at is distinct from case
        when expected_state.expected_issuance_status in ('pending', 'partial')
          then expected_state.observed_at
        else null
      end
      or fulfillment.issuance_last_error_code
        is distinct from expected_state.expected_issuance_error_code
      or fulfillment.issuance_last_error_at is distinct from case
        when expected_state.expected_issuance_error_code is not null
          then expected_state.observed_at
        else null
      end
      or fulfillment.issuance_review_status is distinct from 'none'
      or fulfillment.issuance_review_error_code is not null
      or fulfillment.issuance_review_error_at is not null
      or fulfillment.email_status
        is distinct from expected_state.expected_email_status
      or fulfillment.email_generation is distinct from 1
      or fulfillment.email_next_attempt_at is distinct from case
        when expected_state.expected_issuance_status = 'complete'
          and expected_state.not_sent_count = expected_state.issued_entries
          and expected_state.issued_entries > 0
          then expected_state.observed_at
        else null
      end
      or fulfillment.email_sent_at is distinct from case
        when expected_state.expected_issuance_status = 'complete'
          and expected_state.sent_count = expected_state.issued_entries
          and expected_state.valid_sent_count = expected_state.sent_count
          and expected_state.issued_entries > 0
          then expected_state.max_email_sent_at
        else null
      end
      or fulfillment.email_last_error_code
        is distinct from expected_state.expected_email_error_code
      or fulfillment.email_last_error_at is distinct from case
        when expected_state.expected_issuance_status = 'complete'
          and (
            (
              expected_state.sent_count > 0
              and expected_state.valid_sent_count <> expected_state.sent_count
            )
            or expected_state.email_status_count > 1
            or expected_state.failed_count > 0
            or not (
              expected_state.sent_count = expected_state.issued_entries
              or expected_state.not_sent_count = expected_state.issued_entries
            )
          ) then expected_state.observed_at
        else null
      end
      or fulfillment.email_provider_message_id is not null
      or fulfillment.reconcile_lease_token is not null
      or fulfillment.reconcile_lease_expires_at is not null
      or fulfillment.reconcile_lease_epoch is distinct from 0
      or expected_state.expected_unit_count
        is distinct from expected_state.expected_entries::integer
      or (
        expected_state.expected_issuance_status = 'complete'
        and expected_state.missing_expected_unit_count <> 0
      )
  ) then
    raise exception
      'Migration 046 assertion failed: fulfillment backfill differs from source tables';
  end if;
end;
$$;