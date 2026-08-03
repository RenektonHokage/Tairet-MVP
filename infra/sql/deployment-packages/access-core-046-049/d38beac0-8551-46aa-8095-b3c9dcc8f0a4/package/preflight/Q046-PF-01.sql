BEGIN TRANSACTION READ ONLY;
WITH
approved_ranked AS (
  SELECT
    pa.order_id,
    pa.provider,
    pa.provider_operation,
    pa.confirmed_at,
    count(*) OVER (PARTITION BY pa.order_id) AS approved_count,
    row_number() OVER (
      PARTITION BY pa.order_id
      ORDER BY pa.confirmed_at ASC NULLS LAST,
               pa.attempt_number ASC,
               pa.id ASC
    ) AS approved_rank
  FROM public.payment_attempts AS pa
  WHERE pa.status = 'approved'
),
approved_selected AS (
  SELECT
    order_id,
    provider,
    provider_operation,
    confirmed_at,
    approved_count
  FROM approved_ranked
  WHERE approved_rank = 1
),
item_totals AS (
  SELECT
    oi.order_id,
    count(*) AS item_count,
    sum(oi.quantity::numeric * oi.entries_per_unit::numeric) AS expected_entries
  FROM public.access_order_items AS oi
  GROUP BY oi.order_id
),
entry_totals AS (
  SELECT
    e.order_id,
    count(*) AS issued_entries,
    count(*) FILTER (
      WHERE oi.id IS NULL
         OR oi.order_id IS DISTINCT FROM e.order_id
         OR oi.access_ticket_type_id IS DISTINCT FROM e.access_ticket_type_id
    ) AS alignment_violation_count,
    count(*) FILTER (
      WHERE oi.id IS NOT NULL
        AND e.unit_index::numeric < 1::numeric
    ) AS below_expected_range_count,
    count(*) FILTER (
      WHERE oi.id IS NOT NULL
        AND e.unit_index::numeric
          > oi.quantity::numeric * oi.entries_per_unit::numeric
    ) AS above_expected_range_count,
    count(*) FILTER (
      WHERE oi.id IS NOT NULL
        AND oi.order_id = e.order_id
        AND oi.access_ticket_type_id = e.access_ticket_type_id
        AND e.unit_index::numeric BETWEEN 1::numeric
          AND oi.quantity::numeric * oi.entries_per_unit::numeric
    ) AS valid_expected_entry_count,
    count(*) FILTER (WHERE e.email_status = 'sent') AS sent_count,
    count(*) FILTER (
      WHERE e.email_status = 'sent'
        AND e.email_sent_at IS NOT NULL
    ) AS valid_sent_count,
    count(*) FILTER (WHERE e.email_status = 'not_sent') AS not_sent_count,
    count(*) FILTER (WHERE e.email_status = 'failed') AS failed_count,
    count(DISTINCT e.email_status) AS email_status_count,
    count(*) FILTER (
      WHERE e.email_status IS NULL
         OR e.email_status NOT IN ('not_sent', 'sent', 'failed')
    ) AS invalid_email_status_count,
    count(*) FILTER (
      WHERE e.email_status = 'sent'
        AND e.email_sent_at IS NULL
    ) AS sent_without_timestamp_count
  FROM public.access_entries AS e
  LEFT JOIN public.access_order_items AS oi
    ON oi.id = e.order_item_id
  GROUP BY e.order_id
),
paid_state AS (
  SELECT
    o.id AS order_id,
    coalesce(a.approved_count, 0::bigint) AS approved_count,
    a.provider,
    a.provider_operation,
    a.confirmed_at,
    coalesce(i.item_count, 0::bigint) AS item_count,
    coalesce(i.expected_entries, 0::numeric) AS expected_entries,
    coalesce(e.issued_entries, 0::bigint) AS issued_entries,
    coalesce(e.alignment_violation_count, 0::bigint) AS alignment_violation_count,
    coalesce(e.below_expected_range_count, 0::bigint) AS below_expected_range_count,
    coalesce(e.above_expected_range_count, 0::bigint) AS above_expected_range_count,
    coalesce(e.valid_expected_entry_count, 0::bigint) AS valid_expected_entry_count,
    coalesce(e.sent_count, 0::bigint) AS sent_count,
    coalesce(e.valid_sent_count, 0::bigint) AS valid_sent_count,
    coalesce(e.not_sent_count, 0::bigint) AS not_sent_count,
    coalesce(e.failed_count, 0::bigint) AS failed_count,
    coalesce(e.email_status_count, 0::bigint) AS email_status_count,
    coalesce(e.invalid_email_status_count, 0::bigint) AS invalid_email_status_count,
    coalesce(e.sent_without_timestamp_count, 0::bigint) AS sent_without_timestamp_count
  FROM public.access_orders AS o
  LEFT JOIN approved_selected AS a
    ON a.order_id = o.id
  LEFT JOIN item_totals AS i
    ON i.order_id = o.id
  LEFT JOIN entry_totals AS e
    ON e.order_id = o.id
  WHERE o.status = 'paid'
),
classified AS (
  SELECT
    p.*,
    CASE
      WHEN p.approved_count > 1 THEN 'manual_review'
      WHEN p.provider <> 'bancard'
        OR p.provider_operation <> 'single_buy' THEN 'manual_review'
      WHEN p.item_count = 0 THEN 'manual_review'
      WHEN p.above_expected_range_count > 0 THEN 'manual_review'
      WHEN p.issued_entries::numeric > p.expected_entries THEN 'manual_review'
      WHEN p.issued_entries::numeric = p.expected_entries
        AND p.expected_entries > 0 THEN 'complete'
      WHEN p.issued_entries = 0 THEN 'pending'
      ELSE 'partial'
    END AS expected_issuance_status,
    CASE
      WHEN p.approved_count > 1 THEN 'multiple_approved_payment_attempts'
      WHEN p.provider <> 'bancard'
        OR p.provider_operation <> 'single_buy' THEN 'unsupported_approved_provider'
      WHEN p.item_count = 0 THEN 'items_not_found'
      WHEN p.above_expected_range_count > 0
        OR p.issued_entries::numeric > p.expected_entries THEN 'entries_count_mismatch'
      WHEN p.issued_entries > 0
        AND p.issued_entries::numeric < p.expected_entries THEN 'backfill_partial_entries'
      ELSE NULL
    END AS expected_issuance_error_code
  FROM paid_state AS p
  WHERE p.approved_count > 0
),
projected AS (
  SELECT
    c.*,
    CASE
      WHEN c.expected_issuance_status <> 'complete' THEN 'pending'
      WHEN c.sent_count > 0
        AND c.valid_sent_count <> c.sent_count THEN 'manual_review'
      WHEN c.email_status_count > 1 THEN 'manual_review'
      WHEN c.sent_count = c.issued_entries
        AND c.issued_entries > 0 THEN 'sent'
      WHEN c.not_sent_count = c.issued_entries
        AND c.issued_entries > 0 THEN 'pending'
      WHEN c.failed_count > 0 THEN 'manual_review'
      ELSE 'manual_review'
    END AS expected_email_status,
    CASE
      WHEN c.expected_issuance_status <> 'complete' THEN NULL
      WHEN c.sent_count > 0
        AND c.valid_sent_count <> c.sent_count THEN 'legacy_sent_without_timestamp'
      WHEN c.email_status_count > 1 THEN 'legacy_email_mixed_state'
      WHEN c.failed_count > 0 THEN 'legacy_email_failed_ambiguous'
      WHEN c.sent_count = c.issued_entries
        OR c.not_sent_count = c.issued_entries THEN NULL
      ELSE 'legacy_email_mixed_state'
    END AS expected_email_error_code
  FROM classified AS c
),
metrics AS (
  SELECT
    (SELECT count(*) FROM paid_state) AS paid_order_count,
    (SELECT count(*) FROM projected) AS eligible_paid_order_count,
    (SELECT count(*) FROM paid_state WHERE approved_count = 0) AS paid_without_approved_attempt_order_count,
    (
      SELECT count(*)
      FROM approved_selected AS a
      JOIN public.access_orders AS o ON o.id = a.order_id
      WHERE o.status <> 'paid'
    ) AS nonpaid_with_approved_attempt_order_count,
    (
      SELECT coalesce(sum(a.approved_count), 0::numeric)
      FROM approved_selected AS a
      JOIN public.access_orders AS o ON o.id = a.order_id
      WHERE o.status <> 'paid'
    ) AS nonpaid_approved_attempt_count,
    (SELECT count(*) FROM paid_state WHERE approved_count > 2147483647::bigint) AS paid_approved_count_integer_overflow_order_count,
    (SELECT count(*) FROM item_totals WHERE item_count > 2147483647::bigint) AS global_item_count_integer_overflow_order_count,
    (SELECT count(*) FROM item_totals WHERE expected_entries > 9223372036854775807::numeric) AS global_expected_entries_bigint_overflow_order_count,
    (SELECT count(*) FROM item_totals WHERE expected_entries > 2147483647::numeric) AS global_expected_entries_integer_overflow_order_count,
    (SELECT count(*) FROM entry_totals WHERE issued_entries > 2147483647::bigint) AS global_issued_count_integer_overflow_order_count,
    (SELECT coalesce(sum(expected_entries), 0::numeric) FROM item_totals) AS global_expected_entry_total,
    (SELECT coalesce(max(expected_entries), 0::numeric) FROM item_totals) AS global_max_expected_entries_per_order,
    (SELECT coalesce(sum(issued_entries), 0::numeric) FROM entry_totals) AS global_existing_entry_total,
    (SELECT coalesce(max(issued_entries), 0::bigint) FROM entry_totals) AS global_max_existing_entries_per_order,
    (SELECT coalesce(sum(alignment_violation_count), 0::numeric) FROM entry_totals) AS global_entry_alignment_violation_count,
    (SELECT coalesce(sum(below_expected_range_count), 0::numeric) FROM entry_totals) AS global_below_expected_range_entry_count,
    (SELECT coalesce(sum(invalid_email_status_count), 0::numeric) FROM entry_totals) AS global_invalid_email_status_entry_count,
    (SELECT coalesce(sum(sent_without_timestamp_count), 0::numeric) FROM entry_totals) AS global_sent_without_timestamp_entry_count,
    (SELECT count(*) FROM projected WHERE confirmed_at IS NULL) AS selected_approved_without_confirmation_order_count,
    (SELECT count(*) FROM projected WHERE expected_entries > 2147483647::numeric) AS eligible_expected_entries_integer_overflow_order_count,
    (SELECT coalesce(sum(expected_entries), 0::numeric) FROM projected) AS eligible_expected_entry_total,
    (SELECT coalesce(max(expected_entries), 0::numeric) FROM projected) AS eligible_max_expected_entries_per_order,
    (SELECT coalesce(sum(issued_entries), 0::numeric) FROM projected) AS eligible_existing_entry_total,
    (SELECT coalesce(sum(above_expected_range_count), 0::numeric) FROM projected) AS eligible_above_expected_range_entry_count,
    (SELECT count(*) FROM projected WHERE above_expected_range_count > 0) AS eligible_above_expected_range_order_count,
    (SELECT count(*) FROM projected WHERE issued_entries::numeric > expected_entries) AS eligible_overissued_order_count,
    (
      SELECT count(*)
      FROM projected
      WHERE expected_issuance_status = 'complete'
        AND expected_entries <> valid_expected_entry_count::numeric
    ) AS complete_expected_unit_mismatch_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_status = 'pending') AS projected_issuance_pending_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_status = 'partial') AS projected_issuance_partial_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_status = 'complete') AS projected_issuance_complete_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_error_code = 'multiple_approved_payment_attempts') AS projected_review_multiple_approved_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_error_code = 'unsupported_approved_provider') AS projected_review_unsupported_provider_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_error_code = 'items_not_found') AS projected_review_items_not_found_order_count,
    (SELECT count(*) FROM projected WHERE expected_issuance_error_code = 'entries_count_mismatch') AS projected_review_entries_mismatch_order_count,
    (SELECT count(*) FROM projected WHERE expected_email_status = 'pending') AS projected_email_pending_order_count,
    (SELECT count(*) FROM projected WHERE expected_email_status = 'sent') AS projected_email_sent_order_count,
    (SELECT count(*) FROM projected WHERE expected_email_error_code = 'legacy_sent_without_timestamp') AS projected_email_review_sent_without_timestamp_order_count,
    (SELECT count(*) FROM projected WHERE expected_email_error_code = 'legacy_email_mixed_state') AS projected_email_review_mixed_state_order_count,
    (SELECT count(*) FROM projected WHERE expected_email_error_code = 'legacy_email_failed_ambiguous') AS projected_email_review_failed_ambiguous_order_count,
    (
      SELECT count(*)
      FROM projected
      WHERE expected_issuance_status <> 'complete'
        AND (sent_count > 0 OR failed_count > 0)
    ) AS incomplete_with_legacy_sent_or_failed_order_count
)
SELECT
  metrics.*,
  (
    paid_approved_count_integer_overflow_order_count = 0
    AND global_item_count_integer_overflow_order_count = 0
    AND global_expected_entries_bigint_overflow_order_count = 0
    AND global_expected_entries_integer_overflow_order_count = 0
    AND global_issued_count_integer_overflow_order_count = 0
    AND eligible_expected_entries_integer_overflow_order_count = 0
  ) AS sql_numeric_and_cast_safety_pass,
  (
    global_entry_alignment_violation_count = 0
    AND global_below_expected_range_entry_count = 0
    AND global_invalid_email_status_entry_count = 0
    AND global_sent_without_timestamp_entry_count = 0
    AND complete_expected_unit_mismatch_order_count = 0
  ) AS catalog_promised_row_invariants_pass,
  (
    paid_approved_count_integer_overflow_order_count = 0
    AND global_item_count_integer_overflow_order_count = 0
    AND global_expected_entries_bigint_overflow_order_count = 0
    AND global_expected_entries_integer_overflow_order_count = 0
    AND global_issued_count_integer_overflow_order_count = 0
    AND eligible_expected_entries_integer_overflow_order_count = 0
    AND global_entry_alignment_violation_count = 0
    AND global_below_expected_range_entry_count = 0
    AND global_invalid_email_status_entry_count = 0
    AND complete_expected_unit_mismatch_order_count = 0
  ) AS migration_supported_projection_pass,
  (
    paid_without_approved_attempt_order_count = 0
    AND nonpaid_with_approved_attempt_order_count = 0
    AND selected_approved_without_confirmation_order_count = 0
    AND projected_review_multiple_approved_order_count = 0
    AND projected_review_unsupported_provider_order_count = 0
    AND projected_review_items_not_found_order_count = 0
    AND projected_review_entries_mismatch_order_count = 0
    AND projected_email_review_sent_without_timestamp_order_count = 0
    AND projected_email_review_mixed_state_order_count = 0
    AND projected_email_review_failed_ambiguous_order_count = 0
    AND incomplete_with_legacy_sent_or_failed_order_count = 0
    AND global_sent_without_timestamp_entry_count = 0
  ) AS clean_operational_handoff_pass
FROM metrics;
ROLLBACK;
