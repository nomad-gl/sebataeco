import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

const isProd = import.meta.env.PROD;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    const errorId = Math.random().toString(36).slice(2, 8).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-lg text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              An unexpected error occurred. You can try reloading the page or return to the home screen.
            </p>

            <p className="text-xs text-muted-foreground/60 mb-6 font-mono">
              Error ref: {this.state.errorId}
            </p>

            {/* In development, show the full stack trace */}
            {!isProd && this.state.error && (
              <div className="p-4 w-full rounded-lg bg-muted overflow-auto mb-6 text-left">
                <p className="text-xs font-semibold text-destructive mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => (window.location.href = "/")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  "border border-border bg-background hover:bg-muted transition-colors"
                )}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                )}
              >
                <RotateCcw className="w-4 h-4" />
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
