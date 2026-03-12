import React, { useState, useEffect } from 'react';
import type { Listing } from '../types';
import { MapPin, Building, Maximize, ChevronDown, ChevronUp, Bed, Car, Facebook, Instagram, Youtube } from 'lucide-react';
import { StatusDropdown } from './StatusDropdown';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';

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
    onStatusUpdate?: (id: string, status: string) => Promise<void>;
    onEditClick?: (listing: Listing) => void;
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
    backButtonVariant = 'blue',
    onStatusUpdate,
    onEditClick,
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isColumnKCopied, setIsColumnKCopied] = useState(false);
    const [isColumnBDCopied, setIsColumnBDCopied] = useState(false);
    const [isPhotoLinkCopied, setIsPhotoLinkCopied] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);
    const { permissions } = usePermissions();
    const { fbGroup } = useAuth();

    const formatPrice = (price: number) => {
        const formatted = new Intl.NumberFormat('en-PH', {
            maximumFractionDigits: 0
        }).format(price);
        return `P${formatted}`;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const year = date.getFullYear();
            const month = date.toLocaleString('en-US', { month: 'short' });
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return dateString;
        }
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

    const handleCopyPhotoLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.photoLink) {
            navigator.clipboard.writeText(listing.photoLink);
            setIsPhotoLinkCopied(true);
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

    useEffect(() => {
        if (isPhotoLinkCopied) {
            const timer = setTimeout(() => setIsPhotoLinkCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isPhotoLinkCopied]);

    const status = (listing.statusAQ || '').toLowerCase().trim();
    const isNotAvailable = status !== 'available' && status !== '';
    const isUnderNego = status === 'under nego';
    const isUndecisiveSeller = status === 'undecisive seller';
    // Removed red outline per user request: "UPDATE - no red outline on all NOT AVAILABLE situations"
    const cardClassName = `
                group relative bg-white rounded-3xl transition-all duration-500
                ${isUndecisiveSeller ? 'border-t-4 border-t-amber-800' : isUnderNego ? 'border-t-4 border-t-blue-500' : isNotAvailable ? 'border-t-4 border-t-red-600' : ''}
                ${isSelected
            ? 'ring-4 ring-blue-500 ring-offset-4 shadow-2xl scale-[1.02] z-10'
            : isUndecisiveSeller
                ? 'bg-white border-gray-100 hover:border-amber-700 hover:shadow-amber-100'
                : isUnderNego
                ? 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-blue-100'
                : isNotAvailable
                ? 'bg-white border-gray-100 hover:border-red-300 hover:shadow-red-100'  // NOT AVAILABLE hover - red tint
                : 'border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50'
        }
    `;

    return (
        <div
            className={`${cardClassName} ${isDisabled && !isSelected ? 'opacity-50' : ''} p-5`}
        >
            {permissions.edit_listing && permissions.change_status && onStatusUpdate ? (
                <StatusDropdown
                    currentStatus={listing.statusAQ || 'Available'}
                    listingId={listing.id}
                    onUpdate={onStatusUpdate}
                />
            ) : (
                isNotAvailable && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-[50]">
                        <div className={`bg-white border-2 px-6 py-1.5 rounded-2xl shadow-md flex items-center justify-center min-w-[160px] ${isUndecisiveSeller ? 'border-amber-800' : isUnderNego ? 'border-blue-500' : 'border-red-600'}`}>
                            <span className={`text-[12px] font-black uppercase tracking-[0.25em] ${isUndecisiveSeller ? 'text-amber-800' : isUnderNego ? 'text-blue-500' : 'text-red-600'}`}>
                                {listing.statusAQ}
                            </span>
                        </div>
                    </div>
                )
            )}
            <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col gap-1.5 flex-1 mr-4">
                    {permissions.view_col_k && listing.columnK && (
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


                </div>
                <div className="flex items-center gap-2">
                    {fbGroup && permissions.view_fb_link && (() => {
                        const groupPostLink: Record<string, string | undefined> = {
                            'Luxe': listing.postLinkLuxe,
                            'Nexia': listing.postLinkNexia,
                            'Adolf': listing.postLinkAdolf,
                            'PCO': listing.postLinkPco,
                            'SLoo': listing.postLinkSloo,
                            'Taoke': listing.postLinkTaoke,
                            'Kiu': listing.facebookLink,
                        };
                        const url = (fbGroup && groupPostLink[fbGroup]) || listing.facebookLink || '';
                        if (!url) return null;
                        const socmed = url.includes('instagram.com')
                            ? { icon: <Instagram size={18} />, hover: 'hover:bg-[#E4405F]', title: 'Instagram' }
                            : url.includes('tiktok.com')
                            ? { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>, hover: 'hover:bg-black', title: 'TikTok' }
                            : url.includes('youtube.com') || url.includes('youtu.be')
                            ? { icon: <Youtube size={18} />, hover: 'hover:bg-[#FF0000]', title: 'YouTube' }
                            : url.includes('m.me') || url.includes('messenger.com')
                            ? { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.43 5.39 3.75 7.03v3.74c0 .8.88 1.28 1.59.87l2.48-1.24c.71.13 1.45.2 2.18.2 5.52 0 10-4.03 10-9S17.52 2 12 2zm1 14.24-2.5-2.73-4.86 2.73 5.35-5.68 2.5 2.73 4.86-2.73-5.35 5.68z" /></svg>, hover: 'hover:bg-blue-500', title: 'Messenger' }
                            : { icon: <Facebook size={18} />, hover: 'hover:bg-[#1877F2]', title: 'Facebook' };
                        return (
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-600 ${socmed.hover} hover:text-white transition-colors`}
                                title={socmed.title}
                            >
                                {socmed.icon}
                            </a>
                        );
                    })()}
                    <div className="flex flex-col items-end">
                        {permissions.view_col_ac && (
                        <span
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!permissions.geo_id_click) return;
                                if (isPopupView && onBack) {
                                    onBack();
                                } else if (onMapClick) {
                                    onMapClick(listing);
                                }
                            }}
                            className={`text-2xl font-bold text-black font-sans transition-colors tracking-tighter ${permissions.geo_id_click ? 'cursor-pointer hover:text-blue-600 hover:underline' : 'cursor-default'} ${isPopupView ? 'underline' : ''}`}
                            title={permissions.geo_id_click ? (isPopupView ? "Back" : "View on Map") : undefined}
                        >
                            {listing.id}
                        </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Removed combined BC/BD block from bottom - moved to specific locations */}

            <div className="mb-4 mt-0.5">
                <div className="w-full bg-gray-100 p-2 rounded-lg shadow-inner flex flex-col items-center justify-center gap-0.5 text-center">
                {!permissions.view_pricing && (
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Price Hidden</span>
                )}
                {permissions.view_pricing && <>
                    {/* Column BD: Top of Price, Light Green Theme */}
                    {permissions.view_listing_ownership && listing.columnBD && (
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
                </>}
                </div>
                {/* Column BD removed from here */}
                {permissions.view_col_aa && listing.displaySummary && (
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
                <div
                    className={`flex items-center gap-2 ${listing.photoLink ? 'cursor-pointer' : ''}`}
                    onClick={listing.photoLink ? handleCopyPhotoLink : undefined}
                    title={listing.photoLink ? 'Click to copy photo link' : undefined}
                >
                    <MapPin className={`w-4 h-4 ${isPhotoLinkCopied ? 'text-green-500' : ''}`} />
                    <span className={`truncate transition-colors ${isPhotoLinkCopied ? 'text-green-600 font-semibold' : listing.photoLink ? 'hover:text-blue-600' : ''}`}>
                        {isPhotoLinkCopied ? 'Photo link copied!' : `${listing.city}, ${listing.province}`}
                    </span>
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
                ) : permissions.view_map ? (
                    listing.lat && listing.lng ? (
                        <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${listing.lat},${listing.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-center py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-blue-100 transition-colors uppercase tracking-wider"
                        >
                            LOCATION
                        </a>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                alert(`No map coordinates available for ${listing.id}`);
                            }}
                            className="flex-1 text-center py-2 bg-gray-100 text-gray-400 rounded-lg text-[10px] sm:text-xs font-bold cursor-not-allowed uppercase tracking-wider"
                        >
                            LOCATION
                        </button>
                    )
                ) : null}
                {permissions.view_photos && listing.photoLink && (
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
                {permissions.view_copy && (
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
                )}
                {permissions.view_notes && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onNotesClick && onNotesClick(listing.id);
                        }}
                        className={`flex-1 text-center py-2 bg-yellow-50 rounded-lg text-xs font-bold hover:bg-yellow-100 transition-colors uppercase tracking-wider
                            ${listing.columnV ? 'text-yellow-700' : 'text-blue-600'}
                        `}
                    >
                        NOTES
                    </button>
                )}
                {permissions.edit_listing && onEditClick && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEditClick(listing);
                        }}
                        className="flex-1 text-center py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors uppercase tracking-wider"
                    >
                        EDIT
                    </button>
                )}
            </div>

            {/* Last Update */}
            {permissions.view_last_update && listing.columnBC && !isPopupView && (() => {
                const [datePart, userPart, typePart] = listing.columnBC.split(' | ');
                const label = typePart === 'STATUS' ? 'Status Update' : 'Listing Update';
                return (
                    <div className="mt-2 text-xs text-black text-center">
                        {label}{datePart ? ` - ${formatDate(datePart)}` : ''}{userPart ? `, by ${userPart}` : ''}
                    </div>
                );
})()}

        </div >
    );
});
