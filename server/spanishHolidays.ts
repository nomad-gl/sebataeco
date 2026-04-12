/**
 * Spanish national public holidays + Catalan/Valencian regional holidays
 * for academic years 2024-2025 and 2025-2026.
 *
 * Sources:
 *  - BOE national festivos: 1 Jan, 6 Jan, Good Friday, 1 May, 15 Aug, 12 Oct, 1 Nov, 6 Dec, 8 Dec, 25 Dec
 *  - Catalonia: 26 Dec (Sant Esteve), 11 Sep (Diada), Easter Monday, Whit Monday
 *  - Valencia: 9 Oct (Dia de la Comunitat Valenciana)
 *
 * All dates are ISO strings (YYYY-MM-DD).
 */

export type HolidayEntry = {
  date: string;       // YYYY-MM-DD
  nameEN: string;
  nameES: string;
  nameCA: string;
  region: "national" | "catalonia" | "valencia" | "all";
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
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
  const goodFriday = addDays(easter, -2);
  const easterMonday = addDays(easter, 1);
  const whitMonday = addDays(easter, 50);

  const holidays: HolidayEntry[] = [
    // ── National ──────────────────────────────────────────────────────────────
    { date: `${year}-01-01`, nameEN: "New Year's Day",         nameES: "Año Nuevo",                 nameCA: "Any Nou",                    region: "national" },
    { date: `${year}-01-06`, nameEN: "Epiphany",               nameES: "Reyes Magos",               nameCA: "Reis Mags",                  region: "national" },
    { date: iso(goodFriday), nameEN: "Good Friday",            nameES: "Viernes Santo",             nameCA: "Divendres Sant",             region: "national" },
    { date: `${year}-05-01`, nameEN: "Labour Day",             nameES: "Día del Trabajo",           nameCA: "Dia del Treball",            region: "national" },
    { date: `${year}-08-15`, nameEN: "Assumption of Mary",     nameES: "Asunción de la Virgen",     nameCA: "Assumpció de la Mare de Déu", region: "national" },
    { date: `${year}-10-12`, nameEN: "National Day of Spain",  nameES: "Fiesta Nacional de España", nameCA: "Festa Nacional d'Espanya",   region: "national" },
    { date: `${year}-11-01`, nameEN: "All Saints' Day",        nameES: "Todos los Santos",          nameCA: "Tots Sants",                 region: "national" },
    { date: `${year}-12-06`, nameEN: "Constitution Day",       nameES: "Día de la Constitución",    nameCA: "Dia de la Constitució",      region: "national" },
    { date: `${year}-12-08`, nameEN: "Immaculate Conception",  nameES: "Inmaculada Concepción",     nameCA: "Immaculada Concepció",       region: "national" },
    { date: `${year}-12-25`, nameEN: "Christmas Day",          nameES: "Navidad",                   nameCA: "Nadal",                      region: "national" },
    // ── Catalonia ─────────────────────────────────────────────────────────────
    { date: `${year}-09-11`, nameEN: "Catalan National Day",   nameES: "Diada Nacional de Cataluña",nameCA: "Diada Nacional de Catalunya", region: "catalonia" },
    { date: iso(easterMonday), nameEN: "Easter Monday",        nameES: "Lunes de Pascua",           nameCA: "Dilluns de Pasqua",          region: "catalonia" },
    { date: iso(whitMonday),   nameEN: "Whit Monday",          nameES: "Lunes de Pentecostés",      nameCA: "Dilluns de Pentecosta",      region: "catalonia" },
    { date: `${year}-12-26`, nameEN: "St Stephen's Day",       nameES: "San Esteban",               nameCA: "Sant Esteve",                region: "catalonia" },
    // ── Valencia ──────────────────────────────────────────────────────────────
    { date: `${year}-10-09`, nameEN: "Valencian Community Day",nameES: "Día de la Comunitat Valenciana", nameCA: "Dia de la Comunitat Valenciana", region: "valencia" },
  ];

  return holidays;
}

/**
 * Return all holidays that fall within [startISO, endISO] (inclusive).
 * `region` controls which regional holidays to include alongside national ones.
 */
export function getHolidaysInRange(
  startISO: string,
  endISO: string,
  region: "catalonia" | "valencia" | "national" = "catalonia",
): HolidayEntry[] {
  const start = new Date(startISO);
  const end = new Date(endISO);

  // Collect holidays for all calendar years that overlap the range
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  const all: HolidayEntry[] = [];
  for (let y = startYear; y <= endYear; y++) all.push(...buildHolidaysForYear(y));

  return all.filter(h => {
    const d = new Date(h.date);
    if (d < start || d > end) return false;
    if (h.region === "national") return true;
    if (h.region === region) return true;
    return false;
  });
}
