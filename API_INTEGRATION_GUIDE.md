# API Integration Guide

This guide explains how to integrate external APIs into your application.

## Two Main Approaches

### 1. Direct API Calls from React (Public APIs)

Use this for APIs that:
- Don't require authentication/API keys
- Support CORS (Cross-Origin Resource Sharing)
- Are public/published APIs

**Example: Weather API**

```typescript
// In a React component
const fetchWeather = async (city: string) => {
  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=YOUR_API_KEY`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching weather:', error);
  }
};
```

**Example: Currency Exchange Rate**

```typescript
const fetchExchangeRate = async () => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
  }
};
```

### 2. Via Supabase Edge Functions (Recommended for APIs with Keys)

Use this for APIs that:
- Require API keys or authentication
- Don't support CORS
- Need to keep keys secret
- Require server-side processing

## Step-by-Step: Adding an External API

### Example: Integrate a Time Tracking API (like Toggl or Clockify)

#### Option A: Public API (No Keys Required)

```typescript
// src/utils/externalApi.ts
export const fetchPublicData = async (endpoint: string) => {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};
```

#### Option B: Protected API (With API Key) - Use Edge Function

1. **Create Edge Function** (`supabase/functions/call-external-api/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get API key from environment variables
    const EXTERNAL_API_KEY = Deno.env.get('EXTERNAL_API_KEY')
    
    if (!EXTERNAL_API_KEY) {
      throw new Error('API key not configured')
    }

    // Get request body
    const { endpoint, method = 'GET', body } = await req.json()

    // Call external API
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${EXTERNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
```

2. **Call from React Component**:

```typescript
import { supabase } from '@/integrations/supabase/client';

const callExternalAPI = async () => {
  const { data, error } = await supabase.functions.invoke('call-external-api', {
    body: {
      endpoint: 'https://api.example.com/data',
      method: 'GET',
    },
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('API Response:', data);
};
```

3. **Set Environment Variables in Supabase**:
   - Go to Supabase Dashboard → Edge Functions → Settings
   - Add `EXTERNAL_API_KEY` as an environment variable

## Popular APIs You Can Integrate

### 1. **Time Tracking APIs**
- **Toggl API**: Track time entries
- **Clockify API**: Time tracking and reporting
- **Harvest API**: Time and expense tracking

### 2. **Project Management APIs**
- **Jira API**: Issue tracking
- **Asana API**: Task management
- **Trello API**: Board and card management

### 3. **Communication APIs**
- **Slack API**: Send notifications
- **Microsoft Teams API**: Team notifications
- **Discord API**: Discord bot integration

### 4. **Data APIs**
- **REST Countries API**: Country data
- **OpenWeatherMap API**: Weather data
- **Exchange Rate API**: Currency conversion

### 5. **Automation APIs**
- **Zapier API**: Workflow automation
- **IFTTT API**: Applet automation
- **Make (Integromat) API**: Automation workflows

## Best Practices

1. **Never expose API keys in client-side code**
   - Always use Edge Functions for APIs with keys
   - Store keys in Supabase environment variables

2. **Handle errors gracefully**
   - Always use try-catch blocks
   - Show user-friendly error messages
   - Log errors for debugging

3. **Implement rate limiting**
   - Respect API rate limits
   - Cache responses when possible
   - Use debouncing for search APIs

4. **Cache responses**
   - Store API responses in Supabase database
   - Set appropriate cache headers
   - Use React Query for client-side caching

5. **Test thoroughly**
   - Test with real API responses
   - Handle network failures
   - Test error scenarios

## Example: Complete Integration

Here's a complete example of integrating an external API:

```typescript
// src/utils/externalApi.ts
import { supabase } from '@/integrations/supabase/client';

export interface ExternalApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export const fetchExternalData = async (
  endpoint: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
  }
): Promise<ExternalApiResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('call-external-api', {
      body: {
        endpoint,
        method: options?.method || 'GET',
        body: options?.body,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
```

## Questions?

If you want to integrate a specific API, tell me:
1. Which API you want to use
2. What you want to do with it
3. Whether it requires an API key

I can help you implement it!

















