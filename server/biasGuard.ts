/**
 * biasGuard.ts
 *
 * Server-side middleware that scans AI-generated text for gender, ethnic,
 * socioeconomic, or cultural bias before it is returned to the client.
 *
 * Strategy:
 *  1. Fast regex pre-screen — catches obvious patterns instantly.
 *  2. LLM secondary check — a strict, focused prompt that classifies the
 *     output as PASS / LOW / MEDIUM / HIGH with a short reason.
 *  3. If flagged at MEDIUM or HIGH, the original output is replaced with a
 *     safe neutral fallback and the incident is logged to ai_bias_flags.
 *  4. LOW flags are logged but the original output is returned unchanged.
 */

import { getDb } from "./db";
import { aiBiasFlags } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

export type BiasSeverity = "low" | "medium" | "high";

export interface BiasCheckResult {
  /** The text to actually return to the client (may be the original or a fallback) */
  safeOutput: string;
  /** Whether a bias flag was raised */
  flagged: boolean;
  severity?: BiasSeverity;
  reason?: string;
}

// ── 1. Fast regex pre-screen ─────────────────────────────────────────────────

const BIAS_PATTERNS: { pattern: RegExp; reason: string; severity: BiasSeverity }[] = [
  // Gender stereotypes
  {
    pattern: /\b(boys|girls)\s+(are|tend to be|perform|learn)\s+(better|worse|more|less)\b/i,
    reason: "Gender-based performance generalisation",
    severity: "high",
  },
  {
    pattern: /\b(male|female)\s+(students|pupils|learners)\s+(are|tend|typically|usually)\b/i,
    reason: "Gender-based student generalisation",
    severity: "medium",
  },
  // Ethnic / national stereotypes
  {
    pattern: /\b(immigrants?|foreign|migrant)\s+(students?|children|pupils?)\s+(struggle|fail|cannot|lack)\b/i,
    reason: "Ethnic/national background generalisation",
    severity: "high",
  },
  {
    pattern: /\b(certain|some)\s+(cultures?|backgrounds?|ethnicities|nationalities)\s+(are|tend|typically)\b/i,
    reason: "Cultural generalisation",
    severity: "medium",
  },
  // Socioeconomic stereotypes
  {
    pattern: /\b(poor|low.income|disadvantaged)\s+(students?|families|children)\s+(cannot|won't|will not|are unable)\b/i,
    reason: "Socioeconomic generalisation",
    severity: "high",
  },
  // Disability stereotypes
  {
    pattern: /\b(special.needs|disabled?)\s+(students?|children|pupils?)\s+(cannot|won't|will not|are unable|struggle)\b/i,
    reason: "Disability-based generalisation",
    severity: "high",
  },
];

function regexPreScreen(text: string): { flagged: boolean; reason: string; severity: BiasSeverity } | null {
  for (const { pattern, reason, severity } of BIAS_PATTERNS) {
    if (pattern.test(text)) {
      return { flagged: true, reason, severity };
    }
  }
  return null;
}

// ── 2. LLM secondary check ───────────────────────────────────────────────────

const BIAS_CHECK_SYSTEM = `You are a strict educational content bias auditor. Your only job is to detect bias in AI-generated educational text.

You must check for:
- Gender bias: stereotypes about how boys/girls learn or perform
- Ethnic/national bias: generalisations about students based on origin, immigration status, or nationality
- Socioeconomic bias: assumptions about students based on family income or social class
- Disability bias: assumptions about what students with disabilities can or cannot do
- Cultural bias: assumptions that favour one cultural background over others

Respond ONLY with a JSON object in this exact format:
{
  "verdict": "PASS" | "LOW" | "MEDIUM" | "HIGH",
  "reason": "one sentence explaining the finding, or empty string if PASS"
}

PASS = no bias detected
LOW = subtle or borderline bias that should be monitored
MEDIUM = clear bias that should be reviewed
HIGH = explicit bias that must be blocked`;

async function llmBiasCheck(
  inputText: string,
  outputText: string
): Promise<{ verdict: "PASS" | "LOW" | "MEDIUM" | "HIGH"; reason: string }> {
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: BIAS_CHECK_SYSTEM },
        {
          role: "user",
          content: `TEACHER INPUT:\n${inputText.slice(0, 500)}\n\nAI OUTPUT TO AUDIT:\n${outputText.slice(0, 1500)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bias_check",
          strict: true,
          schema: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["PASS", "LOW", "MEDIUM", "HIGH"] },
              reason: { type: "string" },
            },
            required: ["verdict", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = response.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    return {
      verdict: parsed.verdict ?? "PASS",
      reason: parsed.reason ?? "",
    };
  } catch {
    // If the LLM check fails, default to PASS to avoid blocking legitimate content
    return { verdict: "PASS", reason: "" };
  }
}

// ── 3. Safe fallback messages ─────────────────────────────────────────────────

const SAFE_FALLBACK = `I want to make sure my response is fair and unbiased for all students. Every learner is unique and capable of success regardless of their background, gender, or personal circumstances. Let me provide a response that focuses on evidence-based teaching strategies that support all students equally. Could you rephrase your question so I can give you the most helpful and inclusive advice?`;

// ── 4. Main export ────────────────────────────────────────────────────────────

/**
 * Run the bias guard on an AI-generated output.
 *
 * @param inputText  - The teacher's original prompt/question
 * @param outputText - The AI's generated response
 * @param sessionId  - Optional session identifier for logging
 * @param userId     - Optional user ID for logging
 */
export async function checkBias(
  inputText: string,
  outputText: string,
  sessionId?: string,
  userId?: number
): Promise<BiasCheckResult> {
  // Step 1: Fast regex pre-screen
  const regexResult = regexPreScreen(outputText);

  if (regexResult) {
    // Log and block immediately for HIGH, log-only for MEDIUM from regex
    await logBiasFlag({
      sessionId,
      userId,
      inputText,
      outputText,
      flagReason: `[Regex] ${regexResult.reason}`,
      severity: regexResult.severity,
    });

    if (regexResult.severity === "high") {
      return {
        safeOutput: SAFE_FALLBACK,
        flagged: true,
        severity: regexResult.severity,
        reason: regexResult.reason,
      };
    }
  }

  // Step 2: LLM secondary check (always runs for educational content)
  const llmResult = await llmBiasCheck(inputText, outputText);

  if (llmResult.verdict === "PASS") {
    return { safeOutput: outputText, flagged: false };
  }

  const severity: BiasSeverity =
    llmResult.verdict === "HIGH" ? "high" : llmResult.verdict === "MEDIUM" ? "medium" : "low";

  await logBiasFlag({
    sessionId,
    userId,
    inputText,
    outputText,
    flagReason: `[LLM] ${llmResult.reason}`,
    severity,
  });

  if (severity === "high" || severity === "medium") {
    return {
      safeOutput: SAFE_FALLBACK,
      flagged: true,
      severity,
      reason: llmResult.reason,
    };
  }

  // LOW — log but return original
  return {
    safeOutput: outputText,
    flagged: true,
    severity: "low",
    reason: llmResult.reason,
  };
}

// ── 5. DB logging helper ──────────────────────────────────────────────────────

async function logBiasFlag(params: {
  sessionId?: string;
  userId?: number;
  inputText: string;
  outputText: string;
  flagReason: string;
  severity: BiasSeverity;
}) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(aiBiasFlags).values({
      sessionId: params.sessionId ?? null,
      userId: params.userId ?? null,
      inputText: params.inputText.slice(0, 5000),
      outputText: params.outputText.slice(0, 5000),
      flagReason: params.flagReason,
      severity: params.severity,
      resolved: false,
    });
  } catch (err) {
    // Non-blocking — never let logging failure break the response
    console.error("[BiasGuard] Failed to log bias flag:", err);
  }
}
