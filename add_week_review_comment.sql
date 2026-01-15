-- Add review metadata to confirmed_weeks for approve/reject workflow
-- - admin_review_comment: optional message to user on rejection (or approval notes)
-- - admin_reviewed_by / admin_reviewed_at: audit trail

alter table public.confirmed_weeks
add column if not exists admin_review_comment text,
add column if not exists admin_reviewed_by uuid,
add column if not exists admin_reviewed_at timestamptz;

