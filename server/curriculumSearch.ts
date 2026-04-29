/**
 * Curriculum web search helper — v2.
 *
 * Fetches content from official Spanish/Catalan education government sites
 * so AINA can answer questions about specific legislation and curriculum requirements.
 *
 * Sources covered:
 *  - portaljuridic.gencat.cat   — Official Catalan legal portal (Decret 175/2022 full text)
 *  - projectes.xtec.cat         — XTEC curriculum project pages (SA, avaluació, vectors)
 *  - xtec.gencat.cat            — XTEC main curriculum portal (Primària, ESO, Batxillerat, FP)
 *  - educagob.educacionfpydeportes.gob.es — Spanish national education portal
 *  - boe.es                     — Official Spanish State Gazette (LOMLOE, RD 157/2022, RD 243/2022)
 *  - dogc.gencat.cat            — Diari Oficial de la Generalitat de Catalunya
 *  - curriculumvitae.cat        — Catalan curriculum vitae / competency resources
 *  - edu365.cat                 — Catalan educational resources portal
 *  - agaur.gencat.cat           — Catalan research & university grants agency
 *  - csif.es / ccoo.cat         — Teacher union resources on curriculum (informational)
 */
import * as cheerio from "cheerio";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

/**
 * Fetches a URL and extracts meaningful text content using cheerio.
 */
async function fetchPageText(url: string, maxChars = 3000): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AINA-CurriculumBot/2.0; +https://sebataeco.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return "";
    const html = await response.text();
    const $ = cheerio.load(html);
    // Remove non-content elements
    $(
      "script, style, nav, footer, header, .menu, .sidebar, .nav, aside, " +
      ".cookie-banner, .breadcrumb, .pagination, .social-share, " +
      "[aria-hidden='true'], .sr-only"
    ).remove();
    // Try to extract main content area first, fall back to body
    const mainContent =
      $(
        "main, article, .content, #content, .article-body, .entry-content, " +
        "#main, .page-content, .main-content, .text-content, .document-content"
      ).text() || $("body").text();
    return mainContent.replace(/\s+/g, " ").trim().slice(0, maxChars);
  } catch {
    return "";
  }
}

/**
 * Fetches a specific known URL and returns it as a SearchResult.
 */
async function fetchKnownUrl(
  url: string,
  title: string,
  snippetLength = 700
): Promise<SearchResult | null> {
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const text = await fetchPageText(url, snippetLength + 500);
  if (!text || text.length < 50) return null;
  return { title, url, snippet: text.slice(0, snippetLength), domain };
}

// ─── Source catalogue ────────────────────────────────────────────────────────

