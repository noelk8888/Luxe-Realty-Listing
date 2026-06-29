/**
 * IndexedDB Cache Service for Listings
 *
 * Provides fast local storage with:
 * - 30-minute cache expiry
 * - Version control for cache invalidation
 * - Compression support (future)
 * - Progressive loading support
 */

import Dexie from 'dexie';
import type { Listing } from '../types';

interface CacheMetadata {
  key: string;
  timestamp: number;
  version: string;
  count: number;
}

interface CachedListing extends Listing {
  _cacheIndex?: number; // For ordering
}

class ListingsCacheDB extends Dexie {
  listings!: Dexie.Table<CachedListing, string>;
  metadata!: Dexie.Table<CacheMetadata, string>;

  constructor() {
    super('ListingsCache');

    this.version(1).stores({
      listings: 'id, _cacheIndex', // Index by ID and cache order
      metadata: 'key'
    });
  }
}

const db = new ListingsCacheDB();

// Cache configuration
const CACHE_VERSION = '1.0'; // Increment to force cache clear
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const METADATA_KEY = 'listings_cache';

/**
 * Check if cache is valid (not expired and correct version)
 */
export async function isCacheValid(): Promise<boolean> {
  try {
    // Timeout guard: metadata read can hang if IndexedDB is stuck
    const timeout = new Promise<boolean>((resolve) =>
      setTimeout(() => {
        console.warn('⏱️ Cache validity check timed out after 3s');
        resolve(false);
      }, 3000)
    );

    const check = (async (): Promise<boolean> => {
      const metadata = await db.metadata.get(METADATA_KEY);

      if (!metadata) {
        return false;
      }

      // Check version
      if (metadata.version !== CACHE_VERSION) {
        console.log('📦 Cache version mismatch, invalidating');
        await clearCache();
        return false;
      }

      // Check if cache has data (reject empty caches)
      if (!metadata.count || metadata.count === 0) {
        console.log('🚫 Cache is empty (0 listings), invalidating');
        await clearCache();
        return false;
      }

      // Check expiry
      const age = Date.now() - metadata.timestamp;
      if (age > CACHE_EXPIRY_MS) {
        console.log('⏰ Cache expired, invalidating');
        await clearCache();
        return false;
      }

      console.log(`✅ Cache is valid (age: ${Math.round(age / 1000)}s, count: ${metadata.count})`);
      return true;
    })();

    return await Promise.race([check, timeout]);
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
}

/**
 * Get cached listings (with timeout to prevent IndexedDB hangs)
 */
export async function getCachedListings(): Promise<Listing[] | null> {
  try {
    // Timeout guard: IndexedDB can hang indefinitely on some browsers/deployments
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('⏱️ IndexedDB cache read timed out after 5s, skipping cache');
        resolve(null);
      }, 5000)
    );

    const cacheRead = (async (): Promise<Listing[] | null> => {
      const isValid = await isCacheValid();
      if (!isValid) {
        return null;
      }

      console.log('📖 Reading listings from IndexedDB cache');
      const startTime = performance.now();

      // Get all listings ordered by cache index
      const listings = await db.listings.orderBy('_cacheIndex').toArray();

      const duration = Math.round(performance.now() - startTime);
      console.log(`✅ Loaded ${listings.length} listings from cache in ${duration}ms`);

      return listings;
    })();

    return await Promise.race([cacheRead, timeout]);
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
}

/**
 * Save listings to cache
 */
export async function saveListingsToCache(listings: Listing[]): Promise<void> {
  try {
    console.log(`💾 Saving ${listings.length} listings to IndexedDB cache`);
    const startTime = performance.now();

    // Add cache index for ordering
    const indexedListings = listings.map((listing, index) => ({
      ...listing,
      _cacheIndex: index
    }));

    // Clear old data and save new data in a transaction
    await db.transaction('rw', db.listings, db.metadata, async () => {
      await db.listings.clear();
      await db.listings.bulkAdd(indexedListings);

      await db.metadata.put({
        key: METADATA_KEY,
        timestamp: Date.now(),
        version: CACHE_VERSION,
        count: listings.length
      });
    });

    const duration = Math.round(performance.now() - startTime);
    console.log(`✅ Cached ${listings.length} listings in ${duration}ms`);
  } catch (error) {
    console.error('Error saving to cache:', error);
    throw error;
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  try {
    // Timeout guard: IndexedDB can hang on iOS Safari
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cache clear timed out')), 3000)
    );
    await Promise.race([
      Promise.all([db.listings.clear(), db.metadata.clear()]),
      timeout,
    ]);
    console.log('🗑️ Cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  isValid: boolean;
  count: number;
  ageSeconds: number;
  version: string;
} | null> {
  try {
    const metadata = await db.metadata.get(METADATA_KEY);

    if (!metadata) {
      return null;
    }

    const age = Date.now() - metadata.timestamp;
    const isValid = metadata.version === CACHE_VERSION && age < CACHE_EXPIRY_MS;

    return {
      isValid,
      count: metadata.count,
      ageSeconds: Math.round(age / 1000),
      version: metadata.version
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
}
