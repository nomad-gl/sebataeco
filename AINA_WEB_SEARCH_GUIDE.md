# AINA Web Search Integration Guide

## Overview

This guide explains how to integrate web search capabilities into AINA (the AI Teaching Assistant) to provide real-time access to Spanish government curriculum sources, official education guidelines, and current educational resources.

## Why Web Search for AINA?

Currently, AINA operates with static curriculum data. Web search integration will enable:

1. **Access to Latest Curriculum Updates**: Fetch the most recent versions of LOMLOE and Decret 175/2022
2. **Official Government Sources**: Direct access to Spanish Ministry of Education resources
3. **Current Educational Resources**: Links to official teaching materials and guidelines
4. **Real-Time Compliance**: Ensure recommendations align with current regulations
5. **Source Citations**: Display authoritative sources for all curriculum recommendations

## Official Spanish Education Sources

### National Level (LOMLOE)

- **Spanish Ministry of Education**: https://www.educacionyfp.gob.es/
- **LOMLOE Official Text**: https://www.boe.es/ (Boletín Oficial del Estado)
- **Curriculum Guidelines**: https://www.educacionyfp.gob.es/ca/dam/jcr:...

### Catalan Level (Decret 175/2022)

- **Generalitat de Catalunya**: https://www.gencat.cat/
- **Department of Education**: https://educacio.gencat.cat/
- **Decret 175/2022**: https://educacio.gencat.cat/ca/arees-actuacio/curriculum/
- **Official Curriculum Documents**: https://educacio.gencat.cat/ca/arees-actuacio/curriculum/documents-curriculum/

## Web Search API Options

### Option 1: Manus Built-in Search (Recommended)

SEBA already has access to Manus's built-in search capabilities via the Forge API:

```typescript
import { invokeLLM } from "./server/_core/llm";

// Use LLM with web search capability
const response = await invokeLLM({
  messages: [
    {
      role: "user",
      content: "Search for the latest LOMLOE competency frameworks for primary education"
    }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for current information",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" }
          },
          required: ["query"]
        }
      }
    }
  ]
});
```

### Option 2: Google Custom Search API

For more control over search results:

```typescript
const googleCustomSearch = require("google-custom-search");

const customSearch = new googleCustomSearch({
  apiKey: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
  searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID
});

async function searchEducationSources(query: string) {
  const results = await customSearch.search(query);
  return results.filter(result => 
    isOfficialEducationSource(result.link)
  );
}
```

### Option 3: Bing Search API

Alternative with good coverage of educational resources:

```typescript
const bingSearchClient = require("@azure/cognitiveservices-search-websearch");

async function searchBingEducation(query: string) {
  const results = await bingSearchClient.webSearch(query);
  return results.webPages.value;
}
```

## Implementation Architecture

### 1. Create Web Search Module

File: `server/routers/ainaWebSearch.ts`

```typescript
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";

export const ainaWebSearchRouter = router({
  /**
   * Search official curriculum sources
   */
  searchCurriculumSources: protectedProcedure
    .input(z.object({
      query: z.string(),
      region: z.enum(["spain", "catalonia"]).default("catalonia"),
      limit: z.number().default(5)
    }))
    .query(async ({ input }) => {
      // Implementation here
    }),

  /**
   * Get LOMLOE competency sources
   */
  getLomloeResources: protectedProcedure
    .input(z.object({
      competencyId: z.string(),
      yearGroup: z.string().optional()
    }))
    .query(async ({ input }) => {
      // Implementation here
    }),

  /**
   * Get Decret 175/2022 resources
   */
  getDecretResources: protectedProcedure
    .input(z.object({
      competencyId: z.string(),
      yearGroup: z.string().optional()
    }))
    .query(async ({ input }) => {
      // Implementation here
    }),

  /**
   * Cache search results
   */
  getCachedResults: protectedProcedure
    .input(z.object({
      query: z.string(),
      region: z.enum(["spain", "catalonia"])
    }))
    .query(async ({ input }) => {
      // Implementation here
    })
});
```

### 2. Whitelist Official Sources

```typescript
const OFFICIAL_EDUCATION_SOURCES = [
  // Spanish Ministry
  "educacionyfp.gob.es",
  "boe.es",
  "mpt.gob.es",
  
  // Catalan Government
  "gencat.cat",
  "educacio.gencat.cat",
  
  // European Education Networks
  "eurydice.eacea.ec.europa.eu",
  "european-agency.org",
  
  // Academic & Research
  "uoc.edu",
  "uab.cat",
  "ub.edu",
  "uam.es"
];

function isOfficialEducationSource(url: string): boolean {
  return OFFICIAL_EDUCATION_SOURCES.some(domain => 
    url.includes(domain)
  );
}
```

### 3. Integrate with AINA Chat

File: `server/routers/aina.ts`

