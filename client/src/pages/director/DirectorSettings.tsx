import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Settings, Users, Shield, Loader2, Check, Upload, Trash2, ImageIcon, Building2, ScanSearch, RefreshCw, Wrench, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function DirectorSettings() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  // Allow both admins and directors to access this settings page
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin" && user.role !== "director") navigate("/");
  }, [authLoading, user, navigate]);
  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin" && user?.role !== "director") return null;

  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const { data: users, isLoading: usersLoading } = trpc.director.getUsersForAdmin.useQuery(undefined, { enabled: isAdmin });
  const { data: settings, isLoading: settingsLoading } = trpc.director.getSchoolSettings.useQuery(undefined, { enabled: isAdmin });
  const { data: branding, isLoading: brandingLoading } = trpc.director.getSchoolBranding.useQuery(undefined, { enabled: isAdmin });
  const { data: loginBg } = trpc.director.getLoginBackground.useQuery(undefined, { enabled: isAdmin });

  // ZER status — available to directors and admins
  const { data: zerStatus, isLoading: zerLoading } = trpc.director.getZerStatus.useQuery();
  const setZerStatusMutation = trpc.director.setZerStatus.useMutation({
    onSuccess: (data) => {
      utils.director.getZerStatus.invalidate();
      toast.success(data.isZer ? t("zer_enabled_toast") : t("zer_disabled_toast"));
    },
    onError: (err) => toast.error(err.message),
  });
  const setZerActsAsHosMutation = trpc.director.setZerActsAsHos.useMutation({
    onSuccess: (data) => {
      utils.director.getZerStatus.invalidate();
      toast.success(data.zerActsAsHos ? t("zer_hos_enabled_toast") : t("zer_hos_disabled_toast"));
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.director.updateUserRole.useMutation({
    onSuccess: () => { utils.director.getUsersForAdmin.invalidate(); toast.success(t("dir_settings_role_updated")); },
    onError: () => toast.error(t("dir_settings_role_error")),
  });

  const updateSettingMutation = trpc.director.updateSchoolSetting.useMutation({
    onSuccess: () => { utils.director.getSchoolSettings.invalidate(); toast.success(t("dir_settings_saved")); },
    onError: () => toast.error(t("dir_settings_save_error")),
  });

  const updateSchoolNameMutation = trpc.director.updateSchoolName.useMutation({
    onSuccess: () => { utils.director.getSchoolBranding.invalidate(); toast.success(t("dir_settings_saved")); },
    onError: () => toast.error(t("dir_settings_save_error")),
  });

  const uploadLogoMutation = trpc.director.uploadSchoolLogo.useMutation({
    onSuccess: () => { utils.director.getSchoolBranding.invalidate(); toast.success(t("dir_logo_uploaded")); },
    onError: () => toast.error(t("dir_logo_upload_error")),
  });

  const removeLogoMutation = trpc.director.removeSchoolLogo.useMutation({
    onSuccess: () => { utils.director.getSchoolBranding.invalidate(); toast.success(t("dir_logo_removed")); },
    onError: () => toast.error(t("dir_logo_remove_error")),
  });

  const uploadLoginBgMutation = trpc.director.uploadLoginBackground.useMutation({
    onSuccess: () => { utils.director.getLoginBackground.invalidate(); toast.success(t("dir_login_bg_uploaded")); },
    onError: () => toast.error(t("dir_login_bg_upload_error")),
  });

  const removeLoginBgMutation = trpc.director.removeLoginBackground.useMutation({
    onSuccess: () => { utils.director.getLoginBackground.invalidate(); toast.success(t("dir_login_bg_removed")); },
    onError: () => toast.error(t("dir_login_bg_upload_error")),
  });

  const [pendingRoles, setPendingRoles] = useState<Record<string, "user" | "admin" | "head_of_study">>({});
  const [schoolNameInput, setSchoolNameInput] = useState<string>("");
  const [schoolNameEditing, setSchoolNameEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginBgFileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill school name when branding loads
  useEffect(() => {
    if (branding?.schoolName && !schoolNameEditing) {
      setSchoolNameInput(branding.schoolName);
    }
  }, [branding?.schoolName]);

  function handleRoleChange(userId: string, newRole: "user" | "admin" | "head_of_study") {
    setPendingRoles(prev => ({ ...prev, [userId]: newRole }));
  }

  function saveRole(userId: string) {
    const role = pendingRoles[userId];
    if (!role) return;
    updateRoleMutation.mutate({ userId, role: role as "user" | "admin" });
    setPendingRoles(prev => { const n = { ...prev }; delete n[userId]; return n; });
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error(t("dir_logo_too_large")); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      uploadLogoMutation.mutate({ dataUrl, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    e.target.value = "";
  }

  function handleLoginBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t("dir_login_bg_too_large")); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      uploadLoginBgMutation.mutate({ base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dir_settings")}</h1>
            <p className="text-sm text-muted-foreground">{t("dir_settings_desc")}</p>
          </div>
        </div>

        {/* School Branding — Logo & Name */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">{t("dir_branding_title")}</CardTitle>
            </div>
            <CardDescription>{t("dir_branding_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {brandingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Logo upload */}
                <div className="flex items-start gap-6">
                  {/* Preview */}
                  <div className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                    {branding?.logoUrl ? (
                      <img src={branding.logoUrl} alt="School logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">{t("dir_logo_label")}</p>
                    <p className="text-xs text-muted-foreground">{t("dir_logo_desc")}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLogoMutation.isPending}
                      >
                        {uploadLogoMutation.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Upload className="w-3.5 h-3.5" />}
                        {t("dir_logo_upload")}
                      </Button>
                      {branding?.logoUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => removeLogoMutation.mutate()}
                          disabled={removeLogoMutation.isPending}
                        >
                          {removeLogoMutation.isPending
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                          {t("dir_logo_remove")}
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                  </div>
                </div>

                {/* School name */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">{t("dir_settings_school_name")}</p>
                  <p className="text-xs text-muted-foreground">{t("dir_settings_school_name_desc")}</p>
                  <div className="flex gap-2 max-w-sm">
                    <Input
                      value={schoolNameInput}
                      onChange={(e) => { setSchoolNameInput(e.target.value); setSchoolNameEditing(true); }}
                      placeholder={t("dir_settings_school_name_placeholder")}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => { updateSchoolNameMutation.mutate({ schoolName: schoolNameInput }); setSchoolNameEditing(false); }}
                      disabled={updateSchoolNameMutation.isPending || !schoolNameEditing}
                    >
                      {updateSchoolNameMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {t("btn_save")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Login Page Background */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">{t("dir_login_bg_title")}</CardTitle>
            </div>
            <CardDescription>{t("dir_login_bg_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              {/* Preview */}
              <div className="flex-shrink-0 w-32 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {loginBg ? (
                  <img src={loginBg} alt="Login background" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">{t("dir_login_bg_label")}</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP. Max 5 MB. Recommended: 1920 × 1080 px.</p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => loginBgFileInputRef.current?.click()}
                    disabled={uploadLoginBgMutation.isPending}
                  >
                    {uploadLoginBgMutation.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Upload className="w-3.5 h-3.5" />}
                    {t("dir_login_bg_upload")}
                  </Button>
                  {loginBg && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => removeLoginBgMutation.mutate()}
                      disabled={removeLoginBgMutation.isPending}
                    >
                      {removeLoginBgMutation.isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                      {t("dir_login_bg_remove")}
                    </Button>
                  )}
                </div>
                <input
                  ref={loginBgFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLoginBgFileChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Role Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">{t("dir_settings_users_title")}</CardTitle>
            </div>
            <CardDescription>{t("dir_settings_users_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !users?.length ? (
              <p className="text-sm text-muted-foreground py-4">{t("dir_no_staff_data")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">{t("dir_teacher_name")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("dir_settings_email")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("dir_settings_role")}</th>
                      <th className="text-left py-2 pr-4 font-medium">{t("dir_settings_joined")}</th>
                      <th className="text-left py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const currentRole = (pendingRoles[String(u.id)] ?? u.role ?? "user") as "user" | "admin" | "head_of_study";
                      const isDirty = pendingRoles[String(u.id)] !== undefined;
                      return (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 font-medium">{u.name ?? t("dir_unknown_teacher")}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground text-xs">{u.email ?? "—"}</td>
                          <td className="py-2.5 pr-4">
                            <Select value={currentRole} onValueChange={(v) => handleRoleChange(String(u.id), v as "user" | "admin" | "head_of_study")}>
                              <SelectTrigger className="h-7 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">{t("dir_settings_role_teacher")}</SelectItem>
                                <SelectItem value="head_of_study">{t("dir_settings_role_hos")}</SelectItem>
                                <SelectItem value="admin">{t("dir_settings_role_admin")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2.5">
                            {isDirty && (
                              <Button size="sm" className="h-7 text-xs" onClick={() => saveRole(String(u.id))} disabled={updateRoleMutation.isPending}>
                                {updateRoleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                                {t("dir_settings_save_role")}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* School-wide Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-base">{t("dir_settings_school_title")}</CardTitle>
            </div>
            <CardDescription>{t("dir_settings_school_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Bias scan hour */}
                <div className="flex items-center justify-between gap-4 py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">{t("dir_settings_scan_hour")}</p>
                    <p className="text-xs text-muted-foreground">{t("dir_settings_scan_hour_desc")}</p>
                  </div>
                  <Select
                    value={settings?.bias_scan_hour ?? "4"}
                    onValueChange={(v) => updateSettingMutation.mutate({ key: "bias_scan_hour", value: v })}
                  >
                    <SelectTrigger className="w-28 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00 UTC
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Default language */}
                <div className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm font-medium">{t("dir_settings_default_lang")}</p>
                    <p className="text-xs text-muted-foreground">{t("dir_settings_default_lang_desc")}</p>
                  </div>
                  <Select
                    value={settings?.default_language ?? "en"}
                    onValueChange={(v) => updateSettingMutation.mutate({ key: "default_language", value: v })}
                  >
                    <SelectTrigger className="w-28 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (UK)</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="ca">Català</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── ZER (Zona Escolar Rural) Dual-Role ── */}
        <Card className="border-green-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <Building2 className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-base">{t("zer_section_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("zer_section_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {zerLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {/* ZER school toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("zer_school_label")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("zer_school_hint")}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={zerStatus?.isZer ? "default" : "outline"}
                    className={zerStatus?.isZer ? "bg-green-600 hover:bg-green-700 text-white" : "bg-transparent"}
                    disabled={setZerStatusMutation.isPending}
                    onClick={() => setZerStatusMutation.mutate({ isZer: !zerStatus?.isZer })}
                  >
                    {zerStatus?.isZer ? (
                      <><Check className="h-3.5 w-3.5 mr-1" />{t("zer_enabled")}</>
                    ) : (
                      t("zer_disabled")
                    )}
                  </Button>
                </div>

                {/* Act as HoS toggle — only visible when school is ZER */}
                {zerStatus?.isZer && user?.role === "director" && (
                  <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                    <div>
                      <p className="text-sm font-medium">{t("zer_acts_as_hos_label")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("zer_acts_as_hos_hint")}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={zerStatus?.zerActsAsHos ? "default" : "outline"}
                      className={zerStatus?.zerActsAsHos ? "bg-green-600 hover:bg-green-700 text-white" : "bg-transparent"}
                      disabled={setZerActsAsHosMutation.isPending}
                      onClick={() => setZerActsAsHosMutation.mutate({ zerActsAsHos: !zerStatus?.zerActsAsHos })}
                    >
                      {zerStatus?.zerActsAsHos ? (
                        <><Check className="h-3.5 w-3.5 mr-1" />{t("zer_acts_as_hos_active")}</>
                      ) : (
                        t("zer_acts_as_hos_inactive")
                      )}
                    </Button>
                  </div>
                )}

                {/* Info note when ZER is off */}
                {!zerStatus?.isZer && (
                  <p className="text-xs text-muted-foreground italic">{t("zer_not_zer_note")}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── i18n Hardcoded String Scan ── */}
        {isAdmin && <I18nScanCard />}

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}

/** Standalone i18n scan card — admin only */
function I18nScanCard() {
  const { t } = useI18n();
  const [autoFixRunning, setAutoFixRunning] = useState(false);
  const { data: status, refetch: refetchStatus } = trpc.director.getI18nScanStatus.useQuery(
    undefined,
    { refetchOnWindowFocus: false, refetchInterval: autoFixRunning ? 2000 : false }
  );

  const triggerMutation = trpc.director.triggerI18nScan.useMutation({
    onSuccess: () => {
      refetchStatus();
      toast.success("Scan complete — check notifications for the full report.");
    },
    onError: () => toast.error("Scan failed. Check server logs."),
  });

  const autoFixMutation = trpc.director.autoFixI18nKeys.useMutation({
    onMutate: () => setAutoFixRunning(true),
    onSuccess: (data) => {
      setAutoFixRunning(false);
      refetchStatus();
      if (data.fixedKeys === 0 && data.errors.length === 0) {
        toast.success("No missing keys to fix — everything is up to date!");
      } else if (data.errors.length > 0) {
        toast.error(`Auto-fix completed with ${data.errors.length} error(s). See details below.`);
      } else {
        toast.success(`Auto-fix complete: ${data.fixedKeys} key${data.fixedKeys !== 1 ? "s" : ""} added to EN/ES/CA.`);
      }
    },
    onError: (err) => {
      setAutoFixRunning(false);
      toast.error(`Auto-fix failed: ${err.message}`);
    },
  });

  const result = status?.lastResult;
  const autoFix = status?.autoFix;
  const lastAutoFix = autoFix?.lastResult;
  const isBusy = triggerMutation.isPending || autoFixMutation.isPending || !!autoFix?.running;
  const hasMissingKeys = (result?.missingKeys?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ScanSearch className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">i18n Hardcoded String Scanner</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-fix button — only enabled when there are missing keys */}
            <Button
              size="sm"
              variant={hasMissingKeys ? "default" : "outline"}
              disabled={isBusy || !hasMissingKeys}
              onClick={() => autoFixMutation.mutate({})}
              title={hasMissingKeys ? `Fix ${result?.missingKeys?.length} missing key(s) automatically` : "No missing keys to fix"}
            >
              {autoFixMutation.isPending || autoFix?.running ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Wrench className="w-4 h-4 mr-1" />
              )}
              {autoFixMutation.isPending || autoFix?.running ? "Fixing…" : `Auto-fix${hasMissingKeys ? ` (${result?.missingKeys?.length})` : ""}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => triggerMutation.mutate()}
            >
              {triggerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Run scan
            </Button>
          </div>
        </div>
        <CardDescription>
          Runs daily at 05:00 UTC. Detects hardcoded strings and missing i18n keys. The Auto-fix button translates missing keys via AI and patches <code>I18nContext.tsx</code> automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* ── Last scan result ── */}
        {status?.lastRunAt ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Last scan: {new Date(status.lastRunAt).toLocaleString()}
            </div>
            {result && (
              <div className="rounded-md border bg-muted/50 p-3 text-xs space-y-2">
                {/* Summary row */}
                <div className="flex flex-wrap gap-3">
                  <span className={`flex items-center gap-1 ${
                    result.hardcodedStrings.length > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"
                  }`}>
                    {result.hardcodedStrings.length > 0
                      ? <AlertTriangle className="w-3.5 h-3.5" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {result.hardcodedStrings.length} hardcoded string{result.hardcodedStrings.length !== 1 ? "s" : ""}
                  </span>
                  <span className={`flex items-center gap-1 ${
                    result.missingKeys.length > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  }`}>
                    {result.missingKeys.length > 0
                      ? <XCircle className="w-3.5 h-3.5" />
                      : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {result.missingKeys.length} missing key{result.missingKeys.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {result.unusedKeys.length} unused key{result.unusedKeys.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {result.scannedFiles} files scanned
                  </span>
                </div>

                {/* Missing keys list with per-key fix option */}
                {result.missingKeys.length > 0 && (
                  <div>
                    <p className="font-semibold text-red-600 dark:text-red-400 mb-1">Missing keys:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.missingKeys.slice(0, 20).map((k) => (
                        <button
                          key={k}
                          onClick={() => autoFixMutation.mutate({ keys: [k] })}
                          disabled={isBusy}
                          className="font-mono bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded px-1.5 py-0.5 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`Click to auto-fix just this key`}
                        >
                          {k}
                        </button>
                      ))}
                      {result.missingKeys.length > 20 && (
                        <span className="text-muted-foreground">…+{result.missingKeys.length - 20} more</span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1">Click a key to fix just that one, or use Auto-fix to fix all at once.</p>
                  </div>
                )}

                {/* Top hardcoded strings */}
                {result.hardcodedStrings.length > 0 && (
                  <div>
                    <p className="font-semibold text-yellow-600 dark:text-yellow-400 mb-1">Top hardcoded strings:</p>
                    <div className="font-mono space-y-0.5">
                      {result.hardcodedStrings.slice(0, 5).map((s, i) => (
                        <div key={i} className="text-muted-foreground">
                          <span className="text-foreground">{s.file}:{s.line}</span> — "{s.text.slice(0, 60)}{s.text.length > 60 ? "…" : ""}"
                        </div>
                      ))}
                      {result.hardcodedStrings.length > 5 && (
                        <div className="text-muted-foreground">…and {result.hardcodedStrings.length - 5} more</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No scan has run yet. Click "Run scan" to trigger the first scan.</p>
        )}

        {/* ── Auto-fix result ── */}
        {lastAutoFix && (
          <div className={`rounded-md border p-3 text-xs space-y-1 ${
            lastAutoFix.errors.length > 0
              ? "border-destructive/50 bg-destructive/5"
              : "border-green-500/30 bg-green-500/5"
          }`}>
            <div className="flex items-center gap-1.5 font-semibold">
              {lastAutoFix.errors.length > 0
                ? <XCircle className="w-3.5 h-3.5 text-destructive" />
                : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              Auto-fix ran at {new Date(lastAutoFix.ranAt).toLocaleString()}
            </div>
            {lastAutoFix.fixedKeys > 0 && (
              <p className="text-green-700 dark:text-green-300">
                ✓ Added {lastAutoFix.fixedKeys} key{lastAutoFix.fixedKeys !== 1 ? "s" : ""} to EN/ES/CA: {lastAutoFix.keys.slice(0, 8).join(", ")}{lastAutoFix.keys.length > 8 ? ` +${lastAutoFix.keys.length - 8} more` : ""}
              </p>
            )}
            {lastAutoFix.errors.map((e, i) => (
              <p key={i} className="text-destructive">{e}</p>
            ))}
          </div>
        )}

        {/* Scan error */}
        {status?.lastError && (
          <p className="text-destructive text-xs">Scan error: {status.lastError}</p>
        )}
        {autoFix?.lastError && (
          <p className="text-destructive text-xs">Auto-fix error: {autoFix.lastError}</p>
        )}
      </CardContent>
    </Card>
  );
}
