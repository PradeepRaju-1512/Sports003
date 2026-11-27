import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; resetKey?: string; featureName?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; resetKey?: string; featureName?: string }) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || "Unexpected render error" };
  }

  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("UI ErrorBoundary caught an error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: null });
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[65vh] bg-[#111113] text-[#F5F2EB] flex items-center justify-center p-6">
          <div className="rdr-panel rdr-border-crimson max-w-md w-full p-6 text-center space-y-4">
            <h1 className="font-editorial text-3xl text-[#D97706]">Something Went Wrong</h1>
            <p className="text-xs text-[#D6CFC2]">
              {this.props.featureName
                ? `An unexpected display error occurred in ${this.props.featureName}. Your saved data on the server is unaffected.`
                : "An unexpected display error occurred. Your saved data on the server is unaffected."}
            </p>
            {(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV &&
              this.state.errorMessage && (
              <div className="p-2.5 rounded bg-[#08080A] border border-white/10 text-[11px] font-mono text-[#FCA5A5] text-left break-words">
                {this.state.errorMessage}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={this.handleRetry}
                className="px-4 py-2 bg-[#D97706] hover:bg-[#F59E0B] text-xs font-semibold uppercase tracking-wider text-[#08080A]"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-[#B91C1C] hover:bg-[#DC2626] text-xs font-semibold uppercase tracking-wider text-[#F5F2EB]"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