const SOURCES = {
  // ── Decret 175/2022 ────────────────────────────────────────────────────────
  decret175_portaljuridic: () =>
    fetchKnownUrl(
      "https://portaljuridic.gencat.cat/ca/document-del-pjur/?documentId=938401",
      "Decret 175/2022 — Text oficial (Portaljuridic Gencat)"
    ),
  decret175_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/decret-educacio-basica/",
      "Decret 175/2022 — Guia pràctica (XTEC Nou Currículum)"
    ),
  decret175_dogc: () =>
    fetchKnownUrl(
      "https://dogc.gencat.cat/ca/document-del-dogc/?documentId=938401",
      "Decret 175/2022 — DOGC (Diari Oficial de la Generalitat)"
    ),

  // ── LOMLOE / national legislation ─────────────────────────────────────────
  lomloe_boe: () =>
    fetchKnownUrl(
      "https://www.boe.es/buscar/act.php?id=BOE-A-2020-17264",
      "LOMLOE — BOE Ley Orgánica 3/2020 (text complet)"
    ),
  rd157_primaria: () =>
    fetchKnownUrl(
      "https://www.boe.es/buscar/act.php?id=BOE-A-2022-4975",
      "RD 157/2022 — Currículum Educació Primària (BOE)"
    ),
  rd243_eso: () =>
    fetchKnownUrl(
      "https://www.boe.es/buscar/act.php?id=BOE-A-2022-5521",
      "RD 243/2022 — Currículum ESO (BOE)"
    ),
  rd217_batxillerat: () =>
    fetchKnownUrl(
      "https://www.boe.es/buscar/act.php?id=BOE-A-2022-4975",
      "RD 217/2022 — Currículum Batxillerat (BOE)"
    ),

  // ── Competències clau / perfil de sortida ──────────────────────────────────
  competencies_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-primaria/competencias-clave.html",
      "Competències clau — Educagob (Primària)"
    ),
  competencies_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/competencies-clau/",
      "Competències clau — XTEC Nou Currículum"
    ),
  perfil_sortida: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-primaria/perfil-salida.html",
      "Perfil de sortida — Educagob"
    ),

  // ── Situacions d'aprenentatge ──────────────────────────────────────────────
  sa_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/situacions-daprenentatge/",
      "Situacions d'Aprenentatge — XTEC"
    ),
  sa_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-primaria/situaciones-aprendizaje.html",
      "Situaciones de Aprendizaje — Educagob (Primaria)"
    ),

  // ── Avaluació / evaluació ──────────────────────────────────────────────────
  avaluacio_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/avaluacio/",
      "Avaluació competencial — XTEC"
    ),
  avaluacio_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-primaria/evaluacion.html",
      "Evaluación — Educagob (Primaria)"
    ),

  // ── Primària ───────────────────────────────────────────────────────────────
  primaria_xtec: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/",
      "Currículum Primària 175/2022 — XTEC"
    ),
  primaria_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-primaria.html",
      "Educación Primaria — Educagob"
    ),
  primaria_areas: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/arees/",
      "Àrees Curriculars Primària — XTEC"
    ),

  // ── ESO ────────────────────────────────────────────────────────────────────
  eso_xtec: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/eso/curriculum-175-2022/",
      "Currículum ESO 175/2022 — XTEC"
    ),
  eso_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-secundaria-obligatoria.html",
      "Educación Secundaria Obligatoria — Educagob"
    ),
  eso_materies: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/eso/curriculum-175-2022/materies/",
      "Matèries ESO — XTEC"
    ),

  // ── Batxillerat ────────────────────────────────────────────────────────────
  batx_xtec: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/batxillerat/",
      "Currículum Batxillerat — XTEC"
    ),

  // ── Educació Infantil ──────────────────────────────────────────────────────
  infantil_xtec: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/infantil/",
      "Currículum Educació Infantil — XTEC"
    ),
  infantil_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-infantil.html",
      "Educación Infantil — Educagob"
    ),

  // ── FP / Vocational ───────────────────────────────────────────────────────
  fp_xtec: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/fp/",
      "Formació Professional — XTEC"
    ),
  fp_educagob: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/fp.html",
      "Formación Profesional — Educagob"
    ),

  // ── Vectors / transversal ─────────────────────────────────────────────────
  vectors_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/vectors/",
      "Vectors del Currículum — XTEC"
    ),
  inclusio_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/vectors/inclusio/",
      "Vector Inclusió — XTEC"
    ),
  digital_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/vectors/competencia-digital/",
      "Vector Competència Digital — XTEC"
    ),
  sostenibilitat_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/vectors/sostenibilitat/",
      "Vector Sostenibilitat — XTEC"
    ),
  igualtat_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/vectors/igualtat-de-genere/",
      "Vector Igualtat de Gènere — XTEC"
    ),
  benestar_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/vectors/benestar-emocional/",
      "Vector Benestar Emocional — XTEC"
    ),

  // ── Llengua i literatura ──────────────────────────────────────────────────
  llengua_primaria: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/arees/llengua-catalana/",
      "Llengua Catalana i Literatura (Primària) — XTEC"
    ),
  llengua_eso: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/eso/curriculum-175-2022/materies/llengua-catalana/",
      "Llengua Catalana i Literatura (ESO) — XTEC"
    ),

  // ── IEC — Institut d'Estudis Catalans (language norms) ───────────────────
  iec_geiec: () =>
    fetchKnownUrl(
      "https://geiec.iec.cat",
      "Gramàtica Essencial de la Llengua Catalana (GEIEC) — IEC"
    ),
  iec_ortografia: () =>
    fetchKnownUrl(
      "https://www.iec.cat/llengua/ortografia.asp",
      "Ortografia Catalana — IEC"
    ),
  iec_dlc: () =>
    fetchKnownUrl(
      "https://dlc.iec.cat",
      "Diccionari de la Llengua Catalana — IEC"
    ),

  // ── Matemàtiques ──────────────────────────────────────────────────────────
  mates_primaria: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/arees/matematiques/",
      "Matemàtiques (Primària) — XTEC"
    ),

  // ── Ciències ──────────────────────────────────────────────────────────────
  ciencies_primaria: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/arees/ciencies-de-la-naturalesa/",
      "Ciències de la Naturalesa (Primària) — XTEC"
    ),

  // ── Programació didàctica / planificació ──────────────────────────────────
  programacio_xtec: () =>
    fetchKnownUrl(
      "https://projectes.xtec.cat/nou-curriculum/educacio-basica/programacio-didactica/",
      "Programació Didàctica — XTEC"
    ),

  // ── Orientació / tutoria ──────────────────────────────────────────────────
  tutoria_xtec: () =>
    fetchKnownUrl(
      "https://xtec.gencat.cat/ca/curriculum/primaria/orientacio-tutoria/",
      "Orientació i Tutoria (Primària) — XTEC"
    ),

  // ── Educagob general ──────────────────────────────────────────────────────
  educagob_general: () =>
    fetchKnownUrl(
      "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe.html",
      "Currículum LOMLOE — Educagob (visió general)"
    ),
} as const;

