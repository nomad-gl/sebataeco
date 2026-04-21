/**
 * /ai-models — Public page attributing all AI models used by SEBA to
 * the Barcelona Supercomputing Center (BSC) Salamandra and Àguila frameworks.
 * All visible strings are run through the i18n t() helper so the page
 * respects the user's selected language (CA / ES / EN).
 */
import { ExternalLink, Cpu, FlaskConical, Globe, Shield, BookOpen, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import NavBar from "@/components/NavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/contexts/I18nContext";

const BSC_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Barcelona_Supercomputing_Center_logo.svg/320px-Barcelona_Supercomputing_Center_logo.svg.png";

interface ModelCardProps {
  name: string;
  family: string;
  familyUrl: string;
  description: string;
  usedFor: string[];
  licence: string;
  hfUrl: string;
  language: string[];
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  labelsLanguages: string;
  labelsLicence: string;
  labelsUsedFor: string;
}

function ModelCard({
  name,
  family,
  familyUrl,
  description,
  usedFor,
  licence,
  hfUrl,
  language,
  badge,
  badgeVariant = "default",
  labelsLanguages,
  labelsLicence,
  labelsUsedFor,
}: ModelCardProps) {
  return (
    <Card className="border-border/60 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cpu className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{name}</CardTitle>
              <a
                href={familyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
              >
                {family} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {badge && <Badge variant={badgeVariant} className="text-[10px]">{badge}</Badge>}
            <a
              href={hfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              HuggingFace <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-semibold text-foreground mb-1">{labelsLanguages}</p>
            <div className="flex flex-wrap gap-1">
              {language.map((l) => (
                <span key={l} className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{l}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">{labelsLicence}</p>
            <span className="text-muted-foreground">{licence}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground mb-1.5">{labelsUsedFor}</p>
          <ul className="space-y-0.5">
            {usedFor.map((u) => (
              <li key={u} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                {u}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AiModels() {
  const { t } = useI18n();

  const cardLabels = {
    labelsLanguages: t("ai_models_card_languages"),
    labelsLicence: t("ai_models_card_licence"),
    labelsUsedFor: t("ai_models_card_used_for"),
  };

  const models: ModelCardProps[] = [
    {
      name: "Salamandra 2 7B Instruct",
      family: "Salamandra Family · BSC",
      familyUrl: "https://projecteaina.cat/tech/en/introducing-the-salamandra-family-of-models/",
      description: t("ai_models_salamandra_desc"),
      usedFor: [
        t("ai_models_salamandra_use1"),
        t("ai_models_salamandra_use2"),
        t("ai_models_salamandra_use3"),
        t("ai_models_salamandra_use4"),
        t("ai_models_salamandra_use5"),
      ],
      licence: "Apache 2.0",
      hfUrl: "https://huggingface.co/BSC-LT/salamandra-2-7b-instruct",
      language: [t("ai_models_lang_catalan"), t("ai_models_lang_spanish"), t("ai_models_lang_english")],
      badge: t("ai_models_badge_primary"),
      badgeVariant: "default",
      ...cardLabels,
    },
    {
      name: "Àguila 7B",
      family: "Àguila Family · BSC",
      familyUrl: "https://huggingface.co/BSC-LT/aguila-7b",
      description: t("ai_models_aguila_desc"),
      usedFor: [
        t("ai_models_aguila_use1"),
        t("ai_models_aguila_use2"),
        t("ai_models_aguila_use3"),
        t("ai_models_aguila_use4"),
      ],
      licence: "Apache 2.0",
      hfUrl: "https://huggingface.co/BSC-LT/aguila-7b",
      language: [t("ai_models_lang_spanish"), t("ai_models_lang_catalan")],
      badge: t("ai_models_badge_complementary"),
      badgeVariant: "secondary",
      ...cardLabels,
    },
    {
      name: "Whisper (via HF Inference API)",
      family: "OpenAI Whisper",
      familyUrl: "https://huggingface.co/openai/whisper-large-v3",
      description: t("ai_models_whisper_desc"),
      usedFor: [
        t("ai_models_whisper_use1"),
        t("ai_models_whisper_use2"),
      ],
      licence: "MIT",
      hfUrl: "https://huggingface.co/openai/whisper-large-v3",
      language: [t("ai_models_lang_multilingual")],
      badge: t("ai_models_badge_stt"),
      badgeVariant: "outline",
      ...cardLabels,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="container max-w-3xl py-8 px-4">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        {/* Page header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 rounded-xl bg-primary/10 shrink-0">
            <FlaskConical className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("ai_models_title")}</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {t("ai_models_subtitle")}
            </p>
          </div>
        </div>

        {/* BSC attribution banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-8 flex flex-col sm:flex-row items-center gap-4">
          <img
            src={BSC_LOGO}
            alt="Barcelona Supercomputing Center"
            className="h-10 w-auto object-contain shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-foreground">
              Barcelona Supercomputing Center (BSC) — Centro Nacional de Supercomputación
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {t("ai_models_bsc_desc")}{" "}
              <a
                href="https://projecteaina.cat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Projecte Aina
              </a>
              {t("ai_models_bsc_desc2")}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2">
              <a
                href="https://www.bsc.es"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Globe className="h-3 w-3" /> bsc.es
              </a>
              <a
                href="https://projecteaina.cat"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Globe className="h-3 w-3" /> projecteaina.cat
              </a>
              <a
                href="https://huggingface.co/BSC-LT"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> HuggingFace / BSC-LT
              </a>
            </div>
          </div>
        </div>

        {/* Model cards */}
        <div className="space-y-4 mb-8">
          {models.map((m) => (
            <ModelCard key={m.name} {...m} />
          ))}
        </div>

        {/* Compliance note */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 flex gap-3">
          <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">{t("ai_models_compliance_title")}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("ai_models_compliance_note")}
            </p>
            <div className="flex flex-wrap gap-3 mt-2">
              <Link href="/dpa" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {t("ai_models_view_dpa")}
              </Link>
              <Link href="/privacy" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                <Shield className="h-3 w-3" /> {t("ai_models_view_privacy")}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
