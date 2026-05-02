/**
 * BSC Curriculum Loader
 *
 * Loads and transforms BSC (Catalan Competency-Based Curriculum) data from Hugging Face datasets
 * into the SEBA knowledge bank format for use in AI-powered lesson planning and materials generation.
 *
 * Usage:
 *   const loader = new BSCCurriculumLoader(process.env.HF_API_KEY);
 *   const competencies = await loader.loadCompetencies("bsc-primary-2024");
 *   await loader.syncToKnowledgeBank(competencies);
 */

import { db } from "./db";
import { knowledgeBank } from "../drizzle/schema";

export interface BSCCompetency {
  id: string;
  code: string;
  name: string;
  description: string;
  yearGroups: string[];
  criteria: BSCCriterion[];
  learningOutcomes: string[];
  crossCurricularLinks: string[];
  assessmentMethods: string[];
}

export interface BSCCriterion {
  id: string;
  code: string;
  description: string;
  proficiencyLevels: ProficiencyLevel[];
}

export interface ProficiencyLevel {
  level: number; // 1-4
  descriptor: string;
  indicators: string[];
}

export class BSCCurriculumLoader {
  private apiKey: string;
  private hfApiUrl = "https://huggingface.co/api/datasets";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("HF_API_KEY is required for BSC curriculum loading");
    }
    this.apiKey = apiKey;
  }

  /**
   * Load BSC competencies from a Hugging Face dataset
   */
  async loadCompetencies(datasetId: string): Promise<BSCCompetency[]> {
    try {
      const response = await fetch(
        `${this.hfApiUrl}/${datasetId}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "User-Agent": "SEBA-BSC-Loader/1.0"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load BSC dataset: ${response.status} ${response.statusText}`
        );
      }

      const dataset = await response.json();
      return this.transformDataset(dataset);
    } catch (error) {
      console.error("[BSCCurriculumLoader] Error loading dataset:", error);
      throw error;
    }
  }

  /**
   * Transform raw HF dataset into BSC competency format
   */
  private transformDataset(dataset: any): BSCCompetency[] {
    const competencies: BSCCompetency[] = [];

    if (Array.isArray(dataset.data)) {
      for (const item of dataset.data) {
        competencies.push(this.transformCompetency(item));
      }
    }

    return competencies;
  }

  /**
   * Transform a single competency item
   */
  private transformCompetency(item: any): BSCCompetency {
    return {
      id: item.id || `bsc-${Date.now()}-${Math.random()}`,
      code: item.code || item.competency_code || "",
      name: item.name || item.title || "",
      description: item.description || item.summary || "",
      yearGroups: Array.isArray(item.yearGroups)
        ? item.yearGroups
        : item.year_groups || [],
      criteria: Array.isArray(item.criteria)
        ? item.criteria.map((c: any) => this.transformCriterion(c))
        : [],
      learningOutcomes: Array.isArray(item.learningOutcomes)
        ? item.learningOutcomes
        : item.learning_outcomes || [],
      crossCurricularLinks: Array.isArray(item.crossCurricularLinks)
        ? item.crossCurricularLinks
        : item.cross_curricular_links || [],
      assessmentMethods: Array.isArray(item.assessmentMethods)
        ? item.assessmentMethods
        : item.assessment_methods || []
    };
  }

  /**
   * Transform assessment criterion
   */
  private transformCriterion(criterion: any): BSCCriterion {
    return {
      id: criterion.id || `criterion-${Date.now()}`,
      code: criterion.code || criterion.criterion_code || "",
      description: criterion.description || "",
      proficiencyLevels: Array.isArray(criterion.proficiencyLevels)
        ? criterion.proficiencyLevels.map((p: any, idx: number) =>
            this.transformProficiencyLevel(p, idx + 1)
          )
        : []
    };
  }

  /**
   * Transform proficiency level descriptor
   */
  private transformProficiencyLevel(
    level: any,
    levelNumber: number
  ): ProficiencyLevel {
    return {
      level: levelNumber,
      descriptor: level.descriptor || level.description || "",
      indicators: Array.isArray(level.indicators)
        ? level.indicators
        : level.indicators?.split(";").map((i: string) => i.trim()) || []
    };
  }

  /**
   * Sync competencies to SEBA knowledge bank
   */
  async syncToKnowledgeBank(competencies: BSCCompetency[]): Promise<void> {
    console.log(
      `[BSCCurriculumLoader] Syncing ${competencies.length} competencies to knowledge bank...`
    );

    for (const competency of competencies) {
      try {
        // Upsert competency to knowledge bank
        await db
          .insert(knowledgeBank)
          .values({
            id: competency.id,
            source: "bsc-curriculum",
            type: "competency",
            code: competency.code,
            title: competency.name,
            content: this.formatCompetencyContent(competency),
            metadata: {
              yearGroups: competency.yearGroups,
              criteria: competency.criteria.length,
              learningOutcomes: competency.learningOutcomes.length,
              crossCurricularLinks: competency.crossCurricularLinks.length,
              assessmentMethods: competency.assessmentMethods.length,
              source: "bsc-curriculum",
              lastUpdated: new Date().toISOString()
            },
            tags: [
              "bsc",
              "competency",
              ...competency.yearGroups,
              ...competency.crossCurricularLinks.slice(0, 3)
            ],
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
          .onConflictDoUpdate({
            target: knowledgeBank.id,
            set: {
              content: this.formatCompetencyContent(competency),
              metadata: {
                yearGroups: competency.yearGroups,
                criteria: competency.criteria.length,
                learningOutcomes: competency.learningOutcomes.length,
                crossCurricularLinks: competency.crossCurricularLinks.length,
                assessmentMethods: competency.assessmentMethods.length,
                source: "bsc-curriculum",
                lastUpdated: new Date().toISOString()
              },
              updatedAt: Date.now()
            }
          });

        console.log(`✓ Synced competency: ${competency.code} - ${competency.name}`);
      } catch (error) {
        console.error(
          `✗ Failed to sync competency ${competency.code}:`,
          error
        );
      }
    }

    console.log("[BSCCurriculumLoader] Sync complete");
  }

  /**
   * Format competency data for knowledge bank storage
   */
  private formatCompetencyContent(competency: BSCCompetency): string {
    const sections = [
      `# ${competency.name}`,
      `**Code:** ${competency.code}`,
      `**Year Groups:** ${competency.yearGroups.join(", ")}`,
      "",
      `## Description`,
      competency.description,
      ""
    ];

    if (competency.learningOutcomes.length > 0) {
      sections.push("## Learning Outcomes");
      competency.learningOutcomes.forEach((outcome) => {
        sections.push(`- ${outcome}`);
      });
      sections.push("");
    }

    if (competency.criteria.length > 0) {
      sections.push("## Assessment Criteria");
      competency.criteria.forEach((criterion) => {
        sections.push(`### ${criterion.code}`);
        sections.push(criterion.description);

        if (criterion.proficiencyLevels.length > 0) {
          sections.push("**Proficiency Levels:**");
          criterion.proficiencyLevels.forEach((level) => {
            sections.push(`- **Level ${level.level}:** ${level.descriptor}`);
            if (level.indicators.length > 0) {
              level.indicators.forEach((ind) => {
                sections.push(`  - ${ind}`);
              });
            }
          });
        }
        sections.push("");
      });
    }

    if (competency.crossCurricularLinks.length > 0) {
      sections.push("## Cross-Curricular Links");
      competency.crossCurricularLinks.forEach((link) => {
        sections.push(`- ${link}`);
      });
      sections.push("");
    }

    if (competency.assessmentMethods.length > 0) {
      sections.push("## Assessment Methods");
      competency.assessmentMethods.forEach((method) => {
        sections.push(`- ${method}`);
      });
    }

    return sections.join("\n");
  }

  /**
   * Get competencies by year group
   */
  async getCompetenciesByYearGroup(yearGroup: string): Promise<any[]> {
    return db
      .select()
      .from(knowledgeBank)
      .where(
        (kb) =>
          kb.source === "bsc-curriculum" &&
          kb.metadata.yearGroups.includes(yearGroup)
      );
  }

  /**
   * Search competencies by keyword
   */
  async searchCompetencies(keyword: string): Promise<any[]> {
    return db
      .select()
      .from(knowledgeBank)
      .where(
        (kb) =>
          kb.source === "bsc-curriculum" &&
          (kb.title.ilike(`%${keyword}%`) ||
            kb.content.ilike(`%${keyword}%`) ||
            kb.tags.includes(keyword.toLowerCase()))
      );
  }
}

/**
 * Scheduled task to sync BSC curriculum daily
 * Runs at 4 AM as per knowledge bank sync schedule
 */
export async function syncBSCCurriculumScheduled(): Promise<void> {
  const hfApiKey = process.env.HF_API_KEY;
  if (!hfApiKey) {
    console.warn("[BSCCurriculumLoader] HF_API_KEY not set, skipping BSC sync");
    return;
  }

  try {
    const loader = new BSCCurriculumLoader(hfApiKey);
    const datasetId = process.env.BSC_DATASET_ID || "bsc-primary-curriculum";

    console.log(`[BSCCurriculumLoader] Starting scheduled sync for ${datasetId}`);
    const competencies = await loader.loadCompetencies(datasetId);
    await loader.syncToKnowledgeBank(competencies);

    console.log(
      `[BSCCurriculumLoader] Scheduled sync completed successfully`
    );
  } catch (error) {
    console.error("[BSCCurriculumLoader] Scheduled sync failed:", error);
  }
}

/**
 * Initialize BSC curriculum on app startup
 */
export async function initializeBSCCurriculum(): Promise<void> {
  const hfApiKey = process.env.HF_API_KEY;
  if (!hfApiKey) {
    console.info("[BSCCurriculumLoader] HF_API_KEY not configured");
    return;
  }

  try {
    console.log("[BSCCurriculumLoader] Initializing BSC curriculum...");
    const loader = new BSCCurriculumLoader(hfApiKey);
    const datasetId = process.env.BSC_DATASET_ID || "bsc-primary-curriculum";

    const competencies = await loader.loadCompetencies(datasetId);
    if (competencies.length > 0) {
      await loader.syncToKnowledgeBank(competencies);
      console.log(
        `[BSCCurriculumLoader] Loaded ${competencies.length} BSC competencies`
      );
    }
  } catch (error) {
    console.warn("[BSCCurriculumLoader] Failed to initialize BSC curriculum:", error);
    // Non-blocking — continue startup even if BSC load fails
  }
}
