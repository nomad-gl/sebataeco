import { Link } from "wouter";
import { MessageCircle, Dumbbell, LayoutDashboard, ArrowRight, BookOpen } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import NavBar from "@/components/NavBar";
import { cn } from "@/lib/utils";

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

const features = [
  {
    icon: MessageCircle,
    title: "AI Chat Assistant",
    description:
      "Ask curriculum-aligned questions and get instant, LOMLOE-grounded answers from our AI tutor.",
    href: "/chat",
    color: "oklch(0.45 0.2 240)",
  },
  {
    icon: Dumbbell,
    title: "Practice Mode",
    description:
      "Test your knowledge with multiple-choice questions drawn directly from the LOMLOE competency bank.",
    href: "/practice",
    color: "oklch(0.48 0.18 145)",
  },
  {
    icon: LayoutDashboard,
    title: "Admin Dashboard",
    description:
      "View knowledge bank statistics, coverage metrics, and question distribution across all competencies.",
    href: "/admin",
    color: "oklch(0.48 0.2 270)",
  },
];

export default function Home() {
  const { data: competencies } = trpc.lomloe.getCompetencies.useQuery();
  const { data: stats } = trpc.lomloe.getStats.useQuery();

  return (
    <div className="bg-background flex flex-col">
      <NavBar />

      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />
        <div className="container py-20 lg:py-28 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-sm font-semibold mb-6 backdrop-blur-sm">
              <BookOpen className="w-4 h-4" />
              Spain's LOMLOE Curriculum · 8 Competencies
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-tight mb-6 drop-shadow-lg">
              Your AI Teaching
              <span className="text-blue-300"> Assistant</span>
              <br />
              for LOMLOE
            </h1>
            <p className="text-lg text-white/85 mb-8 max-w-2xl drop-shadow">
              Practise all eight key competencies defined by Spain's LOMLOE education law. Ask
              questions, test your knowledge, and get curriculum-aligned explanations — instantly.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Button asChild size="lg" className="gap-2">
                <Link href="/chat">
                  Start Chatting <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/practice">Practice Questions</Link>
              </Button>
            </div>

            {/* LOMLOE official logo – hero placement */}
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
                className="h-16 w-auto object-contain rounded-md shadow-sm"
              />
            </a>
          </div>
        </div>

        {/* Decorative blobs */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--comp-ccl), transparent)" }}
        />
        <div
          className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, var(--comp-cp), transparent)" }}
        />
      </section>

      {/* Stats bar */}
      {stats && (
        <section className="border-b border-border bg-secondary/30">
          <div className="container py-5">
            <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
              <div className="text-center sm:text-left">
                <p className="text-3xl font-bold text-primary">{stats.totalQuestions}</p>
                <p className="text-sm text-muted-foreground">Curriculum Questions</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-3xl font-bold text-primary">{stats.totalCompetencies}</p>
                <p className="text-sm text-muted-foreground">LOMLOE Competencies</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-3xl font-bold text-primary">{stats.totalYearGroups}</p>
                <p className="text-sm text-muted-foreground">Year Groups</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-foreground mb-8">What you can do</h2>
        <div className="grid md:grid-cols-3 gap-6">
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
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Competency grid */}
      <section className="container pb-16">
        <h2 className="text-2xl font-bold text-foreground mb-2">8 LOMLOE Competencies</h2>
        <p className="text-muted-foreground mb-8">
          Every question is mapped to one of Spain's eight key curriculum competencies.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {competencies?.map((comp) => (
            <Link key={comp.code} href={`/practice?competency=${comp.code}`}>
              <Card className="h-full hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer border-border group overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{comp.emoji}</span>
                    <span
                      className={cn("badge-" + comp.code, "text-xs font-bold")}
                    >
                      {comp.code}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">
                    {comp.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {comp.description}
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
      </section>


    </div>
  );
}
