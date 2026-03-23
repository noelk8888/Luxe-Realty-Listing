
import { PropertyType } from '../types';
import type { Listing } from '../types';

interface ParsedQuery {
    minPrice?: number;
    maxPrice?: number;
    locations: string[];
    types: PropertyType[];
    keywords: string[];
    landmarks: LandmarkMatch[];
    isProximitySearch: boolean;
    isExactPhraseSearch: boolean;
    exactPhrase?: string;
}

interface Landmark {
    name: string;
    aliases: string[];
    lat: number;
    lng: number;
    city: string;
    radius?: number; // Default search radius in km
}

interface LandmarkMatch {
    landmark: Landmark;
    maxDistance: number; // in km
}

// Landmark database with coordinates for proximity search
const LANDMARKS: Landmark[] = [
    // Universities
    { name: 'Ateneo de Manila', aliases: ['ateneo', 'admu', 'ateneo de manila'], lat: 14.6392, lng: 121.0779, city: 'Quezon City', radius: 3 },
    { name: 'UP Diliman', aliases: ['up', 'up diliman', 'university of the philippines'], lat: 14.6537, lng: 121.0685, city: 'Quezon City', radius: 3 },
    { name: 'La Salle', aliases: ['dlsu', 'de la salle', 'la salle'], lat: 14.5648, lng: 120.9931, city: 'Manila', radius: 2 },
    { name: 'UST', aliases: ['ust', 'university of santo tomas', 'santo tomas'], lat: 14.6091, lng: 120.9894, city: 'Manila', radius: 2 },

    // Business Districts
    { name: 'BGC', aliases: ['bgc', 'bonifacio global city', 'fort bonifacio', 'the fort'], lat: 14.5547, lng: 121.0471, city: 'Taguig', radius: 2 },
    { name: 'Makati CBD', aliases: ['makati', 'makati cbd', 'ayala', 'ayala center'], lat: 14.5547, lng: 121.0244, city: 'Makati', radius: 2 },
    { name: 'Ortigas', aliases: ['ortigas', 'ortigas center'], lat: 14.5866, lng: 121.0566, city: 'Pasig', radius: 2 },
    { name: 'Eastwood', aliases: ['eastwood', 'eastwood city'], lat: 14.6090, lng: 121.0790, city: 'Quezon City', radius: 1.5 },
    { name: 'Araneta City', aliases: ['araneta', 'araneta city', 'cubao'], lat: 14.6199, lng: 121.0519, city: 'Quezon City', radius: 2 },

    // Malls & Landmarks
    { name: 'SM Mall of Asia', aliases: ['moa', 'mall of asia', 'sm moa'], lat: 14.5352, lng: 120.9823, city: 'Pasay', radius: 2 },
    { name: 'SM Megamall', aliases: ['megamall', 'sm megamall'], lat: 14.5846, lng: 121.0565, city: 'Mandaluyong', radius: 1.5 },
    { name: 'Greenhills', aliases: ['greenhills', 'greenhills shopping center'], lat: 14.6026, lng: 121.0501, city: 'San Juan', radius: 1.5 },
    { name: 'Alabang Town Center', aliases: ['alabang', 'atc', 'alabang town center'], lat: 14.4193, lng: 121.0399, city: 'Muntinlupa', radius: 2 },

    // Airports
    { name: 'NAIA', aliases: ['naia', 'airport', 'manila airport'], lat: 14.5086, lng: 121.0198, city: 'Pasay', radius: 3 },

    // Other areas
    { name: 'Quezon City Circle', aliases: ['qc circle', 'quezon memorial circle', 'elliptical road'], lat: 14.6521, lng: 121.0498, city: 'Quezon City', radius: 2 },
    { name: 'Kapitolyo', aliases: ['kapitolyo'], lat: 14.5711, lng: 121.0604, city: 'Pasig', radius: 1 },
];

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const searchListings = (listings: Listing[], query: string, minScore: number = 0): Listing[] => {
    const criteria = parseQuery(query);

    console.log('Search criteria:', criteria);
    console.log('Min score threshold:', minScore);
    console.log('Total listings:', listings.length);

    // Special handling for exact phrase search
    if (criteria.isExactPhraseSearch && criteria.exactPhrase) {
        console.log(`🔍 Exact phrase search for: "${criteria.exactPhrase}"`);

        const exactPhrase = criteria.exactPhrase;
        const scoredListings = listings.map(listing => {
            let score = 0;

            // Build searchable text (all fields)
            const allText = [
                listing.id,
                listing.city,
                listing.province,
                listing.barangay,
                listing.area,
                listing.building,
                listing.summary,
                listing.columnJ,
                listing.columnK,
                listing.columnP,
                listing.columnAZ,
                listing.columnBC,
                listing.columnBD,
                listing.statusAQ
            ].join(' . ').toLowerCase();

            // Check if exact phrase exists
            if (!allText.includes(exactPhrase)) {
                return { listing, score: -1 }; // Filter out
            }

            // Score based on where the match appears
            if (listing.id.toLowerCase().includes(exactPhrase)) {
                score += 1000; // Highest priority: ID match
            }

            const primaryText = [
                listing.city,
                listing.province,
                listing.barangay,
                listing.area,
                listing.building
            ].join(' . ').toLowerCase();

            if (primaryText.includes(exactPhrase)) {
                score += 500; // High priority: Primary location fields
            } else {
                score += 100; // Lower priority: Found in description/other fields
            }

            return { listing, score };
        });

        const filtered = scoredListings
            .filter(item => item.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .map(item => item.listing);

        console.log(`✓ Exact phrase search found ${filtered.length} results`);
        return filtered;
    }

    // 0. Pre-clean query for scoring
    const cleanQuery = query.toLowerCase().trim();

    // Filter out price-related tokens so they don't affect scoring
    const priceWords = ['under', 'over', 'below', 'above', 'near', 'close', 'around'];
    const queryTokens = cleanQuery
        .split(/\s+/)
        .filter(t => t.length >= 2)
        .filter(t => !priceWords.includes(t)) // Remove price qualifiers and proximity words
        .filter(t => !/^\d+[mk]$/i.test(t) && !/^\d{4,}$/.test(t)); // Remove price numbers like "10m", "5k", but keep small address numbers like "14"

    console.log('Query tokens:', queryTokens);
    console.log('Landmarks found:', criteria.landmarks.map(lm => lm.landmark.name));
    console.log('Is proximity search:', criteria.isProximitySearch);

    // Score and filter
    const scoredListings = listings.map(listing => {
        let score = 0;
        let meetsCriteria = true;

        // --- HARD FILTERS (Must meet these to be considered) ---

        // 1. Price Filter (+- 10% per previous task)
        if (criteria.minPrice && listing.price < criteria.minPrice) meetsCriteria = false;
        if (criteria.maxPrice && listing.price > criteria.maxPrice) meetsCriteria = false;

        if (!meetsCriteria) return { listing, score: -1 };

        // 2. Type Filter (If specified, we prefer matching types, but maybe not hard filter if loose?
        // Let's make it a massive score booster/penalty instead of hard hidden to be safe,
        // OR keep as hard filter if user was annoyed by looseness. User said "too loose", so hard filter for type is safer.)
        if (criteria.types.length > 0 && !criteria.types.includes(listing.type)) {
            meetsCriteria = false;
        }

        // 3. Proximity/Landmark Filter
        if (criteria.isProximitySearch && criteria.landmarks.length > 0) {
            // Check if listing is within range of any landmark
            let withinRange = false;
            let closestDistance = Infinity;

            for (const lm of criteria.landmarks) {
                // Skip if listing doesn't have coordinates
                if (!listing.lat || !listing.lng) {
                    continue;
                }

                const distance = calculateDistance(listing.lat, listing.lng, lm.landmark.lat, lm.landmark.lng);
                closestDistance = Math.min(closestDistance, distance);

                if (distance <= lm.maxDistance) {
                    withinRange = true;
                    // Boost score based on proximity (closer = higher score)
                    const proximityScore = Math.max(0, 100 - (distance / lm.maxDistance * 100));
                    score += proximityScore;
                }
            }

            // If proximity search and no coordinates or not in range, filter out
            if (!withinRange) {
                // Also check if city matches landmark city (fallback for listings without coordinates)
                const cityMatches = criteria.landmarks.some(lm =>
                    listing.city.toLowerCase().includes(lm.landmark.city.toLowerCase())
                );

                if (!cityMatches) {
                    meetsCriteria = false;
                } else {
                    // Give lower score for city match without exact distance
                    score += 20;
                }
            }
        }

        // 4. Strict "Manila" Filter
        // If user searches "Manila" (without "Metro"), restrict to Manila City only.
        // We avoid matching "Metro Manila" (the region) which appears in all addresses.
        const isStrictManilaSearch = queryTokens.includes('manila') && !queryTokens.includes('metro');
        if (isStrictManilaSearch) {
            if (listing.city.trim().toLowerCase() !== 'manila') {
                meetsCriteria = false;
            }
        }

        if (!meetsCriteria) return { listing, score: -1 };

        // --- SCORING (Relevance) ---

        const primaryText = [
            listing.city,
            listing.province,
            listing.barangay,
            listing.area,
            listing.building,
            listing.id
        ].join(' . ').toLowerCase();

        const secondaryText = [
            listing.summary,
            listing.columnJ,
            listing.columnK,
            listing.columnP,
            listing.columnAZ,
            listing.columnBC,
            listing.columnBD
        ].join(' . ').toLowerCase();

        const listingText = primaryText + ' . ' + secondaryText + ' . ' + (listing.statusAQ || '');

        // Determine matching strategy based on query type
        const hasTypeAndLocation = criteria.types.length > 0 && criteria.keywords.length > 0;
        const isPureMultiKeywordSearch = criteria.keywords.length > 1 && criteria.types.length === 0 && !criteria.isProximitySearch;

        if (criteria.isProximitySearch || hasTypeAndLocation) {
            // A. Flexible Keyword Matching for type+location or proximity searches
            // Each relevant keyword found adds to the score
            const relevantKeywords = queryTokens.filter(token => {
                // Exclude landmark names (already handled by proximity)
                const isLandmarkName = criteria.landmarks.some(lm =>
                    lm.landmark.aliases.some(alias => alias.includes(token))
                );
                return !isLandmarkName && token.length >= 2;
            });

            for (const keyword of relevantKeywords) {
                if (primaryText.includes(keyword)) {
                    score += 30; // Keyword in primary fields
                } else if (secondaryText.includes(keyword)) {
                    score += 15; // Keyword in secondary fields
                }
            }

            // B. Exact Phrase Match Bonus (still valuable, but not required)
            if (listingText.includes(cleanQuery)) {
                score += 50;
            }
        } else if (isPureMultiKeywordSearch && criteria.keywords.length <= 3) {
            // B. Multi-word phrase matching for location-only searches (e.g., "st jude", "la salle")
            // Require all keywords to be present, preferably as exact phrase
            const allKeywordsPresent = criteria.keywords.every(keyword =>
                listingText.includes(keyword)
            );

            if (allKeywordsPresent) {
                // All keywords found - check if they're close together as a phrase
                if (primaryText.includes(cleanQuery)) {
                    score += 100; // Exact phrase in primary location fields
                } else if (listingText.includes(cleanQuery)) {
                    score += 60; // Exact phrase in secondary fields
                } else {
                    // All keywords present but not as exact phrase - lower score
                    score += 20;
                }
            } else {
                // Missing one or more keywords - filter out
                return { listing, score: -1 };
            }
        } else {
            // C. Traditional exact phrase matching for single-keyword searches
            // Checks if the full user query appears inside the text
            if (primaryText.includes(cleanQuery)) {
                score += 100;
            } else if (secondaryText.includes(cleanQuery)) {
                score += 60; // Lower score for description-only matches
            }

            // STRICT PHRASE MATCHING: The entire query phrase must appear in the listing
            // "Road 8" must match "Road 8" exactly, not just "Road" or "8" separately
            if (cleanQuery.length > 0 && !listingText.includes(cleanQuery)) {
                return { listing, score: -1 }; // Filter out non-phrase matches
            }
        }

        // C. Location Booster
        // If criteria.locations are found specifically in location fields
        if (criteria.locations.length > 0) {
            const locString = [listing.city, listing.province, listing.barangay].join(' ').toLowerCase();
            criteria.locations.forEach(loc => {
                const escapedLoc = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedLoc}\\b`, 'i');
                if (regex.test(locString)) score += 20;
            });
        }

        // D. ID Priority Boost (A/B/G + Number)
        // If query looks like an ID (starts with A, B, or G followed by numbers), prioritize related ID matches
        if (/^[abg]\d+/i.test(cleanQuery)) {
            const queryDigits = cleanQuery.substring(1);
            const listingId = (listing.id || '').toLowerCase();
            const startsWithABG = /^[abg]/.test(listingId);
            const idDigits = listingId.substring(1);

            if (startsWithABG && idDigits === queryDigits) {
                score += 2000; // Massive boost for same-number different-series IDs
            } else if (listingId.includes(cleanQuery)) {
                score += 2000; // Original exact match boost
            }
        }

        return { listing, score };
    });

    // Filter out non-matches and Sort by Score Descending
    const filtered = scoredListings
        .filter(item => item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .map(item => item.listing);

    console.log('Results after filtering:', filtered.length);
    console.log('Sample scores (first 5):', scoredListings.slice(0, 5).map(s => ({ id: s.listing.id, score: s.score, building: s.listing.building })));

    return filtered;
};

const parseQuery = (query: string): ParsedQuery => {
    const result: ParsedQuery = {
        locations: [],
        types: [],
        keywords: [],
        landmarks: [],
        isProximitySearch: false,
        isExactPhraseSearch: false
    };

    // Detect quoted strings (both "..." and '...')
    const quotedMatch = query.match(/^["'](.+)["']$/);
    if (quotedMatch) {
        result.isExactPhraseSearch = true;
        result.exactPhrase = quotedMatch[1].toLowerCase().trim();
        return result; // Skip all other parsing
    }

    const lowercaseQuery = query.toLowerCase();

    // Detect proximity keywords
    const proximityKeywords = ['near', 'close to', 'around', 'near to', 'close by', 'nearby', 'within'];
    result.isProximitySearch = proximityKeywords.some(keyword => lowercaseQuery.includes(keyword));

    // Detect landmarks
    for (const landmark of LANDMARKS) {
        for (const alias of landmark.aliases) {
            // Use word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${alias}\\b`, 'i');
            if (regex.test(lowercaseQuery)) {
                // Use custom radius if specified in query (e.g., "within 5km of ateneo")
                const distanceMatch = lowercaseQuery.match(/within\s+(\d+)\s*km/i);
                const maxDistance = distanceMatch ? parseInt(distanceMatch[1]) : (landmark.radius || 3);

                result.landmarks.push({
                    landmark,
                    maxDistance
                });
                break; // Only match once per landmark
            }
        }
    }

    // --- Price Extraction ---
    // Matches: 5M, 5.5M, 500k, 10,000,000, 10 million
    // Matches: 5M, 5.5M, 500k, 10,000,000, 10 million (must start with word boundary to avoid matching IDs like G07463)
    const priceRegex = /\b(\d+(?:[\.,]\d+)?)\s*(m|k|million|thousand)\b/gi;
    const items = lowercaseQuery.match(priceRegex);

    if (items) {
        let targetPrice = 0;
        const match = items[0]; // Take first match
        const numPart = parseFloat(match.replace(/[^\d\.]/g, ''));
        const multiplier = match.toLowerCase();

        if (multiplier.includes('m')) targetPrice = numPart * 1_000_000;
        else if (multiplier.includes('k')) targetPrice = numPart * 1_000;
        else targetPrice = numPart; // Raw number

        // Logic check: if someone types "2 br", we shouldn't treat 2 as price.
        // Heuristic: Price is usually > 1000 or has 'm'/'k'.
        if (targetPrice > 1000 || multiplier.includes('m') || multiplier.includes('k')) {
            // Check for directional keywords
            if (lowercaseQuery.includes('under') || lowercaseQuery.includes('below')) {
                // "under 10m" means 0 to 10M
                result.minPrice = 0;
                result.maxPrice = targetPrice;
            } else if (lowercaseQuery.includes('over') || lowercaseQuery.includes('above')) {
                // "over 10m" means 10M to infinity
                result.minPrice = targetPrice;
                result.maxPrice = undefined;
            } else {
                // Default: ±10% range for exact price searches
                result.minPrice = targetPrice * 0.9;
                result.maxPrice = targetPrice * 1.1;
            }
        }
    }

    // --- Type Extraction ---
    if (lowercaseQuery.includes('condo') || lowercaseQuery.includes('unit')) result.types.push(PropertyType.Condo);
    if (lowercaseQuery.includes('lot') || lowercaseQuery.includes('land')) result.types.push(PropertyType.Lot);

    // --- Location Extraction (Naive implementation) ---
    // In a real app, strict Named Entity Recognition (NER) is better.
    // Here, we'll strip out common stop words and treat remaining tokens as potential locations.
    const stopWords = ['in', 'at', 'near', 'around', 'with', 'a', 'an', 'the', 'for', 'sale', 'lease', 'price', 'seeking', 'looking', 'find', 'me', 'condo', 'lot', 'unit', 'under', 'over', 'below', 'above', 'to', 'of', 'by', 'within', 'km'];

    // Extract landmark names that were matched to avoid duplicate processing
    const matchedLandmarkWords: string[] = [];
    result.landmarks.forEach(lm => {
        lm.landmark.aliases.forEach(alias => {
            matchedLandmarkWords.push(...alias.split(/\s+/));
        });
    });

    const words = lowercaseQuery.split(/\s+/);
    words.forEach(word => {
        // Strip punctuation
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord &&
            !stopWords.includes(cleanWord) &&
            !(/^\d+[mk]$/i.test(cleanWord) || (/^\d+$/.test(cleanWord) && cleanWord.length >= 4)) &&
            !matchedLandmarkWords.includes(cleanWord)) {
            // Also ignore simple numbers that aren't part of a price (already handled regex above, but good to be safe)
            result.locations.push(cleanWord);
            result.keywords.push(cleanWord);
        }
    });

    return result;
};
