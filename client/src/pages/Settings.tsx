/**
 * Settings page
 *
 * Sections:
 *   1. Branding – school logo (stored in localStorage "seba_school_logo")
 *   2. School & Class Defaults – school name, subject, year/level, tutor
 *      (stored in localStorage "seba_school_profile", auto-fills calendars & lesson plans)
 */

import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Palette,
  CheckCircle2,
  BookOpen,
  FileText,
  School,
  Save,
  Trash2,
  Cpu,
  ExternalLink,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import LogoUploader from "@/components/LogoUploader";
import { useI18n, type TranslationKey } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


const LOGO_KEY = "seba_school_logo";
const PROFILE_KEY = "seba_school_profile";

export interface SchoolProfile {
  schoolName: string;
  defaultSubject: string;
  defaultYear: string;
  defaultTutor: string;
}

export function loadSchoolProfile(): SchoolProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw) as SchoolProfile;
  } catch {
    // ignore
  }
  return { schoolName: "", defaultSubject: "", defaultYear: "", defaultTutor: "" };
}

export function saveSchoolProfile(p: SchoolProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  window.dispatchEvent(new CustomEvent("seba_profile_changed", { detail: p }));
}

// ── Live print-header preview ────────────────────────────────────────────────
function PrintHeaderPreview({ t }: { t: (k: TranslationKey) => string }) {
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LOGO_KEY);
    if (stored) setLogoDataUrl(stored);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null;
      setLogoDataUrl(detail);
    };
    window.addEventListener("seba_logo_changed", handler);
    return () => window.removeEventListener("seba_logo_changed", handler);
  }, []);

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">
            {t("settings_logo_preview_school")}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">
            {t("settings_logo_preview_subject")}
          </p>
          <div className="flex gap-4 mt-1.5">
            <span className="text-[9px] text-gray-400">
              <span className="font-semibold text-gray-600">{t("settings_logo_preview_date")}</span>{" "}
              07/04/2026
            </span>
            <span className="text-[9px] text-gray-400">
              <span className="font-semibold text-gray-600">{t("settings_logo_preview_teacher")}</span>{" "}
              Ms García
            </span>
          </div>
        </div>
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt="Logo preview"
            className="h-10 max-w-[90px] object-contain flex-shrink-0"
          />
        ) : (
          <div className="h-10 w-[90px] rounded border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] text-gray-300 text-center leading-tight px-1">Logo here</span>
          </div>
        )}
      </div>
      <div className="px-5 py-2 bg-gray-50">
        <p className="text-[9px] text-gray-400 italic">{t("settings_logo_preview_title")}</p>
      </div>
    </div>
  );
}

