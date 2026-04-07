/**
 * ainaTranslation.ts
 *
 * Aina Translation helper — uses the Hugging Face Inference API (router endpoint)
 * to translate educational text from English into Spanish (ES) or Catalan (CA).
 *
 * Models used:
 *   EN → ES: Helsinki-NLP/opus-mt-en-es
 *   EN → CA: Helsinki-NLP/opus-mt-en-ROMANCE  (with >>ca<< language tag prefix)
 *
 * The API key is read from the HF_API_KEY environment variable.
 */

const HF_BASE = "https://router.huggingface.co/hf-inference/models";
const MODEL_EN_ES = "Helsinki-NLP/opus-mt-en-es";
const MODEL_EN_ROMANCE = "Helsinki-NLP/opus-mt-en-ROMANCE";

type Locale = "es" | "ca";

/**
 * Translate a single string from English to the target locale.
 * Returns the translated string, or throws on network / API error.
 */
export async function ainaTranslate(text: string, locale: Locale): Promise<string> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) {
    throw new Error("HF_API_KEY environment variable is not set");
  }

  // For Catalan we use the ROMANCE multilingual model with a >>ca<< prefix
  const model = locale === "ca" ? MODEL_EN_ROMANCE : MODEL_EN_ES;
  const input = locale === "ca" ? `>>ca<< ${text}` : text;

  const response = await fetch(`${HF_BASE}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: input }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Aina Translation API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as Array<{ translation_text: string }>;
  const translated = data?.[0]?.translation_text;
  if (!translated) {
    throw new Error("Aina Translation API returned an empty result");
  }
  return translated;
}

/**
 * Translate an array of strings in parallel (up to concurrency limit).
 * Returns translated strings in the same order as the input.
 */
export async function ainaTranslateBatch(
  texts: string[],
  locale: Locale,
  concurrency = 5
): Promise<string[]> {
  const results: string[] = new Array(texts.length);

  // Process in chunks to respect rate limits
  for (let i = 0; i < texts.length; i += concurrency) {
    const chunk = texts.slice(i, i + concurrency);
    const translated = await Promise.all(
      chunk.map((text) => ainaTranslate(text, locale))
    );
    for (let j = 0; j < translated.length; j++) {
      results[i + j] = translated[j];
    }
  }

  return results;
}
