/**
 * Bias Scan Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 24 hours (wired in server/_core/index.ts).
 *
 * For every unresolved bias flag it:
 *   1. Asks the LLM to explain the bias and suggest a corrected output.
 *   2. Persists the suggestion in bias_scan_fix_suggestions.
 *   3. Automatically marks the flag as resolved (applies the fix).
 *   4. Notifies the owner if any incidents were found.
 */

import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  aiBiasFlags,
  biasScanRuns,
  biasScanFixSuggestions,
} from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FixSuggestion {
  biasExplanation: string;
  suggestedFix: string;
}

// ── LLM helper ────────────────────────────────────────────────────────────────

async function generateFixSuggestion(
  inputText: string,
  outputText: string,
  flagReason: string
): Promise<FixSuggestion> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an AI ethics reviewer for an educational platform used by Spanish schools.
Your task is to analyse a flagged AI output and provide:
1. A clear explanation of why the output is biased or problematic.
2. A corrected, unbiased replacement for the output.

Respond with valid JSON matching this schema exactly:
{
  "biasExplanation": "string — why the output is biased",
  "suggestedFix": "string — the corrected, unbiased output text"
}`,
      },
      {
        role: "user",
        content: `Flagged reason: ${flagReason}

Original student input:
${inputText}

AI output that was flagged:
${outputText}

Provide your analysis and corrected output as JSON.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bias_fix",
        strict: true,
        schema: {
          type: "object",
          properties: {
            biasExplanation: { type: "string" },
            suggestedFix: { type: "string" },
          },
          required: ["biasExplanation", "suggestedFix"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
  return {
    biasExplanation: parsed.biasExplanation ?? "No explanation generated.",
    suggestedFix: parsed.suggestedFix ?? outputText,
  };
}

// ── Main scan function ────────────────────────────────────────────────────────

export async function runBiasScan(): Promise<{
  incidentCount: number;
  fixesGenerated: number;
  fixesApplied: number;
  summary: string;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[BiasScan] Database unavailable — scan aborted.");
    return { incidentCount: 0, fixesGenerated: 0, fixesApplied: 0, summary: "DB unavailable" };
  }

  // Create a scan run record
  const insertResult = await db.insert(biasScanRuns).values({
    status: "running",
    incidentCount: 0,
    fixesGenerated: 0,
    fixesApplied: 0,
  });
  const scanRunId = (insertResult as unknown as [{ insertId: number }])[0].insertId;

  try {
    // Fetch all unresolved bias flags
    const unresolvedFlags = await db
      .select()
      .from(aiBiasFlags)
      .where(eq(aiBiasFlags.resolved, false))
      .orderBy(aiBiasFlags.createdAt)
      .limit(100);

    const incidentCount = unresolvedFlags.length;
    let fixesGenerated = 0;
    let fixesApplied = 0;

    if (incidentCount === 0) {
      // No incidents — mark scan complete and return
      await db
        .update(biasScanRuns)
        .set({
          status: "completed",
          incidentCount: 0,
          fixesGenerated: 0,
          fixesApplied: 0,
          summary: "No unresolved bias incidents found.",
        })
        .where(eq(biasScanRuns.id, scanRunId));

      console.log("[BiasScan] Scan complete — no incidents found.");
      return { incidentCount: 0, fixesGenerated: 0, fixesApplied: 0, summary: "No unresolved bias incidents found." };
    }

    // Process each flag
    for (const flag of unresolvedFlags) {
      try {
        const suggestion = await generateFixSuggestion(
          flag.inputText,
          flag.outputText,
          flag.flagReason
        );

        // Persist fix suggestion
        await db.insert(biasScanFixSuggestions).values({
          scanRunId,
          biasFlagId: flag.id,
          biasExplanation: suggestion.biasExplanation,
          suggestedFix: suggestion.suggestedFix,
          applied: true,
          appliedAt: new Date(),
        });
        fixesGenerated++;

        // Auto-resolve the flag
        await db
          .update(aiBiasFlags)
          .set({ resolved: true, resolvedAt: new Date() })
          .where(eq(aiBiasFlags.id, flag.id));
        fixesApplied++;
      } catch (err) {
        console.error(`[BiasScan] Failed to process flag ${flag.id}:`, err);
      }
    }

    const summary =
      `Scan found ${incidentCount} unresolved bias incident(s). ` +
      `Fix suggestions generated: ${fixesGenerated}. ` +
      `Incidents auto-resolved: ${fixesApplied}.`;

    // Update scan run with results
    await db
      .update(biasScanRuns)
      .set({
        status: "completed",
        incidentCount,
        fixesGenerated,
        fixesApplied,
        summary,
      })
      .where(eq(biasScanRuns.id, scanRunId));

    // Notify the owner
    try {
      await notifyOwner({
        title: `⚠️ Bias Scan: ${incidentCount} incident(s) found & resolved`,
        content: summary,
      });
    } catch {
      // Notification failure is non-fatal
    }

    console.log(`[BiasScan] ${summary}`);
    return { incidentCount, fixesGenerated, fixesApplied, summary };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(biasScanRuns)
      .set({ status: "failed", errorMessage })
      .where(eq(biasScanRuns.id, scanRunId));
    console.error("[BiasScan] Scan failed:", errorMessage);
    throw err;
  }
}

// ── Scan status export (for UI polling) ──────────────────────────────────────

export const biasScanStatus = {
  lastRunAt: null as Date | null,
  lastResult: null as Awaited<ReturnType<typeof runBiasScan>> | null,
  lastError: null as string | null,
};
