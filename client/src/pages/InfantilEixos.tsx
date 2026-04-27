import { useState, useEffect } from "react";
import { Baby, BookOpen, ChevronDown, ChevronUp, Dumbbell, MessageCircle, ExternalLink, GraduationCap, Lightbulb, Sparkles, CalendarDays, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import ParallaxSection from "@/components/ParallaxSection";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HERO_BG = "/manus-storage/hero-bg_a767782c.jpg";

// DOGC article anchor links for each principle (Decret 21/2023, DOGC núm. 8085)
const DOGC_BASE = "https://portaldogc.gencat.cat/utilsEADOP/PDF/8085/1939488.pdf";

type EixCode = "EIX1" | "EIX2" | "EIX3" | "EIX4";

interface EixDetail {
  code: EixCode;
  emoji: string;
  color: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  /** i18n key for the axis subtitle */
  catalanKey: string;
  /** UI name key for translation */
  nameKey: string;
  /** UI description key for translation */
  descKey: string;
  /** i18n key for saber area name */
  saberAreaKey: string;
  competencies: { code: string; text: string }[];
  /** i18n keys for sabers 0–3 */
  sabers03Keys: string[];
  /** i18n keys for sabers 3–6 */
  sabers36Keys: string[];
  /** Pedagogical focus key for translation */
  pedagogicalFocusKey: string;
}

interface PrincipleDetail {
  key: string;
  exampleKey: string;
  /** DOGC article number for deep-link */
  dogcArticle: number;
  /** Practice filter tag passed to /infantil/practice */
  practiceTag: string;
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
    catalanKey: "eix1_catalan",
    nameKey: "eix1_name",
    descKey: "eix1_desc",
    saberAreaKey: "eix1_saber_area",
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
    sabers03Keys: ["eix1_saber03_1", "eix1_saber03_2", "eix1_saber03_3", "eix1_saber03_4", "eix1_saber03_5"],
    sabers36Keys: ["eix1_saber36_1", "eix1_saber36_2", "eix1_saber36_3", "eix1_saber36_4", "eix1_saber36_5"],
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
    catalanKey: "eix2_catalan",
    nameKey: "eix2_name",
    descKey: "eix2_desc",
    saberAreaKey: "eix2_saber_area",
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
    sabers03Keys: ["eix2_saber03_1", "eix2_saber03_2", "eix2_saber03_3", "eix2_saber03_4"],
    sabers36Keys: ["eix2_saber36_1", "eix2_saber36_2", "eix2_saber36_3", "eix2_saber36_4", "eix2_saber36_5", "eix2_saber36_6"],
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
    catalanKey: "eix3_catalan",
    nameKey: "eix3_name",
    descKey: "eix3_desc",
    saberAreaKey: "eix3_saber_area",
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
    sabers03Keys: ["eix3_saber03_1", "eix3_saber03_2", "eix3_saber03_3", "eix3_saber03_4"],
    sabers36Keys: ["eix3_saber36_1", "eix3_saber36_2", "eix3_saber36_3", "eix3_saber36_4", "eix3_saber36_5", "eix3_saber36_6"],
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
    catalanKey: "eix4_catalan",
    nameKey: "eix4_name",
    descKey: "eix4_desc",
    saberAreaKey: "eix4_saber_area",
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
    sabers03Keys: ["eix4_saber03_1", "eix4_saber03_2", "eix4_saber03_3", "eix4_saber03_4"],
    sabers36Keys: ["eix4_saber36_1", "eix4_saber36_2", "eix4_saber36_3", "eix4_saber36_4", "eix4_saber36_5", "eix4_saber36_6"],
    pedagogicalFocusKey: "eix4_pedagogical",
  },
];

