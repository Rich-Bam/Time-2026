import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Reset from "./pages/Reset";
import InviteConfirm from "./pages/InviteConfirm";
import { logJSError } from "@/utils/errorLogger";

const queryClient = new QueryClient();

// Global error handler
window.addEventListener('error', (event) => {
  // Ignore ResizeObserver errors - these are browser warnings, not real errors
  // ResizeObserver loop errors occur when elements are resized before observers can process them
  // This is a known browser quirk and doesn't indicate a problem with the application
  const errorMessage = event.message?.toLowerCase() || '';
  const errorString = String(event.error || event.message || '').toLowerCase();
  
  if (errorMessage.includes('resizeobserver') || 
      errorMessage.includes('resizeobserver loop') ||
      errorMessage.includes('resizeobserver loop limit exceeded') ||
      errorMessage.includes('resizeobserver loop completed') ||
      errorString.includes('resizeobserver')) {
    return; // Don't log these harmless warnings
  }
  
  logJSError(
    new Error(event.message),
    'GlobalErrorHandler',
    {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }
  );
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  // Ignore ResizeObserver errors in promise rejections too
  const errorMessage = String(event.reason || event).toLowerCase();
  if (errorMessage.includes('resizeobserver') || 
      errorMessage.includes('resizeobserver loop')) {
    return; // Don't log these harmless warnings
  }
  
  const error = event.reason instanceof Error 
    ? event.reason 
    : new Error(String(event.reason));
  logJSError(error, 'UnhandledPromiseRejection');
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/reset" element={<Reset />} />
                <Route path="/invite-confirm" element={<InviteConfirm />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
