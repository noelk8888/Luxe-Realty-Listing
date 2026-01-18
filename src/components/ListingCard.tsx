import React, { useState, useEffect } from 'react';
import type { Listing } from '../types';
import { MapPin, Building, Maximize, Facebook, ChevronDown, ChevronUp, Bed, Car } from 'lucide-react';

interface ListingCardProps {
    listing: Listing;
    isSelected?: boolean;
    onToggleSelection?: (id: string) => void;
    isDisabled?: boolean;
    onNotesClick?: (id: string) => void;
    onMapClick?: (listing: Listing) => void;
    onShowNote?: (note: string, id: string) => void;
    index?: number;
    activeFilter?: string | null;
    isPopupView?: boolean;
    onBack?: () => void;
    backButtonVariant?: 'red' | 'blue' | 'gray';
}

export const ListingCard: React.FC<ListingCardProps> = React.memo(({
    listing,
    isSelected = false,
    isDisabled = false,
    onNotesClick,
    onMapClick,
    // onShowNote,
    index,
    activeFilter,
    isPopupView = false,
    onBack,
    backButtonVariant = 'blue'
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isColumnKCopied, setIsColumnKCopied] = useState(false);
    const [isColumnBDCopied, setIsColumnBDCopied] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);

    const formatPrice = (price: number) => {
        const formatted = new Intl.NumberFormat('en-PH', {
            maximumFractionDigits: 0
        }).format(price);
        return `P${formatted}`;
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

    const handleCopyColumnBD = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.columnBD) {
            navigator.clipboard.writeText(listing.columnBD);
            setIsColumnBDCopied(true);
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

    useEffect(() => {
        if (isColumnBDCopied) {
            const timer = setTimeout(() => setIsColumnBDCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isColumnBDCopied]);

    const isNotAvailable = listing.statusAQ && listing.statusAQ.toLowerCase().trim() !== 'available';
    // Removed red outline per user request: "UPDATE - no red outline on all NOT AVAILABLE situations"

    return (
        <div
            className={`rounded-xl shadow-sm border p-5 hover:shadow-md transition-all relative group
                ${isNotAvailable ? 'border-t-4 border-red-600' : ''}
                ${isSelected
                    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' // Selected State
                    : isNotAvailable
                        ? 'bg-white border-gray-100 hover:border-red-300 hover:shadow-red-100'  // NOT AVAILABLE hover - red tint
                        : 'bg-white border-gray-100 hover:border-blue-200'  // Normal State
                }
                ${isDisabled && !isSelected ? 'opacity-50' : ''}
            `}
        >
            {isNotAvailable && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-[50]">
                    <div className="bg-white border-2 border-red-600 px-6 py-1.5 rounded-2xl shadow-md flex items-center justify-center min-w-[160px]">
                        <span className="text-[12px] font-black uppercase tracking-[0.25em] text-red-600">
                            {listing.statusAQ}
                        </span>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col gap-1.5 flex-1 mr-4">
                    {listing.columnK && (
                        <div
                            onClick={handleCopyColumnK}
                            className={`text-sm font-extrabold leading-tight cursor-pointer transition-colors
                                ${isColumnKCopied ? 'text-green-600' : 'text-gray-900 hover:text-blue-600'}
                            `}
                            title="Click to copy"
                        >
                            {isColumnKCopied ? 'COPIED!' : `${index ? `${index}. ` : ''}${listing.columnK}`}
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
                        {listing.typeDescription && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-600">
                                {listing.typeDescription.toUpperCase()}
                            </span>
                        )}
                    </div>


                </div>
                <div className="flex items-center gap-2">
                    {listing.facebookLink && (
                        <a
                            href={listing.facebookLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-600 hover:bg-[#1877F2] hover:text-white transition-colors"
                            title="View on Facebook"
                        >
                            <Facebook size={18} fill="currentColor" strokeWidth={0} />
                        </a>
                    )}
                    <div className="flex flex-col items-end">
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isPopupView && onBack) {
                                    onBack();
                                } else if (onMapClick) {
                                    onMapClick(listing);
                                }
                            }}
                            className={`text-2xl font-bold text-black font-sans cursor-pointer hover:text-blue-600 hover:underline transition-colors tracking-tighter ${isPopupView ? 'underline' : ''}`}
                            title={isPopupView ? "Back" : "View on Map"}
                        >
                            {listing.id}
                        </span>
                        {/* Column BC: Reverted to Below Listing ID (Gray) */}
                        {listing.columnBC && !isPopupView && (
                            <div className="mt-1 text-xs text-gray-400 text-right">
                                {listing.columnBC}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Removed combined BC/BD block from bottom - moved to specific locations */}

            <div className="mb-4 mt-0.5">
                <div className="w-full bg-gray-100 p-2 rounded-lg shadow-inner flex flex-col items-center justify-center gap-0.5 text-center">
                    {/* Column BD: Top of Price, Light Green Theme */}
                    {listing.columnBD && (
                        <div
                            onClick={handleCopyColumnBD}
                            className={`mb-0.5 text-xs font-bold px-1.5 py-0.5 rounded border shadow-sm w-fit cursor-pointer transition-colors
                                ${isColumnBDCopied
                                    ? 'text-green-700 bg-green-100 border-green-300'
                                    : 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100'
                                }
                            `}
                            title="Click to copy"
                        >
                            {isColumnBDCopied ? 'COPIED!' : listing.columnBD}
                        </div>
                    )}

                    {listing.price === 0 && listing.leasePrice === 0 ? (
                        <div className="flex items-baseline gap-1 text-gray-900 justify-center">
                            <span className="text-xl font-bold uppercase tracking-tight">Price on Request</span>
                        </div>
                    ) : activeFilter === 'Lease' ? (
                        <>
                            {listing.leasePrice > 0 && (
                                <div className="flex items-baseline gap-1 text-gray-900 justify-center">
                                    <span className="text-xl font-bold">{formatPrice(listing.leasePrice)}/month</span>
                                    {listing.leasePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-500">
                                            ({formatPrice(listing.leasePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                            {listing.price > 0 && (
                                <div className="flex items-baseline gap-2 justify-center">
                                    <span className="text-xl font-bold text-gray-900">{formatPrice(listing.price)}</span>
                                    {listing.pricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-500">
                                            ({formatPrice(listing.pricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {listing.price > 0 && (
                                <div className="flex items-baseline gap-2 justify-center">
                                    <span className="text-xl font-bold text-gray-900">{formatPrice(listing.price)}</span>
                                    {listing.pricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-500">
                                            ({formatPrice(listing.pricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                            {listing.leasePrice > 0 && (
                                <div className="flex items-baseline gap-1 text-gray-900 justify-center">
                                    <span className="text-xl font-bold">{formatPrice(listing.leasePrice)}/month</span>
                                    {listing.leasePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-500">
                                            ({formatPrice(listing.leasePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                {/* Column BD removed from here */}
                {listing.displaySummary && (
                    <div className="relative">
                        <div
                            className={`text-sm font-medium text-black mt-1 leading-relaxed whitespace-pre-line
                                ${!isExpanded ? 'line-clamp-4' : ''}
                            `}
                        >
                            {listing.displaySummary}
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
                {listing.bedrooms > 0 && (
                    <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4" />
                        <span>{listing.bedrooms} Bedroom{listing.bedrooms > 1 ? 's' : ''}</span>
                    </div>
                )}
                {listing.parking > 0 && (
                    <div className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        <span>{listing.parking} Parking Slot{listing.parking > 1 ? 's' : ''}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Maximize className="w-4 h-4" />
                    {listing.lotArea > 0 && listing.floorArea > 0 ? (
                        // Both lot and floor area present - use 2 lines
                        <div className="flex flex-col">
                            <span>{listing.lotArea.toLocaleString()} sqm Lot Area</span>
                            <span>{listing.floorArea.toLocaleString()} sqm Floor Area</span>
                        </div>
                    ) : (
                        // Only one area present - single line
                        <span>
                            {listing.lotArea > 0 && (
                                <>
                                    {listing.lotArea.toLocaleString()} sqm Lot Area
                                </>
                            )}
                            {listing.floorArea > 0 && (
                                <>
                                    {listing.floorArea.toLocaleString()} sqm Floor Area
                                </>
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* Removed combined BC/BD block from bottom - moved to specific locations */}

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                {isPopupView ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onBack && onBack();
                        }}
                        className={`
                            flex-1 text-center py-2 text-white rounded-lg text-[10px] sm:text-xs font-bold transition-colors uppercase tracking-wider
                            ${backButtonVariant === 'red' ? 'bg-red-600 hover:bg-red-700' : ''}
                            ${backButtonVariant === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            ${backButtonVariant === 'gray' ? 'bg-gray-400 hover:bg-gray-500' : ''}
                        `}
                    >
                        {backButtonVariant === 'red' ? 'FEATURED' :
                            backButtonVariant === 'blue' ? 'SIMILAR' : 'BACK'}
                    </button>
                ) : (
                    listing.lat && listing.lng ? (
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-center py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-blue-100 transition-colors uppercase tracking-wider"
                        >
                            MAP
                        </a>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                alert(`No map coordinates available for ${listing.id}`);
                            }}
                            className="flex-1 text-center py-2 bg-gray-100 text-gray-400 rounded-lg text-[10px] sm:text-xs font-bold cursor-not-allowed uppercase tracking-wider"
                        >
                            MAP
                        </button>
                    )
                )}
                {listing.photoLink && (
                    <a
                        href={listing.photoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-indigo-100 transition-colors uppercase tracking-wider"
                    >
                        PHOTO
                    </a>
                )}
                <button
                    onClick={handleCopy}
                    className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all duration-200 uppercase tracking-wider flex items-center justify-center gap-1
                        ${isCopied
                            ? 'bg-green-500 text-white scale-105 shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }
                    `}
                >
                    {isCopied ? 'COPIED!' : 'COPY'}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Always open contact form directly
                        onNotesClick && onNotesClick(listing.id);
                    }}
                    className={`flex-1 text-center py-2 bg-yellow-50 rounded-lg text-xs font-bold hover:bg-yellow-100 transition-colors uppercase tracking-wider
                        ${listing.columnV ? 'text-yellow-700' : 'text-blue-600'}
                    `}
                >
                    NOTES
                </button>
            </div>

        </div >
    );
});
