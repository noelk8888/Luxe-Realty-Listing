import React, { useState, useEffect } from 'react';
import type { Listing } from '../types';
import { MapPin, Building, Maximize, Facebook, ChevronDown, ChevronUp } from 'lucide-react';

interface ListingCardProps {
    listing: Listing;
    isSelected?: boolean;
    onToggleSelection?: (id: string) => void;
    isDisabled?: boolean;
    onNotesClick?: (id: string) => void;
    index?: number;
}

export const ListingCard: React.FC<ListingCardProps> = React.memo(({ listing, isSelected = false, isDisabled = false, onNotesClick, index }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isColumnKCopied, setIsColumnKCopied] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            maximumFractionDigits: 0
        }).format(price);
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.summary) {
            navigator.clipboard.writeText(listing.summary);
            setIsCopied(true);
        }
    };

    const handleCopyColumnK = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.columnK) {
            navigator.clipboard.writeText(listing.columnK);
            setIsColumnKCopied(true);
        }
    };

    useEffect(() => {
        if (isCopied) {
            const timer = setTimeout(() => setIsCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isCopied]);

    useEffect(() => {
        if (isColumnKCopied) {
            const timer = setTimeout(() => setIsColumnKCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isColumnKCopied]);

    return (
        <div
            className={`rounded-xl shadow-sm border p-5 hover:shadow-md transition-all relative group
                ${isSelected
                    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' // Selected State
                    : 'bg-white border-gray-100 hover:border-blue-200'  // Normal State
                }
                ${isDisabled && !isSelected ? 'opacity-50' : ''}
            `}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex flex-col gap-1.5">
                    {listing.columnK && (
                        <div
                            onClick={handleCopyColumnK}
                            className={`text-sm font-bold leading-tight cursor-pointer transition-colors
                                ${isColumnKCopied ? 'text-green-600' : 'text-gray-900 hover:text-blue-600'}
                            `}
                            title="Click to copy"
                        >
                            {isColumnKCopied ? 'COPIED!' : `${index ? `${index}. ` : ''}${listing.columnK}`}
                        </div>
                    )}
                    {listing.columnP && (
                        <div className="text-sm border p-1 rounded bg-green-50 text-green-800">
                            {listing.columnP}
                        </div>
                    )}
                    <div className="flex gap-1.5 flex-wrap">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${listing.columnAE ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                            {listing.columnAE || 'OTHERS'}
                        </span>
                        {listing.saleType && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600">
                                {listing.saleType.toUpperCase()}
                            </span>
                        )}
                        {listing.isDirect && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">
                                DIRECT
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {listing.facebookLink && (
                        <a
                            href={listing.facebookLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-900 text-white hover:bg-[#1877F2] transition-colors"
                            title="View on Facebook"
                        >
                            <Facebook size={16} fill="currentColor" strokeWidth={0} />
                        </a>
                    )}
                    <div className="flex flex-col items-end">
                        <span className="text-lg font-bold text-black font-mono">{listing.id}</span>
                        {(listing.columnN || listing.columnM) && (
                            <span className="text-xs font-semibold text-gray-500">
                                {listing.columnN || listing.columnM}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="mb-4">
                <div className="text-xl font-bold text-gray-900">
                    {formatPrice(listing.price)}
                    {listing.pricePerSqm > 0 && (
                        <span className="text-sm font-normal text-gray-500 ml-2">
                            ({formatPrice(listing.pricePerSqm)}/sqm)
                        </span>
                    )}
                </div>
                {listing.summary && (
                    <div className="relative">
                        <div
                            className={`text-sm font-medium text-black mt-1 leading-relaxed whitespace-pre-line
                                ${!isExpanded ? 'line-clamp-4' : ''}
                            `}
                        >
                            {listing.summary}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                            }}
                            className="mt-1 flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors bg-transparent border-0 p-0 cursor-pointer"
                        >
                            {isExpanded ? (
                                <>Show Less <ChevronUp size={14} /></>
                            ) : (
                                <>Show More <ChevronDown size={14} /></>
                            )}
                        </button>
                    </div>
                )}
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
                            <span>{listing.lotArea} sqm Lot Area</span>
                            <span>{listing.floorArea} sqm Floor Area</span>
                        </div>
                    ) : (
                        // Only one area present - single line
                        <span>
                            {listing.lotArea > 0 && (
                                <>
                                    {listing.lotArea} sqm Lot Area
                                </>
                            )}
                            {listing.floorArea > 0 && (
                                <>
                                    {listing.floorArea} sqm Floor Area
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                {listing.photoLink && (
                    <a
                        href={listing.photoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors uppercase tracking-wider"
                    >
                        PHOTO
                    </a>
                )}
                {listing.mapLink && (
                    <a
                        href={listing.mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center py-2 bg-blue-100 text-black rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors uppercase tracking-wider"
                    >
                        MAP
                    </a>
                )}
                <button
                    onClick={handleCopy}
                    className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all duration-200 uppercase tracking-wider flex items-center justify-center gap-1
                        ${isCopied
                            ? 'bg-green-500 text-white scale-105 shadow-sm'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }
                    `}
                >
                    {isCopied ? 'COPIED!' : 'COPY'}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onNotesClick && onNotesClick(listing.id);
                    }}
                    className="flex-1 text-center py-2 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-bold hover:bg-yellow-200 transition-colors uppercase tracking-wider"
                >
                    NOTES
                </button>
            </div>

            {listing.columnV && (
                <div className="mt-3 text-sm italic text-black border-t border-gray-100 pt-2">
                    {listing.columnV}
                </div>
            )}
        </div>
    );
});
