export const PropertyType = {
    Condo: 'Condo',
    Lot: 'Lot',
    Unknown: 'Unknown',
} as const;

export type PropertyType = typeof PropertyType[keyof typeof PropertyType];

export interface Listing {
    id: string; // Col T: Listing Code
    summary: string; // Col A: Summary
    price: number; // Col G: Price
    status: string; // Col O: Status
    saleType: string; // Col H: Sale/Lease
    pricePerSqm: number; // Col X: Price per sqm
    region: string; // Col Y: Region
    province: string; // Col Z: Province
    city: string; // Col AA: City
    barangay: string; // Col AB: Barangay
    area: string; // Col AC: General Area
    building: string; // Col AD: Building Name
    columnJ: string; // Col J
    columnK: string; // Col K
    columnM: string; // Col M
    columnN: string; // Col N
    columnP: string; // Col P
    category: string; // Column B
    facebookLink?: string; // Col R
    photoLink?: string; // Col O
    mapLink?: string; // Col U
    columnV?: string; // Col V
    isDirect: boolean; // Col W
    columnAE: string; // Col AE: Property Category
    lotArea: number; // Col E
    floorArea: number; // Col F
    type: PropertyType; // Inferred
}

export interface RawListing {
    [key: string]: string;
}
