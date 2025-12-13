
import { PropertyType } from '../types';
import type { Listing } from '../types';

interface ParsedQuery {
    minPrice?: number;
    maxPrice?: number;
    locations: string[];
    types: PropertyType[];
    keywords: string[];
}

export const searchListings = (listings: Listing[], query: string, minScore: number = 0): Listing[] => {
    const criteria = parseQuery(query);

    console.log('Search criteria:', criteria);
    console.log('Min score threshold:', minScore);
    console.log('Total listings:', listings.length);

    // 0. Pre-clean query for scoring
    const cleanQuery = query.toLowerCase().trim();

    // Filter out price-related tokens so they don't affect scoring
    const priceWords = ['under', 'over', 'below', 'above'];
    const queryTokens = cleanQuery
        .split(/\s+/)
        .filter(t => t.length >= 2)
        .filter(t => !priceWords.includes(t)) // Remove price qualifiers
        .filter(t => !/^\d+[mk]?$/i.test(t)); // Remove price numbers like "10m", "5k", "100"

    console.log('Query tokens:', queryTokens);

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

        if (!meetsCriteria) return { listing, score: -1 };

        // --- SCORING (Relevance) ---

        const listingText = [
            listing.city,
            listing.province,
            listing.barangay,
            listing.region,
            listing.area,
            listing.building,
            listing.summary,
            listing.columnJ,
            listing.columnK,
            listing.columnP,
            listing.id // Allow searching by ID
        ].join(' ').toLowerCase();

        // A. Exact Phrase Match (The "Holy Grail")
        // Checks if the full user query appears inside the listing text
        if (listingText.includes(cleanQuery)) {
            score += 100;
        }

        // B. Token Matching
        let matchedTokensCount = 0;
        queryTokens.forEach(token => {
            if (listingText.includes(token)) {
                matchedTokensCount++;
                score += 15; // Increased from 10 to make keyword matches more valuable
            }
        });

        // Bonus: All logic words matched (AND logic simulation)
        if (queryTokens.length > 0 && matchedTokensCount === queryTokens.length) {
            score += 35; // Adjusted to ensure 2-word queries get ~65 points total
        }

        // C. Location Booster
        // If criteria.locations are found specifically in location fields
        if (criteria.locations.length > 0) {
            const locString = [listing.city, listing.province, listing.barangay].join(' ').toLowerCase();
            criteria.locations.forEach(loc => {
                if (locString.includes(loc)) score += 20;
            });
        }

        // D. ID Priority Boost (G + Number)
        // If query looks like an ID (starts with G followed by numbers), prioritize ID matches
        if (/^g\d+/i.test(cleanQuery)) {
            if (listing.id.toLowerCase().includes(cleanQuery)) {
                score += 2000; // Massive boost to ensure it's top
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
    const lowercaseQuery = query.toLowerCase();
    const result: ParsedQuery = {
        locations: [],
        types: [],
        keywords: []
    };

    // --- Price Extraction ---
    // Matches: 5M, 5.5M, 500k, 10,000,000, 10 million
    // Matches: 5M, 5.5M, 500k, 10,000,000, 10 million (must start with word boundary to avoid matching IDs like G07463)
    const priceRegex = /\b(\d+(?:[\.,]\d+)?)\s*(m|k|million|thousand)?/gi;
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
    const stopWords = ['in', 'at', 'near', 'around', 'with', 'a', 'an', 'the', 'for', 'sale', 'lease', 'price', 'seeking', 'looking', 'find', 'me', 'condo', 'lot', 'unit', 'under', 'over', 'below', 'above'];

    const words = lowercaseQuery.split(/\s+/);
    words.forEach(word => {
        // Strip punctuation
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord && !stopWords.includes(cleanWord) && !cleanWord.match(/^\d/)) {
            // Also ignore simple numbers that aren't part of a price (already handled regex above, but good to be safe)
            result.locations.push(cleanWord);
        }
    });

    return result;
};
