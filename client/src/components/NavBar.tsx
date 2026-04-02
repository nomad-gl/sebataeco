import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  BookOpen, MessageCircle, Dumbbell, LayoutDashboard,
  Sparkles, Library, TrendingUp, ChevronDown, Menu, X, Zap,
  Presentation as PresentationIcon, Globe, Users, MessagesSquare, Bell, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useI18n, Lang } from "@/contexts/I18nContext";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Share, Plus } from "lucide-react";

const LANG_OPTIONS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "es", label: "ES", flag: "🇪🇸" },
  { code: "ca", label: "CA", flag: "🏴" },
];

export default function NavBar() {
  const [location] = useLocation();
  const { t, lang, setLang } = useI18n();
  const isClassroomPage = location === "/chat" || location === "/practice" || location === "/progress";
  const [dropOpen, setDropOpen]     = useState(false);
  const [langOpen, setLangOpen]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen]     = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
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

  const mainNavItems = [
    { href: "/",          label: t("nav_home"),     icon: BookOpen },
    { href: "/chat",      label: t("nav_chat"),     icon: MessageCircle },
    { href: "/practice",  label: t("nav_practice"), icon: Dumbbell },
    { href: "/progress",  label: t("nav_progress"), icon: TrendingUp },
    { href: "/forum",     label: t("nav_forum"),    icon: MessagesSquare },
  ];

  const teacherItems = [
    { href: "/create",        label: t("nav_create"),        icon: Sparkles },
    { href: "/presentation",  label: t("nav_presentation"),  icon: PresentationIcon },
    { href: "/my-materials",  label: t("nav_my_materials"),  icon: Library },
    { href: "/challenge",     label: t("nav_challenge"),     icon: Zap },
    { href: "/groups",        label: t("nav_groups"),        icon: Users },
    { href: "/questions",     label: t("nav_questions"),     icon: BookOpen },
    { href: "/admin",         label: t("nav_admin"),         icon: LayoutDashboard },
  ];

  const isTeacherActive = teacherItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); setDropOpen(false); setLangOpen(false); }, [location]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

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
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/SEBA_hd_4ec811c2.png"
                alt="SEBA"
                className="h-10 sm:h-12 w-auto object-contain absolute top-0 left-0 transition-opacity duration-500"
                style={{ opacity: isClassroomPage ? 0 : 1 }}
              />
              {/* Classroom logo (black bg) */}
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/SEBA1_02cbc6c3.png"
                alt="SEBA"
                className="h-10 sm:h-12 w-auto object-contain absolute top-0 left-0 transition-opacity duration-500"
                style={{ opacity: isClassroomPage ? 1 : 0 }}
              />
              {/* Invisible spacer to reserve correct width */}
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/SEBA_hd_4ec811c2.png"
                alt=""
                aria-hidden="true"
                className="h-10 sm:h-12 w-auto object-contain invisible"
              />
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {mainNavItems.map(({ href, label, icon: Icon }) => {
              const active = location === href || (href !== "/" && location.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
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
                  {label}
                </Link>
              );
            })}

            {/* Teacher dropdown */}
            <div ref={dropRef} className="relative">
              <button
                onClick={() => setDropOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  isTeacherActive
                    ? "bg-primary text-primary-foreground"
                    : isClassroomPage
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Sparkles className="w-4 h-4" />
                {t("nav_teacher")}
                <ChevronDown className={cn("w-3 h-3 transition-transform", dropOpen && "rotate-180")} />
              </button>

              {dropOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                  {teacherItems.map(({ href, label, icon: Icon }) => {
                    const active = location === href || (href !== "/" && location.startsWith(href));
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
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

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
                              "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-secondary/40 transition-colors",
                              !n.isRead && "bg-primary/5"
                            )}
                            onClick={() => {
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
                            </div>
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
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
                title="Install SEBA as an app"
              >
                <Download className="w-4 h-4" />
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
                <span>{currentLang.flag} {currentLang.label}</span>
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
              "border-b shadow-xl flex flex-col",
              isClassroomPage
                ? "bg-black/70 backdrop-blur-md border-white/15"
                : "bg-white border-border"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main nav */}
            <div className={cn("px-4 py-3 border-b", isClassroomPage ? "border-white/15" : "border-border")}>
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_home")} &amp; {t("nav_practice")}
              </p>
              {mainNavItems.map(({ href, label, icon: Icon }) => {
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
                  <Download className="w-5 h-5 flex-shrink-0" />
                  Install App
                </button>
              </div>
            )}

            {/* Teacher tools */}
            <div className="px-4 py-3">
              <p className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", isClassroomPage ? "text-white/50" : "text-muted-foreground")}>
                {t("nav_teacher")}
              </p>
              {teacherItems.map(({ href, label, icon: Icon }) => {
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
          </nav>
        </div>
      )}
      {/* iOS install instructions modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowIosModal(false)}>
          <div className="w-full max-w-sm bg-[#0f172a] border border-white/20 rounded-2xl shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <p className="text-base font-semibold text-white">Install SEBA on your iPhone</p>
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
                <span>Tap <strong className="text-white">"Add"</strong> — SEBA will appear on your home screen</span>
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
    </>
  );
}
