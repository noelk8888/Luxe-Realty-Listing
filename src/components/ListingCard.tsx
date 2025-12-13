import React from 'react';
import type { Listing } from '../types';
import { MapPin, Building, Maximize } from 'lucide-react';

interface ListingCardProps {
    listing: Listing;
    isSelected?: boolean;
    onToggleSelection?: (id: string) => void;
    isDisabled?: boolean;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, isSelected = false, onToggleSelection, isDisabled = false }) => {
    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }).format(price);
    };

    return (
        <div
            onClick={() => onToggleSelection && (!isDisabled || isSelected) && onToggleSelection(listing.id)}
            className={`rounded-xl shadow-sm border p-5 hover:shadow-md transition-all cursor-pointer relative group
                ${isSelected
                    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' // Selected State
                    : 'bg-white border-gray-100 hover:border-blue-200'  // Normal State
                }
                ${isDisabled && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${listing.columnAE ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                        {listing.columnAE || 'OTHERS'}
                    </span>
                    {listing.saleType && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600">
                            {listing.saleType}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Checkbox removed per update - Card is clickable */}

                    <span className="text-lg font-bold text-black font-mono">{listing.id}</span>
                </div>
            </div>

            {/* Summary removed per user request */}

            <div className="text-xl font-bold text-gray-900 mb-4">
                {formatPrice(listing.price)}
            </div>

            <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{listing.city}, {listing.province}</span>
                </div>
                {(listing.building || listing.area || listing.barangay) && (
                    <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        <span className="truncate">{listing.building || listing.area || listing.barangay}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Maximize className="w-4 h-4" />
                    {listing.lotArea > 0 && listing.floorArea > 0 ? (
                        // Both lot and floor area present - use 2 lines
                        <div className="flex flex-col">
                            <span>{listing.lotArea} sqm Lot Area ({formatPrice(listing.pricePerSqm)}/sqm)</span>
                            <span>{listing.floorArea} sqm Floor Area</span>
                        </div>
                    ) : (
                        // Only one area present - single line
                        <span>
                            {listing.lotArea > 0 && (
                                <>
                                    {listing.lotArea} sqm Lot Area ({formatPrice(listing.pricePerSqm)}/sqm)
                                </>
                            )}
                            {listing.floorArea > 0 && (
                                <>
                                    {listing.floorArea} sqm Floor Area ({formatPrice(listing.pricePerSqm)}/sqm)
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
