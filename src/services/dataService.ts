
import Papa from 'papaparse';
import { PropertyType } from '../types';
import type { Listing } from '../types';

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1OYk_LGiLYb_ayGoVJ-tistDias2VdETdR60SP5ALBlo/export?format=csv';

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
                        .filter(l => l.status?.toLowerCase().includes('available') && l.price > 0);
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

    // DEBUG: Log G00024
    if (row[19] === 'G00024') {
        console.log('DEBUG G00024 RAW:', row);
        console.log('DEBUG G00024 Index 21 (Col V):', row[21]);
    }

    // Column Mappings (0-indexed)
    // A=0, E=4, F=5, G=6, O=14, T=19, X=23, Y=24, Z=25, AA=26, AB=27, AC=28, AD=29

    const lotArea = parseNumber(row[4]); // Col E
    const floorArea = parseNumber(row[5]); // Col F

    // Type Inference Logic
    let type: PropertyType = PropertyType.Unknown;
    if (!lotArea || lotArea === 0) {
        type = PropertyType.Condo;
    } else if (!floorArea || floorArea === 0) {
        type = PropertyType.Lot;
    }

    // Parse Coordinates from Column AH (Index 33)
    const rawCoords = row[33] || '';
    let lat = 0;
    let lng = 0;
    if (rawCoords.includes(',')) {
        const [latStr, lngStr] = rawCoords.split(',');
        lat = parseFloat(latStr.trim()) || 0;
        lng = parseFloat(lngStr.trim()) || 0;
    }

    return {
        id: row[19] || '', // Col T
        summary: row[0] || '', // Col A
        price: parseNumber(row[6]), // Col G
        status: row[14] || '', // Col O
        saleType: row[7] || '', // Col H
        pricePerSqm: parseNumber(row[23]), // Col X
        region: row[24] || '', // Col Y
        province: row[25] || '', // Col Z
        city: row[26] || '', // Col AA
        barangay: row[27] || '', // Col AB
        area: row[28] || '', // Col AC
        building: row[29] || '', // Col AD
        columnJ: row[9] || '', // Col J
        columnK: row[10] || '', // Col K
        columnM: row[12] || '', // Col M
        columnN: row[13] || '', // Col N
        columnP: row[15] || '', // Col P
        columnAE: row[30] || '', // Col AE
        category: row[1] || '', // Col B
        facebookLink: row[17] || '', // Col R
        photoLink: row[16] || '', // Col Q
        mapLink: row[20] || '', // Col U
        columnV: row[21] || '', // Col V
        isDirect: (row[22] || '').trim().toUpperCase() === 'YES', // Col W
        lat,
        lng,
        lotArea,
        floorArea,
        type
    };
};
