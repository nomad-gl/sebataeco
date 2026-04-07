import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";

/**
 * Catalan dialect variants mapped from IP geolocation.
 *
 * Dialect coverage:
 *  - central   → Catalunya (ES-CT), Andorra (AD), Aragon Catalan strip (ES-AR partial)
 *  - valencian  → Comunitat Valenciana (ES-VC)
 *  - balearic   → Illes Balears (ES-IB)
 *  - northern   → Occitanie / Roussillon, France (FR region containing Pyrénées-Orientales)
 *  - alguerese  → Sassari province, Sardinia, Italy (IT-SS)
 *  - standard   → Fallback / all other regions (uses IEC standard written Catalan)
 */
export type CatalanDialect = "central" | "valencian" | "balearic" | "northern" | "alguerese" | "standard";

interface GeoResult {
  countryCode: string;
  region: string;       // ISO 3166-2 short code, e.g. "CT", "VC", "IB"
  regionName: string;   // Human-readable region name
  city: string;
  dialect: CatalanDialect;
  dialectLabel: string;
}

/**
 * Maps ISO country + region codes to a Catalan dialect.
 * ip-api.com returns `region` as the ISO 3166-2 subdivision code (without country prefix).
 */
function mapToDialect(countryCode: string, region: string): CatalanDialect {
  const cc = countryCode.toUpperCase();
  const reg = region.toUpperCase();

  if (cc === "AD") return "central";                       // Andorra
  if (cc === "ES") {
    if (reg === "CT") return "central";                    // Catalunya
    if (reg === "VC") return "valencian";                  // Comunitat Valenciana
    if (reg === "IB") return "balearic";                   // Illes Balears
    if (reg === "AR") return "central";                    // Aragon (Franja de Ponent — use central)
    if (reg === "PM") return "balearic";                   // Old Balearic code fallback
  }
  if (cc === "FR") {
    // Pyrénées-Orientales (66) is in Occitanie region
    if (reg === "OCC" || reg === "76" || reg === "66") return "northern";
  }
  if (cc === "IT") {
    if (reg === "SS" || reg === "SAR") return "alguerese"; // Sassari / Sardinia
  }
  return "standard";
}

const DIALECT_LABELS: Record<CatalanDialect, string> = {
  central:   "Central (Catalunya)",
  valencian: "Valencià",
  balearic:  "Balear",
  northern:  "Septentrional (Rossellonès)",
  alguerese: "Alguerès",
  standard:  "Estàndard",
};

export const geoDialectRouter = router({
  /**
   * Detect the caller's Catalan dialect from their IP address.
   * Uses the free ip-api.com endpoint (no key required, 45 req/min limit).
   * The client IP is read from the Express request headers.
   */
  detect: publicProcedure.query(async ({ ctx }): Promise<GeoResult> => {
    // Resolve real client IP (behind proxies / Cloudflare)
    const forwarded = ctx.req.headers["x-forwarded-for"];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ??
      ctx.req.socket?.remoteAddress ??
      "";

    // Skip geolocation for localhost / private ranges — return central as default
    const isLocal =
      !ip ||
      ip === "::1" ||
      ip === "127.0.0.1" ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      ip.startsWith("172.");

    if (isLocal) {
      return {
        countryCode: "ES",
        region: "CT",
        regionName: "Catalonia",
        city: "",
        dialect: "central",
        dialectLabel: DIALECT_LABELS["central"],
      };
    }

    try {
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,region,regionName,city`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`ip-api HTTP ${res.status}`);
      const data = await res.json() as {
        status: string;
        countryCode?: string;
        region?: string;
        regionName?: string;
        city?: string;
      };

      if (data.status !== "success") {
        return {
          countryCode: "XX",
          region: "",
          regionName: "Unknown",
          city: "",
          dialect: "standard",
          dialectLabel: DIALECT_LABELS["standard"],
        };
      }

      const countryCode = data.countryCode ?? "XX";
      const region = data.region ?? "";
      const dialect = mapToDialect(countryCode, region);

      return {
        countryCode,
        region,
        regionName: data.regionName ?? "",
        city: data.city ?? "",
        dialect,
        dialectLabel: DIALECT_LABELS[dialect],
      };
    } catch {
      return {
        countryCode: "XX",
        region: "",
        regionName: "Unknown",
        city: "",
        dialect: "standard",
        dialectLabel: DIALECT_LABELS["standard"],
      };
    }
  }),
});
