-- Add stayed_overnight flag to timesheet entries
-- This allows users/admins to track "stayed overnight (didn't sleep at home)" per day.

alter table public.timesheet
add column if not exists stayed_overnight boolean not null default false;

