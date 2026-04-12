/**
 * Spanish national public holidays + all 17 autonomous community regional holidays
 * for academic years 2024-2025 and 2025-2026.
 *
 * Sources:
 *  - BOE national festivos (10 fixed + Easter)
 *  - Each community's official festivos calendar
 *
 * All dates are ISO strings (YYYY-MM-DD).
 */

export type SpanishRegion =
  | "national"
  | "andalucia"
  | "aragon"
  | "asturias"
  | "balearic_islands"
  | "canary_islands"
  | "cantabria"
  | "castilla_la_mancha"
  | "castilla_leon"
  | "catalonia"
  | "ceuta"
  | "extremadura"
  | "galicia"
  | "la_rioja"
  | "madrid"
  | "melilla"
  | "murcia"
  | "navarra"
  | "basque_country"
  | "valencia";

export type HolidayEntry = {
  date: string;       // YYYY-MM-DD
  nameEN: string;
  nameES: string;
  nameCA: string;
  region: SpanishRegion;
};

// ─── Helper: Easter Sunday (Gregorian algorithm) ──────────────────────────────
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function iso(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildHolidaysForYear(year: number): HolidayEntry[] {
  const easter = easterSunday(year);
  const goodFriday    = addDays(easter, -2);
  const holyThursday  = addDays(easter, -3);
  const easterMonday  = addDays(easter, 1);
  const whitSunday    = addDays(easter, 49);
  const whitMonday    = addDays(easter, 50);
  const corpusChristi = addDays(easter, 60);

  const h: HolidayEntry[] = [
    // ── National (8 fixed + Good Friday) ─────────────────────────────────────
    { date: `${year}-01-01`, nameEN: "New Year's Day",          nameES: "Año Nuevo",                   nameCA: "Any Nou",                       region: "national" },
    { date: `${year}-01-06`, nameEN: "Epiphany",                nameES: "Reyes Magos",                 nameCA: "Reis Mags",                     region: "national" },
    { date: iso(goodFriday), nameEN: "Good Friday",             nameES: "Viernes Santo",               nameCA: "Divendres Sant",                region: "national" },
    { date: `${year}-05-01`, nameEN: "Labour Day",              nameES: "Día del Trabajo",             nameCA: "Dia del Treball",               region: "national" },
    { date: `${year}-08-15`, nameEN: "Assumption of Mary",      nameES: "Asunción de la Virgen",       nameCA: "Assumpció de la Mare de Déu",   region: "national" },
    { date: `${year}-10-12`, nameEN: "National Day of Spain",   nameES: "Fiesta Nacional de España",   nameCA: "Festa Nacional d'Espanya",      region: "national" },
    { date: `${year}-11-01`, nameEN: "All Saints' Day",         nameES: "Todos los Santos",            nameCA: "Tots Sants",                    region: "national" },
    { date: `${year}-12-06`, nameEN: "Constitution Day",        nameES: "Día de la Constitución",      nameCA: "Dia de la Constitució",         region: "national" },
    { date: `${year}-12-08`, nameEN: "Immaculate Conception",   nameES: "Inmaculada Concepción",       nameCA: "Immaculada Concepció",          region: "national" },
    { date: `${year}-12-25`, nameEN: "Christmas Day",           nameES: "Navidad",                     nameCA: "Nadal",                         region: "national" },

    // ── Andalucía ─────────────────────────────────────────────────────────────
    { date: `${year}-02-28`, nameEN: "Andalusia Day",           nameES: "Día de Andalucía",            nameCA: "Dia d'Andalusia",               region: "andalucia" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "andalucia" },

    // ── Aragón ────────────────────────────────────────────────────────────────
    { date: `${year}-04-23`, nameEN: "St George's Day (Aragon)",nameES: "Día de Aragón",               nameCA: "Dia d'Aragó",                   region: "aragon" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "aragon" },

    // ── Asturias ──────────────────────────────────────────────────────────────
    { date: `${year}-09-08`, nameEN: "Asturias Day",            nameES: "Día de Asturias",             nameCA: "Dia d'Astúries",                region: "asturias" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "asturias" },

    // ── Balearic Islands ──────────────────────────────────────────────────────
    { date: `${year}-03-01`, nameEN: "Balearic Islands Day",    nameES: "Día de las Islas Baleares",   nameCA: "Dia de les Illes Balears",      region: "balearic_islands" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "balearic_islands" },

    // ── Canary Islands ────────────────────────────────────────────────────────
    { date: `${year}-05-30`, nameEN: "Canary Islands Day",      nameES: "Día de Canarias",             nameCA: "Dia de les Canàries",           region: "canary_islands" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "canary_islands" },

    // ── Cantabria ─────────────────────────────────────────────────────────────
    { date: `${year}-08-15`, nameEN: "Cantabria Day / Assumption", nameES: "Día de Cantabria",         nameCA: "Dia de Cantàbria",              region: "cantabria" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "cantabria" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "cantabria" },

    // ── Castilla-La Mancha ────────────────────────────────────────────────────
    { date: `${year}-05-31`, nameEN: "Castilla-La Mancha Day",  nameES: "Día de Castilla-La Mancha",   nameCA: "Dia de Castella-La Manxa",      region: "castilla_la_mancha" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "castilla_la_mancha" },
    { date: iso(corpusChristi), nameEN: "Corpus Christi",       nameES: "Corpus Christi",              nameCA: "Corpus Christi",                region: "castilla_la_mancha" },

    // ── Castilla y León ───────────────────────────────────────────────────────
    { date: `${year}-04-23`, nameEN: "Castile and León Day",    nameES: "Día de Castilla y León",      nameCA: "Dia de Castella i Lleó",        region: "castilla_leon" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "castilla_leon" },

    // ── Catalonia ─────────────────────────────────────────────────────────────
    { date: `${year}-09-11`, nameEN: "Catalan National Day",    nameES: "Diada Nacional de Cataluña",  nameCA: "Diada Nacional de Catalunya",   region: "catalonia" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "catalonia" },
    { date: iso(whitMonday),   nameEN: "Whit Monday",           nameES: "Lunes de Pentecostés",        nameCA: "Dilluns de Pentecosta",         region: "catalonia" },
    { date: `${year}-12-26`, nameEN: "St Stephen's Day",        nameES: "San Esteban",                 nameCA: "Sant Esteve",                   region: "catalonia" },

    // ── Ceuta ─────────────────────────────────────────────────────────────────
    { date: `${year}-09-02`, nameEN: "Ceuta Day",               nameES: "Día de Ceuta",                nameCA: "Dia de Ceuta",                  region: "ceuta" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "ceuta" },

    // ── Extremadura ───────────────────────────────────────────────────────────
    { date: `${year}-09-08`, nameEN: "Extremadura Day",         nameES: "Día de Extremadura",          nameCA: "Dia d'Extremadura",             region: "extremadura" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "extremadura" },

    // ── Galicia ───────────────────────────────────────────────────────────────
    { date: `${year}-07-25`, nameEN: "Galicia Day / St James",  nameES: "Día de Galicia",              nameCA: "Dia de Galícia",                region: "galicia" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "galicia" },

    // ── La Rioja ──────────────────────────────────────────────────────────────
    { date: `${year}-06-09`, nameEN: "La Rioja Day",            nameES: "Día de La Rioja",             nameCA: "Dia de La Rioja",               region: "la_rioja" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "la_rioja" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "la_rioja" },

    // ── Madrid ────────────────────────────────────────────────────────────────
    { date: `${year}-05-02`, nameEN: "Community of Madrid Day", nameES: "Día de la Comunidad de Madrid", nameCA: "Dia de la Comunitat de Madrid", region: "madrid" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "madrid" },
    { date: `${year}-11-09`, nameEN: "Almudena Day",            nameES: "Almudena",                    nameCA: "Almudena",                      region: "madrid" },

    // ── Melilla ───────────────────────────────────────────────────────────────
    { date: `${year}-09-17`, nameEN: "Melilla Day",             nameES: "Día de Melilla",              nameCA: "Dia de Melilla",                region: "melilla" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "melilla" },

    // ── Murcia ────────────────────────────────────────────────────────────────
    { date: `${year}-06-09`, nameEN: "Region of Murcia Day",    nameES: "Día de la Región de Murcia",  nameCA: "Dia de la Regió de Múrcia",     region: "murcia" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "murcia" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "murcia" },

    // ── Navarra ───────────────────────────────────────────────────────────────
    { date: `${year}-07-25`, nameEN: "Santiago Apostle Day",    nameES: "Santiago Apóstol",            nameCA: "Sant Jaume Apòstol",            region: "navarra" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "navarra" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "navarra" },
    { date: iso(whitMonday),   nameEN: "Whit Monday",           nameES: "Lunes de Pentecostés",        nameCA: "Dilluns de Pentecosta",         region: "navarra" },

    // ── Basque Country ────────────────────────────────────────────────────────
    { date: `${year}-10-25`, nameEN: "Basque Country Day",      nameES: "Día del País Vasco",          nameCA: "Dia del País Basc",             region: "basque_country" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "basque_country" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "basque_country" },
    { date: iso(whitSunday),   nameEN: "Whit Sunday",           nameES: "Pentecostés",                 nameCA: "Pentecosta",                    region: "basque_country" },

    // ── Valencia ──────────────────────────────────────────────────────────────
    { date: `${year}-10-09`, nameEN: "Valencian Community Day", nameES: "Día de la Comunitat Valenciana", nameCA: "Dia de la Comunitat Valenciana", region: "valencia" },
    { date: iso(easterMonday), nameEN: "Easter Monday",         nameES: "Lunes de Pascua",             nameCA: "Dilluns de Pasqua",             region: "valencia" },
    { date: iso(holyThursday), nameEN: "Holy Thursday",         nameES: "Jueves Santo",                nameCA: "Dijous Sant",                   region: "valencia" },
    { date: `${year}-04-23`, nameEN: "St George's Day",         nameES: "Sant Jordi",                  nameCA: "Sant Jordi",                    region: "valencia" },
  ];

  return h;
}

/**
 * Return all holidays that fall within [startISO, endISO] (inclusive).
 * `region` controls which regional holidays to include alongside national ones.
 * Pass "national" to get only national holidays.
 */
export function getHolidaysInRange(
  startISO: string,
  endISO: string,
  region: SpanishRegion = "catalonia",
): HolidayEntry[] {
  const start = new Date(startISO);
  const end   = new Date(endISO);

  const startYear = start.getUTCFullYear();
  const endYear   = end.getUTCFullYear();

  const all: HolidayEntry[] = [];
  for (let y = startYear; y <= endYear; y++) all.push(...buildHolidaysForYear(y));

  // Deduplicate by date (some regional holidays share a date with national ones)
  const seen = new Set<string>();
  const result: HolidayEntry[] = [];
  for (const h of all) {
    const d = new Date(h.date);
    if (d < start || d > end) continue;
    if (h.region !== "national" && h.region !== region) continue;
    if (!seen.has(h.date)) {
      seen.add(h.date);
      result.push(h);
    }
  }
  return result;
}

/** All supported regions with display labels */
export const SPANISH_REGIONS: { value: SpanishRegion; labelEN: string; labelES: string; labelCA: string }[] = [
  { value: "national",          labelEN: "National only",              labelES: "Solo nacionales",                  labelCA: "Només nacionals" },
  { value: "andalucia",         labelEN: "Andalucía",                  labelES: "Andalucía",                        labelCA: "Andalusia" },
  { value: "aragon",            labelEN: "Aragón",                     labelES: "Aragón",                           labelCA: "Aragó" },
  { value: "asturias",          labelEN: "Asturias",                   labelES: "Asturias",                         labelCA: "Astúries" },
  { value: "balearic_islands",  labelEN: "Balearic Islands",           labelES: "Islas Baleares",                   labelCA: "Illes Balears" },
  { value: "canary_islands",    labelEN: "Canary Islands",             labelES: "Islas Canarias",                   labelCA: "Illes Canàries" },
  { value: "cantabria",         labelEN: "Cantabria",                  labelES: "Cantabria",                        labelCA: "Cantàbria" },
  { value: "castilla_la_mancha",labelEN: "Castilla-La Mancha",         labelES: "Castilla-La Mancha",               labelCA: "Castella-La Manxa" },
  { value: "castilla_leon",     labelEN: "Castilla y León",            labelES: "Castilla y León",                  labelCA: "Castella i Lleó" },
  { value: "catalonia",         labelEN: "Catalonia",                  labelES: "Cataluña",                         labelCA: "Catalunya" },
  { value: "ceuta",             labelEN: "Ceuta",                      labelES: "Ceuta",                            labelCA: "Ceuta" },
  { value: "extremadura",       labelEN: "Extremadura",                labelES: "Extremadura",                      labelCA: "Extremadura" },
  { value: "galicia",           labelEN: "Galicia",                    labelES: "Galicia",                          labelCA: "Galícia" },
  { value: "la_rioja",          labelEN: "La Rioja",                   labelES: "La Rioja",                         labelCA: "La Rioja" },
  { value: "madrid",            labelEN: "Community of Madrid",        labelES: "Comunidad de Madrid",              labelCA: "Comunitat de Madrid" },
  { value: "melilla",           labelEN: "Melilla",                    labelES: "Melilla",                          labelCA: "Melilla" },
  { value: "murcia",            labelEN: "Region of Murcia",           labelES: "Región de Murcia",                 labelCA: "Regió de Múrcia" },
  { value: "navarra",           labelEN: "Navarra",                    labelES: "Navarra",                          labelCA: "Navarra" },
  { value: "basque_country",    labelEN: "Basque Country",             labelES: "País Vasco",                       labelCA: "País Basc" },
  { value: "valencia",          labelEN: "Valencian Community",        labelES: "Comunitat Valenciana",             labelCA: "Comunitat Valenciana" },
];
