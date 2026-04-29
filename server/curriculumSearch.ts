/**
 * Curriculum web search helper.
 * Fetches content from official Spanish/Catalan education government sites
 * so AINA can answer questions about specific legislation and curriculum requirements.
 */
import * as cheerio from "cheerio";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

// Trusted official education sources
const TRUSTED_DOMAINS = [
  "educagob.educacionfpydeportes.gob.es",
  "xtec.gencat.cat",
  "portaljuridic.gencat.cat",
  "dogc.gencat.cat",
  "boe.es",
  "projectes.xtec.cat",
];

/**
 * Fetches a URL and extracts meaningful text content using cheerio.
 * Returns up to maxChars characters of cleaned text.
 */
async function fetchPageText(url: string, maxChars = 3000): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AINA-CurriculumBot/1.0; +https://sebataeco.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ca,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "";
    const html = await response.text();
    const $ = cheerio.load(html);
    // Remove scripts, styles, nav, footer
    $("script, style, nav, footer, header, .menu, .sidebar, .nav, aside").remove();
    // Extract main content
    const mainContent =
      $("main, article, .content, #content, .article-body, .entry-content, #main").text() ||
      $("body").text();
    return mainContent
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  } catch {
    return "";
  }
}

/**
 * Searches the XTEC curriculum portal for a given query.
 */
async function searchXTEC(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://xtec.gencat.cat/ca/curriculum/?q=${encodeURIComponent(query)}`;
    const text = await fetchPageText(searchUrl, 2000);
    if (!text) return [];
    return [
      {
        title: "XTEC Currículum — " + query,
        url: searchUrl,
        snippet: text.slice(0, 500),
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Fetches a specific known URL and returns its content as a search result.
 */
async function fetchKnownUrl(
  url: string,
  title: string
): Promise<SearchResult | null> {
  const text = await fetchPageText(url, 2500);
  if (!text) return null;
  return { title, url, snippet: text.slice(0, 600) };
}

/**
 * Main search function. Given a query about Spanish/Catalan education legislation,
 * returns relevant content from official sources.
 */
export async function searchCurriculumSources(query: string): Promise<{
  results: SearchResult[];
  summary: string;
}> {
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  // Route to the most relevant source based on query keywords
  const fetchPromises: Promise<SearchResult | null>[] = [];

  if (
    q.includes("175/2022") ||
    q.includes("decret 175") ||
    q.includes("decreto 175") ||
    q.includes("educació bàsica") ||
    q.includes("educacion basica")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://portaljuridic.gencat.cat/ca/document-del-pjur/?documentId=938401",
        "Decret 175/2022 — Portaljuridic Gencat (text oficial)"
      )
    );
    fetchPromises.push(
      fetchKnownUrl(
        "https://projectes.xtec.cat/nou-curriculum/educacio-basica/decret-educacio-basica/",
        "El Decret i la Guia — XTEC Nou Currículum"
      )
    );
  }

  if (
    q.includes("lomloe") ||
    q.includes("ley organica") ||
    q.includes("llei orgànica") ||
    q.includes("3/2020")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://www.boe.es/buscar/act.php?id=BOE-A-2020-17264",
        "LOMLOE — BOE Ley Orgánica 3/2020"
      )
    );
  }

  if (
    q.includes("competencias clave") ||
    q.includes("competències clau") ||
    q.includes("perfil de salida") ||
    q.includes("perfil de sortida")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://educagob.educacionfpydeportes.gob.es/curriculo/curriculo-lomloe/menu-curriculos-basicos/ed-primaria/competencias-clave.html",
        "Competencias clave — Educagob (Primaria)"
      )
    );
  }

  if (
    q.includes("situació d'aprenentatge") ||
    q.includes("situacion de aprendizaje") ||
    q.includes("sa ") ||
    q.includes("aprenentatge basat")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://projectes.xtec.cat/nou-curriculum/educacio-basica/situacions-daprenentatge/",
        "Situacions d'Aprenentatge — XTEC"
      )
    );
  }

  if (
    q.includes("avaluació") ||
    q.includes("evaluacion") ||
    q.includes("criteris d'avaluació") ||
    q.includes("criterios de evaluacion") ||
    q.includes("ae ") ||
    q.includes("assoliment")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://projectes.xtec.cat/nou-curriculum/educacio-basica/avaluacio/",
        "Avaluació competencial — XTEC"
      )
    );
  }

  if (
    q.includes("primaria") ||
    q.includes("primària") ||
    q.includes("primary") ||
    q.includes("àrees")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/",
        "Currículum Primària 175/2022 — XTEC"
      )
    );
  }

  if (
    q.includes("eso") ||
    q.includes("secundaria") ||
    q.includes("secundària") ||
    q.includes("matèries")
  ) {
    fetchPromises.push(
      fetchKnownUrl(
        "https://xtec.gencat.cat/ca/curriculum/eso/curriculum-175-2022/",
        "Currículum ESO 175/2022 — XTEC"
      )
    );
  }

  // Fallback: general XTEC search
  if (fetchPromises.length === 0) {
    fetchPromises.push(
      (async () => {
        const r = await searchXTEC(query);
        return r[0] ?? null;
      })()
    );
  }

  const settled = await Promise.allSettled(fetchPromises);
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) {
      results.push(s.value);
    }
  }

  const summary =
    results.length > 0
      ? results
          .map((r) => `**${r.title}**\n${r.snippet}\nSource: ${r.url}`)
          .join("\n\n---\n\n")
      : "No results found from official sources for this query.";

  return { results, summary };
}