```typescript
async function ainaChat(input: AinaChatInput, ctx: Context) {
  // ... existing code ...

  // Check if query needs curriculum sources
  if (needsCurriculumSearch(input.message)) {
    const searchResults = await ctx.trpc.ainaWebSearch
      .searchCurriculumSources({
        query: input.message,
        region: ctx.user.school?.region || "catalonia"
      });
    
    // Add search results to LLM context
    const enhancedContext = {
      ...context,
      curriculumSources: searchResults,
      sourcesCitation: formatSourcesCitation(searchResults)
    };
    
    // Generate response with source citations
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are AINA, a teaching assistant. Use the provided curriculum sources to answer questions. Always cite your sources.`
        },
        {
          role: "user",
          content: input.message
        }
      ],
      context: enhancedContext
    });
    
    return {
      response: response.text,
      sources: searchResults,
      citations: enhancedContext.sourcesCitation
    };
  }

  // ... rest of implementation ...
}
```

### 4. Display Source Citations in UI

File: `client/src/components/AinaChatBox.tsx`

```tsx
interface Message {
  content: string;
  sources?: Array<{
    title: string;
    url: string;
    domain: string;
    relevance: number;
  }>;
  citations?: string;
}

function renderMessageWithSources(message: Message) {
  return (
    <div className="space-y-3">
      <div className="prose prose-sm">{message.content}</div>
      
      {message.sources && message.sources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            📚 Sources
          </p>
          <ul className="space-y-2">
            {message.sources.map((source, idx) => (
              <li key={idx} className="text-xs">
                <a 
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {source.title}
                </a>
                <span className="text-gray-500 ml-2">
                  ({source.domain})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Search Query Examples

### LOMLOE Searches

```
"LOMLOE primary education competencies"
"LOMLOE mathematical reasoning competency"
"LOMLOE digital competency framework"
"LOMLOE assessment criteria year 3"
```

### Decret 175/2022 Searches

```
"Decret 175/2022 Catalonia curriculum"
"Decret 175/2022 Catalan language competency"
"Decret 175/2022 primary education standards"
"Decret 175/2022 assessment methods"
```

### Material Searches

```
"official LOMLOE teaching materials"
"Spanish Ministry of Education resources"
"Catalan education department lesson plans"
```

## Caching Strategy

To avoid excessive API calls and improve performance:

```typescript
interface CachedSearchResult {
  query: string;
  region: "spain" | "catalonia";
  results: SearchResult[];
  timestamp: number;
  expiresAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const searchCache = new Map<string, CachedSearchResult>();

async function getCachedOrFreshResults(
  query: string,
  region: "spain" | "catalonia"
): Promise<SearchResult[]> {
  const cacheKey = `${query}:${region}`;
  const cached = searchCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }
  
  const results = await performWebSearch(query, region);
  
  searchCache.set(cacheKey, {
    query,
    region,
    results,
    timestamp: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS
  });
  
  return results;
}
```

## Implementation Checklist

- [ ] Choose web search API (Manus built-in recommended)
- [ ] Create `server/routers/ainaWebSearch.ts`
- [ ] Implement official source whitelisting
- [ ] Integrate with AINA chat router
- [ ] Add source citation display to UI
- [ ] Implement search result caching
- [ ] Add search query logging for analytics
- [ ] Test with LOMLOE queries
- [ ] Test with Decret 175/2022 queries
- [ ] Verify source authenticity
- [ ] Add rate limiting for search API
- [ ] Create search result analytics dashboard

## Environment Variables

```bash
# If using Google Custom Search
GOOGLE_CUSTOM_SEARCH_API_KEY=xxx
GOOGLE_SEARCH_ENGINE_ID=xxx

# If using Bing Search
BING_SEARCH_API_KEY=xxx

# Search configuration
SEARCH_CACHE_TTL_HOURS=24
SEARCH_RESULT_LIMIT=5
SEARCH_OFFICIAL_SOURCES_ONLY=true
```

## Testing

### Unit Tests

```typescript
describe("ainaWebSearch", () => {
  it("should return official sources only", async () => {
    const results = await searchCurriculumSources({
      query: "LOMLOE competencies",
      region: "catalonia"
    });
    
    results.forEach(result => {
      expect(isOfficialEducationSource(result.url)).toBe(true);
    });
  });

  it("should cache results", async () => {
    const query = "test query";
    const result1 = await getCachedResults(query, "catalonia");
    const result2 = await getCachedResults(query, "catalonia");
    
    expect(result1).toEqual(result2);
  });
});
```

## Next Steps

1. **Choose API Provider**: Recommend using Manus built-in search
2. **Implement Module**: Create `ainaWebSearch.ts` router
3. **Test Searches**: Verify official sources are returned
4. **Integrate with Chat**: Update AINA chat to use web search
5. **Add UI Display**: Show source citations in chat interface
6. **Monitor Performance**: Track search API usage and cache hit rates

## Support

For questions:
1. Check the web search API documentation
2. Review official Spanish education sources
3. Test search queries manually
4. Check cache performance metrics
