import { useState } from "react";
import NavBar from "@/components/NavBar";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import {
  MessageCircle, Dumbbell, TrendingUp, Users, BookOpen, FileText,
  CalendarDays, Zap, LayoutDashboard, ShieldAlert, Lock, Library,
  Presentation as PresentationIcon, ChevronDown, ChevronUp,
  Play, CheckCircle, Info, HelpCircle, ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SebaSymbol } from "@/components/SebaSymbol";

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
  title: string;
  description: string;
}

interface FeatureSection {
  id: string;
  icon: React.ElementType;
  color: string;
  badge?: string;
  title: string;
  subtitle: string;
  videoId?: string; // YouTube video ID — leave undefined for placeholder
  steps: Step[];
  tips?: string[];
}

// ── Feature definitions ──────────────────────────────────────────────────────

function useFeatures(): FeatureSection[] {
  const { t } = useI18n();
  return [
    {
      id: "chat",
      icon: MessageCircle,
      color: "from-blue-500 to-indigo-600",
      title: t("help_feat_chat_title"),
      subtitle: t("help_feat_chat_sub"),
      steps: [
        { title: t("help_chat_s1_title"), description: t("help_chat_s1_desc") },
        { title: t("help_chat_s2_title"), description: t("help_chat_s2_desc") },
        { title: t("help_chat_s3_title"), description: t("help_chat_s3_desc") },
        { title: t("help_chat_s4_title"), description: t("help_chat_s4_desc") },
      ],
      tips: [t("help_chat_tip1"), t("help_chat_tip2")],
    },
    {
      id: "practice",
      icon: Dumbbell,
      color: "from-green-500 to-emerald-600",
      title: t("help_feat_practice_title"),
      subtitle: t("help_feat_practice_sub"),
      steps: [
        { title: t("help_practice_s1_title"), description: t("help_practice_s1_desc") },
        { title: t("help_practice_s2_title"), description: t("help_practice_s2_desc") },
        { title: t("help_practice_s3_title"), description: t("help_practice_s3_desc") },
        { title: t("help_practice_s4_title"), description: t("help_practice_s4_desc") },
      ],
      tips: [t("help_practice_tip1")],
    },
    {
      id: "progress",
      icon: TrendingUp,
      color: "from-purple-500 to-violet-600",
      title: t("help_feat_progress_title"),
      subtitle: t("help_feat_progress_sub"),
      steps: [
        { title: t("help_progress_s1_title"), description: t("help_progress_s1_desc") },
        { title: t("help_progress_s2_title"), description: t("help_progress_s2_desc") },
        { title: t("help_progress_s3_title"), description: t("help_progress_s3_desc") },
      ],
      tips: [t("help_progress_tip1")],
    },
    {
      id: "groups",
      icon: Users,
      color: "from-orange-500 to-amber-600",
      title: t("help_feat_groups_title"),
      subtitle: t("help_feat_groups_sub"),
      steps: [
        { title: t("help_groups_s1_title"), description: t("help_groups_s1_desc") },
        { title: t("help_groups_s2_title"), description: t("help_groups_s2_desc") },
        { title: t("help_groups_s3_title"), description: t("help_groups_s3_desc") },
        { title: t("help_groups_s4_title"), description: t("help_groups_s4_desc") },
      ],
      tips: [t("help_groups_tip1")],
    },
    {
      id: "create",
      icon: BookOpen,
      color: "from-pink-500 to-rose-600",
      title: t("help_feat_create_title"),
      subtitle: t("help_feat_create_sub"),
      steps: [
        { title: t("help_create_s1_title"), description: t("help_create_s1_desc") },
        { title: t("help_create_s2_title"), description: t("help_create_s2_desc") },
        { title: t("help_create_s3_title"), description: t("help_create_s3_desc") },
        { title: t("help_create_s4_title"), description: t("help_create_s4_desc") },
        { title: t("help_create_s5_title"), description: t("help_create_s5_desc") },
      ],
      tips: [t("help_create_tip1"), t("help_create_tip2")],
    },
    {
      id: "presentations",
      icon: PresentationIcon,
      color: "from-cyan-500 to-sky-600",
      title: t("help_feat_pres_title"),
      subtitle: t("help_feat_pres_sub"),
      steps: [
        { title: t("help_pres_s1_title"), description: t("help_pres_s1_desc") },
        { title: t("help_pres_s2_title"), description: t("help_pres_s2_desc") },
        { title: t("help_pres_s3_title"), description: t("help_pres_s3_desc") },
        { title: t("help_pres_s4_title"), description: t("help_pres_s4_desc") },
      ],
      tips: [t("help_pres_tip1")],
    },
    {
      id: "materials",
      icon: Library,
      color: "from-teal-500 to-emerald-600",
      title: t("help_feat_materials_title"),
      subtitle: t("help_feat_materials_sub"),
      steps: [
        { title: t("help_materials_s1_title"), description: t("help_materials_s1_desc") },
        { title: t("help_materials_s2_title"), description: t("help_materials_s2_desc") },
        { title: t("help_materials_s3_title"), description: t("help_materials_s3_desc") },
      ],
      tips: [t("help_materials_tip1")],
    },
    {
      id: "lesson-planner",
      icon: FileText,
      color: "from-indigo-500 to-blue-600",
      badge: t("help_badge_core"),
      title: t("help_feat_lp_title"),
      subtitle: t("help_feat_lp_sub"),
      steps: [
        { title: t("help_lp_s1_title"), description: t("help_lp_s1_desc") },
        { title: t("help_lp_s2_title"), description: t("help_lp_s2_desc") },
        { title: t("help_lp_s3_title"), description: t("help_lp_s3_desc") },
        { title: t("help_lp_s4_title"), description: t("help_lp_s4_desc") },
        { title: t("help_lp_s5_title"), description: t("help_lp_s5_desc") },
        { title: t("help_lp_s6_title"), description: t("help_lp_s6_desc") },
        { title: t("help_lp_s7_title"), description: t("help_lp_s7_desc") },
        { title: t("help_lp_s8_title"), description: t("help_lp_s8_desc") },
      ],
      tips: [t("help_lp_tip1"), t("help_lp_tip2"), t("help_lp_tip3")],
    },
    {
      id: "school-calendar",
      icon: CalendarDays,
      color: "from-yellow-500 to-orange-500",
      badge: t("help_badge_core"),
      title: t("help_feat_cal_title"),
      subtitle: t("help_feat_cal_sub"),
      steps: [
        { title: t("help_cal_s1_title"), description: t("help_cal_s1_desc") },
        { title: t("help_cal_s2_title"), description: t("help_cal_s2_desc") },
        { title: t("help_cal_s3_title"), description: t("help_cal_s3_desc") },
        { title: t("help_cal_s4_title"), description: t("help_cal_s4_desc") },
        { title: t("help_cal_s5_title"), description: t("help_cal_s5_desc") },
        { title: t("help_cal_s6_title"), description: t("help_cal_s6_desc") },
      ],
      tips: [t("help_cal_tip1"), t("help_cal_tip2")],
    },
    {
      id: "classroom",
      icon: Zap,
      color: "from-yellow-400 to-amber-500",
      title: t("help_feat_classroom_title"),
      subtitle: t("help_feat_classroom_sub"),
      steps: [
        { title: t("help_classroom_s1_title"), description: t("help_classroom_s1_desc") },
        { title: t("help_classroom_s2_title"), description: t("help_classroom_s2_desc") },
        { title: t("help_classroom_s3_title"), description: t("help_classroom_s3_desc") },
        { title: t("help_classroom_s4_title"), description: t("help_classroom_s4_desc") },
        { title: t("help_classroom_s5_title"), description: t("help_classroom_s5_desc") },
      ],
      tips: [t("help_classroom_tip1"), t("help_classroom_tip2")],
    },
    {
      id: "questions",
      icon: BookOpen,
      color: "from-violet-500 to-purple-600",
      title: t("help_feat_questions_title"),
      subtitle: t("help_feat_questions_sub"),
      steps: [
        { title: t("help_questions_s1_title"), description: t("help_questions_s1_desc") },
        { title: t("help_questions_s2_title"), description: t("help_questions_s2_desc") },
        { title: t("help_questions_s3_title"), description: t("help_questions_s3_desc") },
      ],
      tips: [t("help_questions_tip1")],
    },
    {
      id: "accountability",
      icon: ShieldAlert,
      color: "from-red-500 to-rose-600",
      title: t("help_feat_accountability_title"),
      subtitle: t("help_feat_accountability_sub"),
      steps: [
        { title: t("help_accountability_s1_title"), description: t("help_accountability_s1_desc") },
        { title: t("help_accountability_s2_title"), description: t("help_accountability_s2_desc") },
        { title: t("help_accountability_s3_title"), description: t("help_accountability_s3_desc") },
      ],
      tips: [t("help_accountability_tip1")],
    },
    {
      id: "privacy",
      icon: Lock,
      color: "from-slate-500 to-gray-600",
      title: t("help_feat_privacy_title"),
      subtitle: t("help_feat_privacy_sub"),
      steps: [
        { title: t("help_privacy_s1_title"), description: t("help_privacy_s1_desc") },
        { title: t("help_privacy_s2_title"), description: t("help_privacy_s2_desc") },
        { title: t("help_privacy_s3_title"), description: t("help_privacy_s3_desc") },
      ],
      tips: [t("help_privacy_tip1")],
    },
    {
      id: "admin",
      icon: LayoutDashboard,
      color: "from-gray-600 to-zinc-700",
      title: t("help_feat_admin_title"),
      subtitle: t("help_feat_admin_sub"),
      steps: [
        { title: t("help_admin_s1_title"), description: t("help_admin_s1_desc") },
        { title: t("help_admin_s2_title"), description: t("help_admin_s2_desc") },
        { title: t("help_admin_s3_title"), description: t("help_admin_s3_desc") },
      ],
      tips: [t("help_admin_tip1")],
    },
  ];
}