// Pedagogical principles — canonical Catalan content per Decree 21/2023
const PRINCIPLES: PrincipleDetail[] = [
  { key: "eix_principle_1", exampleKey: "eix_principle_1_example", dogcArticle: 6,  practiceTag: "play" },
  { key: "eix_principle_2", exampleKey: "eix_principle_2_example", dogcArticle: 6,  practiceTag: "wellbeing" },
  { key: "eix_principle_3", exampleKey: "eix_principle_3_example", dogcArticle: 6,  practiceTag: "active" },
  { key: "eix_principle_4", exampleKey: "eix_principle_4_example", dogcArticle: 6,  practiceTag: "inclusion" },
  { key: "eix_principle_5", exampleKey: "eix_principle_5_example", dogcArticle: 6,  practiceTag: "holistic" },
  { key: "eix_principle_6", exampleKey: "eix_principle_6_example", dogcArticle: 6,  practiceTag: "context" },
  { key: "eix_principle_7", exampleKey: "eix_principle_7_example", dogcArticle: 6,  practiceTag: "collaborative" },
  { key: "eix_principle_8", exampleKey: "eix_principle_8_example", dogcArticle: 6,  practiceTag: "observation" },
  { key: "eix_principle_9", exampleKey: "eix_principle_9_example", dogcArticle: 6,  practiceTag: "family" },
  { key: "eix_principle_10", exampleKey: "eix_principle_10_example", dogcArticle: 6, practiceTag: "transition" },
];

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
              {t(eix.catalanKey as any)}
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
          <span className={`text-xs font-bold ${eix.textColor}`}>{t(eix.saberAreaKey as any)}</span>
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
                {eix.sabers03Keys.map((k) => (
                  <li key={k} className="flex gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eix.color }} />
                    <span className="leading-relaxed">{t(k as any)}</span>
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
                {eix.sabers36Keys.map((k) => (
                  <li key={k} className="flex gap-2 text-sm">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: eix.color }} />
                    <span className="leading-relaxed">{t(k as any)}</span>
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

/** Expandable card for a single pedagogical principle */
function PrincipleCard({ principle, index }: { principle: PrincipleDetail; index: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={open}
      >
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center border border-pink-200 mt-0.5">
          {index + 1}
        </span>
        <p className="text-sm leading-relaxed flex-1">{t(principle.key as any)}</p>
        <span className="ml-2 shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Expanded detail panel */}
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3 space-y-3">
          {/* Classroom example */}
          <div className="flex gap-2 items-start">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                {t("eix_principle_example_label")}
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {t(principle.exampleKey as any)}
              </p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/infantil/practice?principle=${principle.practiceTag}`}>
              <Button size="sm" variant="outline" className="gap-2 border-pink-200 text-pink-700 hover:bg-pink-50">
                <GraduationCap className="w-3.5 h-3.5" />
                {t("eix_principle_practice_btn")}
              </Button>
            </Link>
            <a
              href={DOGC_BASE}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
                {t("eix_principle_dogc_btn")}
              </Button>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── AI Generation Modals ────────────────────────────────────────────────────

function AiCalendarModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [eix, setEix] = useState<"EIX1" | "EIX2" | "EIX3" | "EIX4">("EIX1");
  const [cycle, setCycle] = useState<"0-3" | "3-6">("3-6");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  });
  const [theme, setTheme] = useState("");
  const [academicYear] = useState(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  });
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  const generate = trpc.infantil.aiGenerateCalendar.useMutation({
    onSuccess: (data) => { setCount(data.eventsGenerated); setDone(true); },
    onError: (err) => toast.error(err.message || t("infantil_ai_gen_error")),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-pink-500" />
            {t("infantil_ai_gen_calendar_btn")}
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="py-4 space-y-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <p className="font-medium">{t("infantil_ai_gen_success_calendar").replace("{count}", String(count))}</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>{t("infantil_ai_gen_cancel_btn")}</Button>
              <Button asChild className="bg-pink-600 hover:bg-pink-700 text-white">
                <a href="/school-calendar">{t("infantil_ai_gen_view_calendar")}</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_eix_label")}</Label>
              <Select value={eix} onValueChange={(v) => setEix(v as typeof eix)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EIX1">EIX1 — Descoberta d’un mateix i dels altres</SelectItem>
                  <SelectItem value="EIX2">EIX2 — Descoberta de l’entorn</SelectItem>
                  <SelectItem value="EIX3">EIX3 — Comunicació i representació</SelectItem>
                  <SelectItem value="EIX4">EIX4 — Benestar i salut</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_cycle_label")}</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as typeof cycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-3">{t("infantil_ai_gen_cycle_03")}</SelectItem>
                  <SelectItem value="3-6">{t("infantil_ai_gen_cycle_36")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_week_label")}</Label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_theme_label")}</Label>
              <Input placeholder={t("infantil_ai_gen_theme_placeholder")} value={theme} onChange={(e) => setTheme(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{t("infantil_ai_gen_cancel_btn")}</Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700 text-white"
                disabled={generate.isPending || !weekStart}
                onClick={() => generate.mutate({ eix, cycle, weekStartDate: weekStart, academicYear, language: lang as "en" | "es" | "ca", theme: theme || undefined })}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {generate.isPending ? t("infantil_ai_gen_generating") : t("infantil_ai_gen_generate_btn")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AiLessonModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const [eix, setEix] = useState<"EIX1" | "EIX2" | "EIX3" | "EIX4">("EIX1");
  const [cycle, setCycle] = useState<"0-3" | "3-6">("3-6");
  const [title, setTitle] = useState("");
  const [principle, setPrinciple] = useState("");
  const [duration, setDuration] = useState(45);
  const [academicYear] = useState(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  });
  const [done, setDone] = useState(false);

  const generate = trpc.infantil.aiGenerateLessonPlan.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message || t("infantil_ai_gen_error")),
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-pink-500" />
            {t("infantil_ai_gen_lesson_btn")}
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="py-4 space-y-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <p className="font-medium">{t("infantil_ai_gen_success_lesson")}</p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>{t("infantil_ai_gen_cancel_btn")}</Button>
              <Button asChild className="bg-pink-600 hover:bg-pink-700 text-white">
                <a href="/lesson-planner">{t("infantil_ai_gen_view_lesson")}</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_eix_label")}</Label>
              <Select value={eix} onValueChange={(v) => setEix(v as typeof eix)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EIX1">EIX1 — Descoberta d’un mateix i dels altres</SelectItem>
                  <SelectItem value="EIX2">EIX2 — Descoberta de l’entorn</SelectItem>
                  <SelectItem value="EIX3">EIX3 — Comunicació i representació</SelectItem>
                  <SelectItem value="EIX4">EIX4 — Benestar i salut</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_cycle_label")}</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as typeof cycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-3">{t("infantil_ai_gen_cycle_03")}</SelectItem>
                  <SelectItem value="3-6">{t("infantil_ai_gen_cycle_36")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_title_label")}</Label>
              <Input placeholder={t("infantil_ai_gen_title_placeholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_principle_label")}</Label>
              <Input placeholder={t("infantil_ai_gen_principle_placeholder")} value={principle} onChange={(e) => setPrinciple(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("infantil_ai_gen_duration_label")}</Label>
              <Input type="number" min={10} max={120} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{t("infantil_ai_gen_cancel_btn")}</Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700 text-white"
                disabled={generate.isPending}
                onClick={() => generate.mutate({ eix, cycle, academicYear, language: lang as "en" | "es" | "ca", title: title || undefined, principle: principle || undefined, duration })}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {generate.isPending ? t("infantil_ai_gen_generating") : t("infantil_ai_gen_generate_btn")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function InfantilEixos() {
  const { t } = useI18n();
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
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
            {PRINCIPLES.map((principle, i) => (
              <PrincipleCard key={principle.key} principle={principle} index={i} />
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
                {([
                  ["eix_row_denominacio", "eix_row_val_denominacio_03", "eix_row_val_denominacio_36"],
                  ["eix_row_llei", "eix_row_val_llei_03", "eix_row_val_llei_36"],
                  ["eix_row_comunicacio", "eix_row_val_comunicacio_03", "eix_row_val_comunicacio_36"],
                  ["eix_row_matematiques", "eix_row_val_matematiques_03", "eix_row_val_matematiques_36"],
                  ["eix_row_entorn", "eix_row_val_entorn_03", "eix_row_val_entorn_36"],
                  ["eix_row_social", "eix_row_val_social_03", "eix_row_val_social_36"],
                  ["eix_row_avaluacio", "eix_row_val_avaluacio_03", "eix_row_val_avaluacio_36"],
                ] as const).map(([aspectKey, val03Key, val36Key]) => (
                  <tr key={aspectKey} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-2 sm:p-4 font-medium text-xs sm:text-sm">{t(aspectKey)}</td>
                    <td className="p-2 sm:p-4 text-muted-foreground text-xs sm:text-sm">{t(val03Key)}</td>
                    <td className="p-2 sm:p-4 text-muted-foreground text-xs sm:text-sm">{t(val36Key)}</td>
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
            <Button
              variant="outline"
              className="gap-2 border-pink-300 text-pink-700 hover:bg-pink-100"
              onClick={() => setShowCalendarModal(true)}
            >
              <CalendarDays className="w-4 h-4" />
              {t("infantil_ai_gen_calendar_btn")}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-pink-300 text-pink-700 hover:bg-pink-100"
              onClick={() => setShowLessonModal(true)}
            >
              <FileText className="w-4 h-4" />
              {t("infantil_ai_gen_lesson_btn")}
            </Button>
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

      {/* AI Generation Modals */}
      {showCalendarModal && <AiCalendarModal onClose={() => setShowCalendarModal(false)} />}
      {showLessonModal && <AiLessonModal onClose={() => setShowLessonModal(false)} />}
    </div>
  );
}
