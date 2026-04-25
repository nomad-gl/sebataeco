import { useState, useEffect } from "react";
import { Baby, BookOpen, ChevronDown, ChevronUp, Dumbbell, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import ParallaxSection from "@/components/ParallaxSection";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const HERO_BG = "/manus-storage/hero-bg_a767782c.jpg";

type EixCode = "EIX1" | "EIX2" | "EIX3" | "EIX4";

interface EixDetail {
  code: EixCode;
  emoji: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  /** Canonical Catalan subtitle — always shown in Catalan per Decree 21/2023 */
  catalan: string;
  /** UI name key for translation */
  nameKey: string;
  /** UI description key for translation */
  descKey: string;
  /** Canonical Catalan saber area name */
  saberAreaName: string;
  competencies: { code: string; text: string }[];
  sabers03: string[];
  sabers36: string[];
  /** Pedagogical focus key for translation */
  pedagogicalFocusKey: string;
}

// Canonical curriculum content stays in Catalan per Decree 21/2023.
// Only UI chrome (headings, labels, buttons) is translated.
const EIX_DATA: EixDetail[] = [
  {
    code: "EIX1",
    emoji: "🌱",
    color: "oklch(0.72 0.18 340)",
    bgLight: "bg-pink-50 dark:bg-pink-950/30",
    borderColor: "border-pink-200 dark:border-pink-800",
    textColor: "text-pink-700 dark:text-pink-300",
    badgeBg: "bg-pink-100 text-pink-700 border-pink-200",
    catalan: "Un infant que creix amb autonomia i confiança",
    nameKey: "eix1_name",
    descKey: "eix1_desc",
    saberAreaName: "Cos, moviment i autonomia",
    competencies: [
      {
        code: "CE1.1",
        text: "Explorar i reconèixer el propi cos i les seves possibilitats, per construir progressivament una imatge positiva d'un mateix",
      },
      {
        code: "CE1.2",
        text: "Adquirir habilitats de cura personal i autonomia en situacions quotidianes, per avançar en l'autoregulació i el benestar personal",
      },
    ],
    sabers03: [
      "Gaudi i benestar en el moviment lliure i el joc autònom",
      "Descobriment d'objectes de manera activa i autònoma",
      "Exploració i coneixement global i segmentari del cos",
      "Adaptació del propi moviment en relació amb els altres",
      "Curiositat i interès en l'exploració sensoriomotriu",
    ],
    sabers36: [
      "Exploració i reconeixement del propi cos a través dels sentits",
      "Construcció progressiva d'una autoimatge positiva",
      "Respecte pel propi cos i pels cossos dels altres",
      "Adquisició progressiva d'autonomia en situacions quotidianes",
      "Descobriment i reconeixement de la pròpia imatge i la de les persones de l'entorn",
    ],
    pedagogicalFocusKey: "eix1_pedagogical",
  },
  {
    code: "EIX2",
    emoji: "🗣️",
    color: "oklch(0.68 0.18 200)",
    bgLight: "bg-teal-50 dark:bg-teal-950/30",
    borderColor: "border-teal-200 dark:border-teal-800",
    textColor: "text-teal-700 dark:text-teal-300",
    badgeBg: "bg-teal-100 text-teal-700 border-teal-200",
    catalan: "Un infant que es comunica amb diferents llenguatges",
    nameKey: "eix2_name",
    descKey: "eix2_desc",
    saberAreaName: "Comunicació i representació de la realitat",
    competencies: [
      {
        code: "CE2.1",
        text: "Expressar-se i comunicar-se oralment, per participar en situacions comunicatives de l'entorn proper",
      },
      {
        code: "CE2.2",
        text: "Iniciar-se en la descoberta de la llengua escrita com a eina de comunicació i representació",
      },
      {
        code: "CE2.3",
        text: "Explorar i crear amb els diferents llenguatges artístics, per expressar i comunicar emocions, vivències i idees",
      },
      {
        code: "CE2.4",
        text: "Iniciar-se en l'ús de recursos digitals, per explorar i comunicar-se en entorns digitals",
      },
    ],
    sabers03: [
      "Comunicació gestual, corporal i oral",
      "Escolta i comprensió de missatges orals simples",
      "Exploració de materials gràfics i plàstics",
      "Iniciació al contacte amb la llengua escrita (llibres, imatges)",
    ],
    sabers36: [
      "Expressió oral en situacions quotidianes i de joc",
      "Comprensió de textos orals i escrits de l'entorn",
      "Iniciació a la lectura i escriptura emergent",
      "Exploració de la llengua escrita com a sistema de representació",
      "Expressió plàstica, musical i corporal",
      "Ús d'eines digitals bàsiques per a la comunicació i la creació",
    ],
    pedagogicalFocusKey: "eix2_pedagogical",
  },
  {
    code: "EIX3",
    emoji: "🔍",
    color: "oklch(0.72 0.18 130)",
    bgLight: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    textColor: "text-green-700 dark:text-green-300",
    badgeBg: "bg-green-100 text-green-700 border-green-200",
    catalan: "Un infant que descobreix l'entorn amb curiositat",
    nameKey: "eix3_name",
    descKey: "eix3_desc",
    saberAreaName: "Descoberta de l'entorn",
    competencies: [
      {
        code: "CE3.1",
        text: "Explorar i identificar elements i relacions matemàtiques en situacions quotidianes, per iniciar-se en el pensament lògic i matemàtic",
      },
      {
        code: "CE3.2",
        text: "Observar i explorar l'entorn natural, establint relacions de causa-efecte, per iniciar hàbits de sostenibilitat i cura del medi",
      },
    ],
    sabers03: [
      "Exploració d'objectes i materials de l'entorn proper",
      "Descoberta de les propietats dels objectes (forma, color, mida, textura)",
      "Iniciació a la quantitat i la numeració en situacions quotidianes",
      "Descoberta dels efectes de les pròpies accions en el medi natural",
    ],
    sabers36: [
      "Exploració i classificació d'objectes per atributs",
      "Iniciació al nombre, la mesura i l'espai",
      "Ús d'instruments analògics i digitals per a la recollida de dades",
      "Experimentació amb elements naturals (aigua, terra, aire)",
      "Observació i exploració de l'entorn planificant la pròpia acció",
      "Indagació en el medi natural: cura, valoració i respecte",
    ],
    pedagogicalFocusKey: "eix3_pedagogical",
  },
  {
    code: "EIX4",
    emoji: "🌍",
    color: "oklch(0.68 0.18 260)",
    bgLight: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    textColor: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-100 text-purple-700 border-purple-200",
    catalan: "Un infant que forma part de la diversitat del món",
    nameKey: "eix4_name",
    descKey: "eix4_desc",
    saberAreaName: "La vida amb els altres / Interacció social i cultural en l'entorn",
    competencies: [
      {
        code: "CE4.1",
        text: "Avançar en la relació amb els altres en condicions d'igualtat, creant lligams, per construir la pròpia identitat basada en els valors democràtics",
      },
      {
        code: "CE4.2",
        text: "Apreciar progressivament l'entorn social i cultural proper i la seva diversitat, mostrant interès i respecte per conviure",
      },
    ],
    sabers03: [
      "Identificació dels primers vincles afectius",
      "Disposició per establir relacions afectuoses i respectuoses",
      "Transició progressiva del grup familiar al grup social",
      "Reconeixement de la família com a nucli central de convivència",
    ],
    sabers36: [
      "Reconeixement de pertinença a diferents grups socials",
      "Observació i identificació de l'entorn social: escola, carrer, barri",
      "Identificació i rebuig d'estereotips de gènere",
      "Reconeixement d'elements de l'entorn sociocultural (festes, tradicions)",
      "Participació en celebracions i tradicions culturals de l'entorn",
      "Coneixement de la realitat lingüística de l'aula i l'entorn proper",
    ],
    pedagogicalFocusKey: "eix4_pedagogical",
  },
];

// Pedagogical principles — canonical Catalan content per Decree 21/2023
// (translated via i18n keys eix_principle_1 … eix_principle_10)
const PRINCIPLE_KEYS = [
  "eix_principle_1",
  "eix_principle_2",
  "eix_principle_3",
  "eix_principle_4",
  "eix_principle_5",
  "eix_principle_6",
  "eix_principle_7",
  "eix_principle_8",
  "eix_principle_9",
  "eix_principle_10",
] as const;

function EixCard({ eix }: { eix: EixDetail }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`border ${eix.borderColor} ${eix.bgLight} overflow-hidden`}>
      {/* Coloured top accent bar */}
      <div className="h-1.5 w-full" style={{ background: eix.color }} />

      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-start gap-4">
          <span className="text-4xl leading-none mt-0.5">{eix.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${eix.badgeBg}`}
              >
                {eix.code}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700 border border-pink-200">
                Decret 21/2023
              </span>
            </div>
            <h2 className={`text-xl font-bold leading-snug mb-1 ${eix.textColor}`}>
              {t(eix.nameKey as any)}
            </h2>
            <p className={`text-sm font-medium italic mb-2 ${eix.textColor} opacity-80`}>
              {eix.catalan}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(eix.descKey as any)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-5">
        {/* Saber Area Name */}
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t("eix_saber_area_label")}
          </span>
          <span className={`text-xs font-bold ${eix.textColor}`}>{eix.saberAreaName}</span>
        </div>

        {/* Competències específiques */}
        <div className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            {t("eix_competencies_title")}
          </h3>
          <div className="space-y-2">
            {eix.competencies.map((ce) => (
              <div key={ce.code} className="flex gap-2 items-start">
                <Badge
                  variant="outline"
                  className={`text-xs shrink-0 mt-0.5 ${eix.badgeBg} border`}
                >
                  {ce.code}
                </Badge>
                <p className="text-sm leading-relaxed">{ce.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sabers by cycle — expandable */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-2 text-sm font-semibold ${eix.textColor} hover:opacity-80 transition-opacity mb-3`}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? t("eix_hide_sabers") : t("eix_show_sabers")}
        </button>

        {expanded && (
          <div className="grid sm:grid-cols-2 gap-4 mt-1">
            {/* Primer cicle 0–3 */}
            <div className={`rounded-lg border ${eix.borderColor} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${eix.badgeBg}`}>
                  {t("eix_primer_cicle")}
                </span>
                <span className="text-xs text-muted-foreground font-medium">0–3 anys</span>
              </div>
              <ul className="space-y-1.5">
                {eix.sabers03.map((s) => (
                  <li key={s} className="flex gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eix.color }} />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Segon cicle 3–6 */}
            <div className={`rounded-lg border ${eix.borderColor} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${eix.badgeBg}`}>
                  {t("eix_segon_cicle")}
                </span>
                <span className="text-xs text-muted-foreground font-medium">3–6 anys</span>
              </div>
              <ul className="space-y-1.5">
                {eix.sabers36.map((s) => (
                  <li key={s} className="flex gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eix.color }} />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Pedagogical focus */}
        <div className={`mt-4 rounded-lg border ${eix.borderColor} p-4 ${eix.bgLight}`}>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            {t("eix_enfocament_label")}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground italic">
            {t(eix.pedagogicalFocusKey as any)}
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={`/infantil/practice?eix=${eix.code}`}>
            <Button size="sm" variant="outline" className={`gap-2 border ${eix.borderColor} ${eix.textColor}`}>
              <Dumbbell className="w-3.5 h-3.5" />
              {t("eix_practica_btn")} {eix.code}
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="sm" variant="ghost" className="gap-2">
              <MessageCircle className="w-3.5 h-3.5" />
              {t("eix_ask_aina_btn")}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InfantilEixos() {
  const { t } = useI18n();
  useDocumentTitle("Educació Infantil · Eixos de Desenvolupament · Decret 21/2023");

  // Scroll to the anchor eix on load (e.g. /infantil/eixos#eix1)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="bg-background flex flex-col min-h-screen">
      <NavBar />

      {/* Hero */}
      <ParallaxSection
        imageUrl={HERO_BG}
        speed={0.3}
        overlayClass="bg-black/60"
        className="border-b border-border"
      >
        <div className="container py-12 sm:py-16 lg:py-20">
          <BackButton href="/" label={t("nav_home")} className="text-white/80 hover:text-white mb-6" />
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-sm font-semibold mb-5 backdrop-blur-sm">
              <Baby className="w-4 h-4" />
              {t("eix_hero_badge")}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
              {t("eix_hero_title_1")}{" "}
              <span className="text-pink-300">{t("eix_hero_title_2")}</span>
            </h1>
            <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl">
              {t("eix_hero_desc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/80 text-white backdrop-blur-sm">
                Decret 21/2023
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/80 text-white backdrop-blur-sm">
                LOMLOE
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                {t("eix_badge_primer_cicle")}
              </span>
            </div>
          </div>
        </div>
      </ParallaxSection>

      {/* Stage overview strip */}
      <div className="border-b border-border bg-muted/40">
        <div className="container py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: t("eix_stat_eixos"), value: "4" },
              { label: t("eix_stat_cicles"), value: "2" },
              { label: t("eix_stat_competencies"), value: "10" },
              { label: t("eix_stat_areas"), value: "4" },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-2xl font-extrabold text-pink-600">{value}</span>
                <span className="text-xs text-muted-foreground font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-12 max-w-5xl mx-auto">

        {/* Intro paragraph */}
        <div className="mb-10 max-w-3xl">
          <h2 className="text-2xl font-bold mb-3">{t("eix_intro_title")}</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            {t("eix_intro_p1")}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {t("eix_intro_p2")}
          </p>
        </div>

        {/* EIX cards */}
        <div className="space-y-6 mb-14">
          {EIX_DATA.map((eix) => (
            <div key={eix.code} id={eix.code.toLowerCase()}>
              <EixCard eix={eix} />
            </div>
          ))}
        </div>

        {/* Pedagogical principles */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">{t("eix_principles_title")}</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            {t("eix_principles_desc")}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PRINCIPLE_KEYS.map((key, i) => (
              <div
                key={key}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center border border-pink-200">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{t(key as any)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cycle comparison table */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">{t("eix_comparison_title")}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {t("eix_comparison_desc")}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-4 font-semibold text-muted-foreground w-1/3">{t("eix_table_aspect")}</th>
                  <th className="text-left p-4 font-semibold text-pink-700">{t("eix_table_primer")}</th>
                  <th className="text-left p-4 font-semibold text-purple-700">{t("eix_table_segon")}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["eix_row_denominacio", "Llar d'infants", "Parvulari / Preschool"],
                  ["eix_row_llei", "LOMLOE + RD 95/2022 + Decret 21/2023", "LOMLOE + RD 95/2022 + Decret 21/2023"],
                  ["eix_row_comunicacio", "Gestual, corporal i oral emergent", "Oral, escrita emergent, digital bàsic"],
                  ["eix_row_matematiques", "Quantitat i numeració en joc", "Nombre, mesura, espai i classificació"],
                  ["eix_row_entorn", "Exploració sensoriomotriu", "Indagació, experimentació, sostenibilitat"],
                  ["eix_row_social", "Vincles afectius i família", "Grups socials, diversitat, valors democràtics"],
                  ["eix_row_avaluacio", "Observació i documentació", "Observació, documentació i portafolis"],
                ].map(([aspectKey, c03, c36]) => (
                  <tr key={aspectKey} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{t(aspectKey as any)}</td>
                    <td className="p-4 text-muted-foreground">{c03}</td>
                    <td className="p-4 text-muted-foreground">{c36}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA section */}
        <section className="rounded-xl border border-pink-200 bg-pink-50 dark:bg-pink-950/30 dark:border-pink-800 p-8 text-center">
          <Baby className="w-10 h-10 text-pink-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">{t("eix_cta_title")}</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            {t("eix_cta_desc")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/infantil/practice">
              <Button className="gap-2 bg-pink-600 hover:bg-pink-700 text-white">
                <Dumbbell className="w-4 h-4" />
                {t("eix_cta_practice_btn")}
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" className="gap-2 border-pink-300 text-pink-700 hover:bg-pink-100">
                <MessageCircle className="w-4 h-4" />
                {t("eix_ask_aina_btn")}
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-5 flex items-center justify-center gap-1">
            <ExternalLink className="w-3 h-3" />
            {t("eix_source_label")}
          </p>
        </section>
      </div>
    </div>
  );
}
