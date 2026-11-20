import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TEKSCOdle ErrorBoundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  public render() {
    if (this.state.hasError) {
      let friendlyMessage = 'Something went wrong while loading this checkout lane.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          if (parsed.error.includes('Quota exceeded')) {
            friendlyMessage =
              'Daily database read quota was reached. You can still play offline and try again tomorrow.';
          } else if (parsed.error.includes('permission')) {
            friendlyMessage =
              'A leaderboard permission check failed. Please sign in and retry.';
          }
        }
      } catch {
        // Non-JSON runtime error
      }

      return (
        <div className="min-h-screen bg-[#FBF8F1] dark:bg-[#160524] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#220836] border border-purple-200 dark:border-purple-800 rounded-2xl p-8 text-center shadow-lg">
            <h1 className="font-display text-2xl font-bold text-[#2B0938] dark:text-white mb-3">
              Checkout Till Interrupted
            </h1>
            <p className="text-sm text-slate-600 dark:text-purple-200/80 mb-6 leading-relaxed">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 text-sm font-bold text-[#1D0830] bg-[#F6C915] hover:bg-[#FFE047] rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              Return to Game
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
