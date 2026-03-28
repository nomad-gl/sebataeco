import { Link, useLocation } from "wouter";
import { BookOpen, MessageCircle, Dumbbell, LayoutDashboard, Sparkles, Library, TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

const mainNavItems = [
  { href: "/", label: "Home", icon: BookOpen },
  { href: "/chat", label: "AI Chat", icon: MessageCircle },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: TrendingUp },
];

const teacherItems = [
  { href: "/create", label: "Create Material", icon: Sparkles },
  { href: "/my-materials", label: "My Materials", icon: Library },
  { href: "/admin", label: "Admin", icon: LayoutDashboard },
];

export default function NavBar() {
  const [location] = useLocation();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const isTeacherActive = teacherItems.some(
    (i) => location === i.href || (i.href !== "/" && location.startsWith(i.href))
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-sm">
            S
          </div>
          <span className="font-heading font-bold text-lg text-foreground group-hover:text-primary transition-colors">
            SEBA AI
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
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
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          {/* Teacher tools dropdown */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setDropOpen((o) => !o)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                isTeacherActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Teacher</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform hidden sm:block", dropOpen && "rotate-180")} />
            </button>

            {dropOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-border rounded-xl shadow-lg py-1 z-50">
                {teacherItems.map(({ href, label, icon: Icon }) => {
                  const active = location === href || (href !== "/" && location.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDropOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "text-primary bg-primary/5"
                          : "text-foreground hover:bg-secondary"
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
        </nav>
      </div>
    </header>
  );
}
