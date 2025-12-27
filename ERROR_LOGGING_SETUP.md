# Error Logging Setup

Dit document beschrijft hoe het error logging systeem werkt en hoe je het instelt.

## Overzicht

Het error logging systeem logt automatisch alle errors die users ervaren in de applicatie. Deze errors zijn alleen zichtbaar voor de super admin in het admin panel.

## Setup

### 1. Database Tabel Aanmaken

Voer het SQL script uit om de `error_logs` tabel aan te maken:

1. Ga naar je Supabase Dashboard
2. Navigate naar **SQL Editor**
3. Kopieer de inhoud van `create_error_logs_table.sql`
4. Plak het in de SQL Editor
5. Klik op **Run** om het script uit te voeren

### 2. Wat het Script Doet

- Maakt de `error_logs` tabel aan met de volgende kolommen:
  - `id` - Primary key (UUID)
  - `user_id` - ID van de user die de error heeft ervaren
  - `user_email` - Email van de user
  - `user_name` - Naam van de user
  - `error_message` - Het error bericht
  - `error_stack` - Stack trace van de error
  - `error_component` - Component waar de error optrad
  - `error_url` - URL waar de error optrad
  - `user_agent` - Browser user agent
  - `browser_info` - Gedetailleerde browser informatie (JSON)
  - `severity` - Severity level ('error', 'warning', 'info')
  - `resolved` - Of de error is opgelost
  - `resolved_at` - Wanneer de error is opgelost
  - `resolved_by` - Wie de error heeft opgelost
  - `notes` - Notities over de oplossing
  - `created_at` - Wanneer de error is gelogd

- Stelt Row Level Security (RLS) policies in:
  - Iedereen kan errors loggen (INSERT)
  - Alleen super admin kan errors bekijken (SELECT)
  - Alleen super admin kan errors updaten (UPDATE)
  - Alleen super admin kan errors verwijderen (DELETE)

- Maakt indexes aan voor snellere queries

## Functionaliteit

### Automatische Error Logging

Het systeem logt automatisch:

1. **React Errors** - Via de ErrorBoundary component
2. **JavaScript Errors** - Via de global error handler
3. **Unhandled Promise Rejections** - Via de unhandled rejection handler

### Error Log Sectie in Admin Panel

De super admin kan errors bekijken in het Admin Panel:

- **Filters:**
  - All Errors / Unresolved / Resolved
  - All Severities / Errors / Warnings / Info

- **Functies:**
  - Errors bekijken met alle details
  - Errors markeren als opgelost
  - Notities toevoegen bij het oplossen
  - Errors verwijderen
  - Stack traces bekijken

### Error Severity Levels

- **error** - Kritieke errors die de applicatie kunnen breken
- **warning** - Waarschuwingen die aandacht vereisen
- **info** - Informatieve berichten

## Gebruik

### Handmatig Errors Loggen

Je kunt ook handmatig errors loggen in je code:

```typescript
import { logError, logJSError, logWarning, logInfo } from "@/utils/errorLogger";

// Log een JavaScript error
try {
  // some code
} catch (error) {
  logJSError(error, 'ComponentName');
}

// Log een warning
logWarning('Something might be wrong', 'ComponentName');

// Log info
logInfo('User performed action', 'ComponentName');
```

### Error Boundary

De ErrorBoundary component is al geïntegreerd in `App.tsx` en vangt automatisch alle React errors op.

## Toegang

Alleen de super admin (r.blance@bampro.nl) kan de error logs bekijken in het Admin Panel.

## Best Practices

1. **Resolve Errors** - Markeer errors als opgelost wanneer je ze hebt gefixed
2. **Add Notes** - Voeg notities toe over hoe je de error hebt opgelost
3. **Delete Old Errors** - Verwijder oude resolved errors regelmatig om de database schoon te houden
4. **Monitor Regularly** - Check regelmatig op nieuwe errors

## Troubleshooting

### Errors worden niet gelogd

- Controleer of de `error_logs` tabel bestaat
- Controleer of RLS policies correct zijn ingesteld
- Check de browser console voor errors

### Super admin kan errors niet zien

- Controleer of de user email overeenkomt met `r.blance@bampro.nl`
- Controleer of RLS policies correct zijn ingesteld









