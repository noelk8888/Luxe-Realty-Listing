/**
 * Generate embeddings for available listings using OpenAI API
 *
 * Usage:
 * 1. Set OPENAI_API_KEY in .env.local
 * 2. Run: npx tsx scripts/generate-embeddings.ts
 *
 * This script:
 * - Only processes listings with STATUS='AVAILABLE'
 * - Skips listings that already have embeddings
 * - Processes in batches to avoid rate limits
 * - Shows cost estimates and progress
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  console.error('Need: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!openaiKey) {
  console.error('Missing OPENAI_API_KEY in .env.local');
  console.error('Get your API key from: https://platform.openai.com/api-keys');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiKey });

// Configuration
const BATCH_SIZE = 50; // Process 50 listings at a time
const EMBEDDING_MODEL = 'text-embedding-3-small'; // Cost: $0.00002 per 1K tokens
const MAX_TOKENS_PER_LISTING = 500; // Rough estimate

interface Listing {
  'GEO ID': string;
  'MAIN': string;
  'STATUS': string;
  'CITY': string;
  'BUILDING': string;
  'TYPE': string;
}

/**
 * Create text to embed from listing data
 * Fields are repeated to increase their weight in semantic similarity
 */
function createEmbeddingText(listing: any): string {
  const building = listing['BUILDING'] || '';
  const area = listing['AREA'] || '';
  const barangay = listing['BARANGAY'] || '';
  const city = listing['CITY'] || '';
  const price = listing['Extracted Sale Price'] || 0;
  const lotArea = listing['LOT AREA'] || 0;
  const floorArea = listing['FLOOR AREA'] || 0;
  const type = listing['TYPE'] || '';

  // Weight fields by importance (repetition increases semantic weight)
  const parts = [
    // 1. Building - Highest priority (5x weight)
    building, building, building, building, building,

    // 2. Area/Barangay - Very high priority (4x weight)
    area, area, area, area,
    barangay, barangay, barangay, barangay,

    // 3. City - High priority (3x weight)
    city, city, city,

    // 4. Price - Medium-high priority (2x weight)
    price > 0 ? `price ${price} pesos` : '',
    price > 0 ? `${price}` : '',

    // 5. Floor/Lot Area - Medium priority (2x weight)
    lotArea > 0 ? `lot area ${lotArea} sqm` : '',
    floorArea > 0 ? `floor area ${floorArea} sqm` : '',

    // 6. Property type - Low priority (1x weight)
    type,

    // 7. Description - Context only
    listing['MAIN'] || ''
  ].filter(Boolean);

  return parts.join(' ').substring(0, 8000); // OpenAI limit
}

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting embedding generation...\n');

  // Step 1: Count listings that need embeddings
  const { count, error: countError } = await supabase
    .from('KIU Properties')
    .select('*', { count: 'exact', head: true })
    .eq('STATUS', 'Available')
    .is('embedding', null);

  if (countError) {
    console.error('Error counting listings:', countError);
    return;
  }

  const totalToProcess = count || 0;
  console.log(`📊 Found ${totalToProcess} available listings without embeddings\n`);

  if (totalToProcess === 0) {
    console.log('✅ All available listings already have embeddings!');
    return;
  }

  // Calculate cost estimate
  const estimatedTokens = totalToProcess * MAX_TOKENS_PER_LISTING;
  const estimatedCost = (estimatedTokens / 1000) * 0.00002;
  console.log(`💰 Estimated cost: $${estimatedCost.toFixed(2)}`);
  console.log(`⏱️  Processing in batches of ${BATCH_SIZE}...\n`);

  // Step 2: Process in batches
  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  while (processed < totalToProcess) {
    // Fetch batch
    const { data: listings, error: fetchError } = await supabase
      .from('KIU Properties')
      .select('*')
      .eq('STATUS', 'Available')
      .is('embedding', null)
      .limit(BATCH_SIZE);

    if (fetchError || !listings || listings.length === 0) {
      console.error('Error fetching batch:', fetchError);
      break;
    }

    console.log(`📦 Processing batch ${Math.floor(processed / BATCH_SIZE) + 1}...`);

    // Process each listing in the batch
    for (const listing of listings) {
      try {
        const text = createEmbeddingText(listing);
        const embedding = await generateEmbedding(text);

        // Update database
        const { error: updateError } = await supabase
          .from('KIU Properties')
          .update({
            embedding: embedding, // Pass array directly, not stringified
            embedding_needs_update: false
          })
          .eq('GEO ID', listing['GEO ID']);

        if (updateError) {
          console.error(`❌ Error updating ${listing['GEO ID']}:`, updateError.message);
          errors++;
        } else {
          processed++;

          // Progress update every 10 listings
          if (processed % 10 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = processed / elapsed;
            const remaining = (totalToProcess - processed) / rate;
            console.log(
              `   ✓ ${processed}/${totalToProcess} (${((processed/totalToProcess)*100).toFixed(1)}%) - ` +
              `ETA: ${Math.round(remaining)}s`
            );
          }
        }

        // Rate limiting: Wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`❌ Error processing ${listing['GEO ID']}:`, error.message);
        errors++;

        // If rate limited, wait longer
        if (error.status === 429) {
          console.log('⏸️  Rate limited, waiting 60s...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }
  }

  // Summary
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Completed!`);
  console.log(`   Processed: ${processed} listings`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Time: ${Math.round(totalTime)}s`);
  console.log(`   Rate: ${(processed / totalTime).toFixed(1)} listings/second`);
}

main().catch(console.error);
