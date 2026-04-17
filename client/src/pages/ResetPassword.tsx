import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Eye, EyeOff, KeyRound, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function ResetPassword() {
  const { t } = useI18n();
  const [, navigate] = useLocation();

  // Read token from URL query string
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [clientError, setClientError] = useState("");

  const resetMutation = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => {
      setDone(true);
      // Redirect to login after 2 seconds
      setTimeout(() => navigate("/login"), 2000);
    },
  });

  // If no token in URL, show invalid link immediately
  const isInvalidToken = !token;

  useEffect(() => {
    if (isInvalidToken) return;
  }, [isInvalidToken]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError("");
    if (password.length < 8) {
      setClientError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setClientError("Passwords do not match.");
      return;
    }
    resetMutation.mutate({ token, password });
  };

  // --- Invalid / expired token state ---
  if (isInvalidToken || resetMutation.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto mb-2 h-10 w-10 text-destructive" />
            <CardTitle>{t("local_auth_reset_password")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("local_auth_reset_invalid")}
            </p>
            <Button variant="outline" onClick={() => navigate("/login")}>
              {t("local_auth_back_to_login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Success state ---
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="mx-auto mb-2 h-10 w-10 text-green-500" />
            <CardTitle>{t("local_auth_reset_password")}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm">
              {t("local_auth_reset_success")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Form state ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto mb-2 h-10 w-10 text-primary" />
          <CardTitle>{t("local_auth_reset_password")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rp-password">{t("local_auth_new_password")}</Label>
              <div className="relative">
                <Input
                  id="rp-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rp-confirm">{t("local_auth_confirm_new_password")}</Label>
              <div className="relative">
                <Input
                  id="rp-confirm"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {clientError && (
              <p className="text-destructive text-sm">{clientError}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending
                ? t("local_auth_resetting")
                : t("local_auth_reset_password")}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/login")}
            >
              {t("local_auth_back_to_login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
