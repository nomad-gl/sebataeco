/**
 * BSC Curriculum Setup Script
 *
 * This script helps set up the BSC (Catalan Competency-Based Curriculum) integration
 * by loading competencies from a Hugging Face dataset and syncing them to the knowledge bank.
 *
 * Prerequisites:
 *   1. Set HF_API_KEY environment variable with your Hugging Face API token
 *   2. Have access to a BSC curriculum dataset on Hugging Face
 *
 * Usage:
 *   # With default dataset (bsc-primary-curriculum)
 *   pnpm ts-node scripts/setup-bsc-curriculum.ts
 *
 *   # With custom dataset
 *   BSC_DATASET_ID=your-dataset-id pnpm ts-node scripts/setup-bsc-curriculum.ts
 *
 * Example:
 *   HF_API_KEY=hf_xxxxx BSC_DATASET_ID=my-org/bsc-curriculum pnpm ts-node scripts/setup-bsc-curriculum.ts
 */

import { BSCCurriculumLoader } from "../server/bscCurriculumLoader";

async function setupBSCCurriculum() {
  console.log("🎓 SEBA BSC Curriculum Setup\n");

  // Check for HF_API_KEY
  const hfApiKey = process.env.HF_API_KEY;
  if (!hfApiKey) {
    console.error("❌ Error: HF_API_KEY environment variable not set\n");
    console.log("📋 Setup Instructions:");
    console.log("1. Get your Hugging Face API token from https://huggingface.co/settings/tokens");
    console.log("2. Set the environment variable:");
    console.log("   export HF_API_KEY=hf_your_token_here");
    console.log("3. Run this script again\n");
    process.exit(1);
  }

  const datasetId = process.env.BSC_DATASET_ID || "bsc-primary-curriculum";

  console.log("📊 Configuration:");
  console.log(`   Dataset ID: ${datasetId}`);
  console.log(`   API Key: ${hfApiKey.substring(0, 10)}...`);
  console.log(`   Timestamp: ${new Date().toISOString()}\n`);

  try {
    console.log("🔄 Initializing BSC Curriculum Loader...");
    const loader = new BSCCurriculumLoader(hfApiKey);

    console.log(`📥 Fetching competencies from Hugging Face dataset: ${datasetId}`);
    const competencies = await loader.loadCompetencies(datasetId);

    if (competencies.length === 0) {
      console.error(`❌ No competencies found in dataset: ${datasetId}`);
      console.log("\n💡 Troubleshooting:");
      console.log("1. Verify the dataset exists on Hugging Face");
      console.log("2. Check that your API token has access to the dataset");
      console.log("3. Ensure the dataset is in the correct format");
      process.exit(1);
    }

    console.log(`✅ Loaded ${competencies.length} competencies\n`);

    console.log("📝 Sample Competencies:");
    competencies.slice(0, 3).forEach((comp, idx) => {
      console.log(`   ${idx + 1}. ${comp.code} - ${comp.name}`);
      console.log(`      Year Groups: ${comp.yearGroups.join(", ")}`);
      console.log(`      Criteria: ${comp.criteria.length}`);
    });
    if (competencies.length > 3) {
      console.log(`   ... and ${competencies.length - 3} more\n`);
    }

    console.log("💾 Syncing to knowledge bank...");
    await loader.syncToKnowledgeBank(competencies);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ BSC Curriculum Setup Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("📋 Next Steps:");
    console.log("1. Refresh the AINA chat interface");
    console.log("2. Ask AINA questions about BSC competencies");
    console.log("3. AINA will now use BSC data for enhanced context");
    console.log("4. Check the security dashboard for activity logs\n");

    console.log("🔍 Verify Integration:");
    console.log("Run: pnpm test bscCurriculum");
    console.log("Or call: trpc.bscCurriculum.getStats.query()\n");

    console.log("📅 Scheduled Sync:");
    console.log("BSC curriculum will automatically refresh daily at 4 AM UTC\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Setup failed:", error);
    console.log("\n💡 Troubleshooting:");
    console.log("1. Check your Hugging Face API key is valid");
    console.log("2. Verify the dataset ID is correct");
    console.log("3. Ensure your HF account has access to the dataset");
    console.log("4. Check your internet connection\n");
    process.exit(1);
  }
}

setupBSCCurriculum();
