import { supabase } from '../lib/supabase';
import { PropertyType } from '../types';
import type { Listing } from '../types';
import {
    getCachedListings,
    saveListingsToCache,
    clearCache
} from './listingsCache';

// Database row type from Supabase - matches "KIU Properties" table
export interface DbListing {
    'GEO ID': string | null;
    'FB LINK': string | null;
    'MAIN': string | null;
    'PHOTO': string | null;
    'MAP LINK': string | null;
    'REGION': string | null;
    'PROVINCE': string | null;
    'CITY': string | null;
    'BARANGAY': string | null;
    'AREA': string | null;
    'BUILDING': string | null;
    'RESIDENTIAL': string | null;
    'COMMERCIAL': string | null;
    'INDUSTRIAL': string | null;
    'AGRICULTURAL': string | null;
    'LOT AREA': number | null;
    'FLOOR AREA': number | null;
    'STATUS': string | null;
    'TYPE': string | null;
    'Extracted Sale Price': number | null;
    'Sale Price/Sqm': number | null;
    'Extracted Lease Price': number | null;
    'Lease Price/Sqm': number | null;
    'COMMENTS': string | null;
    'WITH INCOME': string | null;
    'DIRECT OR BROKER': string | null;
    'NAME': string | null;
    'AWAY': string | null;
    'DATE RECV': string | null;
    'DATE UPDATED': string | null;
    'LISTING OWNERSHIP': string | null;
    'LAT LONG': string | null;
    'LAT': string | null;
    'LONG': string | null;
    'SPONSOR START': string | null;
    'SPONSOR END': string | null;
    'bedrooms': string | number | null; // Database stores as TEXT, but may be parsed as number
    'toilet': string | null;
    'garage': string | null;
    'amenities': string | null;
    'corner': string | null;
    'compound': string | null;
    'BP': string | null; // LUXE REALTY post link
    'BQ': string | null; // NEXIA post link
    'BR': string | null; // ADOLF post link
    'BS': string | null; // PCO post link
    'BT': string | null; // SLOO post link
    'BU': string | null; // TAOKE post link
    'MONTHLY DUES': number | string | null;
    'SOURCE_TAB': string | null;
    'MAP VERIFIED': string | null;
    'BW': string | null; // Client
}

export const isDuplicateListing = (summary: string): boolean => {
    if (!summary) return false;
    const allLines = summary.split(/\r?\n/).map(l => l.trim()).filter(line => line !== '');
    if (allLines.length === 0) return false;
    
    // Check first line
    if (allLines[0].toUpperCase().includes('DUPLICATE')) return true;
    
    // If the first line is a GEO ID (e.g. matches A/B/G + digits or is a row placeholder), check the second line
    if (allLines.length > 1) {
        const firstLine = allLines[0];
        const isGeoId = /^[A-Z\d-]+$/i.test(firstLine);
        if (isGeoId && allLines[1].toUpperCase().includes('DUPLICATE')) {
            return true;
        }
    }
    
    return false;
};

/**
 * Fetch listings with IndexedDB caching + progressive loading
 *
 * Strategy:
 * 1. Check IndexedDB cache first (instant if cached)
 * 2. If cache valid: return cached data immediately
 * 3. If cache invalid: fetch from Supabase and cache
 */
export const fetchListings = async (): Promise<Listing[]> => {
    try {
        // Global timeout: if the entire fetch pipeline hangs, resolve with empty
        // so the loading screen doesn't get stuck forever
        const FETCH_TIMEOUT_MS = 30_000; // 30 seconds
        const timeout = new Promise<Listing[]>((resolve) =>
            setTimeout(() => {
                console.error('⏱️ fetchListings global timeout after 30s — returning empty');
                resolve([]);
            }, FETCH_TIMEOUT_MS)
        );

        const fetchPipeline = (async (): Promise<Listing[]> => {
            // Try to get cached data first
            const cached = await getCachedListings();
            if (cached) {
                console.log('✅ Using cached listings from IndexedDB');
                return cached.filter(l => !isDuplicateListing(l.summary));
            }

            // Cache miss or invalid - fetch from Supabase
            console.log('📡 Cache miss - fetching from Supabase...');
            const listings = await fetchFromSupabase();

            // Save to cache in background (don't await - don't block return)
            saveListingsToCache(listings).catch(err => {
                console.error('Failed to cache listings:', err);
            });

            return listings;
        })();

        return await Promise.race([fetchPipeline, timeout]);
    } catch (error) {
        console.error('Error in fetchListings:', error);
        return [];
    }
};

