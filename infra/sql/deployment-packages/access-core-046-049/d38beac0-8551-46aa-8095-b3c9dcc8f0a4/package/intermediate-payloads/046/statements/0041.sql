with
backfill_clock as (
  select transaction_timestamp() as observed_at
),
approved_ranked as (
  select
    payment_attempts.order_id,
    payment_attempts.id as payment_attempt_id,
    payment_attempts.provider,
    payment_attempts.provider_operation,
    count(*) over (partition by payment_attempts.order_id)::integer as approved_count,
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
  select
    order_id, payment_attempt_id, approved_count, provider, provider_operation
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
    ), 0)
      as expected_entries
  from public.access_order_items
  group by access_order_items.order_id
),
entry_totals as (
  select
    access_entries.order_id,
    count(*)::integer as issued_entries,
    count(*) filter (where access_entries.email_status = 'sent')::integer as sent_count,
    count(*) filter (
      where access_entries.email_status = 'sent'
        and access_entries.email_sent_at is not null
    )::integer as valid_sent_count,
    count(*) filter (where access_entries.email_status = 'not_sent')::integer as not_sent_count,
    count(*) filter (where access_entries.email_status = 'failed')::integer as failed_count,
    count(distinct access_entries.email_status)::integer as email_status_count,
    count(*) filter (
      where access_entries.unit_index::bigint
        > access_order_items.quantity::bigint * access_order_items.entries_per_unit::bigint
    )::integer
      as invalid_unit_count,
    max(access_entries.email_sent_at) as max_email_sent_at
  from public.access_entries
  join public.access_order_items
    on access_order_items.id
      = access_entries.order_item_id
  group by access_entries.order_id
),
classified as (
  select
    access_orders.id as order_id,
    approved_selected.payment_attempt_id,
    approved_selected.approved_count,
    coalesce(item_totals.item_count, 0) as item_count,
    coalesce(item_totals.expected_entries, 0) as expected_entries,
    coalesce(entry_totals.issued_entries, 0) as issued_entries,
    coalesce(entry_totals.sent_count, 0) as sent_count,
    coalesce(entry_totals.valid_sent_count, 0) as valid_sent_count,
    coalesce(entry_totals.not_sent_count, 0) as not_sent_count,
    coalesce(entry_totals.failed_count, 0) as failed_count,
    coalesce(entry_totals.email_status_count, 0) as email_status_count,
    coalesce(entry_totals.invalid_unit_count, 0)
      as invalid_unit_count,
    entry_totals.max_email_sent_at,
    backfill_clock.observed_at,
    case
      when approved_selected.approved_count > 1 then 'manual_review'
      when approved_selected.provider <> 'bancard'
        or approved_selected.provider_operation <> 'single_buy'
        then 'manual_review'
      when coalesce(item_totals.item_count, 0) = 0 then 'manual_review'
      when coalesce(entry_totals.invalid_unit_count, 0) > 0
        then 'manual_review'
      when coalesce(entry_totals.issued_entries, 0) > coalesce(item_totals.expected_entries, 0)
        then 'manual_review'
      when coalesce(entry_totals.issued_entries, 0) = coalesce(item_totals.expected_entries, 0)
        and coalesce(item_totals.expected_entries, 0) > 0 then 'complete'
      when coalesce(entry_totals.issued_entries, 0) = 0 then 'pending'
      else 'partial'
    end as issuance_status,
    case
      when approved_selected.approved_count > 1 then 'multiple_approved_payment_attempts'
      when approved_selected.provider <> 'bancard'
        or approved_selected.provider_operation <> 'single_buy'
        then 'unsupported_approved_provider'
      when coalesce(item_totals.item_count, 0) = 0 then 'items_not_found'
      when coalesce(entry_totals.invalid_unit_count, 0) > 0
        then 'entries_count_mismatch'
      when coalesce(entry_totals.issued_entries, 0) > coalesce(item_totals.expected_entries, 0)
        then 'entries_count_mismatch'
      when coalesce(entry_totals.issued_entries, 0) > 0
        and coalesce(entry_totals.issued_entries, 0) < coalesce(item_totals.expected_entries, 0)
        then 'backfill_partial_entries'
      else null
    end as issuance_error_code
  from public.access_orders
  join approved_selected on approved_selected.order_id = access_orders.id
  left join item_totals on item_totals.order_id = access_orders.id
  left join entry_totals on entry_totals.order_id = access_orders.id
  cross join backfill_clock
  where access_orders.status = 'paid'
)
insert into public.access_order_fulfillments (
  order_id,
  approved_payment_attempt_id,
  expected_entries,
  issued_entries,
  issuance_status,
  issuance_attempt_count,
  issuance_last_attempt_at,
  issuance_next_attempt_at,
  issuance_last_error_code,
  issuance_last_error_at,
  issuance_review_status,
  issuance_review_error_code,
  issuance_review_error_at,
  email_status,
  email_generation,
  email_next_attempt_at,
  email_sent_at,
  email_last_error_code,
  email_last_error_at,
  email_provider_message_id,
  reconcile_lease_token,
  reconcile_lease_expires_at,
  created_at,
  updated_at
)
select
  classified.order_id,
  classified.payment_attempt_id,
  classified.expected_entries::integer,
  classified.issued_entries,
  classified.issuance_status,
  0,
  null,
  case
    when classified.issuance_status in ('pending', 'partial') then classified.observed_at
    else null
  end,
  classified.issuance_error_code,
  case when classified.issuance_error_code is not null then classified.observed_at else null end,
  'none',
  null,
  null,
  case
    when classified.issuance_status <> 'complete' then 'pending'
    when classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count
      then 'manual_review'
    when classified.email_status_count > 1 then 'manual_review'
    when classified.sent_count = classified.issued_entries and classified.issued_entries > 0
      then 'sent'
    when classified.not_sent_count = classified.issued_entries and classified.issued_entries > 0
      then 'pending'
    when classified.failed_count > 0 then 'manual_review'
    else 'manual_review'
  end,
  1,
  case
    when classified.issuance_status = 'complete'
      and classified.not_sent_count = classified.issued_entries
      and classified.issued_entries > 0
      then classified.observed_at
    else null
  end,
  case
    when classified.issuance_status = 'complete'
      and classified.sent_count = classified.issued_entries
      and classified.valid_sent_count = classified.sent_count
      and classified.issued_entries > 0
      then classified.max_email_sent_at
    else null
  end,
  case
    when classified.issuance_status <> 'complete' then null
    when classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count
      then 'legacy_sent_without_timestamp'
    when classified.email_status_count > 1 then 'legacy_email_mixed_state'
    when classified.failed_count > 0 then 'legacy_email_failed_ambiguous'
    when classified.sent_count = classified.issued_entries
      or classified.not_sent_count = classified.issued_entries then null
    else 'legacy_email_mixed_state'
  end,
  case
    when classified.issuance_status = 'complete' and (
      (classified.sent_count > 0 and classified.valid_sent_count <> classified.sent_count)
      or classified.email_status_count > 1
      or classified.failed_count > 0
      or not (
        classified.sent_count = classified.issued_entries
        or classified.not_sent_count = classified.issued_entries
      )
    ) then classified.observed_at
    else null
  end,
  null,
  null,
  null,
  classified.observed_at,
  classified.observed_at
from classified;