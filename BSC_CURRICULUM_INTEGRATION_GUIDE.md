# BSC Curriculum Integration Guide

## Overview

This guide explains how to integrate BSC (Barcelona Supercomputing Center) curriculum data from Hugging Face into SEBA AI Studio. This will enable AINA to provide curriculum-aligned content generation using BSC-specific competency frameworks.

## What is BSC Curriculum Data?

The Barcelona Supercomputing Center maintains educational datasets that define competencies, learning objectives, and curriculum standards. These can be integrated into SEBA to:

- Provide more granular competency tracking
- Generate lesson plans aligned with specific BSC standards
- Create assessments that map to BSC competency frameworks
- Enhance AINA's curriculum context awareness

## Prerequisites

1. **Hugging Face Account**: You must have a Hugging Face account with access to the BSC dataset
2. **HF API Key**: Generate an API key from your Hugging Face account settings
3. **Dataset Identifier**: Know the exact dataset identifier on Hugging Face (e.g., `HPAI-BSC/dataset-name`)

## Step 1: Identify Your BSC Dataset

### Finding BSC Datasets on Hugging Face

1. Go to https://huggingface.co/datasets
2. Search for "BSC" or "Barcelona Supercomputing"
3. Look for datasets that match your curriculum needs
4. Common BSC datasets include:
   - `HPAI-BSC/medical-specialities` (medical education)
   - `HPAI-BSC/CareQA` (healthcare QA)
   - Custom BSC curriculum datasets

### Documenting Your Dataset

Once you identify your dataset, note:
- **Dataset ID**: e.g., `HPAI-BSC/your-dataset`
- **Dataset Type**: (competencies, learning objectives, assessment items, etc.)
- **Data Format**: JSON, CSV, or other format
- **Fields**: What fields does the dataset contain?
- **Year Groups**: Which year groups does it cover?

## Step 2: Add Hugging Face API Key

### Via SEBA Dashboard

1. Open the SEBA dashboard for your project
2. Go to **Settings** → **Secrets**
3. Click **Add Secret** or **Add Environment Variable**
4. Set the following:
   - **Key**: `HF_API_KEY`
   - **Value**: Your Hugging Face API token
5. Click **Save**

### Via Command Line (if you have direct access)

```bash
# Generate HF token at https://huggingface.co/settings/tokens
# Then set it in your environment
export HF_API_KEY="hf_xxxxxxxxxxxxxx"
```

## Step 3: Create BSC Data Integration Module

A new server module will be created at `server/routers/bscCurriculum.ts` with the following procedures:

### Procedures to Implement

#### 1. `bscCurriculum.loadDataset`
- Fetches BSC dataset from Hugging Face
- Validates data structure
- Returns dataset metadata

#### 2. `bscCurriculum.listCompetencies`
- Lists all competencies in the BSC dataset
- Filters by year group if specified
- Returns competency tree structure

#### 3. `bscCurriculum.getCompetencyDetails`
- Returns detailed information for a specific competency
- Includes learning objectives, assessment criteria, etc.

#### 4. `bscCurriculum.syncToKnowledgeBank`
- Transforms BSC data into the internal knowledge bank format
- Maps competencies to year groups
- Stores in the database for fast access

## Step 4: Transform BSC Data

The BSC data will be transformed into SEBA's internal format:

```typescript
interface KnowledgeBankEntry {
  competencyId: string;
  competencyName: string;
  yearGroup: string;
  learningObjectives: string[];
  assessmentCriteria: string[];
  resources: string[];
  relatedCompetencies: string[];
}
```

## Step 5: Update AI Generation Procedures

The following procedures will be updated to use BSC data:

### 1. `lomloe.chat` (AINA Chat)
- Enhanced context with BSC competencies
- Better curriculum alignment in responses
- More specific learning objective suggestions

### 2. `materials.create` (Material Generation)
- Generate materials aligned with BSC competencies
- Include BSC assessment criteria
- Reference BSC learning objectives

### 3. `aiGenerateLessonPlan` (Lesson Planning)
- Use BSC competency framework for planning
- Map lessons to BSC learning objectives
- Include BSC assessment strategies

## Step 6: Set Up Scheduled Refresh

A nightly scheduled task will:

1. Connect to Hugging Face API
2. Check for dataset updates
3. Fetch new/modified competencies
4. Update the knowledge bank
5. Log sync status

### Configuration

```typescript
// In server/scheduledTasks/bscSync.ts
const BSC_SYNC_SCHEDULE = "0 2 * * *"; // 2 AM daily
const HF_DATASET_ID = process.env.BSC_HF_DATASET_ID;
const HF_API_KEY = process.env.HF_API_KEY;
```

## Implementation Checklist

- [ ] User provides BSC dataset identifier
- [ ] HF_API_KEY added to secrets
- [ ] Create `server/routers/bscCurriculum.ts`
- [ ] Implement dataset loading and validation
- [ ] Create knowledge bank transformation logic
- [ ] Update `lomloe.chat` to use BSC data
- [ ] Update `materials.create` to use BSC data
- [ ] Update `aiGenerateLessonPlan` to use BSC data
- [ ] Create scheduled sync task
- [ ] Test end-to-end curriculum alignment
- [ ] Document BSC competency mappings

## API Integration Example

```typescript
import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HF_API_KEY);

async function loadBSCDataset(datasetId: string) {
  try {
    // Fetch dataset from Hugging Face
    const response = await fetch(
      `https://huggingface.co/api/datasets/${datasetId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to load dataset: ${response.statusText}`);
    }
    
    const dataset = await response.json();
    return dataset;
  } catch (error) {
    console.error("Error loading BSC dataset:", error);
    throw error;
  }
}
```

## Troubleshooting

### Issue: "Invalid HF_API_KEY"
- Verify your token at https://huggingface.co/settings/tokens
- Ensure the token has "read" access to datasets
- Check that the token hasn't expired

### Issue: "Dataset not found"
- Verify the dataset ID is correct
- Ensure you have access to the dataset
- Check that the dataset is public or you have permission

### Issue: "Data format incompatible"
- Verify the dataset structure matches expected format
- Check field names and data types
- May need custom transformation logic

## Next Steps

1. **Provide Dataset Information**: Share the BSC dataset identifier with the development team
2. **Add API Key**: Add your HF_API_KEY to the project secrets
3. **Review Implementation**: Once implemented, test curriculum alignment
4. **Validate Results**: Verify that AINA uses BSC competencies correctly

## Support

For questions or issues:
1. Check the Hugging Face dataset documentation
2. Review the implementation in `server/routers/bscCurriculum.ts`
3. Check the scheduled task logs for sync errors
4. Contact support with dataset details
