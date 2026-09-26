import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  spokeName?: string;
  fallbackRender?: (props: {
    error: Error;
    resetErrorBoundary: () => void;
  }) => ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * AES v3 Compliant Spoke Domain Error Boundary.
 * Prevents isolated runtime exceptions in individual components or spokes
 * from crashing the global application shell.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[AES v3 ErrorBoundary] Uncaught exception in ${
        this.props.spokeName || 'SpokeOpsComponent'
      }:`,
      error,
      errorInfo.componentStack
    );
  }

  public resetErrorBoundary = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary
        });
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 my-4 border border-rose-500/20 bg-rose-500/5 rounded-xl text-center">
          <div className="p-3 bg-rose-500/10 rounded-full mb-3 text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-rose-400 mb-1">
            {this.props.spokeName ? `${this.props.spokeName} Runtime Error` : 'Rendering Failure'}
          </h3>
          <p className="text-xs text-rose-300/80 mb-4 max-w-md font-mono break-words">
            {this.state.error.message || 'An unexpected error occurred in this module.'}
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
