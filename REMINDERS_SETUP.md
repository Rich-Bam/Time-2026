# Reminders Table Setup

To enable the reminder functionality, you need to create the `reminders` table in your Supabase database.

## Steps:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `create_reminders_table.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the script

## What the script does:

- Creates the `reminders` table with the following columns:
  - `id` - Primary key
  - `user_id` - The user who should receive the reminder
  - `week_number` - The week number for the reminder
  - `year` - The year for the reminder
  - `message` - Optional custom message
  - `created_at` - When the reminder was created
  - `read_at` - When the user read the reminder (NULL = unread)
  - `created_by` - The admin who created the reminder

- Sets up Row Level Security (RLS) policies:
  - Admins can insert reminders
  - Users can view their own reminders
  - Users can update their own reminders (to mark as read)
  - Admins can delete reminders

- Creates indexes for faster queries

## After running the script:

The reminder functionality will work:
- Admins can send reminders to users (including other admins)
- Users will see a pop-up when they log in if they have an unread reminder
- Reminders are marked as read when the user dismisses or acts on them

