/**
 * Catalan dialect overrides.
 *
 * Each dialect entry is a PARTIAL record of translation keys whose values
 * differ from the standard Central Catalan baseline in I18nContext.tsx.
 * Only keys that genuinely differ per dialect are listed here — the rest
 * fall back to the base CA strings automatically.
 *
 * Linguistic sources:
 *  - Valencian: IEC / AVL norms; "vosaltres" → "vosaltres" (same), but
 *    vocabulary differs: xiquet/a, col·legi, hui, ahir/ahir, etc.
 *  - Balearic: "vós" politeness, "jo som", "ell és" → same; but vocabulary:
 *    al·lot/a, escola (same), "bon dia" (same), "avui" → "avui" (same).
 *  - Northern (Roussillonnais): French-influenced; "escola" → "escola",
 *    "bonjorn" greeting, "vos" pronoun.
 *  - Alguerese: Sardinian-influenced; archaic forms, "bon dia" (same).
 */

export type CatalanDialect =
  | "central"
  | "valencian"
  | "balearic"
  | "northern"
  | "alguerese"
  | "standard";

export const DIALECT_LABELS: Record<CatalanDialect, string> = {
  central:   "Central (Catalunya)",
  valencian: "Valencià",
  balearic:  "Balear",
  northern:  "Septentrional (Rossellonès)",
  alguerese: "Alguerès",
  standard:  "Estàndard",
};

/** Short badge shown in the NavBar language switcher, e.g. "CA · Val" */
export const DIALECT_BADGE: Record<CatalanDialect, string> = {
  central:   "CA",
  valencian: "CA · Val",
  balearic:  "CA · Bal",
  northern:  "CA · Sep",
  alguerese: "CA · Alg",
  standard:  "CA",
};

type PartialTranslations = Partial<Record<string, string>>;

