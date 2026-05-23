/**
 * Geographic-to-Dialect Mapping for Catalan-speaking territories.
 *
 * Maps comarques (counties), provinces, and broader regions to the appropriate
 * Catalan TTS dialect code used by the Matxa TTS engine.
 *
 * Dialect codes:
 *   ca    — Central Catalan (Barcelona, Girona, most of Tarragona province)
 *   ca-nw — Nord-occidental / Northwestern (Lleida, Terres de l'Ebre)
 *   ca-ba — Balear (Illes Balears)
 *   ca-va — Valencià (País Valencià / Comunitat Valenciana)
 */

export type CatalanDialect = "ca" | "ca-nw" | "ca-ba" | "ca-va";

export interface RegionInfo {
  id: string;
  name: string;         // Catalan name
  nameEs: string;       // Spanish name
  nameEn: string;       // English name
  province: string;     // Province or broader area
  dialect: CatalanDialect;
}

/**
 * Complete list of comarques (counties) in Catalonia and other Catalan-speaking
 * territories, each mapped to the appropriate dialect.
 */
export const COMARQUES: RegionInfo[] = [
  // ─── BARCELONA PROVINCE (Central Catalan) ───
  { id: "alt_penedes", name: "Alt Penedès", nameEs: "Alto Penedés", nameEn: "Alt Penedès", province: "Barcelona", dialect: "ca" },
  { id: "anoia", name: "Anoia", nameEs: "Anoia", nameEn: "Anoia", province: "Barcelona", dialect: "ca" },
  { id: "bages", name: "Bages", nameEs: "Bages", nameEn: "Bages", province: "Barcelona", dialect: "ca" },
  { id: "baix_llobregat", name: "Baix Llobregat", nameEs: "Bajo Llobregat", nameEn: "Baix Llobregat", province: "Barcelona", dialect: "ca" },
  { id: "barcelones", name: "Barcelonès", nameEs: "Barcelonés", nameEn: "Barcelonès", province: "Barcelona", dialect: "ca" },
  { id: "bergueda", name: "Berguedà", nameEs: "Berguedá", nameEn: "Berguedà", province: "Barcelona", dialect: "ca" },
  { id: "garraf", name: "Garraf", nameEs: "Garraf", nameEn: "Garraf", province: "Barcelona", dialect: "ca" },
  { id: "maresme", name: "Maresme", nameEs: "Maresme", nameEn: "Maresme", province: "Barcelona", dialect: "ca" },
  { id: "moianes", name: "Moianès", nameEs: "Moyanés", nameEn: "Moianès", province: "Barcelona", dialect: "ca" },
  { id: "osona", name: "Osona", nameEs: "Osona", nameEn: "Osona", province: "Barcelona", dialect: "ca" },
  { id: "valles_occidental", name: "Vallès Occidental", nameEs: "Vallés Occidental", nameEn: "Vallès Occidental", province: "Barcelona", dialect: "ca" },
  { id: "valles_oriental", name: "Vallès Oriental", nameEs: "Vallés Oriental", nameEn: "Vallès Oriental", province: "Barcelona", dialect: "ca" },

  // ─── GIRONA PROVINCE (Central Catalan) ───
  { id: "alt_emporda", name: "Alt Empordà", nameEs: "Alto Ampurdán", nameEn: "Alt Empordà", province: "Girona", dialect: "ca" },
  { id: "baix_emporda", name: "Baix Empordà", nameEs: "Bajo Ampurdán", nameEn: "Baix Empordà", province: "Girona", dialect: "ca" },
  { id: "cerdanya", name: "Cerdanya", nameEs: "Cerdaña", nameEn: "Cerdanya", province: "Girona", dialect: "ca" },
  { id: "garrotxa", name: "Garrotxa", nameEs: "Garrotxa", nameEn: "Garrotxa", province: "Girona", dialect: "ca" },
  { id: "girones", name: "Gironès", nameEs: "Gironés", nameEn: "Gironès", province: "Girona", dialect: "ca" },
  { id: "pla_estany", name: "Pla de l'Estany", nameEs: "Plan del Estanque", nameEn: "Pla de l'Estany", province: "Girona", dialect: "ca" },
  { id: "ripolles", name: "Ripollès", nameEs: "Ripollés", nameEn: "Ripollès", province: "Girona", dialect: "ca" },
  { id: "selva", name: "Selva", nameEs: "Selva", nameEn: "Selva", province: "Girona", dialect: "ca" },

  // ─── TARRAGONA PROVINCE — Camp de Tarragona (Central Catalan) ───
  { id: "alt_camp", name: "Alt Camp", nameEs: "Alto Campo", nameEn: "Alt Camp", province: "Tarragona", dialect: "ca" },
  { id: "baix_camp", name: "Baix Camp", nameEs: "Bajo Campo", nameEn: "Baix Camp", province: "Tarragona", dialect: "ca" },
  { id: "baix_penedes", name: "Baix Penedès", nameEs: "Bajo Penedés", nameEn: "Baix Penedès", province: "Tarragona", dialect: "ca" },
  { id: "conca_barbera", name: "Conca de Barberà", nameEs: "Cuenca de Barberá", nameEn: "Conca de Barberà", province: "Tarragona", dialect: "ca" },
  { id: "priorat", name: "Priorat", nameEs: "Priorato", nameEn: "Priorat", province: "Tarragona", dialect: "ca" },
  { id: "tarragones", name: "Tarragonès", nameEs: "Tarragonés", nameEn: "Tarragonès", province: "Tarragona", dialect: "ca" },

  // ─── TARRAGONA PROVINCE — Terres de l'Ebre (Northwestern Catalan) ───
  { id: "baix_ebre", name: "Baix Ebre", nameEs: "Bajo Ebro", nameEn: "Baix Ebre", province: "Terres de l'Ebre", dialect: "ca-nw" },
  { id: "montsia", name: "Montsià", nameEs: "Montsià", nameEn: "Montsià", province: "Terres de l'Ebre", dialect: "ca-nw" },
  { id: "ribera_ebre", name: "Ribera d'Ebre", nameEs: "Ribera de Ebro", nameEn: "Ribera d'Ebre", province: "Terres de l'Ebre", dialect: "ca-nw" },
  { id: "terra_alta", name: "Terra Alta", nameEs: "Terra Alta", nameEn: "Terra Alta", province: "Terres de l'Ebre", dialect: "ca-nw" },

  // ─── LLEIDA PROVINCE (Northwestern Catalan) ───
  { id: "alt_urgell", name: "Alt Urgell", nameEs: "Alto Urgel", nameEn: "Alt Urgell", province: "Lleida", dialect: "ca-nw" },
  { id: "alta_ribagorca", name: "Alta Ribagorça", nameEs: "Alta Ribagorza", nameEn: "Alta Ribagorça", province: "Lleida", dialect: "ca-nw" },
  { id: "garrigues", name: "Garrigues", nameEs: "Garrigas", nameEn: "Garrigues", province: "Lleida", dialect: "ca-nw" },
  { id: "noguera", name: "Noguera", nameEs: "Noguera", nameEn: "Noguera", province: "Lleida", dialect: "ca-nw" },
  { id: "pallars_jussa", name: "Pallars Jussà", nameEs: "Pallars Jussà", nameEn: "Pallars Jussà", province: "Lleida", dialect: "ca-nw" },
  { id: "pallars_sobira", name: "Pallars Sobirà", nameEs: "Pallars Sobirà", nameEn: "Pallars Sobirà", province: "Lleida", dialect: "ca-nw" },
  { id: "pla_urgell", name: "Pla d'Urgell", nameEs: "Plan de Urgel", nameEn: "Pla d'Urgell", province: "Lleida", dialect: "ca-nw" },
  { id: "segarra", name: "Segarra", nameEs: "Segarra", nameEn: "Segarra", province: "Lleida", dialect: "ca-nw" },
  { id: "segria", name: "Segrià", nameEs: "Segriá", nameEn: "Segrià", province: "Lleida", dialect: "ca-nw" },
  { id: "solsones", name: "Solsonès", nameEs: "Solsonés", nameEn: "Solsonès", province: "Lleida", dialect: "ca-nw" },
  { id: "urgell", name: "Urgell", nameEs: "Urgel", nameEn: "Urgell", province: "Lleida", dialect: "ca-nw" },
  { id: "val_aran", name: "Val d'Aran", nameEs: "Valle de Arán", nameEn: "Val d'Aran", province: "Lleida", dialect: "ca-nw" },

  // ─── ILLES BALEARS (Balearic Catalan) ───
  { id: "mallorca", name: "Mallorca", nameEs: "Mallorca", nameEn: "Mallorca", province: "Illes Balears", dialect: "ca-ba" },
  { id: "menorca", name: "Menorca", nameEs: "Menorca", nameEn: "Menorca", province: "Illes Balears", dialect: "ca-ba" },
  { id: "eivissa", name: "Eivissa", nameEs: "Ibiza", nameEn: "Ibiza", province: "Illes Balears", dialect: "ca-ba" },
  { id: "formentera", name: "Formentera", nameEs: "Formentera", nameEn: "Formentera", province: "Illes Balears", dialect: "ca-ba" },

  // ─── PAÍS VALENCIÀ / COMUNITAT VALENCIANA (Valencian) ───
  { id: "horta_nord", name: "Horta Nord", nameEs: "Huerta Norte", nameEn: "Horta Nord", province: "València", dialect: "ca-va" },
  { id: "horta_sud", name: "Horta Sud", nameEs: "Huerta Sur", nameEn: "Horta Sud", province: "València", dialect: "ca-va" },
  { id: "valencia_city", name: "Ciutat de València", nameEs: "Ciudad de Valencia", nameEn: "City of Valencia", province: "València", dialect: "ca-va" },
  { id: "camp_turia", name: "Camp de Túria", nameEs: "Campo de Turia", nameEn: "Camp de Túria", province: "València", dialect: "ca-va" },
  { id: "ribera_alta", name: "Ribera Alta", nameEs: "Ribera Alta", nameEn: "Ribera Alta", province: "València", dialect: "ca-va" },
  { id: "ribera_baixa", name: "Ribera Baixa", nameEs: "Ribera Baja", nameEn: "Ribera Baixa", province: "València", dialect: "ca-va" },
  { id: "costera", name: "Costera", nameEs: "Costera", nameEn: "Costera", province: "València", dialect: "ca-va" },
  { id: "safor", name: "Safor", nameEs: "Safor", nameEn: "Safor", province: "València", dialect: "ca-va" },
  { id: "marina_alta", name: "Marina Alta", nameEs: "Marina Alta", nameEn: "Marina Alta", province: "Alacant", dialect: "ca-va" },
  { id: "marina_baixa", name: "Marina Baixa", nameEs: "Marina Baja", nameEn: "Marina Baixa", province: "Alacant", dialect: "ca-va" },
  { id: "alacanti", name: "Alacantí", nameEs: "Alicantino", nameEn: "Alacantí", province: "Alacant", dialect: "ca-va" },
  { id: "alcoia", name: "Alcoià", nameEs: "Alcoyana", nameEn: "Alcoià", province: "Alacant", dialect: "ca-va" },
  { id: "comtat", name: "Comtat", nameEs: "Condado", nameEn: "Comtat", province: "Alacant", dialect: "ca-va" },
  { id: "plana_alta", name: "Plana Alta", nameEs: "Plana Alta", nameEn: "Plana Alta", province: "Castelló", dialect: "ca-va" },
  { id: "plana_baixa", name: "Plana Baixa", nameEs: "Plana Baja", nameEn: "Plana Baixa", province: "Castelló", dialect: "ca-va" },
  { id: "maestrat", name: "Maestrat", nameEs: "Maestrazgo", nameEn: "Maestrat", province: "Castelló", dialect: "ca-va" },
  { id: "ports", name: "Els Ports", nameEs: "Los Puertos", nameEn: "Els Ports", province: "Castelló", dialect: "ca-va" },
];

