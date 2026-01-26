/**
 * Semantic Search Service using OpenAI embeddings and Supabase pgvector
 *
 * This provides intelligent search that understands meaning, not just keywords.
 * Example: "affordable studio near university" will find relevant listings even
 * if they don't contain those exact words.
 */

import { supabase } from '../lib/supabase';
import type { Listing } from '../types';
import OpenAI from 'openai';

// Initialize OpenAI (only if API key is available)
let openai: OpenAI | null = null;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // Note: Better to use edge functions in production
  });
}

/**
 * Check if semantic search is available
 */
export function isSemanticSearchAvailable(): boolean {
  return openai !== null;
}

/**
 * Generate embedding for a search query
 */
async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  if (!openai) return null;

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Perform semantic search using vector similarity
 *
 * @param query - The search query
 * @param limit - Maximum number of results (default 100)
 * @param similarityThreshold - Minimum similarity score 0-1 (default 0.7)
 * @returns Array of listings sorted by similarity
 */
export async function semanticSearch(
  query: string,
  limit: number = 100,
  similarityThreshold: number = 0.7
): Promise<Listing[]> {
  if (!openai) {
    console.warn('Semantic search not available: Missing VITE_OPENAI_API_KEY');
    return [];
  }

  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);
  if (!queryEmbedding) {
    console.error('Failed to generate query embedding');
    return [];
  }

  try {
    // Perform vector similarity search using Supabase RPC function
    // We'll need to create this function in Supabase
    const { data, error } = await supabase.rpc('search_listings_by_embedding', {
      query_embedding: queryEmbedding,
      match_threshold: similarityThreshold,
      match_count: limit
    });

    if (error) {
      console.error('Error performing semantic search:', error);
      return [];
    }

    return data || [];
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
  if (!isSemanticSearchAvailable()) {
    // Fall back to keyword search only
    return keywordResults;
  }

  // Get semantic results
  const semanticResults = await semanticSearch(query, limit);

  // Combine and deduplicate (prefer keyword matches)
  const keywordIds = new Set(keywordResults.map(l => l.id));
  const combined = [...keywordResults];

  for (const listing of semanticResults) {
    if (!keywordIds.has(listing.id)) {
      combined.push(listing);
    }
  }

  return combined.slice(0, limit);
}
