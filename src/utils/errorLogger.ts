import { supabase } from "@/integrations/supabase/client";

export type ErrorSeverity = 'error' | 'warning' | 'info';

export interface ErrorLogData {
  user_id?: string;
  user_email?: string;
  user_name?: string;
  error_message: string;
  error_stack?: string;
  error_component?: string;
  error_url?: string;
  user_agent?: string;
  browser_info?: string;
  severity?: ErrorSeverity;
  notes?: string;
}

/**
 * List of error messages to ignore (harmless browser warnings)
 */
const IGNORED_ERROR_PATTERNS = [
  'resizeobserver',
  'resizeobserver loop',
  'resizeobserver loop limit exceeded',
  'resizeobserver loop completed',
  'non-error promise rejection',
];

/**
 * Check if an error should be ignored
 */
function shouldIgnoreError(errorMessage: string): boolean {
  const lowerMessage = errorMessage.toLowerCase();
  return IGNORED_ERROR_PATTERNS.some(pattern => lowerMessage.includes(pattern));
}

/**
 * Log an error to the database
 * This function silently fails if logging fails to prevent infinite loops
 */
export async function logError(errorData: ErrorLogData): Promise<void> {
  try {
    // Ignore harmless browser warnings
    if (shouldIgnoreError(errorData.error_message)) {
      return; // Don't log these errors
    }
    
    // Get current user info if available
    const currentUser = (window as any).__currentUser;
    
    // Get browser info
    const userAgent = navigator.userAgent;
    const browserInfo = {
      userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };

    const logEntry = {
      user_id: errorData.user_id || currentUser?.id || null,
      user_email: errorData.user_email || currentUser?.email || null,
      user_name: errorData.user_name || currentUser?.name || null,
      error_message: errorData.error_message,
      error_stack: errorData.error_stack || null,
      error_component: errorData.error_component || null,
      error_url: errorData.error_url || window.location.href,
      user_agent: errorData.user_agent || userAgent,
      browser_info: JSON.stringify(browserInfo),
      severity: errorData.severity || 'error',
      notes: errorData.notes || null,
    };

    // Insert error log (silently fail if it doesn't work)
    await supabase.from('error_logs').insert([logEntry]);
  } catch (error) {
    // Silently fail - we don't want error logging to cause more errors
    console.error('Failed to log error:', error);
  }
}

/**
 * Log a JavaScript error
 */
export async function logJSError(
  error: Error,
  component?: string,
  additionalInfo?: Record<string, any>
): Promise<void> {
  await logError({
    error_message: error.message || 'Unknown error',
    error_stack: error.stack || error.toString(),
    error_component: component,
    severity: 'error',
    notes: additionalInfo ? JSON.stringify(additionalInfo) : undefined,
  });
}

/**
 * Log a warning
 */
export async function logWarning(
  message: string,
  component?: string,
  additionalInfo?: Record<string, any>
): Promise<void> {
  await logError({
    error_message: message,
    error_component: component,
    severity: 'warning',
    notes: additionalInfo ? JSON.stringify(additionalInfo) : undefined,
  });
}

/**
 * Log an info message
 */
export async function logInfo(
  message: string,
  component?: string,
  additionalInfo?: Record<string, any>
): Promise<void> {
  await logError({
    error_message: message,
    error_component: component,
    severity: 'info',
    notes: additionalInfo ? JSON.stringify(additionalInfo) : undefined,
  });
}