/**
 * Broader province/region groupings for simplified selection.
 */
export const PROVINCES = [
  { id: "barcelona", name: "Barcelona", dialect: "ca" as CatalanDialect },
  { id: "girona", name: "Girona", dialect: "ca" as CatalanDialect },
  { id: "tarragona_camp", name: "Tarragona (Camp de Tarragona)", dialect: "ca" as CatalanDialect },
  { id: "terres_ebre", name: "Terres de l'Ebre", dialect: "ca-nw" as CatalanDialect },
  { id: "lleida", name: "Lleida", dialect: "ca-nw" as CatalanDialect },
  { id: "illes_balears", name: "Illes Balears", dialect: "ca-ba" as CatalanDialect },
  { id: "valencia", name: "País Valencià (València)", dialect: "ca-va" as CatalanDialect },
  { id: "alacant", name: "País Valencià (Alacant)", dialect: "ca-va" as CatalanDialect },
  { id: "castello", name: "País Valencià (Castelló)", dialect: "ca-va" as CatalanDialect },
];

/**
 * Given a comarca ID or province ID, returns the corresponding dialect code.
 * Falls back to "ca" (Central) if the location is not found.
 */
export function detectDialectFromLocation(locationId: string | null | undefined): CatalanDialect {
  if (!locationId) return "ca";

  const normalized = locationId.toLowerCase().trim();

  // Check comarques first
  const comarca = COMARQUES.find(c => c.id === normalized);
  if (comarca) return comarca.dialect;

  // Check provinces
  const province = PROVINCES.find(p => p.id === normalized);
  if (province) return province.dialect;

  // Legacy values from old system
  const legacyMap: Record<string, CatalanDialect> = {
    "historical_centre": "ca-nw",  // Tortosa → Terres de l'Ebre
    "nucli_antic": "ca-nw",        // Tortosa → Terres de l'Ebre
  };
  if (legacyMap[normalized]) return legacyMap[normalized];

  // Fuzzy match: check if the location string contains a known comarca/province name
  for (const c of COMARQUES) {
    if (normalized.includes(c.id) || c.name.toLowerCase().includes(normalized)) {
      return c.dialect;
    }
  }

  return "ca"; // Default to Central Catalan
}

/**
 * Returns all comarques grouped by dialect for display in selectors.
 */
export function getComarquesByDialect(): Record<CatalanDialect, RegionInfo[]> {
  return {
    "ca": COMARQUES.filter(c => c.dialect === "ca"),
    "ca-nw": COMARQUES.filter(c => c.dialect === "ca-nw"),
    "ca-ba": COMARQUES.filter(c => c.dialect === "ca-ba"),
    "ca-va": COMARQUES.filter(c => c.dialect === "ca-va"),
  };
}

/**
 * Human-readable dialect labels in all three languages.
 */
export const DIALECT_LABELS: Record<CatalanDialect, { ca: string; es: string; en: string }> = {
  "ca": { ca: "Català central", es: "Catalán central", en: "Central Catalan" },
  "ca-nw": { ca: "Català nord-occidental", es: "Catalán noroccidental", en: "Northwestern Catalan" },
  "ca-ba": { ca: "Català balear", es: "Catalán balear", en: "Balearic Catalan" },
  "ca-va": { ca: "Valencià", es: "Valenciano", en: "Valencian" },
};
