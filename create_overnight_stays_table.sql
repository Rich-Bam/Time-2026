-- Track overnight stays (didn't sleep at home) per user per date
-- This is independent from timesheet entries so it can be toggled and saved immediately.

create table if not exists public.overnight_stays (
  id bigserial primary key,
  user_id uuid not null,
  date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists overnight_stays_user_date_idx
  on public.overnight_stays (user_id, date);

