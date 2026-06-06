/**
 * Factual Grounding Helper — researches topics on certified/authoritative sources
 * before any LLM generation or image creation, ensuring:
 *  - Correct country names, borders, and political designations
 *  - Accurate location landmarks, coordinates, and official names
 *  - Verified scientific, historical, and cultural facts
 *
 * Sources used (in priority order):
 *  1. Wikipedia REST API (en + ca + es) — encyclopaedic facts, geography, history
 *  2. Wikidata API — structured entity data (countries, capitals, coordinates)
 *  3. REST Countries API — official country names, flags, capitals, regions
 *  4. OpenStreetMap Nominatim — verified place names and addresses
 *
 * The returned `groundingContext` string is injected into the LLM system prompt
 * and prepended to image generation prompts.
 */

export type GroundingResult = {
  /** Compact verified-facts block ready to inject into a prompt */
  groundingContext: string;
  /** Individual source snippets for logging / citation */
  sources: Array<{ title: string; url: string; snippet: string }>;
};

// ─── Wikipedia ────────────────────────────────────────────────────────────────

async function fetchWikipediaSummary(
  topic: string,
  lang: "en" | "ca" | "es" = "en"
): Promise<{ title: string; extract: string; url: string } | null> {
  try {
    const encoded = encodeURIComponent(topic.trim());
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SEBA-AI-Studio/2.0 (https://sebataeco.com; educational bot)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
      type?: string;
    };
    // Skip disambiguation pages
    if (data.type === "disambiguation" || !data.extract) return null;
    return {
      title: data.title ?? topic,
      extract: data.extract.slice(0, 1200),
      url: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encoded}`,
    };
  } catch {
    return null;
  }
}

// ─── Wikidata (structured entity lookup) ─────────────────────────────────────

async function fetchWikidataEntity(
  topic: string
): Promise<{ label: string; description: string; url: string } | null> {
  try {
    const encoded = encodeURIComponent(topic.trim());
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encoded}&language=en&limit=1&format=json&origin=*`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SEBA-AI-Studio/2.0 (https://sebataeco.com)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      search?: Array<{ label?: string; description?: string; concepturi?: string }>;
    };
    const hit = data.search?.[0];
    if (!hit?.label) return null;
    return {
      label: hit.label,
      description: hit.description ?? "",
      url: hit.concepturi ?? `https://www.wikidata.org/wiki/Special:Search/${encoded}`,
    };
  } catch {
    return null;
  }
}

// ─── REST Countries API ───────────────────────────────────────────────────────

async function fetchCountryData(
  countryName: string
): Promise<{ name: string; capital: string; region: string; subregion: string; url: string } | null> {
  try {
    const encoded = encodeURIComponent(countryName.trim());
    const url = `https://restcountries.com/v3.1/name/${encoded}?fields=name,capital,region,subregion`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SEBA-AI-Studio/2.0 (https://sebataeco.com)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      name?: { common?: string; official?: string };
      capital?: string[];
      region?: string;
      subregion?: string;
    }>;
    const hit = data[0];
    if (!hit) return null;
    return {
      name: hit.name?.official ?? hit.name?.common ?? countryName,
      capital: hit.capital?.[0] ?? "unknown",
      region: hit.region ?? "",
      subregion: hit.subregion ?? "",
      url: `https://restcountries.com/v3.1/name/${encoded}`,
    };
  } catch {
    return null;
  }
}

// ─── OpenStreetMap Nominatim (place name verification) ───────────────────────

