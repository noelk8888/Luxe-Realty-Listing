/**
 * Semantic Search Service using OpenAI embeddings via Supabase Edge Functions
 *
 * This provides intelligent search that understands meaning, not just keywords.
 * Example: "affordable studio near university" will find relevant listings even
 * if they don't contain those exact words.
 *
 * SECURITY: OpenAI API key is now stored securely in Supabase Edge Functions,
 * not exposed in the browser.
 */

import { supabase } from '../lib/supabase';
import type { Listing } from '../types';
import { normalizeDbListing, type DbListing } from './dataService';

/**
 * Check if semantic search is available (always true now with Edge Functions)
 */
export function isSemanticSearchAvailable(): boolean {
  return true; // Edge Functions are always available
}

/**
 * Generate embedding for a search query using Supabase Edge Function
 * This calls our secure Edge Function which keeps the OpenAI API key server-side
 */
async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    console.log(`📞 Calling Edge Function with query: "${query}"`);

    const { data, error } = await supabase.functions.invoke('generate-query-embedding', {
      body: { query }
    });

    if (error) {
      console.error('❌ Edge Function error:', {
        message: error.message,
        details: error,
        query
      });
      return null;
    }

    if (!data || !data.embedding) {
      console.error('❌ Edge Function returned invalid data:', { data, hasEmbedding: !!data?.embedding });
      return null;
    }

    console.log(`✅ Edge Function returned embedding (${data.embedding.length} dimensions)`);
    return data.embedding;
  } catch (error) {
    console.error('❌ Exception calling Edge Function:', error);
    return null;
  }
}

/**
 * Perform semantic search using vector similarity
 *
 * @param query - The search query
 * @param limit - Maximum number of results (default 100)
 * @param similarityThreshold - Minimum similarity score 0-1 (default 0.5 for moderate matches)
 * @returns Array of listings sorted by similarity
 */
export async function semanticSearch(
  query: string,
  limit: number = 100,
  similarityThreshold: number = 0.5
): Promise<Listing[]> {
  console.log(`🔍 Performing semantic search for: "${query}"`);
  console.log(`   Threshold: ${similarityThreshold}, Limit: ${limit}`);

  // Generate embedding for the query using Edge Function
  const queryEmbedding = await generateQueryEmbedding(query);
  if (!queryEmbedding) {
    console.error('Failed to generate query embedding');
    return [];
  }

  console.log(`✓ Generated embedding (${queryEmbedding.length} dimensions)`);

  try {
    // Perform vector similarity search using Supabase RPC function
    const { data, error } = await supabase.rpc('search_listings_by_embedding', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit
    });

    if (error) {
      console.error('Error performing semantic search:', error);
      return [];
    }

    // Normalize the database results to Listing format
    const listings = (data || []).map((row: DbListing) => normalizeDbListing(row));
    console.log(`✨ Semantic search found ${listings.length} results`);

    if (listings.length > 0) {
      console.log(`   Top result: ${listings[0].id} - ${listings[0].summary.substring(0, 60)}...`);
      // Log similarity scores of top 5 results
      console.log(`   Similarity scores:`, data.slice(0, 5).map((row: any) => ({
        id: row['GEO ID'],
        similarity: row.similarity?.toFixed(3)
      })));
    } else {
      console.warn(`   No semantic results found above threshold ${similarityThreshold}`);
    }

    return listings;
  } catch (error) {
    console.error('Semantic search failed:', error);
    return [];
  }
}

/**
 * Hybrid search: Combines keyword search with semantic search
 *
 * This gives the best of both worlds:
 * - Exact matches get high scores
 * - Semantically similar listings also appear
 *
 * @param keywordResults - Results from keyword search
 * @param query - The search query
 * @param limit - Maximum combined results
 */
export async function hybridSearch(
  keywordResults: Listing[],
  query: string,
  limit: number = 100
): Promise<Listing[]> {
  console.log(`\n🔄 Hybrid Search for: "${query}"`);
  console.log(`   Keyword results: ${keywordResults.length}`);

  // Get semantic results
  const semanticResults = await semanticSearch(query, limit);
  console.log(`   Semantic results: ${semanticResults.length}`);

  // Combine and deduplicate (prefer keyword matches)
  const keywordIds = new Set(keywordResults.map(l => l.id));
  const combined = [...keywordResults];

  let addedCount = 0;
  for (const listing of semanticResults) {
    if (!keywordIds.has(listing.id)) {
      combined.push(listing);
      addedCount++;
    }
  }

  console.log(`   📊 Combined: ${combined.length} total (${addedCount} new from semantic)`);
  return combined.slice(0, limit);
}
