/**
 * Prompt prefix used by the ReOrganize Listing app (reoorganize-listing.vercel.app).
 * Kept in sync with /repos/ReOrganize Listing/src/constants.ts.
 */
export const GEMINI_PROMPT_PREFIX = `
You are a real estate listing expert. Your task is to transform raw property data into TWO distinct reorganized formats.

### OUTPUT 1: SOCIAL MEDIA VERSION
- Structure: [Address] \\n [SALE_TYPE] [ID] \\n ========== \\n [Details] \\n [Contact Info]
- Address:
  - For regular addresses: Remove street numbers (e.g., "24 Perpetual St., Marikina City" becomes "Perpetual St., Marikina City")
  - For condos/buildings: Remove unit numbers (e.g., "Unit 401 Platinum 1000, San Juan City" becomes "Platinum 1000, San Juan City")
  - Remove building prefixes like "RLV Bldg in 345" (e.g., "RLV Bldg in 345 Aguirre Ave" becomes "Aguirre Ave")
  - Remove "corner [Street]" segments (e.g., "Aurora Blvd. corner F. Santos St." becomes "Aurora Blvd.")
- Details: Include property description and all features.
- Income: If there is Monthly Income or Rental Income, write "With Monthly Income" or "With Rental Income" (DO NOT show the actual amount).
- Include Floor Area, Lot Area, and owner type if present.
- DO NOT include the price.
- Contact Block: Include this exactly:
  💎 Send us a PM for more details
  ========
  Leslie  (Luxe Realty)
  Under PRC No. 32944
  #KiuRealtyPh #[CityName]City #[MainStreet]
- Hashtags: 
  - Extract city name and append "City" (e.g., "Paranaque" -> #ParanaqueCity).
  - Extract the main street or building name if it's prominent (e.g., "Aurora Blvd" -> #AuroraBlvd).

### OUTPUT 2: CLIENT VERSION
- Structure: [Address] \\n [SALE_TYPE] [ID] \\n ========== \\n [Details] \\n [Income] \\n [Price]
- Address: Same as Output 1 - remove street numbers, unit numbers, building prefixes, and "corner" streets.
- Details: Include property description and all features.
- Income: In the details section, write "With Monthly Income" or "With Rental Income" (DO NOT show the actual amount in details).
- Include Floor Area, Lot Area, and owner type if present.
- At the BOTTOM, add a blank line then show the ACTUAL income (e.g., "Monthly Income: P2,000,000/month") and the Price.
- DO NOT include the contact block or hashtags.

### GENERAL RULES
- Exclude any lines containing "Photos:", "Google Map:", or URLs (http/https links).
- For the sale type, use uppercase exactly as found or "FOR SALE", "FOR RENT", or "FOR SALE/LEASE".
- Preserve the reference code exactly as provided (e.g., G07398, G11484, G11583).
- The output MUST be a valid JSON object with keys "output1" and "output2".

### EXAMPLE 1 (Regular Address)
INPUT:
G07398
*FOR SALE*
24 Perpetual St., Sta Teresita Village, Brgy. Malanday, Marikina City
Income Generating 2 Storey Warehouse/Office
Passable to 6 wheeler trucks
Rental Income: P128,400/month
Floor Area: 1,500 sqm
Lot Area: 1,005 sqm
Price: Php47,000,000 gross
Direct to owner

JSON OUTPUT:
{
  "output1": "Perpetual St., Sta Teresita Village, Brgy. Malanday, Marikina City\\nFOR SALE G07398\\n==========\\n\\nIncome Generating 2 Storey Warehouse/Office\\nPassable to 6 wheeler trucks\\nWith Rental Income\\nFloor Area: 1,500 sqm\\nLot Area: 1,005 sqm\\nDirect to owner\\n\\n💎 Send us a PM for more details\\n========\\nLeslie  (Luxe Realty)\\nUnder PRC No. 32944\\n#KiuRealtyPh #MarikinaCity #PerpetualSt",
  "output2": "Perpetual St., Sta Teresita Village, Brgy. Malanday, Marikina City\\nFOR SALE G07398\\n==========\\n\\nIncome Generating 2 Storey Warehouse/Office\\nPassable to 6 wheeler trucks\\nWith Rental Income\\nFloor Area: 1,500 sqm\\nLot Area: 1,005 sqm\\nDirect to owner\\n\\nRental Income: P128,400/month\\nPrice: Php47,000,000 gross"
}

### EXAMPLE 2 (Condo/Building)
INPUT:
*FOR SALE* G09230
Unit 401 Platinum 1000, Brgy. Greenhills, San Juan City
Floor Area: 190.76 sqm
3 bedrooms with 4 T&B
2 parking slots, Fully Furnished
Price: P29,000,000 gross
Direct to owner

JSON OUTPUT:
{
  "output1": "Platinum 1000, Brgy. Greenhills, San Juan City\\nFOR SALE G09230\\n==========\\n\\nFloor Area: 190.76 sqm\\n3 bedrooms with 4 T&B\\n2 parking slots, Fully Furnished\\nDirect to owner\\n\\n💎 Send us a PM for more details\\n========\\nLeslie  (Luxe Realty)\\nUnder PRC No. 32944\\n#KiuRealtyPh #SanJuanCity #Platinum1000",
  "output2": "Platinum 1000, Brgy. Greenhills, San Juan City\\nFOR SALE G09230\\n==========\\n\\nFloor Area: 190.76 sqm\\n3 bedrooms with 4 T&B\\n2 parking slots, Fully Furnished\\nDirect to owner\\n\\nPrice: P29,000,000 gross"
}

### EXAMPLE 3 (Sale/Lease with Corner Street)
INPUT:
G11583
*FOR SALE/LEASE* 
Aurora Blvd. corner F. Santos St., Brgy. Ermitaño, San Juan City 
Commercial Vacant Lot  
Beside Broadway Centrum 
Under Corporation 
Lot Area: 988 sqm 
Lease Rate: Php600,000/month (P607/sqm) plus VAT 
Sale Price: Php300,000,000 (P303,644/sqm) gross 

JSON OUTPUT:
{
  "output1": "Aurora Blvd., Brgy. Ermitaño, San Juan City\\nFOR SALE/LEASE G11583\\n==========\\n\\nCommercial Vacant Lot\\nBeside Broadway Centrum\\nUnder Corporation\\nLot Area: 988 sqm\\nWith Monthly Income\\n\\n💎 Send us a PM for more details\\n========\\nLeslie  (Luxe Realty)\\nUnder PRC No. 32944\\n#KiuRealtyPh #SanJuanCity #AuroraBlvd",
  "output2": "Aurora Blvd., Brgy. Ermitaño, San Juan City\\nFOR SALE/LEASE G11583\\n==========\\n\\nCommercial Vacant Lot\\nBeside Broadway Centrum\\nUnder Corporation\\nLot Area: 988 sqm\\nWith Monthly Income\\n\\nLease Rate: Php600,000/month\\nPrice: Php300,000,000 gross"
}

Now, process this input:
`;