// ── Where the logo is used ───────────────────────────────────────────────────
function WhereUsed({ t }: { t: (k: TranslationKey) => string }) {
  const items = [
    { icon: BookOpen, label: t("settings_where_lesson") },
    { icon: FileText, label: t("settings_where_worksheet") },
  ];
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs font-semibold text-foreground mb-2">{t("settings_where_used")}</p>
      <ul className="space-y-1.5">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── School & Class defaults card ─────────────────────────────────────────────
function SchoolProfileCard({ t }: { t: (k: TranslationKey) => string }) {
  const [form, setForm] = useState<SchoolProfile>(() => loadSchoolProfile());

  const handleSave = () => {
    saveSchoolProfile(form);
    toast.success(t("settings_profile_saved"));
  };

  const handleClear = () => {
    const empty: SchoolProfile = {
      schoolName: "",
      defaultSubject: "",
      defaultYear: "",
      defaultTutor: "",
    };
    setForm(empty);
    saveSchoolProfile(empty);
    toast.success(t("settings_profile_cleared"));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <School className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">{t("settings_school_profile")}</CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {t("settings_school_profile_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* School Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sp-school" className="text-xs font-medium">
              {t("settings_school_name")}
            </Label>
            <Input
              id="sp-school"
              value={form.schoolName}
              onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
              placeholder={t("settings_school_name_ph")}
              className="h-9 text-sm"
            />
          </div>

          {/* Default Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="sp-subject" className="text-xs font-medium">
              {t("settings_default_subject")}
            </Label>
            <Input
              id="sp-subject"
              value={form.defaultSubject}
              onChange={(e) => setForm((f) => ({ ...f, defaultSubject: e.target.value }))}
              placeholder={t("settings_default_subject_ph")}
              className="h-9 text-sm"
            />
          </div>

          {/* Default Year / Level */}
          <div className="space-y-1.5">
            <Label htmlFor="sp-year" className="text-xs font-medium">
              {t("settings_default_year")}
            </Label>
            <Input
              id="sp-year"
              value={form.defaultYear}
              onChange={(e) => setForm((f) => ({ ...f, defaultYear: e.target.value }))}
              placeholder={t("settings_default_year_ph")}
              className="h-9 text-sm"
            />
          </div>

          {/* Default Tutor Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sp-tutor" className="text-xs font-medium">
              {t("settings_default_tutor")}
            </Label>
            <Input
              id="sp-tutor"
              value={form.defaultTutor}
              onChange={(e) => setForm((f) => ({ ...f, defaultTutor: e.target.value }))}
              placeholder={t("settings_default_tutor_ph")}
              className="h-9 text-sm"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {t("settings_save_profile")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("settings_clear_profile")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Account Security card ──────────────────────────────────────────────────
function AccountSecurityCard({ t }: { t: (k: TranslationKey) => string }) {
  const { logout } = useAuth();

  const logoutAll = trpc.localAuth.logoutAllDevices.useMutation({
    onSuccess: () => {
      toast.success(t("settings_logout_all_success"));
      // Clear local state and redirect to login
      setTimeout(() => logout(), 800);
    },
    onError: (err) => {
      toast.error(err.message || t("settings_logout_all_error"));
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <CardTitle className="text-base">{t("settings_security_title")}</CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed">
          {t("settings_security_desc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={logoutAll.isPending}
            >
              <LogOut className="w-3.5 h-3.5" />
              {logoutAll.isPending ? t("settings_logout_all_loading") : t("settings_logout_all_btn")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings_logout_all_confirm_title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings_logout_all_confirm_desc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => logoutAll.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("settings_logout_all_btn")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useI18n();
  useDocumentTitle("Configuració · SEBA AI Aina");

  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="container max-w-2xl py-8 px-4">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("settings_title")}</h1>
            <p className="text-sm text-muted-foreground">Powered by SEBA</p>
          </div>
        </div>

        {/* Auth gate */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user && !loading ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <SettingsIcon className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                Please sign in to access your settings.
              </p>
              <Button asChild>
                <a href={getLoginUrl(window.location.pathname + window.location.search)}>Sign In</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* ── School & Class Defaults card ── */}
            <SchoolProfileCard t={t} />

            {/* ── AI Model Attribution card ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{t("settings_ai_models_title")}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  {t("settings_ai_models_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Salamandra 2</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("settings_salamandra_desc")}</p>
                    </div>
                    <a href="https://projecteaina.cat/tech/en/introducing-the-salamandra-family-of-models/" target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> BSC
                    </a>
                  </div>
                  <div className="border-t border-border" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Àguila</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("settings_aguila_desc")}</p>
                    </div>
                    <a href="https://huggingface.co/BSC-LT/aguila-7b" target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> BSC
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("settings_ai_models_note")}{" "}
                  <Link href="/ai-models" className="text-primary hover:underline">{t("settings_ai_models_full_page")}</Link>
                </p>
              </CardContent>
            </Card>

            {/* ── Account Security card ── */}
            <AccountSecurityCard t={t} />

            {/* ── Branding card ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{t("settings_branding")}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  {t("settings_branding_desc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Logo uploader */}
                <LogoUploader />

                {/* Live preview */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-2">
                    {t("settings_logo_preview_title")}
                  </p>
                  <PrintHeaderPreview t={t} />
                </div>

                {/* Where used */}
                <WhereUsed t={t} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
