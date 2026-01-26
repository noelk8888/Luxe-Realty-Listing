# Semantic Search Setup Guide

This guide will help you set up AI-powered semantic search for your property listings using OpenAI embeddings and Supabase pgvector.

## What is Semantic Search?

Semantic search understands the **meaning** of queries, not just keywords:
- "affordable studio near campus" → finds budget-friendly units near universities
- "luxury penthouse with view" → finds high-end properties even without exact wording
- Works with synonyms, context, and related concepts

## Cost Estimate

**One-time setup:** ~$3-5
- Generate embeddings for ~7,876 available listings
- OpenAI cost: $0.00002 per 1K tokens
- Estimated: ~$3.15 total

**Ongoing (daily updates):** ~$0.02-0.03/day
- Only new or changed AVAILABLE listings
- ~50 new listings/day × $0.0004 = $0.02

**Monthly:** ~$0.60-0.90

## Prerequisites

1. **OpenAI API Key**
   - Sign up at https://platform.openai.com/
   - Create an API key at https://platform.openai.com/api-keys
   - Add $5-10 credit to your account

2. **Supabase Project** (you already have this)

## Setup Steps

### Step 1: Add OpenAI API Key to Environment

Add to your `.env.local` file:

```bash
# Existing variables
VITE_SUPABASE_URL=https://onjatpjbmtjaalnayaqf.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# NEW: Add this for embeddings
OPENAI_API_KEY=sk-proj-...your-key-here...
VITE_OPENAI_API_KEY=sk-proj-...your-key-here...
```

**Note:**
- `OPENAI_API_KEY` is for Node.js scripts (embedding generation)
- `VITE_OPENAI_API_KEY` is for the browser (optional, only if you want client-side semantic search)

### Step 2: Enable pgvector in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the entire contents of `supabase_enable_vector.sql`
5. Click **Run**

This will:
- Enable the pgvector extension
- Add `embedding` column to your table
- Create search index for fast queries
- Create the RPC function for semantic search

### Step 3: Generate Initial Embeddings

Run the embedding generation script:

```bash
npx tsx scripts/generate-embeddings.ts
```

This will:
- Find all AVAILABLE listings without embeddings
- Show cost estimate before starting
- Generate embeddings using OpenAI
- Save embeddings to Supabase
- Show progress and ETA

**Expected output:**
```
🚀 Starting embedding generation...

📊 Found 7876 available listings without embeddings

💰 Estimated cost: $3.15
⏱️  Processing in batches of 50...

📦 Processing batch 1...
   ✓ 10/7876 (0.1%) - ETA: 1200s
   ✓ 20/7876 (0.3%) - ETA: 1150s
   ...

✅ Completed!
   Processed: 7876 listings
   Errors: 0
   Time: 1247s
   Rate: 6.3 listings/second
```

### Step 4: Set Up Daily Updates (Optional but Recommended)

After you import your daily CSV updates to Supabase, run:

```bash
npx tsx scripts/update-embeddings-daily.ts
```

This will:
- Only process new or changed AVAILABLE listings
- Much faster and cheaper than full regeneration
- Typical cost: $0.02-0.03 per day

You can automate this with a cron job or GitHub Actions.

## How to Use Semantic Search

### Option 1: Automatic (Recommended)

The app will automatically use semantic search when available. No code changes needed!

### Option 2: Manual Integration

Update your search component to use hybrid search:

```typescript
import { hybridSearch } from '../services/semanticSearch';
import { searchListings } from '../services/searchEngine';

// In your search handler:
const keywordResults = searchListings(allListings, query);
const finalResults = await hybridSearch(keywordResults, query);
```

## Testing Semantic Search

Try these example queries:

1. **"affordable studio near university"**
   - Should find budget-friendly units near UP, Ateneo, etc.
   - Even without exact words "affordable" or "studio"

2. **"luxury penthouse with city view"**
   - Finds high-end properties
   - Understands "luxury" = expensive, upscale

3. **"family home with garden"**
   - Finds houses (not condos)
   - Prioritizes properties with outdoor space

4. **"investment property with rental income"**
   - Finds properties marketed for investors
   - Understands context of "investment" and "rental"

## Monitoring Costs

Check your OpenAI usage:
1. Go to https://platform.openai.com/usage
2. View API usage and costs
3. Set up billing alerts if desired

## Troubleshooting

### "Missing OPENAI_API_KEY"
- Make sure you added it to `.env.local`
- Restart your dev server after adding env variables

### "Error 429: Rate limit exceeded"
- OpenAI free tier has rate limits
- Script will automatically wait and retry
- Consider upgrading to paid tier ($5 minimum)

### Embeddings not updating
- Make sure you ran the SQL script in Supabase
- Check that the trigger is created (marks changed listings)
- Verify listings have STATUS='AVAILABLE'

### Search not using embeddings
- Check browser console for errors
- Verify `VITE_OPENAI_API_KEY` is set (if using client-side search)
- Confirm embeddings were generated (check Supabase table)

## Architecture

```
┌─────────────┐
│ User Query  │
└──────┬──────┘
       │
       ├──────────────────┬─────────────────┐
       │                  │                 │
       ▼                  ▼                 ▼
┌──────────────┐   ┌─────────────┐   ┌──────────────┐
│   Keyword    │   │  Semantic   │   │  Proximity   │
│   Search     │   │   Search    │   │   Search     │
└──────┬───────┘   └──────┬──────┘   └──────┬───────┘
       │                  │                 │
       └──────────────────┼─────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Hybrid Merge  │
                  │ (Deduplicate) │
                  └───────┬───────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Final Results │
                  └───────────────┘
```

## Next Steps

1. ✅ Complete this setup
2. Test with various queries
3. Monitor costs and performance
4. Optionally: Automate daily updates
5. Optionally: Add semantic search UI indicator

## Questions?

- Check the scripts for detailed comments
- Review OpenAI documentation: https://platform.openai.com/docs/guides/embeddings
- Check Supabase pgvector guide: https://supabase.com/docs/guides/ai/vector-columns