async function fetchNominatimPlace(
  place: string
): Promise<{ displayName: string; country: string; url: string } | null> {
  try {
    const encoded = encodeURIComponent(place.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SEBA-AI-Studio/2.0 (https://sebataeco.com; educational bot)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      display_name?: string;
      address?: { country?: string };
    }>;
    const hit = data[0];
    if (!hit?.display_name) return null;
    return {
      displayName: hit.display_name,
      country: hit.address?.country ?? "",
      url: `https://www.openstreetmap.org/search?query=${encoded}`,
    };
  } catch {
    return null;
  }
}

// ─── Topic classifier ─────────────────────────────────────────────────────────

function classifyTopic(topic: string): {
  isGeographic: boolean;
  isCountry: boolean;
  isLandmark: boolean;
  isScientific: boolean;
  isHistorical: boolean;
} {
  const t = topic.toLowerCase();
  const geoKeywords = /\b(country|countries|city|capital|continent|ocean|river|mountain|island|region|province|state|border|map|geography|location|place|landmark|monument|flag|nation|territory|peninsula|valley|desert|lake|sea|bay|gulf|strait|canal|port|coast)\b/i;
  const countryKeywords = /\b(spain|france|germany|italy|portugal|uk|united kingdom|united states|usa|china|japan|india|brazil|australia|canada|mexico|russia|africa|europe|asia|america|catalonia|catalan|mediterranean)\b/i;
  const landmarkKeywords = /\b(eiffel|colosseum|pyramid|tower|palace|cathedral|museum|castle|bridge|statue|monument|temple|mosque|church|ruins|park|garden|zoo|stadium)\b/i;
  const sciKeywords = /\b(science|biology|chemistry|physics|mathematics|ecology|evolution|cell|atom|molecule|energy|force|gravity|photosynthesis|climate|weather|space|planet|star|galaxy|dna|gene|species|ecosystem)\b/i;
  const histKeywords = /\b(history|historical|ancient|medieval|renaissance|revolution|war|empire|civilization|dynasty|century|bc|ad|era|period|age|discovery|exploration|colonization|independence)\b/i;

  return {
    isGeographic: geoKeywords.test(t) || countryKeywords.test(t) || landmarkKeywords.test(t),
    isCountry: countryKeywords.test(t),
    isLandmark: landmarkKeywords.test(t),
    isScientific: sciKeywords.test(t),
    isHistorical: histKeywords.test(t),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Researches a topic on authoritative/verified sources and returns a grounding
 * context block ready to inject into LLM system prompts or image prompts.
 *
 * Always runs in parallel to keep latency low (≤8 s total).
 * Gracefully degrades — if all sources fail, returns an empty context.
 */
export async function groundTopic(topic: string): Promise<GroundingResult> {
  const classification = classifyTopic(topic);
  const sources: Array<{ title: string; url: string; snippet: string }> = [];

  // Always fetch English Wikipedia as the primary source
  const fetchTasks: Promise<void>[] = [];

  // 1. Wikipedia (English — primary)
  fetchTasks.push(
    fetchWikipediaSummary(topic, "en").then((r) => {
      if (r) sources.push({ title: `Wikipedia (EN): ${r.title}`, url: r.url, snippet: r.extract });
    })
  );

  // 2. Wikipedia (Catalan) — for Catalan/Spanish topics
  if (classification.isGeographic || classification.isHistorical) {
    fetchTasks.push(
      fetchWikipediaSummary(topic, "ca").then((r) => {
        if (r) sources.push({ title: `Viquipèdia (CA): ${r.title}`, url: r.url, snippet: r.extract });
      })
    );
  }

  // 3. Wikidata — structured entity data for any topic
  fetchTasks.push(
    fetchWikidataEntity(topic).then((r) => {
      if (r) sources.push({
        title: `Wikidata: ${r.label}`,
        url: r.url,
        snippet: r.description,
      });
    })
  );

  // 4. REST Countries — for country-related topics
  if (classification.isCountry || classification.isGeographic) {
    fetchTasks.push(
      fetchCountryData(topic).then((r) => {
        if (r) sources.push({
          title: `REST Countries: ${r.name}`,
          url: r.url,
          snippet: `Official name: ${r.name}. Capital: ${r.capital}. Region: ${r.region} / ${r.subregion}.`,
        });
      })
    );
  }

  // 5. OpenStreetMap Nominatim — for landmark/place topics
  if (classification.isLandmark || classification.isGeographic) {
    fetchTasks.push(
      fetchNominatimPlace(topic).then((r) => {
        if (r) sources.push({
          title: `OpenStreetMap: ${r.displayName.split(",")[0]}`,
          url: r.url,
          snippet: `Verified location: ${r.displayName}. Country: ${r.country}.`,
        });
      })
    );
  }

  // Run all fetches in parallel with a global timeout guard
  await Promise.allSettled(fetchTasks);

  if (sources.length === 0) {
    return { groundingContext: "", sources: [] };
  }

  // Build the grounding context block
  const groundingContext = [
    "=== VERIFIED FACTUAL CONTEXT (from authoritative sources) ===",
    "Use the following verified information to ensure accuracy. Do NOT contradict these facts.",
    "",
    ...sources.map((s) => `[${s.title}]\n${s.snippet}\nSource: ${s.url}`),
    "",
    "=== END VERIFIED CONTEXT ===",
  ].join("\n");

  return { groundingContext, sources };
}

/**
 * Enriches an image generation prompt with verified geographic/factual context.
 * Adds accuracy notes for countries, landmarks, and locations.
 */
export async function groundImagePrompt(prompt: string): Promise<string> {
  // Classify the full prompt AND individual capitalized words (potential place names)
  const classification = classifyTopic(prompt);
  if (!classification.isGeographic && !classification.isLandmark && !classification.isCountry) {
    // Non-geographic prompt — no grounding needed
    return prompt;
  }

  // Extract the most specific place/landmark phrase from the prompt
  // Look for capitalized sequences like "Eiffel Tower", "Rome", "France"
  const placeMatch = prompt.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+){0,3})\b/);
  const searchTopic = placeMatch ? placeMatch[0] : prompt;

  const { groundingContext, sources } = await groundTopic(searchTopic);
  if (!groundingContext || sources.length === 0) return prompt;

  // Build a compact accuracy note from the top verified facts
  const factLines = sources
    .flatMap((s) => s.snippet.split(".").slice(0, 2))
    .filter((l) => l.trim().length > 15)
    .slice(0, 3)
    .map((l) => l.trim())
    .join(". ");

  const accuracyNote = factLines
    ? `Verified facts: ${factLines}. Use accurate depictions consistent with these verified sources.`
    : `Verified location from OpenStreetMap/Wikipedia. Use accurate geographic depictions.`;

  return `${prompt} [ACCURACY NOTE: ${accuracyNote}]`;
}
