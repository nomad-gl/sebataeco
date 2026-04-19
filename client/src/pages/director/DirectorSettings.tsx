import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { trpc } from "@/lib/trpc";
import { Settings, Users, Shield, Loader2, Check, Upload, Trash2, ImageIcon, Building2 } from "lucide-react";
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
  useEffect(() => { if (!authLoading && user && user.role !== "admin") navigate("/"); }, [authLoading, user, navigate]);
  if (authLoading || (!user && !authLoading)) return null;
  if (user?.role !== "admin") return null;

  const utils = trpc.useUtils();
  const { data: users, isLoading: usersLoading } = trpc.director.getUsersForAdmin.useQuery();
  const { data: settings, isLoading: settingsLoading } = trpc.director.getSchoolSettings.useQuery();
  const { data: branding, isLoading: brandingLoading } = trpc.director.getSchoolBranding.useQuery();
  const { data: loginBg } = trpc.director.getLoginBackground.useQuery();

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
                      <img src={branding.logoUrl} alt="School logo" className="w-full h-full object-contain p-1" loading="lazy" />
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
                  <img src={loginBg} alt="Login background" className="w-full h-full object-cover" loading="lazy" />
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

        <p className="text-xs text-muted-foreground text-right">Powered by SEBA</p>
      </div>
    </DashboardLayout>
  );
}
