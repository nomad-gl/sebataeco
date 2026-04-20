import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  BookOpen, MessageCircle, Dumbbell, LayoutDashboard,
  Library, TrendingUp, ChevronDown, Menu, X, Zap,
  Presentation as PresentationIcon, Globe, Users, MessagesSquare, Bell, Download,
  CalendarDays, FileText, Settings as SettingsIcon, ShieldAlert, Lock, HelpCircle,
  BarChart3, UserCheck, BookCheck, GraduationCap, Mic,
  ClipboardList, Banknote, UserCog, FolderOpen, Building2, Wrench, Music, Wifi, LogOut, LogIn,
  UserPlus, Copy, CheckCircle2, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { AdminPinGate, isAdminUnlocked } from "@/components/AdminPinGate";
import { useI18n, Lang } from "@/contexts/I18nContext";
import { DialectBadge } from "@/components/CatalanDialectDetector";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Share, Plus } from "lucide-react";
import { SebaSymbol } from "@/components/SebaSymbol";
import { toast } from "sonner";

const LANG_OPTIONS: { code: Lang; label: string; flag: string }[] = [
  { code: "ca", label: "CA", flag: "🏴" },
  { code: "es", label: "ES", flag: "🇪🇸" },
  { code: "en", label: "EN", flag: "🇬🇧" },
];

/** Inline Accept/Decline buttons for meeting_invite notifications in the bell dropdown */
function MeetingInviteActions({ notificationId, onDone }: { notificationId: number; onDone: () => void }) {
  const utils = trpc.useUtils();
  const markRead = trpc.notifications.markRead.useMutation();
  const getPending = trpc.meetingInvitation.getPending.useQuery(undefined, { enabled: true });
  const accept = trpc.meetingInvitation.accept.useMutation({
    onSuccess: () => {
      markRead.mutate({ id: notificationId });
      onDone();
    },
  });
  const decline = trpc.meetingInvitation.decline.useMutation({
    onSuccess: () => {
      markRead.mutate({ id: notificationId });
      onDone();
    },
  });
  // Find the matching pending invitation — match by notification id is not direct;
  // we use the first pending invite as a best-effort match (notifications are per-invite)
  const pending = getPending.data ?? [];
  const inv = pending[0]; // simplest heuristic: act on the oldest pending invite
  if (!inv) return null;
  const busy = accept.isPending || decline.isPending;
  return (
    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
      <button
        disabled={busy}
        onClick={() => accept.mutate({ invitationId: inv.id })}
        className="flex-1 text-xs font-medium py-1 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        ✓ Accept
      </button>
      <button
        disabled={busy}
        onClick={() => decline.mutate({ invitationId: inv.id })}
        className="flex-1 text-xs font-medium py-1 rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
      >
        ✗ Decline
      </button>
    </div>
  );
}