/**
 * Manually refresh listings (clears cache and fetches fresh data)
 */
export const refreshListings = async (): Promise<Listing[]> => {
    console.log('🔄 Manual refresh requested - clearing cache');
    await clearCache();
    return await fetchFromSupabase();
};

/**
 * Fetch listings directly from Supabase (bypasses cache)
 * Implements retry logic with fallback to Available-only on timeout
 */
export const fetchFromSupabase = async (): Promise<Listing[]> => {
    try {
        console.log('Starting to fetch listings from Supabase...');

        // Try fetching all listings first (with retry)
        const allListings = await fetchWithRetry(false);
        if (allListings.length > 0) {
            console.log(`✅ Successfully fetched ${allListings.length} total listings (ALL STATUS)`);
            return allListings;
        }

        // If all listings fetch fails, fall back to Available only
        console.warn('⚠️ Fetching all listings failed, falling back to Available only...');
        const availableListings = await fetchWithRetry(true);
        console.log(`✅ Successfully fetched ${availableListings.length} listings (AVAILABLE only)`);
        return availableListings;

    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
};

/**
 * Fetch listings with retry logic
 * @param availableOnly - If true, only fetch Available listings
 * @param maxRetries - Maximum number of retry attempts
 */
const fetchWithRetry = async (
    availableOnly: boolean,
    maxRetries: number = 2
): Promise<Listing[]> => {
    const batchSize = 500; // Smaller batches to reduce load
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            const allData: DbListing[] = [];
            let offset = 0;
            let hasMore = true;

            console.log(`Attempt ${attempt + 1}/${maxRetries + 1}: Fetching ${availableOnly ? 'AVAILABLE' : 'ALL'} listings...`);

            while (hasMore) {
                let query = supabase
                    .from('KIU Properties')
                    .select('*');

                // Apply status filter if needed
                if (availableOnly) {
                    query = query.eq('STATUS', 'Available');
                }

                query = query.range(offset, offset + batchSize - 1);

                const { data, error } = await query;

                if (error) {
                    // Check if it's a timeout error
                    if (error.code === '57014' || error.message.includes('timeout')) {
                        throw new Error('TIMEOUT');
                    }
                    console.error('Error fetching from Supabase:', error);
                    throw error;
                }

                if (!data || data.length === 0) {
                    hasMore = false;
                } else {
                    allData.push(...data);
                    offset += batchSize;
                    console.log(`  Batch: ${data.length} listings (total: ${allData.length})`);

                    // Small delay between batches to reduce database load
                    await new Promise(resolve => setTimeout(resolve, 50));

                    if (data.length < batchSize) {
                        hasMore = false;
                    }
                }
            }

            return allData.map(normalizeDbListing).filter(l => !isDuplicateListing(l.summary));

        } catch (error: any) {
            attempt++;

            if (error.message === 'TIMEOUT') {
                console.warn(`⏱️ Timeout on attempt ${attempt}/${maxRetries + 1}`);

                if (attempt <= maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                    console.log(`   Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error('❌ Max retries reached');
                    throw error;
                }
            } else {
                console.error('❌ Non-timeout error:', error);
                throw error;
            }
        }
    }

    return [];
};

export const normalizeDbListing = (row: DbListing): Listing => {
    const parseFirstPrice = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Handle strings with multiple prices (e.g., "120,000,000 / 150,000,000")
        const cleanStr = String(val).replace(/,/g, '');
        const match = cleanStr.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    };

    let price = parseFirstPrice(row['Extracted Sale Price']);
    let leasePrice = parseFirstPrice(row['Extracted Lease Price']);

    // Summary Logic
    const rawSummary = (row['MAIN'] || '').trim();
    const allLines = rawSummary.split(/\r?\n/).map(l => l.trim());
    const fullSummary = rawSummary;

    // Determine Sale Type from Text Header first to override bad extractions
    let textSaleType = '';
    const headerLine = allLines.find(line => {
        const upper = line.toUpperCase();
        return upper.includes('FOR LEASE') || upper.includes('FOR SALE') || upper.includes('FOR SALE/LEASE') || upper.includes('FOR SALE / LEASE');
    });

    if (headerLine) {
        const upper = headerLine.toUpperCase();
        if (upper.includes('FOR SALE/LEASE') || upper.includes('FOR SALE / LEASE') || (upper.includes('FOR SALE') && upper.includes('FOR LEASE'))) {
            textSaleType = 'SALE/LEASE';
        } else if (upper.includes('FOR LEASE')) {
            textSaleType = 'FOR LEASE';
        } else if (upper.includes('FOR SALE')) {
            textSaleType = 'FOR SALE';
        }
    }

    if (textSaleType === 'FOR LEASE') {
        price = 0;
    } else if (textSaleType === 'FOR SALE') {
        leasePrice = 0;
    }

    // Determine Sale Type Logic
    let saleType = '';
    if (price > 0 && leasePrice > 0) {
        saleType = 'SALE/LEASE';
    } else if (price > 0) {
        saleType = 'FOR SALE';
    } else if (leasePrice > 0) {
        saleType = 'FOR LEASE';
    } else if (textSaleType) {
        saleType = textSaleType;
    }

    // Category Logic
    const categories: string[] = [];
    if (row['RESIDENTIAL'] && row['RESIDENTIAL'].trim()) categories.push('RESIDENTIAL');
    if (row['COMMERCIAL'] && row['COMMERCIAL'].trim()) categories.push('COMMERCIAL');
    if (row['INDUSTRIAL'] && row['INDUSTRIAL'].trim()) categories.push('INDUSTRIAL');
    if (row['AGRICULTURAL'] && row['AGRICULTURAL'].trim()) categories.push('AGRICULTURAL');
    const category = categories.join(', ');

    // Find non-empty content
    const nonEmptyIndices = allLines.reduce((acc, line, idx) => {
        if (line !== '') acc.push(idx);
        return acc;
    }, [] as number[]);

    const geoId = (row['GEO ID'] || '').trim();

    let displaySummary = '';
    if (nonEmptyIndices.length > 0) {
        const firstIdx = nonEmptyIndices[0];
        const lastIdx = nonEmptyIndices[nonEmptyIndices.length - 1];

        // Strip first line ONLY if it matches the GEO ID pattern/value
        const firstLine = allLines[firstIdx];
        const isGeoIdLine = firstLine.toUpperCase() === geoId.toUpperCase() || 
                            /^[ABG]\d+$/i.test(firstLine);
        const startSlice = isGeoIdLine ? firstIdx + 1 : firstIdx;

        // Strip last line ONLY if it is a photos or map link
        const lastLine = allLines[lastIdx];
        const isPhotoOrMapLink = lastLine.toUpperCase().startsWith('PHOTOS:') || 
                                 lastLine.toUpperCase().startsWith('PHOTO:') || 
                                 lastLine.includes('http://') || 
                                 lastLine.includes('https://');
        const endSlice = isPhotoOrMapLink ? lastIdx : lastIdx + 1;

        if (startSlice < endSlice) {
            displaySummary = allLines.slice(startSlice, endSlice)
                .filter(line => {
                    const cleanLine = line.trim().toLowerCase();
                    
                    // Do not include if starts with "google pin:" or "google location"
                    if (cleanLine.startsWith('google pin:') || cleanLine.startsWith('google location')) {
                        return false;
                    }
                    
                    // Do not include if includes maps link
                    const hasMapLink = cleanLine.includes('maps.google') || 
                                       cleanLine.includes('google.com/maps') || 
                                       cleanLine.includes('goo.gl/maps') ||
                                       cleanLine.includes('maps.app.goo.gl');
                    
                    // Do not include if includes photos link
                    const hasPhotosLink = cleanLine.includes('photos.app.goo.gl') || 
                                          cleanLine.includes('drive.google.com') ||
                                          (cleanLine.includes('photo') && (cleanLine.includes('http://') || cleanLine.includes('https://')));
                    
                    if (hasMapLink || hasPhotosLink) {
                        return false;
                    }
                    
                    return true;
                })
                .join('\n')
                .trim();
        } else {
            displaySummary = '';
        }
    } else {
        displaySummary = '';
    }

    const lotArea = row['LOT AREA'] || 0;
    const floorArea = row['FLOOR AREA'] || 0;

    // Type Inference Logic
    let type: PropertyType = PropertyType.Unknown;
    if (!lotArea || lotArea === 0) {
        type = PropertyType.Condo;
    } else if (!floorArea || floorArea === 0) {
        type = PropertyType.Lot;
    }

    // Parse Coordinates - try LAT LONG first, then individual LAT/LONG columns
    let lat = 0;
    let lng = 0;
    const rawCoords = row['LAT LONG'] || '';
    if (rawCoords.includes(',')) {
        const [latStr, lngStr] = rawCoords.split(',');
        lat = parseFloat(latStr.trim()) || 0;
        lng = parseFloat(lngStr.trim()) || 0;
    } else {
        lat = parseFloat(row['LAT'] || '') || 0;
        lng = parseFloat(row['LONG'] || '') || 0;
    }

    const columnV = row['COMMENTS'] || '';
    const summaryWithV = columnV ? `${fullSummary}\n\n${columnV}` : fullSummary;

    // STATUS column (Col O) is the single source of truth — never infer from description text
    const statusAQ = (row['STATUS'] || 'Available').trim() || 'Available';

    // Parse Sponsored Date Range
    const rawSponsoredStart = row['SPONSOR START'] || '';
    const rawSponsoredEnd = row['SPONSOR END'] || '';
    let isSponsored = false;
    let sponsoredUntilDate: Date | null = null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (rawSponsoredStart && rawSponsoredEnd) {
        const startDate = new Date(rawSponsoredStart);
        const endDate = new Date(rawSponsoredEnd);

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            sponsoredUntilDate = endDate;
            if (today >= startDate && today <= endDate) {
                isSponsored = true;
            }
        }
    }

    // Check isDirect from DIRECT OR BROKER column or summary
    const directOrBroker = (row['DIRECT OR BROKER'] || '').toUpperCase();
    const isDirect = directOrBroker.includes('DIRECT') || rawSummary.toUpperCase().includes('DIRECT');

    // Parse parking from garage column
    const parking = parseInt(row['garage'] || '0') || 0;

    // Parse bedrooms - database stores as TEXT, need to convert to number
    const bedroomsValue = row['bedrooms'];
    const bedrooms = typeof bedroomsValue === 'string'
        ? (parseInt(bedroomsValue) || 0)
        : (bedroomsValue || 0);

    return {
        id: (row['GEO ID'] || '').trim(),
        summary: summaryWithV,
        displaySummary: displaySummary,
        price: price,
        status: statusAQ || 'Available', // Use detected status, fallback to Available
        saleType: saleType,
        pricePerSqm: row['Sale Price/Sqm'] || 0,
        region: row['REGION'] || '',
        province: row['PROVINCE'] || '',
        city: row['CITY'] || '',
        barangay: row['BARANGAY'] || '',
        area: row['AREA'] || '',
        building: row['BUILDING'] || '',

        columnJ: '',
        columnK: row['NAME'] || '', // Using NAME column (was column AZ)
        columnM: '',
        columnN: '',
        columnP: '',
        columnAE: row['TYPE'] || '',

        category: category,
        facebookLink: row['FB LINK'] || '',
        postLinkLuxe: row['BP'] || '',
        postLinkNexia: row['BQ'] || '',
        postLinkAdolf: row['BR'] || '',
        postLinkPco: row['BS'] || '',
        postLinkSloo: row['BT'] || '',
        postLinkTaoke: row['BU'] || '',
        photoLink: row['PHOTO'] || '',
        mapLink: row['MAP LINK'] || '',
        columnV: row['COMMENTS'] || '',
        isDirect: isDirect,

        lat,
        lng,
        lotArea,
        floorArea,
        type,
        leasePrice: leasePrice,
        leasePricePerSqm: row['Lease Price/Sqm'] || 0,
        columnBC: row['DATE UPDATED'] || '',
        columnBD: row['LISTING OWNERSHIP'] || '',
        columnAZ: row['NAME'] || '',
        statusAQ: statusAQ,
        isSponsored: isSponsored,
        sponsoredUntil: sponsoredUntilDate,
        bedrooms: bedrooms,
        parking: parking,
        typeDescription: row['TYPE'] || '',
        monthlyDues: row['MONTHLY DUES'] ? String(row['MONTHLY DUES']).trim() : '',
        sourceTab: row['SOURCE_TAB'] || 'Sheet1',
        mapVerified: row['MAP VERIFIED'] || '',
        client: row['BW'] || '',
    };
};