type SourceKey = keyof typeof SOURCES;

// ─── Keyword routing table ────────────────────────────────────────────────────

type Route = { keys: RegExp; sources: SourceKey[] };

const ROUTES: Route[] = [
  {
    keys: /decret\s*175|decreto\s*175|175\/2022|educaci[oó]\s*b[aà]sica/i,
    sources: ["decret175_portaljuridic", "decret175_xtec", "decret175_dogc"],
  },
  {
    keys: /lomloe|ley org[aà]nica.*2020|llei org[aà]nica.*2020|3\/2020/i,
    sources: ["lomloe_boe", "rd157_primaria", "rd243_eso"],
  },
  {
    keys: /rd\s*157|real decreto.*157|reial decret.*157/i,
    sources: ["rd157_primaria", "primaria_educagob"],
  },
  {
    keys: /rd\s*243|real decreto.*243|reial decret.*243/i,
    sources: ["rd243_eso", "eso_educagob"],
  },
  {
    keys: /compet[eè]ncies clau|competencias clave|perfil.*sortida|perfil.*salida|ccl|stem|cpsaa|cc|cd|ce|cmct/i,
    sources: ["competencies_xtec", "competencies_educagob", "perfil_sortida"],
  },
  {
    keys: /situaci[oó].*aprenentatge|situaci[oó]n.*aprendizaje|\bsa\b|aprenentatge basat|aprendizaje basado/i,
    sources: ["sa_xtec", "sa_educagob"],
  },
  {
    keys: /avaluaci[oó]|evaluaci[oó]n|criteris.*avaluaci|criterios.*evaluaci|assoliment.*excel|assoliment.*notable|ae\b|an\b|as\b|na\b/i,
    sources: ["avaluacio_xtec", "avaluacio_educagob"],
  },
  {
    keys: /vector.*curr[ií]cul|curr[ií]cul.*vector|sis vectors|6 vectors/i,
    sources: ["vectors_xtec", "decret175_xtec"],
  },
  {
    keys: /inclusi[oó]/i,
    sources: ["inclusio_xtec", "vectors_xtec"],
  },
  {
    keys: /compet[eè]ncia digital|digital.*compet|cd\b/i,
    sources: ["digital_xtec", "vectors_xtec"],
  },
  {
    keys: /sostenibilitat|sostenibilidad|ods|sdg|medi ambient/i,
    sources: ["sostenibilitat_xtec", "vectors_xtec"],
  },
  {
    keys: /igualtat.*g[eè]nere|g[eè]nere.*igualtat|perspectiva de g[eè]nere/i,
    sources: ["igualtat_xtec", "vectors_xtec"],
  },
  {
    keys: /benestar emocional|bienestar emocional|salut mental|salud mental/i,
    sources: ["benestar_xtec", "vectors_xtec"],
  },
  {
    keys: /primari[ae]|prim[aà]ria|cicle.*prim[aà]ria|àrees.*prim[aà]ria/i,
    sources: ["primaria_xtec", "primaria_educagob", "primaria_areas"],
  },
  {
    keys: /\beso\b|secundari[ae]|secundàri[ae]|mat[eè]ries.*eso/i,
    sources: ["eso_xtec", "eso_educagob", "eso_materies"],
  },
  {
    keys: /batxillerat|bachillerato/i,
    sources: ["batx_xtec"],
  },
  {
    keys: /infantil|p3|p4|p5|educaci[oó] infantil/i,
    sources: ["infantil_xtec", "infantil_educagob"],
  },
  {
    keys: /formaci[oó] professional|\bfp\b|cicle formatiu|ciclo formativo/i,
    sources: ["fp_xtec", "fp_educagob"],
  },
  {
    keys: /llengua catalana|catalan.*language|literatura catalana|ortografia|morfologia|sintaxi|signes de puntuaci|abreviaci|gram[aà]tica|puntuaci[oó]|ortografia|accentuaci[oó]|dièresi|apòstrof|guionet|cometes|guillemets|iec|institut.*estudis/i,
    sources: ["llengua_primaria", "llengua_eso", "iec_geiec", "iec_ortografia"],
  },
  {
    keys: /diccionari.*catal[aà]|dlc|significat.*paraula|paraula.*significat/i,
    sources: ["iec_dlc", "iec_geiec"],
  },
  {
    keys: /matem[aà]tiques|matem[aà]ticas|geometria|àlgebra|estadística/i,
    sources: ["mates_primaria"],
  },
  {
    keys: /ci[eè]ncies.*naturalesa|ci[eè]ncies.*socials|medi natural|medi social/i,
    sources: ["ciencies_primaria"],
  },
  {
    keys: /programaci[oó] did[aà]ctica|unitat.*did[aà]ctica|seqü[eè]ncia.*did[aà]ctica/i,
    sources: ["programacio_xtec"],
  },
  {
    keys: /tutoria|orientaci[oó].*educativa|pla.*acci[oó].*tutorial/i,
    sources: ["tutoria_xtec"],
  },
  {
    keys: /\bannex\b|\bannexe\b|annex\s+\d|cap[ií]tol\s+\d|article\s+\d|art[ií]cle\s+\d/i,
    sources: ["decret175_portaljuridic", "decret175_xtec"],
  },
  {
    keys: /sabers b[aà]sics|saberes b[aà]sicos|continguts|contenidos/i,
    sources: ["primaria_areas", "eso_materies"],
  },
  {
    keys: /compet[eè]ncies espec[ií]fiques|competencias espec[ií]ficas/i,
    sources: ["primaria_areas", "competencies_xtec"],
  },
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Given a teacher's query, fetches relevant content from official sources.
 * Returns both structured results (for citation display) and a summary string
 * (for injection into the LLM context).
 */
export async function searchCurriculumSources(query: string): Promise<{
  results: SearchResult[];
  summary: string;
}> {
  // Collect matching source keys (deduplicated, max 4 to keep latency low)
  const matchedKeys = new Set<SourceKey>();
  for (const route of ROUTES) {
    if (route.keys.test(query)) {
      for (const key of route.sources) {
        matchedKeys.add(key);
        if (matchedKeys.size >= 4) break;
      }
    }
    if (matchedKeys.size >= 4) break;
  }

  // Fallback: general educagob overview
  if (matchedKeys.size === 0) {
    matchedKeys.add("educagob_general");
    matchedKeys.add("decret175_xtec");
  }

  // Fetch all matched sources in parallel
  const fetchPromises = Array.from(matchedKeys).map((key) => (SOURCES[key] as () => Promise<SearchResult | null>)());
  const settled = await Promise.allSettled(fetchPromises);

  const results: SearchResult[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) {
      results.push(s.value);
    }
  }

  const summary =
    results.length > 0
      ? results
          .map((r) => `**${r.title}** (${r.domain})\n${r.snippet}\nSource: ${r.url}`)
          .join("\n\n---\n\n")
      : "No results found from official sources for this query.";

  return { results, summary };
}
