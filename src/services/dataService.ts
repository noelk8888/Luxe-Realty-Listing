
import Papa from 'papaparse';
import { PropertyType } from '../types';
import type { Listing } from '../types';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1OYk_LGiLYb_ayGoVJ-tistDias2VdETdR60SP5ALBlo/export?format=csv&gid=628592557';

export const fetchListings = async (): Promise<Listing[]> => {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();

        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: false, // Use array mode to rely on column indices
                skipEmptyLines: true,
                complete: (results) => {
                    const rawRows = results.data as string[][];
                    // Skip header row (index 0)
                    const dataRows = rawRows.slice(1);

                    const cleanedData = dataRows
                        .map(normalizeListing)
                        .filter(l => l.price > 0 || l.leasePrice > 0); // Display if has Price OR Lease Price
                    resolve(cleanedData);
                },
                error: (error: Error) => {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
};

const normalizeListing = (row: string[]): Listing => {
    // Helper to clean price strings "P 4,200,000" -> 4200000
    const parseNumber = (val: string) => {
        if (!val) return 0;
        return parseFloat(val.replace(/[P,php\s]/gi, '').replace(/,/g, '')) || 0;
    };

    // Column Indices (0-based) from Sheet4:
    // A=0, Z=25, AB=27, AC=28, AD=29, AE=30, AF=31, AG=32, AH=33, AI=34, AJ=35
    // AK=36, AL=37, AM=38, AN=39, AP=41, AQ=42, AR=43, AS=44, AT=45, AU=46, AV=47, AW=48, BE=56

    const price = parseNumber(row[44]); // Col AS
    const leasePrice = parseNumber(row[46]); // Col AU

    // Determine Sale Type Logic
    let saleType = '';
    if (price > 0 && leasePrice > 0) {
        saleType = 'SALE/LEASE';
    } else if (price > 0) {
        saleType = 'FOR SALE';
    } else if (leasePrice > 0) {
        saleType = 'FOR LEASE';
    }

    // Category Logic (Cols AK, AL, AM, AN -> 36, 37, 38, 39)
    const categories: string[] = [];
    if (row[36] && row[36].trim()) categories.push('RESIDENTIAL');
    if (row[37] && row[37].trim()) categories.push('COMMERCIAL');
    if (row[38] && row[38].trim()) categories.push('INDUSTRIAL');
    if (row[39] && row[39].trim()) categories.push('AGRICULTURAL');
    const category = categories.join(', ');

    // Summary Logic (Col AA -> 26)
    const rawSummary = row[26] || '';
    const summaryLines = rawSummary.split('\n');
    const fullSummary = rawSummary;
    const displaySummary = summaryLines.length > 1 ? summaryLines.slice(1).join('\n') : rawSummary;

    const lotArea = parseNumber(row[41]); // Col AP
    const floorArea = parseNumber(row[42]); // Col AQ

    // Type Inference Logic
    let type: PropertyType = PropertyType.Unknown;
    if (!lotArea || lotArea === 0) {
        type = PropertyType.Condo;
    } else if (!floorArea || floorArea === 0) {
        type = PropertyType.Lot;
    }

    // Parse Coordinates from Column BE (Index 56)
    const rawCoords = row[56] || '';
    let lat = 0;
    let lng = 0;
    if (rawCoords.includes(',')) {
        const [latStr, lngStr] = rawCoords.split(',');
        lat = parseFloat(latStr.trim()) || 0;
        lng = parseFloat(lngStr.trim()) || 0;
    }

    const columnV = row[48] || ''; // Col AW (Comments)
    const summaryWithV = columnV ? `${fullSummary}\n\n${columnV}` : fullSummary;

    return {
        id: row[28] || '', // Col AC
        summary: summaryWithV, // Full text for copy including monthly dues
        displaySummary: displaySummary, // Text without first line for UI
        price: price, // Col AS
        status: 'Available', // Default to Available since we don't have a status col mapped explicitly in request? 
        // Wait, user request didn't map Status (O in old). 
        // Request says "category - if any 1 or 4 of the COL AK to AN is not empty"
        // Use 'Available' as default or map if needed. 
        // Logic for Status was previously O. New mapping doesn't mention it.
        // I will default to 'Available' for now to ensure display.
        saleType: saleType, // Derived
        pricePerSqm: parseNumber(row[45]), // Col AT
        region: row[30] || '', // Col AE
        province: row[31] || '', // Col AF
        city: row[32] || '', // Col AG
        barangay: row[33] || '', // Col AH
        area: row[34] || '', // Col AI
        building: row[35] || '', // Col AJ

        // Mapped to match existing UI usage where possible or generic fields
        columnJ: '',
        columnK: row[10] || '', // Col K (Owner/Broker)
        columnM: '',
        columnN: '',
        columnP: '',
        columnAE: row[43] || '', // Col AR

        category: category,
        facebookLink: row[25] || '', // Col Z
        photoLink: row[27] || '', // Col AB
        mapLink: row[29] || '', // Col AD
        columnV: row[48] || '', // Col AW (Comments)
        isDirect: (row[40]?.toUpperCase().includes('DIRECT')) || (rawSummary.toUpperCase().includes('DIRECT')), // Col AO or Summary fallback

        lat,
        lng,
        lotArea,
        floorArea,
        type,
        leasePrice: leasePrice,
        leasePricePerSqm: parseNumber(row[47]) // Col AV
    };
};