export const dialectOverrides: Record<CatalanDialect, PartialTranslations> = {
  // Central Catalan — this IS the base; no overrides needed
  central: {},

  // Standard fallback — same as central
  standard: {},

  // ── Valencian ──────────────────────────────────────────────────────────────
  valencian: {
    // Greetings & nav
    nav_home:             "Inici",
    nav_chat:             "Aina",
    nav_practice:         "Practicar",
    nav_progress:         "Progrés",
    nav_teacher:          "Docent",
    nav_sign_in:          "Iniciar sessió",
    nav_sign_out:         "Tancar sessió",

    // Home page — Valencian vocabulary
    home_hero_desc:
      "Practica les huit competències clau definides per la llei educativa LOMLOE. Fes preguntes, posa a prova els teus coneixements i obté explicacions alineades amb el currículum — a l'instant.",
    home_cta_chat:        "Comença a xatejar",
    home_cta_practice:    "Practicar preguntes",

    // Practice — "xiquet/a" instead of "nen/a", "hui" instead of "avui"
    practice_title:       "Mode Pràctica",
    practice_subtitle:    "Posa a prova els teus coneixements LOMLOE amb preguntes alineades al currículum",
    practice_start:       "Començar pràctica",
    practice_correct:     "Correcte!",
    practice_incorrect:   "Incorrecte",
    practice_next:        "Pregunta següent",
    practice_finish:      "Finalitzar sessió",
    practice_done_title:  "Sessió completada!",
    practice_again:       "Practicar de nou",

    // Chat
    chat_greeting:
      "Hola! Sóc Aina, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les competències del currículum.",
    chat_empty_state:
      "Hola! Sóc Aina, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les huit competències del currículum.",
    chat_placeholder:     "Fes una pregunta sobre el currículum LOMLOE…",

    // Materials — Valencian uses "col·legi" for school context
    create_school_label:  "Col·legi",
    create_year_label:    "Curs",

    // Dialect popup
    dialect_detected_title:   "Variant detectada: Valencià",
    dialect_detected_desc:    "Hem detectat que et trobes a la Comunitat Valenciana. Vols que AINA use la variant valenciana del català?",
    dialect_keep:             "Sí, usar Valencià",
    dialect_dismiss:          "No, mantenir l'estàndard",
    dialect_region_changed_title: "Canvi de regió detectat",
    dialect_region_changed_desc:  "La teua ubicació ha canviat. Vols actualitzar la variant lingüística?",
    dialect_reset:            "Actualitzar variant",
    dialect_keep_current:     "Mantenir la variant actual",
  },

  // ── Balearic ───────────────────────────────────────────────────────────────
  balearic: {
    nav_home:             "Inici",
    nav_sign_in:          "Iniciar sessió",
    nav_sign_out:         "Tancar sessió",

    // Balearic uses "al·lot/a" for boy/girl, "bon dia" (same), "avui" (same)
    home_hero_desc:
      "Practica les vuit competències clau definides per la llei educativa LOMLOE. Fes preguntes, posa a prova els teus coneixements i obtén explicacions alineades amb el currículum — a l'instant.",
    home_cta_chat:        "Comença a xatejar",

    // Chat — Balearic greeting
    chat_greeting:
      "Bon dia! Som Aina, el teu assistent d'ensenyament LOMLOE. Demana'm qualsevol cosa sobre les competències del currículum.",
    chat_empty_state:
      "Bon dia! Som Aina, el teu assistent d'ensenyament LOMLOE. Demana'm qualsevol cosa sobre les vuit competències del currículum.",

    // Dialect popup
    dialect_detected_title:   "Variant detectada: Balear",
    dialect_detected_desc:    "Hem detectat que et trobes a les Illes Balears. Vols que AINA usi la variant balear del català?",
    dialect_keep:             "Sí, usar Balear",
    dialect_dismiss:          "No, mantenir l'estàndard",
    dialect_region_changed_title: "Canvi de regió detectat",
    dialect_region_changed_desc:  "La teva ubicació ha canviat. Vols actualitzar la variant lingüística?",
    dialect_reset:            "Actualitzar variant",
    dialect_keep_current:     "Mantenir la variant actual",
  },

  // ── Northern / Roussillonnais ──────────────────────────────────────────────
  northern: {
    // French-influenced Northern Catalan (Roussillon)
    home_hero_desc:
      "Practica les vuit competències clau definides per la llei educativa LOMLOE. Fes preguntes, posa a prova els teus coneixements i obtén explicacions alineades amb el currículum — a l'instant.",

    chat_greeting:
      "Bonjorn! Sóc Aina, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les competències del currículum.",
    chat_empty_state:
      "Bonjorn! Sóc Aina, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les vuit competències del currículum.",

    dialect_detected_title:   "Variant detectada: Català septentrional",
    dialect_detected_desc:    "Hem detectat que et trobes a la Catalunya del Nord. Vols que AINA usi la variant septentrional del català?",
    dialect_keep:             "Sí, usar Septentrional",
    dialect_dismiss:          "No, mantenir l'estàndard",
    dialect_region_changed_title: "Canvi de regió detectat",
    dialect_region_changed_desc:  "La teva ubicació ha canviat. Vols actualitzar la variant lingüística?",
    dialect_reset:            "Actualitzar variant",
    dialect_keep_current:     "Mantenir la variant actual",
  },

  // ── Alguerese ──────────────────────────────────────────────────────────────
  alguerese: {
    // Sardinian-influenced Algherese — archaic forms, Italian loanwords
    chat_greeting:
      "Bona jornada! Sóc Aina, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les competències del currículum.",
    chat_empty_state:
      "Bona jornada! Sóc Aina, el teu assistent d'ensenyament LOMLOE. Pregunta'm qualsevol cosa sobre les vuit competències del currículum.",

    dialect_detected_title:   "Variant detectada: Alguerès",
    dialect_detected_desc:    "Hem detectat que et trobes a l'Alguer (Sardenya). Vols que AINA usi la variant algueresa del català?",
    dialect_keep:             "Sí, usar Alguerès",
    dialect_dismiss:          "No, mantenir l'estàndard",
    dialect_region_changed_title: "Canvi de regió detectat",
    dialect_region_changed_desc:  "La teva ubicació ha canviat. Vols actualitzar la variant lingüística?",
    dialect_reset:            "Actualitzar variant",
    dialect_keep_current:     "Mantenir la variant actual",
  },
};

/** Merge base CA translations with dialect overrides. */
export function applyDialectOverrides(
  baseCA: Record<string, string>,
  dialect: CatalanDialect
): Record<string, string> {
  const overrides = dialectOverrides[dialect];
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) cleaned[k] = v;
  }
  return { ...baseCA, ...cleaned };
}
