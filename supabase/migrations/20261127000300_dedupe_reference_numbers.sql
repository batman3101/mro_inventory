-- Renumber duplicate inbound/outbound reference numbers, then enforce uniqueness.
--
-- Production 2026-11-27: 51 outbound rows shared OUT-20260910-100. The old
-- client-side numbering sorted references as text, so after ...-99 it kept
-- reading ...-99 as the maximum and issued ...-100 again. Numbering is now
-- server-side (private.next_reference_number); this cleans up the past.
--
-- Rule: the earliest row (created_at, id) keeps its number; the others get the
-- next free numbers of the same day in creation order. Every change is logged
-- in private.reference_number_changes so paper records can be matched.

CREATE TABLE IF NOT EXISTS private.reference_number_changes (
  table_name    TEXT        NOT NULL,
  row_id        UUID        NOT NULL,
  old_reference TEXT        NOT NULL,
  new_reference TEXT        NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON private.reference_number_changes FROM PUBLIC, anon, authenticated;

-- outbound
WITH ranked AS (
  SELECT outbound_id AS id, reference_number,
         regexp_replace(reference_number, '[0-9]+$', '') AS prefix,
         row_number() OVER (PARTITION BY reference_number ORDER BY created_at, outbound_id) AS rn
  FROM public.outbound
  WHERE reference_number IS NOT NULL
), dups AS (
  SELECT id, reference_number, prefix,
         row_number() OVER (PARTITION BY prefix ORDER BY reference_number, rn) AS k
  FROM ranked
  WHERE rn > 1
), base AS (
  SELECT prefix, max(substring(reference_number FROM '[0-9]+$')::int) AS max_seq
  FROM ranked
  GROUP BY prefix
), plan AS (
  SELECT d.id, d.reference_number AS old_ref, (b.max_seq + d.k) AS seq, d.prefix
  FROM dups d JOIN base b USING (prefix)
), logged AS (
  INSERT INTO private.reference_number_changes (table_name, row_id, old_reference, new_reference)
  SELECT 'outbound', id, old_ref, prefix || lpad(seq::text, greatest(2, length(seq::text)), '0')
  FROM plan
  RETURNING row_id, new_reference
)
UPDATE public.outbound o
SET reference_number = l.new_reference
FROM logged l
WHERE o.outbound_id = l.row_id;

-- inbound (no duplicates on 2026-11-27; kept so the constraint below is safe)
WITH ranked AS (
  SELECT inbound_id AS id, reference_number,
         regexp_replace(reference_number, '[0-9]+$', '') AS prefix,
         row_number() OVER (PARTITION BY reference_number ORDER BY created_at, inbound_id) AS rn
  FROM public.inbound
  WHERE reference_number IS NOT NULL
), dups AS (
  SELECT id, reference_number, prefix,
         row_number() OVER (PARTITION BY prefix ORDER BY reference_number, rn) AS k
  FROM ranked
  WHERE rn > 1
), base AS (
  SELECT prefix, max(substring(reference_number FROM '[0-9]+$')::int) AS max_seq
  FROM ranked
  GROUP BY prefix
), plan AS (
  SELECT d.id, d.reference_number AS old_ref, (b.max_seq + d.k) AS seq, d.prefix
  FROM dups d JOIN base b USING (prefix)
), logged AS (
  INSERT INTO private.reference_number_changes (table_name, row_id, old_reference, new_reference)
  SELECT 'inbound', id, old_ref, prefix || lpad(seq::text, greatest(2, length(seq::text)), '0')
  FROM plan
  RETURNING row_id, new_reference
)
UPDATE public.inbound i
SET reference_number = l.new_reference
FROM logged l
WHERE i.inbound_id = l.row_id;

ALTER TABLE public.outbound DROP CONSTRAINT IF EXISTS outbound_reference_number_key;
ALTER TABLE public.outbound ADD CONSTRAINT outbound_reference_number_key UNIQUE (reference_number);
ALTER TABLE public.inbound DROP CONSTRAINT IF EXISTS inbound_reference_number_key;
ALTER TABLE public.inbound ADD CONSTRAINT inbound_reference_number_key UNIQUE (reference_number);
