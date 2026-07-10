const normalizePropertyType = (value: string) => value.trim().toUpperCase();

export const listingMatchesPropertyType = (itemTypeValue: string, selectedType: string): boolean => {
  const itemType = normalizePropertyType(itemTypeValue);
  const type = normalizePropertyType(selectedType);

  if (type === 'TOWNHOUSE') return itemType.includes('TOWNHOUSE') || itemType.includes('TOWN HOUSE');
  if (type === 'WAREHOUSE') return itemType.includes('WAREHOUSE');
  if (type === 'VACANT LOT') return itemType.includes('VACANT LOT');
  if (type === 'HOUSE AND LOT') return itemType.includes('HOUSE AND LOT') || itemType.includes('HOUSE & LOT');
  if (type === 'CONDO') return itemType.includes('CONDO');
  if (type === 'OFFICE/COMMERCIAL') return itemType.includes('OFFICE') || itemType.includes('COMMERCIAL');
  if (type === 'BUILDING') return itemType.includes('BUILDING');
  if (type === 'CLUB SHARE / BUSINESS') {
    return itemType.includes('CLUB SHARES') || itemType.includes('CLUB SHARE') || itemType.includes('BUSINESS');
  }

  return false;
};
