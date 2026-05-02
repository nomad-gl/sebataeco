import { AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/contexts/I18nContext";
import { getLoginUrl } from "@/const";

interface AuthErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  onLogin?: () => void;
  title?: string;
  description?: string;
}

/**
 * Fallback component for authentication errors
 * Shows user-friendly error message with retry and login options
 */
export function AuthErrorFallback({
  error,
  onRetry,
  onLogin,
  title,
  description,
}: AuthErrorFallbackProps) {
  const { t } = useI18n();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  const handleLogin = () => {
    if (onLogin) {
      onLogin();
    } else {
      window.location.href = getLoginUrl(window.location.pathname + window.location.search);
    }
  };

  // Determine error message based on error type
  const getErrorMessage = () => {
    if (!error) return t("auth_error_unknown") || "An authentication error occurred";
    
    const message = error.message || "";
    
    if (message.includes("UNAUTHORIZED")) {
      return t("auth_error_unauthorized") || "Your session has expired. Please log in again.";
    }
    if (message.includes("FORBIDDEN")) {
      return t("auth_error_forbidden") || "You don't have permission to access this page.";
    }
    if (message.includes("Failed to fetch")) {
      return t("auth_error_network") || "Network error. Please check your connection and try again.";
    }
    if (message.includes("timeout")) {
      return t("auth_error_timeout") || "Request timed out. Please try again.";
    }
    
    return message || (t("auth_error_unknown") || "An authentication error occurred");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-red-500/30">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <CardTitle className="text-red-400">
              {title || (t("auth_error_title") || "Authentication Error")}
            </CardTitle>
          </div>
          <CardDescription className="text-slate-300">
            {description || (t("auth_error_description") || "We encountered an issue with your authentication")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Message */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-300">{getErrorMessage()}</p>
          </div>

          {/* Error Details (for debugging) */}
          {error && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer hover:text-slate-300 mb-2">
                {t("auth_error_details") || "Error Details"}
              </summary>
              <pre className="bg-slate-900/50 p-2 rounded overflow-auto max-h-24 border border-slate-700">
                {error.message}
              </pre>
            </details>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {onRetry && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="w-full border-blue-500/30 hover:bg-blue-500/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("btn_retry") || "Try Again"}
              </Button>
            )}

            <Button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {t("nav_sign_in") || "Sign In"}
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-slate-400 text-center">
            {t("auth_error_help") || "If the problem persists, please contact support."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