export default function NavBar() {
  const [location] = useLocation();
  const { t, lang, setLang } = useI18n();
  const isClassroomPage = location === "/chat" || location === "/practice" || location === "/progress";
  const [dropOpen, setDropOpen]         = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [hosOpen, setHosOpen]           = useState(false);
  const [situacioOpen, setSituacioOpen] = useState(false);
  const [adminOpen, setAdminOpen]       = useState(false);
  const [platformExpanded, setPlatformExpanded] = useState(() => isAdminUnlocked());
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const [pinOpen, setPinOpen]           = useState(false);
  const [pinTarget, setPinTarget]       = useState<string | null>(null);
  const [platformUnlocked, setPlatformUnlocked] = useState(() => isAdminUnlocked());
  const [langOpen, setLangOpen]         = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [bellOpen, setBellOpen]         = useState(false);
  // Register Territorial Director dialog state
  const [tdDialogOpen, setTdDialogOpen]   = useState(false);
  const [tdName, setTdName]               = useState("");
  const [tdEmail, setTdEmail]             = useState("");
  const [tdReason, setTdReason]           = useState("");
  const [tdResult, setTdResult]           = useState<{ email: string; tempPassword: string; territoryName: string } | null>(null);
  const [tdCopied, setTdCopied]           = useState(false);
  const dropRef     = useRef<HTMLDivElement>(null);
  const directorRef = useRef<HTMLDivElement>(null);
  const hosRef      = useRef<HTMLDivElement>(null);
  const situacioRef = useRef<HTMLDivElement>(null);
  const adminRef    = useRef<HTMLDivElement>(null);
  const langRef     = useRef<HTMLDivElement>(null);
  const bellRef     = useRef<HTMLDivElement>(null);

  const { user, logout } = useAuth();

  // Territorial Director registration mutation
  const registerTD = trpc.tenants.registerAndGrantTerritorialDirector.useMutation({
    onSuccess: (data) => {
      setTdResult({ email: data.email, tempPassword: data.tempPassword, territoryName: data.territoryName });
      toast.success(`Territorial Director registered for ${data.territoryName}`);
    },
    onError: (err) => toast.error(err.message),
  });
  const { data: tdTerritories = [] } = trpc.tenants.listTerritories.useQuery(undefined, { enabled: tdDialogOpen && !!user && user.role === "admin" });
  const [tdTerritoryId, setTdTerritoryId] = useState<number | null>(null);

  // Position-based visibility helpers
  // Director sees everything; each role sees its own menus plus shared menus
  const pos = (user as { position?: string } | null)?.position ?? "unassigned";
  const isDirectorPos   = pos === "director";
  const isHosPos        = pos === "head_of_study" || pos === "director";
  const isTeacherPos    = pos === "teacher" || pos === "director";
  const isSituacioPos   = pos === "head_of_study" || pos === "director";

  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30_000,
  });
  const { data: myNotifications = [] } = trpc.notifications.getMyNotifications.useQuery(undefined, {
    enabled: !!user && bellOpen,
  });
  const markRead = trpc.notifications.markRead.useMutation();
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.getUnreadCount.invalidate(),
  });
  const utils = trpc.useUtils();

  // Missed call badge — poll for unanswered incoming calls
  const { data: missedCallData } = trpc.dmCall.getMissedCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 15_000,
  });
  const missedCallCount = missedCallData?.count ?? 0;

  // Pending meeting invitation badge
  const { data: pendingMeetData } = trpc.meetingInvitation.getPendingCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 20_000,
  });
  const pendingMeetCount = pendingMeetData?.count ?? 0;
  const connectBadge = missedCallCount + pendingMeetCount;

  // Unread forum DM badge
  const { data: forumUnreadData } = trpc.forum.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 20_000,
  });
  const forumBadge = forumUnreadData?.unread ?? 0;

  // Pending teacher invite badge (Director only)
  const { data: pendingInviteData } = trpc.director.getPendingInviteCount.useQuery(undefined, {
    enabled: !!user && isDirectorPos,
    refetchInterval: 60_000,
  });
  const pendingInviteCount = pendingInviteData?.count ?? 0;

  // Items before Teacher dropdown (Home removed — logo already links to /)
  const mainNavItemsBefore = [
    { href: "/chat",           label: t("nav_chat"),           icon: MessageCircle },
  ];

  // Situació dropdown items — gated to admin/head_of_study
  const situacioItems = [
    { href: "/situacio",      label: t("nav_situacio"),       icon: SebaSymbol },
    { href: "/my-situacions", label: t("nav_my_situacions"),  icon: Library },
  ];
  const isSituacioActive = situacioItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );
  // Administration dropdown — school admin functions (top section)
  const schoolAdminItems = [
    { href: "/admin/enrolment",   label: t("nav_admin_enrolment"),   icon: ClipboardList },
    { href: "/admin/finance",     label: t("nav_admin_finance"),     icon: Banknote },
    { href: "/admin/staff",       label: t("nav_admin_staff"),       icon: UserCog },
    { href: "/admin/documents",   label: t("nav_admin_documents"),   icon: FolderOpen },
    { href: "/admin/governance",  label: t("nav_admin_governance"),  icon: Building2 },
    { href: "/admin/facilities",  label: t("nav_admin_facilities"),  icon: Wrench },
  ];
  // Platform management tools (bottom section — PIN-gated)
  const platformItems = [
    { href: "/admin",             label: t("nav_admin"),             icon: LayoutDashboard },
    { href: "/admin/errors",      label: t("nav_admin_errors"),      icon: ShieldAlert },
    { href: "/audit",             label: t("nav_audit"),             icon: BarChart3 },
    { href: "/ai-models",         label: t("nav_ai_models"),         icon: SebaSymbol },
    { href: "/accountability",    label: t("nav_accountability"),    icon: Lock },
    { href: "/admin/wake-words",  label: t("nav_wake_words"),        icon: Mic },
    { href: "/admin/audio-responses", label: t("nav_audio_responses"), icon: Music },
  ];
  const allAdminItems = [...schoolAdminItems, ...platformItems];
  const isAdminActive = allAdminItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );
  // Handler: navigate to platform tool — prompt PIN if not yet unlocked
  const handlePlatformClick = useCallback((href: string, e: React.MouseEvent) => {
    if (!platformUnlocked) {
      e.preventDefault();
      setPinTarget(href);
      setPinOpen(true);
      setAdminOpen(false);
    }
  }, [platformUnlocked]);
  const handlePinSuccess = useCallback(() => {
    setPlatformUnlocked(true);
    setPinOpen(false);
    if (pinTarget) window.location.href = pinTarget;
    setPinTarget(null);
  }, [pinTarget]);

  const hosItems = [
    { href: "/head-of-study/progress",            label: t("hos_progress"),            icon: GraduationCap },
    { href: "/head-of-study/groups",              label: t("hos_groups"),              icon: Users },
    { href: "/head-of-study/timetable",           label: t("hos_timetable"),           icon: CalendarDays },
    { href: "/head-of-study/attendance",          label: t("hos_attendance"),          icon: UserCheck },
    { href: "/head-of-study/assessment-calendar", label: t("hos_assessment_calendar"), icon: BookOpen },
    { href: "/head-of-study/curriculum",          label: t("hos_curriculum"),          icon: BookCheck },
    { href: "/head-of-study/reports",             label: t("hos_reports"),             icon: Download },
    { href: "/head-of-study/settings",            label: t("hos_settings"),            icon: SettingsIcon },
    { href: "/school-calendar",                   label: t("nav_school_calendar"),     icon: CalendarDays },
    { href: "/connect",                           label: t("nav_connect"),             icon: Wifi },
  ];

  const isHosActive = hosItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  const directorItems = [
    { href: "/director/overview",  label: t("dir_overview"),         icon: BarChart3 },
    { href: "/director/staff",     label: t("dir_staff"),            icon: UserCheck },
    { href: "/director/curriculum",label: t("dir_curriculum"),       icon: BookCheck },
    { href: "/accountability",     label: t("dir_accountability"),   icon: ShieldAlert },
    { href: "/director/progress",  label: t("dir_student_progress"), icon: GraduationCap },
    { href: "/director/reports",   label: t("dir_reports"),          icon: Download },
    { href: "/director/settings",  label: t("dir_settings"),         icon: SettingsIcon },
    { href: "/director/users",     label: t("dir_users_nav"),        icon: UserCog },
    { href: "/attendance",           label: t("nav_attendance"),       icon: ClipboardList },
    { href: "/school-calendar",      label: t("nav_school_calendar"),  icon: CalendarDays },
    { href: "/connect",             label: t("nav_connect"),          icon: Wifi },
    { href: "/audit",               label: t("nav_audit"),            icon: BarChart3 },
    { href: "/ai-models",           label: t("nav_ai_models"),        icon: SebaSymbol },
    { href: "/accountability",      label: t("nav_accountability"),   icon: Lock },
  ];

  const isDirectorActive = directorItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  const teacherItems = [
    { href: "/create",        label: t("nav_create"),        icon: SebaSymbol },
    { href: "/presentation",  label: t("nav_presentation"),  icon: PresentationIcon },
    { href: "/my-materials",  label: t("nav_my_materials"),  icon: Library },
    { href: "/challenge",     label: t("nav_challenge"),     icon: Zap },
    { href: "/groups",        label: t("nav_groups"),        icon: Users },
    { href: "/questions",     label: t("nav_questions"),     icon: BookOpen },
    { href: "/progress",      label: t("nav_group_progress"), icon: TrendingUp },
    { href: "/attendance",   label: t("nav_attendance"),   icon: UserCheck },
    { href: "/forum",         label: t("nav_forum"),         icon: MessagesSquare },
    { href: "/connect",       label: t("nav_connect"),       icon: Wifi },
    { href: "/lesson-planner",  label: t("nav_lesson_planner"),  icon: FileText },
    { href: "/individual-plans",  label: t("nav_individual_plans"),  icon: GraduationCap },
    { href: "/school-calendar",  label: t("nav_school_calendar"),  icon: CalendarDays },
    { href: "/help",             label: t("nav_help"),            icon: HelpCircle },
    { href: "/privacy",           label: t("nav_privacy"),          icon: Lock },
  ];

  const isTeacherActive = teacherItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
      if (directorRef.current && !directorRef.current.contains(e.target as Node)) setDirectorOpen(false);
      if (hosRef.current && !hosRef.current.contains(e.target as Node)) setHosOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (situacioRef.current && !situacioRef.current.contains(e.target as Node)) setSituacioOpen(false);
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) setAdminOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setDropOpen(false); setDirectorOpen(false); setHosOpen(false); setSituacioOpen(false); setAdminOpen(false); setLangOpen(false); }, [location]);

  // Note: body scroll lock removed — the mobile nav panel itself scrolls instead
  // (overflow-y-auto on the nav element handles long menus on small screens)

  const currentLang = LANG_OPTIONS.find((l) => l.code === lang) ?? LANG_OPTIONS[0];
  const { state: pwaState, install: pwaInstall, showIosModal, setShowIosModal } = usePwaInstall();

  return (
    <>
      <header className={cn(
        "sticky top-0 z-50 backdrop-blur-md border-b shadow-sm",
        isClassroomPage
          ? "bg-black/40 border-white/15"
          : "bg-white/95 border-border"
      )}>
        <div className="container flex items-center justify-between h-14 sm:h-16">

          {/* Logo — crossfade between classroom and standard variants */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
            <div className="relative h-10 sm:h-12" style={{ width: 'auto', minWidth: '60px' }}>
              {/* Standard logo (white bg) */}
              <img
                src="/manus-storage/SEBA_hd_new_b460fab2.png"
                alt="SEBA"
                className="h-10 sm:h-12 w-auto object-contain absolute top-0 left-0 transition-opacity duration-500"
                style={{ opacity: isClassroomPage ? 0 : 1 }}
              />
              {/* Classroom logo (black bg) */}
              <img
                src="/manus-storage/SEBA1_new_9053c213.png"
                alt="SEBA"
                className="h-10 sm:h-12 w-auto object-contain absolute top-0 left-0 transition-opacity duration-500"
                style={{ opacity: isClassroomPage ? 1 : 0 }}
              />
              {/* Invisible spacer to reserve correct width */}
              <img
                src="/manus-storage/SEBA_hd_new_b460fab2.png"
                alt=""
                aria-hidden="true"
                className="h-10 sm:h-12 w-auto object-contain invisible"
              />
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Items before Teacher dropdown: Chat, Practice */}
            {mainNavItemsBefore.map(({ href, label, icon: Icon }) => {
              const active = location === href || (href !== "/" && location.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground"
                      : isClassroomPage
                        ? "text-white/80 hover:text-white hover:bg-white/15"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}

            {/* Situació dropdown — gated by position */}
            {isSituacioPos && (
            <div ref={situacioRef} className="relative">
              <button
                onClick={() => setSituacioOpen((o) => !o)}
                title={t("nav_situacio_nav")}
                aria-label={t("nav_situacio_nav")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isSituacioActive
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <SebaSymbol className="w-4 h-4" />
                <span className="hidden lg:inline">{t("nav_situacio_nav")}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform hidden lg:inline", situacioOpen && "rotate-180")} />
              </button>

              {situacioOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  {situacioItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setSituacioOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            )}

            {/* Teacher dropdown (after Practice, before TA Forum) */}
            <div ref={dropRef} className="relative group/teacher">
              <button
                onClick={() => setDropOpen((o) => !o)}
                title={t("nav_teacher")}
                aria-label={t("nav_teacher")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isTeacherActive
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <SebaSymbol className="w-4 h-4" />
                <span className="hidden lg:inline">{t("nav_teacher")}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform hidden lg:inline", dropOpen && "rotate-180")} />
              </button>

              {dropOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  {teacherItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    const isConnect = href === "/connect";
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDropOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1">{label}</span>
                        {isConnect && connectBadge > 0 && (
                          <span className="ml-auto flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                            {connectBadge > 9 ? "9+" : connectBadge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Administration dropdown — admin only (system-level, role-gated) */}
            {user?.role === "admin" && (
            <div ref={adminRef} className="relative">
              <button
                onClick={() => setAdminOpen((o) => !o)}
                title={t("nav_administration")}
                aria-label={t("nav_administration")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isAdminActive
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden lg:inline">{t("nav_administration")}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform hidden lg:inline", adminOpen && "rotate-180")} />
              </button>
              {adminOpen && (
                <div
                  ref={adminMenuRef}
                  role="menu"
                  aria-label={t("nav_administration")}
                  className="absolute right-0 top-full mt-1 w-64 bg-white border border-border rounded-xl shadow-lg py-1 z-50 max-h-[80vh] overflow-y-auto"
                  onKeyDown={(e) => {
                    const items = adminMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
                    if (!items || items.length === 0) return;
                    const focused = document.activeElement as HTMLElement;
                    const idx = Array.from(items).indexOf(focused);
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      const next = idx < items.length - 1 ? items[idx + 1] : items[0];
                      next.focus();
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      const prev = idx > 0 ? items[idx - 1] : items[items.length - 1];
                      prev.focus();
                    } else if (e.key === "Escape") {
                      setAdminOpen(false);
                    }
                  }}
                >
                  {/* School administration section — sticky header */}
                  <p className="sticky top-0 bg-white z-10 px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                    {t("nav_admin_school_section")}
                  </p>
                  {schoolAdminItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        onClick={() => setAdminOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </Link>
                    );
                  })}
                  {/* Divider */}
                  <div className="my-1 border-t border-border" />
                  {/* Platform tools section — collapsed by default when PIN-locked */}
                  <button
                    role="menuitem"
                    onClick={() => setPlatformExpanded((v) => !v)}
                    className="sticky top-[28px] bg-white z-10 w-full px-4 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 hover:bg-secondary/50 transition-colors border-b border-border/40"
                  >
                    <Lock className="w-3 h-3" />
                    {t("nav_admin_platform_section")}
                    {!platformUnlocked && <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 rounded px-1">PIN</span>}
                    {platformUnlocked && <span className="text-[9px] bg-green-100 text-green-700 rounded px-1">{t("nav_admin_unlocked")}</span>}
                    <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", platformExpanded && "rotate-180")} />
                  </button>
                  {platformExpanded && platformItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        onClick={(e) => { handlePlatformClick(href, e); if (platformUnlocked) setAdminOpen(false); }}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary",
                          !platformUnlocked && "opacity-60"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        {!platformUnlocked && <Lock className="w-3 h-3 ml-auto text-muted-foreground" />}
                      </Link>
                    );
                  })}
                  {/* Divider + Territorial Services section */}
                  <div className="my-1 border-t border-border" />
                  <p className="sticky top-[28px] bg-white z-10 px-4 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 border-b border-border/40">
                    <MapPin className="w-3 h-3" />
                    {t("nav_admin_territorial_section")}
                  </p>
                  <button
                    role="menuitem"
                    onClick={() => { setTdDialogOpen(true); setAdminOpen(false); setTdResult(null); setTdName(""); setTdEmail(""); setTdReason(""); setTdTerritoryId(null); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors text-left"
                  >
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    {platformUnlocked ? t("nav_admin_register_td") : <span className="opacity-60">{t("nav_admin_register_td")}</span>}
                  </button>
                  <Link
                    href="/seba/tenants"
                    role="menuitem"
                    onClick={() => setAdminOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-purple-600" />
                    {t("nav_admin_tenant_management")}
                  </Link>
                </div>
              )}
            </div>
            )}

            {/* Head of Study dropdown — visible by position */}
            {isHosPos && (
            <div ref={hosRef} className="relative">
              <button
                onClick={() => setHosOpen((o) => !o)}
                title={t("nav_head_of_study")}
                aria-label={t("nav_head_of_study")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isHosActive
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <GraduationCap className="w-4 h-4" />
                <span className="hidden lg:inline">{t("nav_head_of_study")}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform hidden lg:inline", hosOpen && "rotate-180")} />
              </button>

              {hosOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  {hosItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setHosOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </Link>
                    );
                  })}
                  {/* TA Forum */}
                  <Link
                    href="/forum"
                    onClick={() => setHosOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                      location === "/forum" ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <MessagesSquare className="w-4 h-4" />
                    {t("nav_forum")}
                    {forumBadge > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {forumBadge > 9 ? "9+" : forumBadge}
                      </span>
                    )}
                  </Link>
                </div>
              )}
            </div>
            )}

            {/* Director dropdown — position-gated */}
            {isDirectorPos && (
            <div ref={directorRef} className="relative">
              <button
                onClick={() => setDirectorOpen((o) => !o)}
                title={t("nav_director")}
                aria-label={t("nav_director")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isDirectorActive
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden lg:inline">{t("nav_director")}</span>
                {pendingInviteCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white leading-none">
                    {pendingInviteCount > 9 ? "9+" : pendingInviteCount}
                  </span>
                )}
                <ChevronDown className={cn("w-3 h-3 transition-transform hidden lg:inline", directorOpen && "rotate-180")} />
              </button>

              {directorOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  {directorItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
                    const isUsersItem = href === "/director/users";
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDirectorOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                          active ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        {isUsersItem && pendingInviteCount > 0 && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white leading-none">
                            {pendingInviteCount > 9 ? "9+" : pendingInviteCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {/* TA Forum */}
                  <Link
                    href="/forum"
                    onClick={() => setDirectorOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                      location === "/forum" ? "text-primary bg-primary/5" : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <MessagesSquare className="w-4 h-4" />
                    {t("nav_forum")}
                    {forumBadge > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                        {forumBadge > 9 ? "9+" : forumBadge}
                      </span>
                    )}
                  </Link>
                </div>
              )}
            </div>
            )}

            {/* Settings link (desktop) */}
            {user && (
              <Link
                href="/settings"
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                  location === "/settings"
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                aria-label={t("nav_settings")}
                title={t("nav_settings")}
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
            )}

            {/* Notification bell */}
            {user && (
              <div ref={bellRef} className="relative ml-1">
                <button
                  onClick={() => setBellOpen((o) => !o)}
                  className={cn(
                    "relative flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                    isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  aria-label={t("nav_notifications")}
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="text-sm font-semibold text-foreground">{t("nav_notifications")}</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllRead.mutate()}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("nav_mark_all_read")}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {myNotifications.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">{t("nav_no_notifications")}</p>
                      ) : (
                        myNotifications.map((n: { id: number; title: string; body: string; link: string | null; isRead: boolean; createdAt: Date; type: string; userId: string }) => (
                          <div
                            key={n.id}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors",
                              !n.isRead && "bg-primary/5",
                              n.type !== "meeting_invite" && "cursor-pointer hover:bg-secondary/40"
                            )}
                            onClick={() => {
                              if (n.type === "meeting_invite") return;
                              if (!n.isRead) {
                                markRead.mutate({ id: n.id });
                                utils.notifications.getUnreadCount.invalidate();
                                utils.notifications.getMyNotifications.invalidate();
                              }
                              if (n.link) window.location.href = n.link;
                              setBellOpen(false);
                            }}
                          >
                            <Bell className={cn("w-4 h-4 mt-0.5 flex-shrink-0", n.isRead ? "text-muted-foreground" : "text-primary")} />
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", n.isRead ? "text-muted-foreground" : "text-foreground")}>{n.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                              {n.type === "meeting_invite" && !n.isRead && (
                                <MeetingInviteActions
                                  notificationId={n.id}
                                  onDone={() => {
                                    utils.notifications.getMyNotifications.invalidate();
                                    utils.notifications.getUnreadCount.invalidate();
                                    utils.meetingInvitation.getPendingCount.invalidate();
                                  }}
                                />
                              )}
                            </div>
                            {!n.isRead && n.type !== "meeting_invite" && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Install App button — desktop */}
            {pwaState !== "unavailable" && (
              <button
                onClick={pwaInstall}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                  isClassroomPage
                    ? "text-white border-white/30 hover:bg-white/15"
                    : "text-primary border-primary/40 hover:bg-primary/5"
                )}
                title="Install AINA as an app"
              >
                <Download className="w-4 h-4 animate-pulse-subtle" />
                Install App
              </button>
            )}

            {/* Language toggle */}
            <div ref={langRef} className="relative ml-1">
              <button
                onClick={() => setLangOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isClassroomPage
                    ? "text-white/80 hover:text-white hover:bg-white/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                aria-label={t("nav_change_language")}
              >
                <Globe className="w-4 h-4" />
                <span>{currentLang.flag} {currentLang.label}<DialectBadge /></span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", langOpen && "rotate-180")} />
              </button>

              {langOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  {LANG_OPTIONS.map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => { setLang(opt.code); setLangOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-left",
                        lang === opt.code ? "text-primary bg-primary/5 font-semibold" : "text-foreground hover:bg-secondary"
                      )}
                    >
                      <span>{opt.flag}</span>
                      <span>{opt.code === "ca" ? "Català" : opt.code === "es" ? "Español" : "English"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User avatar + Sign Out — desktop */}
            {/* Sign In button — desktop, only when not authenticated */}
            {!user && (
              <Link
                href="/login"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                  isClassroomPage
                    ? "text-white border-white/30 hover:bg-white/15"
                    : "text-primary border-primary/40 hover:bg-primary/5"
                )}
                aria-label={t("nav_sign_in")}
                title={t("nav_sign_in")}
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden lg:inline">{t("nav_sign_in")}</span>
              </Link>
            )}

            {user && (
              <div className="flex items-center gap-1.5">
                {/* Avatar circle with initials */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold select-none shrink-0",
                    isClassroomPage
                      ? "bg-white/20 text-white"
                      : "bg-primary/15 text-primary"
                  )}
                  title={user.name ?? user.email ?? ""}
                >
                  {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                </div>
                {/* Sign Out button */}
                <button
                  onClick={logout}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                    isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  )}
                  aria-label={t("nav_sign_out")}
                  title={t("nav_sign_out")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </nav>

          {/* Mobile: language pill + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            {/* Compact language switcher on mobile */}
            <div className={cn(
                "flex items-center gap-0.5 rounded-lg p-0.5",
                isClassroomPage ? "bg-white/15 backdrop-blur-sm" : "bg-secondary"
              )}>
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => setLang(opt.code)}
                  className={cn(
                    "px-2 py-1 rounded-md text-xs font-semibold transition-all",
                    lang === opt.code
                      ? isClassroomPage
                        ? "bg-white/30 text-white shadow-sm"
                        : "bg-primary text-primary-foreground shadow-sm"
                      : isClassroomPage
                        ? "text-white/70 hover:text-white"
                        : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg transition-all",
                isClassroomPage
                  ? "text-white/80 hover:text-white hover:bg-white/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? t("nav_close_menu") : t("nav_open_menu")}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-black/40" onClick={() => setMobileOpen(false)}>
          <nav
            className={cn(
              "border-b shadow-xl flex flex-col overflow-y-auto max-h-[calc(100vh-3.5rem)]",
              isClassroomPage
                ? "bg-black/70 backdrop-blur-md border-white/15"
                : "bg-white border-border"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main nav */}
            <div className={cn("px-4 py-3 border-b", isClassroomPage ? "border-white/15" : "border-border")}>
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
  {t("nav_home")} &amp; {t("nav_chat")}
              </p>
              {/* Sign In — mobile, only when not authenticated */}
              {!user && (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1 border",
                    isClassroomPage
                      ? "text-white border-white/30 hover:bg-white/15"
                      : "text-primary border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <LogIn className="w-5 h-5 flex-shrink-0" />
                  {t("nav_sign_in")}
                </Link>
              )}
              {mainNavItemsBefore.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* Install App — mobile */}
            {pwaState !== "unavailable" && (
              <div className={cn("px-4 py-3 border-t", isClassroomPage ? "border-white/15" : "border-border")}>
                <button
                  onClick={() => { pwaInstall(); setMobileOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
                    isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-primary hover:bg-primary/5"
                  )}
                >
                  <Download className="w-5 h-5 flex-shrink-0 animate-pulse-subtle" />
                  Install App
                </button>
              </div>
            )}

            {/* Situació tools — role-gated to admin / head_of_study */}
            {isSituacioPos && (
            <div className={cn("px-4 py-3 border-b", isClassroomPage ? "border-white/15" : "border-border")}>
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_situacio_nav")}
              </p>
              {situacioItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
            )}

            {/* Administration tools — admin only */}
            {user?.role === "admin" && (
            <div className="px-4 py-3">
              {/* School admin section */}
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_administration")} — {t("nav_admin_school_section")}
              </p>
              {schoolAdminItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
              {/* Divider + Platform tools */}
              <div className="my-2 border-t border-border/40" />
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1 flex items-center gap-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                <Lock className="w-3 h-3" />
                {t("nav_admin_platform_section")}
                {!platformUnlocked && <span className="ml-auto text-[9px] bg-amber-100 text-amber-700 rounded px-1">PIN</span>}
                {platformUnlocked && <span className="ml-auto text-[9px] bg-green-100 text-green-700 rounded px-1">{t("nav_admin_unlocked")}</span>}
              </p>
              {platformItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={(e) => { handlePlatformClick(href, e); if (platformUnlocked) setMobileOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary",
                      !platformUnlocked && "opacity-60"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                    {!platformUnlocked && <Lock className="w-4 h-4 ml-auto text-muted-foreground" />}
                  </Link>
                );
              })}
            </div>
            )}

            {/* Head of Study tools — role-gated */}
            {isHosPos && (
            <div className="px-4 py-3">
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_head_of_study")}
              </p>
              {hosItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
              {/* TA Forum */}
              <Link
                href="/forum"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                  location === "/forum"
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-foreground hover:bg-secondary"
                )}
              >
                <MessagesSquare className="w-5 h-5 flex-shrink-0" />
                {t("nav_forum")}
                {forumBadge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {forumBadge > 9 ? "9+" : forumBadge}
                  </span>
                )}
              </Link>
            </div>
            )}

            {/* Director tools */}
            {isDirectorPos && (
            <div className="px-4 py-3">
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_director")}
              </p>
              {directorItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                const isUsersItem = href === "/director/users";
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                    {isUsersItem && pendingInviteCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white leading-none">
                        {pendingInviteCount > 9 ? "9+" : pendingInviteCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              {/* TA Forum */}
              <Link
                href="/forum"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                  location === "/forum"
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-foreground hover:bg-secondary"
                )}
              >
                <MessagesSquare className="w-5 h-5 flex-shrink-0" />
                {t("nav_forum")}
                {forumBadge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {forumBadge > 9 ? "9+" : forumBadge}
                  </span>
                )}
              </Link>
            </div>
            )}

            {/* Teacher tools */}
            {isTeacherPos && (
            <div className="px-4 py-3">
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_teacher")}
              </p>
              {/* Settings link in mobile menu */}
              {user && (
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                    location === "/settings"
                      ? "bg-primary text-primary-foreground"
                      : isClassroomPage
                        ? "text-white/80 hover:text-white hover:bg-white/15"
                        : "text-foreground hover:bg-secondary"
                  )}
                >
                  <SettingsIcon className="w-5 h-5 flex-shrink-0" />
                  {t("nav_settings")}
                </Link>
              )}
              {teacherItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || (href !== "/" && location.startsWith(href));
                const isMobileConnect = href === "/connect";
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all mb-1",
                      active
                        ? "bg-primary text-primary-foreground"
                        : isClassroomPage
                          ? "text-white/80 hover:text-white hover:bg-white/15"
                          : "text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {isMobileConnect && connectBadge > 0 && (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {connectBadge > 9 ? "9+" : connectBadge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            )}

            {/* User info + Sign Out — mobile */}
            {user && (
              <div className="px-4 py-3 border-t border-border mt-1 space-y-1">
                {/* User identity row */}
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl",
                  isClassroomPage ? "bg-white/10" : "bg-muted/50"
                )}>
                  <div className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold select-none shrink-0",
                    isClassroomPage ? "bg-white/20 text-white" : "bg-primary/15 text-primary"
                  )}>
                    {(user.name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={cn(
                      "text-sm font-semibold truncate",
                      isClassroomPage ? "text-white" : "text-foreground"
                    )}>
                      {user.name ?? user.email ?? ""}
                    </p>
                    {user.name && user.email && (
                      <p className={cn(
                        "text-xs truncate",
                        isClassroomPage ? "text-white/60" : "text-muted-foreground"
                      )}>
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                {/* Sign Out button */}
                <button
                  onClick={() => { setMobileOpen(false); logout(); }}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-all",
                    isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-destructive hover:bg-destructive/10"
                  )}
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  {t("nav_sign_out")}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
      {/* iOS install instructions modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIosModal(false)}>
          <div className="w-full max-w-sm bg-[#0f172a] border border-white/20 rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <p className="text-base font-semibold text-white">Install AINA on your iPhone</p>
              <button onClick={() => setShowIosModal(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-white/70">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">1</span>
                <span>Tap the <Share className="w-4 h-4 inline-block mx-1 text-blue-400" /> Share button in Safari</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">2</span>
                <span>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong> <Plus className="w-3.5 h-3.5 inline-block ml-0.5" /></span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">3</span>
                <span>Tap <strong className="text-white">"Add"</strong> — AINA will appear on your home screen</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIosModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {/* PIN gate modal for platform tools */}
      <AdminPinGate
        open={pinOpen}
        onSuccess={handlePinSuccess}
        onCancel={() => { setPinOpen(false); setPinTarget(null); }}
      />

      {/* Register Territorial Director dialog */}
      {tdDialogOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !registerTD.isPending && setTdDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {!tdResult ? (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Register Territorial Director</h2>
                    <p className="text-xs text-gray-500">Creates account, grants role, assigns territory</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={tdName}
                      onChange={(e) => setTdName(e.target.value)}
                      placeholder="e.g. Director Territorial Terres de l'Ebre"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={tdEmail}
                      onChange={(e) => setTdEmail(e.target.value)}
                      placeholder="e.g. territorial.ebre@educacio.gencat.cat"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Territory</label>
                    <select
                      value={tdTerritoryId ?? ""}
                      onChange={(e) => setTdTerritoryId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select territory...</option>
                      {tdTerritories.map((t: { id: number; name: string }) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <input
                      type="text"
                      value={tdReason}
                      onChange={(e) => setTdReason(e.target.value)}
                      placeholder="e.g. Appointed by Departament d'Educació"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => setTdDialogOpen(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!tdName.trim() || !tdEmail.trim() || !tdTerritoryId || registerTD.isPending}
                    onClick={() => registerTD.mutate({ name: tdName.trim(), email: tdEmail.trim(), territoryId: tdTerritoryId!, reason: tdReason.trim() || undefined })}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {registerTD.isPending ? "Registering..." : "Register & Grant"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Director Registered</h2>
                    <p className="text-xs text-gray-500">{tdResult.territoryName}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{tdResult.email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Temp Password</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-white border border-gray-200 px-2 py-0.5 rounded">{tdResult.tempPassword}</code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`Email: ${tdResult!.email}\nPassword: ${tdResult!.tempPassword}\nPortal: ${window.location.origin}/login`); setTdCopied(true); setTimeout(() => setTdCopied(false), 2000); }}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Copy credentials"
                      >
                        {tdCopied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                  Share these credentials securely. The director should change their password on first login.
                </p>
                <button
                  onClick={() => setTdDialogOpen(false)}
                  className="w-full mt-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
