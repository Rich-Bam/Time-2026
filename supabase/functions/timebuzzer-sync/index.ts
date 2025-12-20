import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIMEBUZZER_API_URL = 'https://my.timebuzzer.com/api/v1'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get API key from environment variables
    const TIMEBUZZER_API_KEY = Deno.env.get('TIMEBUZZER_API_KEY')
    
    if (!TIMEBUZZER_API_KEY) {
      throw new Error('TIMEBUZZER_API_KEY not configured in environment variables')
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request body
    const { action, userId, startDate, endDate } = await req.json()

    if (action === 'fetch-activities') {
      // Fetch activities from Timebuzzer
      const queryParams = new URLSearchParams()
      if (startDate) queryParams.append('start_date', startDate)
      if (endDate) queryParams.append('end_date', endDate)
      if (userId) queryParams.append('user_id', userId)

      const activitiesUrl = `${TIMEBUZZER_API_URL}/activities${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      
      console.log('Fetching activities from:', activitiesUrl)
      
      const response = await fetch(activitiesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `APIKey ${TIMEBUZZER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Timebuzzer API error:', response.status, errorText)
        throw new Error(`Timebuzzer API error: ${response.status} - ${errorText}`)
      }

      const activities = await response.json()
      console.log('Timebuzzer API response:', JSON.stringify(activities, null, 2))

      return new Response(
        JSON.stringify({ success: true, data: activities }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    if (action === 'test-api') {
      // Test endpoint to see what the API returns
      try {
        const response = await fetch(`${TIMEBUZZER_API_URL}/activities?limit=10`, {
          method: 'GET',
          headers: {
            'Authorization': `APIKey ${TIMEBUZZER_API_KEY}`,
            'Content-Type': 'application/json',
          },
        })

        const responseText = await response.text()
        let activities
        try {
          activities = JSON.parse(responseText)
        } catch (e) {
          activities = responseText
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: activities,
            rawResponse: responseText.substring(0, 1000), // First 1000 chars
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message, stack: error.stack }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
        )
      }
    }

    if (action === 'sync-to-timesheet') {
      // Fetch activities from Timebuzzer
      const queryParams = new URLSearchParams()
      if (startDate) queryParams.append('start_date', startDate)
      if (endDate) queryParams.append('end_date', endDate)
      if (userId) queryParams.append('user_id', userId)

      const activitiesUrl = `${TIMEBUZZER_API_URL}/activities${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      
      const response = await fetch(activitiesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `APIKey ${TIMEBUZZER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Timebuzzer API error: ${response.status} - ${errorText}`)
      }

      const activities = await response.json()

      // Get user mapping from database (Timebuzzer user ID to your user ID)
      const { data: userMappings } = await supabase
        .from('users')
        .select('id, email, timebuzzer_user_id')
        .not('timebuzzer_user_id', 'is', null)

      const userMap = new Map(
        (userMappings || []).map(u => [u.timebuzzer_user_id, u.id])
      )

      // Get project mapping
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, timebuzzer_project_id')
        .not('timebuzzer_project_id', 'is', null)

      const projectMap = new Map(
        (projects || []).map(p => [p.timebuzzer_project_id, p])
      )

      // Convert Timebuzzer activities to timesheet entries
      const timesheetEntries = []
      const errors = []

      for (const activity of activities.data || activities) {
        try {
          // Map Timebuzzer user to your user
          const localUserId = userMap.get(activity.user_id)
          if (!localUserId) {
            errors.push(`No user mapping found for Timebuzzer user ID: ${activity.user_id}`)
            continue
          }

          // Map Timebuzzer project to your project
          const project = projectMap.get(activity.project_id || activity.tile_id)
          if (!project) {
            errors.push(`No project mapping found for Timebuzzer project ID: ${activity.project_id || activity.tile_id}`)
            continue
          }

          // Parse date and time
          const activityDate = new Date(activity.date || activity.created_at)
          const dateStr = activityDate.toISOString().split('T')[0]

          // Calculate hours (Timebuzzer usually stores duration in seconds or minutes)
          let hours = 0
          if (activity.duration) {
            // Convert duration to hours (assuming it's in seconds or minutes)
            hours = activity.duration_unit === 'minutes' 
              ? activity.duration / 60 
              : activity.duration / 3600
          } else if (activity.start_time && activity.end_time) {
            // Calculate from start/end times
            const start = new Date(`${dateStr}T${activity.start_time}`)
            const end = new Date(`${dateStr}T${activity.end_time}`)
            hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          }

          // Parse start and end times if available
          const startTime = activity.start_time || null
          const endTime = activity.end_time || null

          // Get work type (description or activity type)
          const workType = activity.description || activity.activity_type || activity.note || ''

          timesheetEntries.push({
            user_id: localUserId,
            date: dateStr,
            project: project.name,
            hours: hours,
            description: workType,
            startTime: startTime,
            endTime: endTime,
            // Store Timebuzzer ID for reference and to prevent duplicates
            timebuzzer_activity_id: activity.id,
          })
        } catch (error: any) {
          errors.push(`Error processing activity ${activity.id}: ${error.message}`)
        }
      }

      // Insert timesheet entries (upsert to prevent duplicates based on timebuzzer_activity_id)
      if (timesheetEntries.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('timesheet')
          .upsert(timesheetEntries, {
            onConflict: 'timebuzzer_activity_id',
            ignoreDuplicates: false,
          })
          .select()

        if (insertError) {
          throw new Error(`Failed to insert timesheet entries: ${insertError.message}`)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            inserted: inserted?.length || 0,
            total: timesheetEntries.length,
            errors: errors.length > 0 ? errors : undefined,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0,
          total: 0,
          message: 'No entries to sync',
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    throw new Error(`Unknown action: ${action}`)

  } catch (error: any) {
    console.error('Timebuzzer sync error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})

