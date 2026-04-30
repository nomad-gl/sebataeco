/**
 * MFA Setup Page — HIGH-01 security fix
 *
 * Allows privileged users (admin, director, head_of_study) to configure
 * TOTP-based multi-factor authentication using any RFC 6238 authenticator app
 * (Google Authenticator, Authy, Microsoft Authenticator, etc.).
 *
 * Flow:
 *   1. User clicks "Set up MFA" → server generates secret + QR URI
 *   2. User scans QR code with their authenticator app
 *   3. User enters the 6-digit code to verify setup
 *   4. Server activates MFA and returns 10 one-time backup codes
 *   5. User saves backup codes in a safe place
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  QrCode,
  Key,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

type SetupStep = "idle" | "qr" | "verify" | "backup" | "done";

export default function MfaSetup() {
  const utils = trpc.useUtils();

  const [step, setStep] = useState<SetupStep>("idle");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [secret, setSecret] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableToken, setDisableToken] = useState("");
  const [regenToken, setRegenToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = trpc.mfa.getStatus.useQuery();
  const setupMutation = trpc.mfa.setupMfa.useMutation();
  const verifySetupMutation = trpc.mfa.verifyMfaSetup.useMutation();
  const disableMutation = trpc.mfa.disableMfa.useMutation();
  const regenMutation = trpc.mfa.regenerateBackupCodes.useMutation();

  const mfaEnabled = statusQuery.data?.mfaEnabled ?? false;

  const qrDataUrl = otpauthUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`
    : null;

  async function handleSetup() {
    setError(null);
    try {
      const result = await setupMutation.mutateAsync();
      setSecret(result.secret);
      setOtpauthUri(result.otpauthUri);
      setStep("qr");
    } catch (e: any) {
      setError(e.message ?? "Failed to start MFA setup");
    }
  }

  async function handleVerify() {
    setError(null);
    if (tokenInput.length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    try {
      const result = await verifySetupMutation.mutateAsync({ token: tokenInput });
      setBackupCodes(result.backupCodes);
      setTokenInput("");
      setStep("backup");
      utils.mfa.getStatus.invalidate();
    } catch (e: any) {
      setError(e.message ?? "Invalid code. Please try again.");
    }
  }

  async function handleDisable() {
    setError(null);
    if (disableToken.length !== 6) {
      setError("Please enter your 6-digit TOTP code to confirm.");
      return;
    }
    try {
      await disableMutation.mutateAsync({ token: disableToken });
      setDisableToken("");
      utils.mfa.getStatus.invalidate();
    } catch (e: any) {
      setError(e.message ?? "Failed to disable MFA.");
    }
  }

  async function handleRegen() {
    setError(null);
    if (regenToken.length !== 6) {
      setError("Please enter your 6-digit TOTP code to confirm.");
      return;
    }
    try {
      const result = await regenMutation.mutateAsync({ token: regenToken });
      setBackupCodes(result.backupCodes);
      setRegenToken("");
      setStep("backup");
    } catch (e: any) {
      setError(e.message ?? "Failed to regenerate backup codes.");
    }
  }

  function handleCopyCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  }

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="text-muted-foreground text-sm">
            Protect your account with TOTP-based multi-factor authentication
          </p>
        </div>
        {mfaEnabled && (
          <Badge variant="default" className="ml-auto bg-green-600">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Enabled
          </Badge>
        )}
        {!mfaEnabled && (
          <Badge variant="outline" className="ml-auto text-muted-foreground">
            <ShieldOff className="h-3 w-3 mr-1" />
            Disabled
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── MFA Not Enabled ── */}
      {!mfaEnabled && step === "idle" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Set Up Authenticator App
            </CardTitle>
            <CardDescription>
              Use Google Authenticator, Authy, Microsoft Authenticator, or any
              RFC 6238-compatible app to generate time-based one-time passwords.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSetup} disabled={setupMutation.isPending}>
              {setupMutation.isPending ? "Generating…" : "Set Up MFA"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: QR Code ── */}
      {step === "qr" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — Scan QR Code</CardTitle>
            <CardDescription>
              Open your authenticator app and scan this QR code, or enter the
              secret key manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrDataUrl && (
              <div className="flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="TOTP QR Code"
                  className="border rounded-lg p-2 bg-white"
                  width={200}
                  height={200}
                />
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Or enter the secret key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono tracking-wider">
                  {showSecret ? secret : "•".repeat(secret.length)}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecret(v => !v)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(secret)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Step 2 — Enter the 6-digit code from your app to verify:
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value.replace(/\D/g, ""))}
                  className="font-mono text-lg tracking-widest w-36"
                  onKeyDown={e => e.key === "Enter" && handleVerify()}
                />
                <Button
                  onClick={handleVerify}
                  disabled={verifySetupMutation.isPending || tokenInput.length !== 6}
                >
                  {verifySetupMutation.isPending ? "Verifying…" : "Verify & Activate"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Backup Codes ── */}
      {step === "backup" && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              MFA Activated — Save Your Backup Codes
            </CardTitle>
            <CardDescription>
              <strong>Save these codes now.</strong> Each code can only be used
              once to sign in if you lose access to your authenticator app. Store
              them in a safe place (password manager, printed copy).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code
                  key={i}
                  className="bg-background border rounded px-3 py-1.5 text-sm font-mono tracking-widest text-center"
                >
                  {code}
                </code>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={handleCopyCodes}
              className="w-full"
            >
              {copiedCodes ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Codes
                </>
              )}
            </Button>
            <Button
              className="w-full"
              onClick={() => { setStep("done"); setBackupCodes([]); }}
            >
              I've saved my backup codes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── MFA Enabled — Management ── */}
      {mfaEnabled && (step === "idle" || step === "done") && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Regenerate Backup Codes
              </CardTitle>
              <CardDescription>
                Generate a new set of backup codes. Your old codes will be
                immediately invalidated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter TOTP code"
                  value={regenToken}
                  onChange={e => setRegenToken(e.target.value.replace(/\D/g, ""))}
                  className="font-mono w-40"
                />
                <Button
                  variant="outline"
                  onClick={handleRegen}
                  disabled={regenMutation.isPending || regenToken.length !== 6}
                >
                  {regenMutation.isPending ? "Regenerating…" : "Regenerate"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldOff className="h-5 w-5" />
                Disable MFA
              </CardTitle>
              <CardDescription>
                Removing MFA will make your account less secure. You will need
                to enter your current TOTP code to confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter TOTP code"
                  value={disableToken}
                  onChange={e => setDisableToken(e.target.value.replace(/\D/g, ""))}
                  className="font-mono w-40"
                />
                <Button
                  variant="destructive"
                  onClick={handleDisable}
                  disabled={disableMutation.isPending || disableToken.length !== 6}
                >
                  {disableMutation.isPending ? "Disabling…" : "Disable MFA"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info box */}
      <Card className="bg-muted/40">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Key className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">About MFA on SEBA AI Studio</p>
              <p>
                MFA is required for all privileged accounts (admin, director,
                head of study). Once enabled, you will be prompted for your
                6-digit code when accessing sensitive features.
              </p>
              <p>
                Compatible apps: Google Authenticator, Authy, Microsoft
                Authenticator, 1Password, Bitwarden, and any RFC 6238 TOTP app.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
