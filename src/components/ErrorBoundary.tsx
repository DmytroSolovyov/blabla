import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let errorDetails = this.state.error?.message;

      try {
        if (errorDetails) {
          const parsed = JSON.parse(errorDetails);
          if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
            errorMessage = "You do not have permission to perform this action.";
          }
        }
      } catch (e) {
        // Not a JSON error message, ignore
      }

      return (
        <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-center text-white p-4">
          <div className="bg-[#242b3d] p-8 rounded-xl max-w-lg w-full border border-red-500/30">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Oops! Something went wrong.</h2>
            <p className="text-gray-300 mb-4">{errorMessage}</p>
            <div className="bg-black/30 p-4 rounded-lg overflow-auto text-xs font-mono text-gray-400 mb-6">
              {errorDetails}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