// ── Video placeholder / embed ────────────────────────────────────────────────

function VideoCard({ videoId, title }: { videoId?: string; title: string }) {
  const { t } = useI18n();
  if (videoId) {
    return (
      <div className="rounded-xl overflow-hidden border border-border shadow-sm aspect-video">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 aspect-video flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Play className="w-6 h-6 text-primary ml-1" />
      </div>
      <div className="text-center px-4">
        <p className="font-medium text-sm text-foreground">{t("help_video_coming")}</p>
        <p className="text-xs mt-1">{t("help_video_soon")}</p>
      </div>
    </div>
  );
}

// ── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: FeatureSection }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const Icon = feature.icon;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm", feature.color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{feature.title}</h3>
            {feature.badge && (
              <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{feature.subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-border px-5 pb-6 pt-5 space-y-6">
          {/* Subtitle */}
          <p className="text-sm text-muted-foreground leading-relaxed">{feature.subtitle}</p>

          {/* Video */}
          <VideoCard videoId={feature.videoId} title={feature.title} />

          {/* Step-by-step */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              {t("help_steps_heading")}
            </h4>
            <ol className="space-y-3">
              {feature.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          {feature.tips && feature.tips.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                {t("help_tips_heading")}
              </h4>
              <ul className="space-y-1.5">
                {feature.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Help() {
  const { t } = useI18n();
  const features = useFeatures();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? features.filter(
        (f) =>
          f.title.toLowerCase().includes(search.toLowerCase()) ||
          f.subtitle.toLowerCase().includes(search.toLowerCase())
      )
    : features;

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b border-border">
        <div className="container py-10 max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("help_page_title")}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">{t("help_page_subtitle")}</p>

          {/* Search */}
          <div className="relative mt-5 max-w-md">
            <HelpCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("help_search_ph")}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div className="container py-8 max-w-4xl">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{t("help_no_results")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((f) => (
              <FeatureCard key={f.id} feature={f} />
            ))}
          </div>
        )}
      </div>

      {/* Footer branding */}
      <div className="border-t border-border py-6">
        <div className="container max-w-4xl flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <SebaSymbol className="w-5 h-5" />
            <span>{t("powered_by_seba")}</span>
          </div>
          <a
            href="mailto:support@sebataeco.com"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("help_contact_support")}
          </a>
        </div>
      </div>
    </div>
  );
}
