import { supabase } from '../lib/supabase';
import { PropertyType } from '../types';
import type { Listing } from '../types';

// Database row type from Supabase - matches "KIU Properties" table
interface DbListing {
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
    'bedrooms': number | null;
    'toilet': string | null;
    'garage': string | null;
    'amenities': string | null;
    'corner': string | null;
    'compound': string | null;
}

export const fetchListings = async (): Promise<Listing[]> => {
    try {
        console.log('Starting to fetch listings from Supabase...');

        // Fetch all listings in batches (Supabase default limit is 1000)
        const allData: DbListing[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('KIU Properties')
                .select('*')
                .range(offset, offset + batchSize - 1);

            if (error) {
                console.error('Error fetching from Supabase:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                return [];
            }

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allData.push(...data);
                offset += batchSize;
                console.log(`Fetched batch: ${data.length} listings (total: ${allData.length})`);

                // If we got less than batchSize, we've reached the end
                if (data.length < batchSize) {
                    hasMore = false;
                }
            }
        }

        console.log(`Successfully fetched ${allData.length} total listings from Supabase`);
        return allData.map(normalizeDbListing);
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
};

const normalizeDbListing = (row: DbListing): Listing => {
    const price = row['Extracted Sale Price'] || 0;
    const leasePrice = row['Extracted Lease Price'] || 0;

    // Determine Sale Type Logic
    let saleType = '';
    if (price > 0 && leasePrice > 0) {
        saleType = 'SALE/LEASE';
    } else if (price > 0) {
        saleType = 'FOR SALE';
    } else if (leasePrice > 0) {
        saleType = 'FOR LEASE';
    }

    // Category Logic
    const categories: string[] = [];
    if (row['RESIDENTIAL'] && row['RESIDENTIAL'].trim()) categories.push('RESIDENTIAL');
    if (row['COMMERCIAL'] && row['COMMERCIAL'].trim()) categories.push('COMMERCIAL');
    if (row['INDUSTRIAL'] && row['INDUSTRIAL'].trim()) categories.push('INDUSTRIAL');
    if (row['AGRICULTURAL'] && row['AGRICULTURAL'].trim()) categories.push('AGRICULTURAL');
    const category = categories.join(', ');

    // Summary Logic
    const rawSummary = (row['MAIN'] || '').trim();
    const allLines = rawSummary.split(/\r?\n/).map(l => l.trim());
    const fullSummary = rawSummary;

    // Find non-empty content
    const nonEmptyIndices = allLines.reduce((acc, line, idx) => {
        if (line !== '') acc.push(idx);
        return acc;
    }, [] as number[]);

    let displaySummary = '';
    if (nonEmptyIndices.length >= 2) {
        const firstIdx = nonEmptyIndices[0];
        const lastIdx = nonEmptyIndices[nonEmptyIndices.length - 1];

        if (nonEmptyIndices.length === 2) {
            displaySummary = allLines[nonEmptyIndices[1]];
        } else {
            displaySummary = allLines.slice(firstIdx + 1, lastIdx).join('\n').trim();
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

    // Detect status from summary if status is empty or "available"
    let statusAQ = (row['STATUS'] || '').trim();
    if (!statusAQ || statusAQ.toLowerCase() === 'available') {
        const upperFull = (row['MAIN'] || '').toUpperCase();
        const upperComments = (row['COMMENTS'] || '').toUpperCase();
        const combinedText = `${upperFull} ${upperComments}`;

        if (combinedText.includes('SOLD')) {
            statusAQ = 'SOLD';
        } else if (combinedText.includes('RENTED')) {
            statusAQ = 'RENTED';
        } else if (combinedText.includes('NOT AVAILABLE')) {
            statusAQ = 'NOT AVAILABLE';
        }
    }

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

    return {
        id: row['GEO ID'] || '',
        summary: summaryWithV,
        displaySummary: displaySummary,
        price: price,
        status: 'Available',
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
        columnBC: row['AWAY'] || '',
        columnBD: row['LISTING OWNERSHIP'] || '',
        columnAZ: row['NAME'] || '',
        statusAQ: statusAQ,
        isSponsored: isSponsored,
        sponsoredUntil: sponsoredUntilDate,
        bedrooms: row['bedrooms'] || 0,
        parking: parking,
        typeDescription: row['TYPE'] || ''
    };
};
