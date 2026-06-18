import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="auth-shell" style={{ display: "grid", placeContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <div className="auth-brand-mark" style={{ margin: "0 auto" }}>
            <span style={{ fontSize: 24 }}>!</span>
          </div>
          <h2 style={{ color: "#f7faf8", margin: 0 }}>Something went wrong</h2>
          <p style={{ color: "#7b867f", maxWidth: 420, margin: 0, fontSize: 13, lineHeight: 1.6 }}>
            Jini encountered an unexpected error. Please try refreshing the page.
          </p>
          <button
            className="primary-button"
            onClick={() => window.location.reload()}
            type="button"
            style={{ marginTop: 8 }}
          >
            Reload Jini
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
