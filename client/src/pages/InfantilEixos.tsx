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
  catalan: string;
  name: string;
  description: string;
  saberAreaName: string;
  competencies: { code: string; text: string }[];
  sabers03: string[];
  sabers36: string[];
  pedagogicalFocus: string;
}

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
    name: "Growing with Autonomy & Confidence",
    description:
      "Body awareness, movement, self-care, emotional wellbeing, and the progressive construction of a positive self-image. Children develop autonomy in everyday routines and learn to trust their own capabilities.",
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
    pedagogicalFocus:
      "Free movement, autonomous play, sensorimotor exploration, and wellbeing routines are the primary vehicles for learning in this axis. The curriculum explicitly rejects comparison and competition, favouring inclusive environments where every child feels valued and safe.",
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
    name: "Communicating with Different Languages",
    description:
      "Oral and written language, mathematical language, artistic and creative expression, body language, and digital literacy. Children explore multiple ways of expressing and communicating ideas, emotions, and experiences.",
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
    pedagogicalFocus:
      "Language-rich environments, storytelling, creative play, and digital exploration underpin this axis. Catalan is the vehicular language, and multilingual awareness is fostered from the earliest stages. Artistic expression — drawing, music, movement — is treated as a full language system.",
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
    name: "Discovering the Environment with Curiosity",
    description:
      "Mathematical thinking, scientific inquiry, exploration of the natural world, logical reasoning, and the development of habits of sustainability and care for the environment.",
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
    pedagogicalFocus:
      "Inquiry-based learning, hands-on experimentation, and outdoor exploration are central. Children are encouraged to ask questions, test hypotheses, and develop a sense of wonder. Sustainability and care for the natural world are woven throughout both cycles.",
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
    name: "Being Part of a Diverse World",
    description:
      "Social relationships, cultural diversity, democratic values, community belonging, gender equality, and appreciation of the social and cultural environment. Children build their identity through respectful relationships with others.",
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
    pedagogicalFocus:
      "Democratic values, gender equality, and cultural diversity are not add-ons but central to this axis. Children learn to recognise and celebrate difference, build empathy, and participate in community life. Family-school partnership is especially emphasised in the 0–3 cycle.",
  },
];

const PEDAGOGICAL_PRINCIPLES = [
  { n: 1, text: "Child as protagonist of their own learning" },
  { n: 2, text: "Wellbeing, enjoyment and learning as inseparable" },
  { n: 3, text: "Meaningful, functional, contextualised situations" },
  { n: 4, text: "Respect for different rhythms and developmental stages" },
  { n: 5, text: "Play as the primary vehicle for learning" },
  { n: 6, text: "Observation and documentation as pedagogical tools" },
  { n: 7, text: "Family-school partnership" },
  { n: 8, text: "Inclusive approach — diversity as enrichment" },
  { n: 9, text: "Creativity and critical thinking from the earliest stages" },
  { n: 10, text: "Language-rich environment (Catalan as vehicular language)" },
];

