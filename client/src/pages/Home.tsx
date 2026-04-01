import { Link } from "wouter";
import { MessageCircle, Dumbbell, LayoutDashboard, ArrowRight, BookOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import NavBar from "@/components/NavBar";
import ParallaxSection from "@/components/ParallaxSection";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

const LOMLOE_LOGO =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/lomloe_23170104.png";

const HERO_BG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/hero-bg-UMuQESLM5HrV2VsrndDo2h.webp";

const COMP_COLORS: Record<string, string> = {
  CCL: "var(--comp-ccl)",
  CP: "var(--comp-cp)",
  STEM: "var(--comp-stem)",
  CD: "var(--comp-cd)",
  CPSAA: "var(--comp-cpsaa)",
  CC: "var(--comp-cc)",
  CE: "var(--comp-ce)",
  CCEC: "var(--comp-ccec)",
};

export default function Home() {
  const { t } = useI18n();
  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();
  const { data: stats } = trpc.lomloe.getStats.useQuery();

  const features = [
    {
      icon: MessageCircle,
      title: t("home_feature_chat_title"),
      description: t("home_feature_chat_desc"),
      href: "/chat",
      color: "oklch(0.45 0.2 240)",
    },
    {
      icon: Dumbbell,
      title: t("home_feature_practice_title"),
      description: t("home_feature_practice_desc"),
      href: "/practice",
      color: "oklch(0.48 0.18 145)",
    },
    {
      icon: LayoutDashboard,
      title: t("home_feature_create_title"),
      description: t("home_feature_create_desc"),
      href: "/create",
      color: "oklch(0.48 0.2 270)",
    },
  ];

  return (
    <div className="bg-background flex flex-col">
      <NavBar />

      {/* Hero */}
      <ParallaxSection
        imageUrl={HERO_BG}
        speed={0.35}
        overlayClass="bg-black/55"
        className="border-b border-border"
      >
        <div className="container py-14 sm:py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-sm font-semibold mb-6 backdrop-blur-sm">
              <BookOpen className="w-4 h-4" />
              {t("home_badge")}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white leading-tight mb-4 sm:mb-6 drop-shadow-lg">
              {t("home_hero_title")}
              <span className="text-blue-300"> {t("home_hero_accent")}</span>
              <br />
              {t("home_hero_subtitle")}
            </h1>
            <p className="text-base sm:text-lg text-white/85 mb-6 sm:mb-8 max-w-2xl drop-shadow">
              {t("home_hero_desc")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
              <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
                <Link href="/chat">
                  {t("home_cta_chat")} <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto bg-white/10 text-white border-white/40 hover:bg-white/20">
                <Link href="/practice">{t("home_cta_practice")}</Link>
              </Button>
            </div>

            {/* LOMLOE official logo */}
            <a
              href="https://www.educacionyfp.gob.es"
              target="_blank"
              rel="noopener noreferrer"
              title="Ministerio de Educación y Formación Profesional – LOMLOE"
              className="inline-block"
            >
              <img
                src={LOMLOE_LOGO}
                alt="LOMLOE – Gobierno de España · Ministerio de Educación y Formación Profesional"
                className="h-12 sm:h-16 w-auto object-contain rounded-md shadow-sm"
              />
            </a>
          </div>
        </div>
      </ParallaxSection>


      {/* Features */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-foreground mb-8">{t("home_features_title")}</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {features.map(({ icon: Icon, title, description, href, color }) => (
            <Link key={href} href={href}>
              <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer border-border group">
                <CardContent className="p-6 flex flex-col gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ background: color }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg mb-1 group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    {t("open")} <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Competency grid */}
      <ParallaxSection
        imageUrl={HERO_BG}
        speed={0.35}
        overlayClass="bg-black/60"
        className="py-16"
      >
        <div className="container">
        <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{t("home_competencies_title")}</h2>
        <p className="text-white/75 mb-8">
          {t("home_badge")}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {competencies?.map((comp) => (
            <Link key={comp.code} href={`/competency/${comp.code}`}>
              <Card className="h-full hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer border-white/20 bg-white/10 backdrop-blur-sm group overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{comp.emoji}</span>
                    <span className={cn("badge-" + comp.code, "text-xs font-bold")}>
                      {comp.code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-blue-200 transition-colors drop-shadow">
                    {t(`comp_${comp.code.toLowerCase()}_name` as Parameters<typeof t>[0])}
                  </h3>
                  <p className="text-xs text-white/75 line-clamp-3 leading-relaxed">
                    {t(`comp_${comp.code.toLowerCase()}_desc` as Parameters<typeof t>[0])}
                  </p>
                </CardContent>
                <div
                  className="h-1 w-0 group-hover:w-full transition-all duration-300"
                  style={{ background: COMP_COLORS[comp.code] }}
                />
              </Card>
            </Link>
          ))}
        </div>
        </div>
      </ParallaxSection>
    </div>
  );
}
