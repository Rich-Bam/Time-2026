import React, { Component, ErrorInfo, ReactNode } from "react";
import { logJSError } from "@/utils/errorLogger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignore ResizeObserver errors - these are harmless browser warnings
    const errorMessage = error.message?.toLowerCase() || '';
    if (errorMessage.includes('resizeobserver') || 
        errorMessage.includes('resizeobserver loop')) {
      // Don't log or show ResizeObserver errors
      return;
    }
    
    // Log the error
    logJSError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">
                Er is een fout opgetreden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Er is een onverwachte fout opgetreden in de applicatie. De fout is gelogd en zal worden onderzocht.
              </p>
              
              {this.state.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                  <p className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    Foutmelding:
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} variant="default">
                  Probeer opnieuw
                </Button>
                <Button 
                  onClick={() => window.location.href = '/'} 
                  variant="outline"
                >
                  Terug naar home
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                    Technische details (alleen in development)
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-96">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