function EixCard({ eix }: { eix: EixDetail }) {
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
              {eix.name}
            </h2>
            <p className={`text-sm font-medium italic mb-2 ${eix.textColor} opacity-80`}>
              {eix.catalan}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {eix.description}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-5">
        {/* Saber Area Name */}
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Àrea de sabers:
          </span>
          <span className={`text-xs font-bold ${eix.textColor}`}>{eix.saberAreaName}</span>
        </div>

        {/* Competències específiques */}
        <div className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Competències específiques
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
          {expanded ? "Amaga els sabers per cicle" : "Mostra els sabers per cicle"}
        </button>

        {expanded && (
          <div className="grid sm:grid-cols-2 gap-4 mt-1">
            {/* Primer cicle 0–3 */}
            <div className={`rounded-lg border ${eix.borderColor} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${eix.badgeBg}`}>
                  Primer cicle
                </span>
                <span className="text-xs text-muted-foreground font-medium">0–3 anys</span>
              </div>
              <ul className="space-y-1.5">
                {eix.sabers03.map((s) => (
                  <li key={s} className="flex gap-2 text-sm">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0`} style={{ background: eix.color }} />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Segon cicle 3–6 */}
            <div className={`rounded-lg border ${eix.borderColor} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${eix.badgeBg}`}>
                  Segon cicle
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
            Enfocament pedagògic
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground italic">
            {eix.pedagogicalFocus}
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href={`/infantil/practice?eix=${eix.code}`}>
            <Button size="sm" variant="outline" className={`gap-2 border ${eix.borderColor} ${eix.textColor}`}>
              <Dumbbell className="w-3.5 h-3.5" />
              Practica {eix.code}
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="sm" variant="ghost" className="gap-2">
              <MessageCircle className="w-3.5 h-3.5" />
              Pregunta a Aina
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
      // Slight delay to allow the page to render fully before scrolling
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
          <BackButton href="/" label={t("nav_home") || "Inici"} className="text-white/80 hover:text-white mb-6" />
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-sm font-semibold mb-5 backdrop-blur-sm">
              <Baby className="w-4 h-4" />
              Educació Infantil · 0–6 anys
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
              Els 4 Eixos de{" "}
              <span className="text-pink-300">Desenvolupament</span>
            </h1>
            <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-6 max-w-2xl">
              El Decret 21/2023 de la Generalitat de Catalunya estructura l'etapa d'Educació Infantil
              al voltant de quatre eixos de desenvolupament i aprenentatge, en coherència amb la LOMLOE
              (Llei Orgànica 3/2020).
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-pink-500/80 text-white backdrop-blur-sm">
                Decret 21/2023
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/80 text-white backdrop-blur-sm">
                LOMLOE
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                Primer cicle 0–3 · Segon cicle 3–6
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
              { label: "Eixos de Desenvolupament", value: "4" },
              { label: "Cicles", value: "2" },
              { label: "Competències específiques", value: "10" },
              { label: "Àrees de sabers", value: "4" },
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
          <h2 className="text-2xl font-bold mb-3">Estructura curricular</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            A diferència de les etapes posteriors, l'Educació Infantil no s'organitza en àrees
            curriculars sinó en <strong>eixos de desenvolupament i aprenentatge</strong>. Cada eix
            integra competències específiques, criteris d'avaluació i sabers curriculars, i s'aplica
            de manera diferenciada als dos cicles de l'etapa.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Els quatre eixos no són compartiments estancs: el currículum promou un enfocament
            globalitzador on els aprenentatges es produeixen de manera integrada, a través del joc,
            la descoberta i la vida quotidiana.
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
          <h2 className="text-2xl font-bold mb-2">10 Principis pedagògics del Decret 21/2023</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Aquests principis travessen tots quatre eixos i orienten la pràctica docent a l'etapa d'Educació Infantil.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PEDAGOGICAL_PRINCIPLES.map(({ n, text }) => (
              <div
                key={n}
                className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-pink-100 text-pink-700 text-xs font-bold flex items-center justify-center border border-pink-200">
                  {n}
                </span>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cycle comparison table */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">Comparativa dels dos cicles</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Tots dos cicles comparteixen els mateixos quatre eixos, però amb competències específiques i sabers diferenciats.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-4 font-semibold text-muted-foreground w-1/3">Aspecte</th>
                  <th className="text-left p-4 font-semibold text-pink-700">Primer cicle (0–3)</th>
                  <th className="text-left p-4 font-semibold text-purple-700">Segon cicle (3–6)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Denominació", "Llar d'infants", "Parvulari / Preschool"],
                  ["Llei marc", "LOMLOE + RD 95/2022 + Decret 21/2023", "LOMLOE + RD 95/2022 + Decret 21/2023"],
                  ["Comunicació", "Gestual, corporal i oral emergent", "Oral, escrita emergent, digital bàsic"],
                  ["Matemàtiques", "Quantitat i numeració en joc", "Nombre, mesura, espai i classificació"],
                  ["Entorn", "Exploració sensoriomotriu", "Indagació, experimentació, sostenibilitat"],
                  ["Social", "Vincles afectius i família", "Grups socials, diversitat, valors democràtics"],
                  ["Avaluació", "Observació i documentació", "Observació, documentació i portafolis"],
                ].map(([aspect, c03, c36]) => (
                  <tr key={aspect} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{aspect}</td>
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
          <h2 className="text-xl font-bold mb-2">Posa a prova els teus coneixements</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            Practica preguntes sobre els quatre eixos del Decret 21/2023, filtrades per cicle i eix.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/infantil/practice">
              <Button className="gap-2 bg-pink-600 hover:bg-pink-700 text-white">
                <Dumbbell className="w-4 h-4" />
                Pràctica Educació Infantil
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" className="gap-2 border-pink-300 text-pink-700 hover:bg-pink-100">
                <MessageCircle className="w-4 h-4" />
                Pregunta a Aina
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-5 flex items-center justify-center gap-1">
            <ExternalLink className="w-3 h-3" />
            Font: Decret 21/2023, de 7 de febrer, d'ordenació dels ensenyaments de l'educació infantil (DOGC)
          </p>
        </section>
      </div>
    </div>
  );
}
