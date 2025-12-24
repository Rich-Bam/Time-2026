# Timebuzzer API Integration Guide

This guide explains how to integrate Timebuzzer time tracking with your application to automatically sync hours.

## Overview

The integration allows you to:
1. Fetch time entries from Timebuzzer
2. Automatically sync them to your timesheet
3. Map Timebuzzer users to your users
4. Map Timebuzzer projects to your projects

## Setup Steps

### 1. Get Your Timebuzzer API Key

1. Log in to your Timebuzzer account at [my.timebuzzer.com](https://my.timebuzzer.com)
2. Go to **Settings** → **API**
3. Generate or copy your API key
4. Save it for the next step

### 2. Configure Supabase Environment Variables

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Settings** → **Environment Variables**
3. Add the following environment variable:
   - **Name**: `TIMEBUZZER_API_KEY`
   - **Value**: Your Timebuzzer API key

### 3. Deploy the Edge Function

Deploy the Timebuzzer sync function:

```bash
cd time-track-teamwork-excel-main
supabase functions deploy timebuzzer-sync
```

### 4. Database Schema Updates

You'll need to add columns to store Timebuzzer IDs for mapping:

#### Add Timebuzzer User ID to Users Table

```sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS timebuzzer_user_id TEXT;

COMMENT ON COLUMN public.users.timebuzzer_user_id IS 'Timebuzzer user ID for syncing';
```

#### Add Timebuzzer Project ID to Projects Table

```sql
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS timebuzzer_project_id TEXT;

COMMENT ON COLUMN public.projects.timebuzzer_project_id IS 'Timebuzzer project/tile ID for syncing';
```

#### Add Timebuzzer Activity ID to Timesheet Table (optional, for duplicate prevention)

```sql
ALTER TABLE public.timesheet 
ADD COLUMN IF NOT EXISTS timebuzzer_activity_id TEXT UNIQUE;

COMMENT ON COLUMN public.timesheet.timebuzzer_activity_id IS 'Timebuzzer activity ID to prevent duplicate syncing';
```

### 5. Map Users and Projects

Before syncing, you need to map Timebuzzer users and projects to your local users and projects:

#### Map Users

1. Get Timebuzzer user IDs from the Timebuzzer API or dashboard
2. Update your users table with the Timebuzzer user IDs:

```sql
UPDATE public.users 
SET timebuzzer_user_id = 'timebuzzer-user-id-123'
WHERE email = 'user@example.com';
```

#### Map Projects

1. Get Timebuzzer project/tile IDs from the Timebuzzer API or dashboard
2. Update your projects table with the Timebuzzer project IDs:

```sql
UPDATE public.projects 
SET timebuzzer_project_id = 'timebuzzer-project-id-456'
WHERE name = 'Project Name';
```

## Usage

### Sync Timebuzzer Data to Timesheet

You can sync data in two ways:

#### Option 1: Via Admin Panel (Recommended)

Add a sync button to your admin panel that calls the Edge Function.

#### Option 2: Programmatically

```typescript
import { supabase } from '@/integrations/supabase/client';

const syncTimebuzzer = async (startDate?: string, endDate?: string, userId?: string) => {
  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
    body: {
      action: 'sync-to-timesheet',
      startDate: startDate, // Format: 'YYYY-MM-DD'
      endDate: endDate,     // Format: 'YYYY-MM-DD'
      userId: userId,       // Optional: Timebuzzer user ID
    },
  });

  if (error) {
    console.error('Sync error:', error);
    return;
  }

  console.log('Sync result:', data);
  // data.inserted: number of entries inserted
  // data.total: total entries processed
  // data.errors: array of errors (if any)
};
```

### Fetch Activities (Without Syncing)

To just fetch activities without syncing:

```typescript
const fetchActivities = async () => {
  const { data, error } = await supabase.functions.invoke('timebuzzer-sync', {
    body: {
      action: 'fetch-activities',
    },
  });

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  console.log('Activities:', data.data);
};
```

## Timebuzzer API Documentation

For detailed API documentation, visit:
- [Timebuzzer Developer Area](https://timebuzzer.com/developer-area/)
- [Timebuzzer API Documentation](https://my.timebuzzer.com/doc/)
- [Postman Collection](https://www.postman.com/timebuzzer/open-api/collection/11fruy1/timebuzzer-open-api)

## Authentication

Timebuzzer uses API key authentication. Include the API key in the Authorization header:

```
Authorization: APIKey YOUR_API_KEY
```

## Data Mapping

### Activity to Timesheet Entry

The Edge Function maps Timebuzzer activities to your timesheet entries:

- **Timebuzzer User ID** → **Your User ID** (via `timebuzzer_user_id` column)
- **Timebuzzer Project/Tile ID** → **Your Project Name** (via `timebuzzer_project_id` column)
- **Activity Date** → **Timesheet Date**
- **Activity Duration** → **Hours** (converted to hours)
- **Activity Start/End Time** → **StartTime/EndTime**
- **Activity Description/Note** → **Description**

## Troubleshooting

### API Key Not Working

1. Verify the API key in Timebuzzer settings
2. Check that it's correctly set in Supabase environment variables
3. Make sure there are no extra spaces in the API key

### Users/Projects Not Mapping

1. Verify that `timebuzzer_user_id` and `timebuzzer_project_id` are set correctly
2. Check that the IDs match the actual Timebuzzer IDs
3. Review sync errors in the response

### Duplicate Entries

The function uses `timebuzzer_activity_id` to prevent duplicates via upsert. Make sure:
1. The `timebuzzer_activity_id` column exists in the timesheet table
2. It has a UNIQUE constraint
3. The Timebuzzer activity IDs are being stored correctly

### Date/Time Format Issues

Timebuzzer may use different date/time formats. The Edge Function handles:
- ISO date strings
- Unix timestamps
- Custom date formats

If you encounter format issues, you may need to adjust the parsing logic in the Edge Function.

## Next Steps

1. Test the sync with a small date range
2. Verify entries are created correctly
3. Set up automatic syncing (cron job or scheduled task)
4. Consider adding a UI in the admin panel for manual syncing









