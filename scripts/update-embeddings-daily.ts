/**
 * Daily embedding update script
 *
 * Run this after CSV import to update embeddings for:
 * - New listings (STATUS='AVAILABLE', embedding IS NULL)
 * - Changed listings (embedding_needs_update = true)
 *
 * Usage:
 * npx tsx scripts/update-embeddings-daily.ts
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

const EMBEDDING_MODEL = 'text-embedding-3-small';

interface Listing {
  'GEO ID': string;
  'MAIN': string;
  'STATUS': string;
  'CITY': string;
  'BUILDING': string;
  'TYPE': string;
}

function createEmbeddingText(listing: Listing): string {
  const parts = [
    listing['MAIN'] || '',
    listing['CITY'] || '',
    listing['BUILDING'] || '',
    listing['TYPE'] || ''
  ].filter(Boolean);
  return parts.join(' ').substring(0, 8000);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function main() {
  console.log('🔄 Daily embedding update starting...\n');

  // Find listings that need updates (AVAILABLE only)
  const { data: needUpdate, error } = await supabase
    .from('KIU Properties')
    .select('*')
    .eq('STATUS', 'AVAILABLE')
    .or('embedding.is.null,embedding_needs_update.eq.true');

  if (error || !needUpdate) {
    console.error('Error fetching listings:', error);
    return;
  }

  const total = needUpdate.length;
  console.log(`📊 Found ${total} listings to update\n`);

  if (total === 0) {
    console.log('✅ No updates needed!');
    return;
  }

  // Estimate cost
  const estimatedCost = (total * 500 / 1000) * 0.00002;
  console.log(`💰 Estimated cost: $${estimatedCost.toFixed(4)}\n`);

  let processed = 0;
  let errors = 0;

  for (const listing of needUpdate) {
    try {
      const text = createEmbeddingText(listing);
      const embedding = await generateEmbedding(text);

      const { error: updateError } = await supabase
        .from('KIU Properties')
        .update({
          embedding: JSON.stringify(embedding),
          embedding_needs_update: false
        })
        .eq('GEO ID', listing['GEO ID']);

      if (updateError) {
        console.error(`❌ ${listing['GEO ID']}:`, updateError.message);
        errors++;
      } else {
        processed++;
        if (processed % 10 === 0 || processed === total) {
          console.log(`   ✓ ${processed}/${total} (${((processed/total)*100).toFixed(1)}%)`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.error(`❌ ${listing['GEO ID']}:`, error.message);
      errors++;

      if (error.status === 429) {
        console.log('⏸️  Rate limited, waiting 60s...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  }

  console.log(`\n✅ Daily update completed!`);
  console.log(`   Updated: ${processed}`);
  console.log(`   Errors: ${errors}`);
}

main().catch(console.error);
