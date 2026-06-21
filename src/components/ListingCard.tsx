import React, { useState, useEffect } from 'react';
import type { Listing } from '../types';
import { MapPin, Building, Maximize, ChevronDown, ChevronUp, Bed, Car, Facebook, Instagram, Youtube, Receipt } from 'lucide-react';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';
import { useViewing } from '../contexts/ViewingContext';
import { GEMINI_PROMPT_PREFIX } from '../constants/reorganizePrompt';
import { extractClientVersion } from '../services/geminiService';
import kiuLogo from '../assets/kiu_logo.png';

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

    onEditClick?: (listing: Listing) => void;
    rowNumber?: number | null;
}

const getImageUrl = (photoLink: string | undefined): { isGooglePhotos: boolean; directUrl?: string } => {
    if (!photoLink) return { isGooglePhotos: false };
    const cleanLink = photoLink.trim();
    if (!cleanLink.startsWith('http')) return { isGooglePhotos: false };

    const isGooglePhotos = cleanLink.includes('photos.app.goo.gl') || cleanLink.includes('photos.google.com');
    if (!isGooglePhotos) {
        return { isGooglePhotos: false, directUrl: cleanLink };
    }
    return { isGooglePhotos: true };
};

const failedPhotoExtractions = new Set<string>();

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
    onEditClick,
    rowNumber,
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isColumnKCopied, setIsColumnKCopied] = useState(false);
    const [isPhotoLinkCopied, setIsPhotoLinkCopied] = useState(false);
    const [isMapLinkCopied, setIsMapLinkCopied] = useState(false);
    const [isClientCopied, setIsClientCopied] = useState(false);
    const [isClientEmpty, setIsClientEmpty] = useState(false);
    const [isClientLoading, setIsClientLoading] = useState(false);
    const [isClientError, setIsClientError] = useState(false);
    const [clientErrorMsg, setClientErrorMsg] = useState('');

    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [isPhotoLoading, setIsPhotoLoading] = useState(false);
    const [photoError, setPhotoError] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);
    const { permissions } = usePermissions();
    const { fbGroup, role } = useAuth();
    const { addToViewing, removeFromViewing, isInViewing, isFull } = useViewing();



    const formatPrice = (price: number) => {
        const formatted = new Intl.NumberFormat('en-PH', {
            maximumFractionDigits: 0
        }).format(price);
        return `P${formatted}`;
    };
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr.includes(' | ') ? dateStr.split(' | ')[0] : dateStr);
        if (isNaN(date.getTime())) return dateStr;
        
        // Format: Mar 24, 2026 (Mmm dd, yyyy)
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: '2-digit', 
            year: 'numeric' 
        });
    };
    // Computed per-sqm prices: use DB value if available, otherwise calculate from price/area
    const effectivePricePerSqm = listing.pricePerSqm > 0
        ? listing.pricePerSqm
        : (() => {
            const area = listing.lotArea > 0 ? listing.lotArea : listing.floorArea;
            return (area > 0 && listing.price > 0) ? Math.round(listing.price / area) : 0;
        })();

    const effectiveLeasePricePerSqm = listing.leasePricePerSqm > 0
        ? listing.leasePricePerSqm
        : (() => {
            const area = listing.floorArea > 0 ? listing.floorArea : listing.lotArea;
            return (area > 0 && listing.leasePrice > 0) ? Math.round(listing.leasePrice / area) : 0;
        })();

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.summary) {
            // Split notes out of summary (summary = mainBody + '\n\n' + columnV)
            const notes = listing.columnV?.trim() || '';
            const mainBody = notes && listing.summary.endsWith('\n\n' + notes)
                ? listing.summary.slice(0, -(notes.length + 2))
                : listing.summary;

            const mapsLink = (listing.lat && listing.lng)
                ? `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`
                : '';

            const cleanId = listing.id.trim();
            const cleanBody = mainBody.trim();
            let copyText = cleanBody.startsWith(cleanId) ? mainBody : `${cleanId}\n${mainBody}`;
            
            if (listing.monthlyDues && !copyText.toLowerCase().includes('monthly dues:')) {
                const priceMatch = copyText.match(/\n(?=\s*(?:Lease Price|Sale Price|Price)\s*:)/i);
                if (priceMatch && priceMatch.index !== undefined) {
                    copyText = copyText.slice(0, priceMatch.index) + `\nMonthly Dues: ${listing.monthlyDues}` + copyText.slice(priceMatch.index);
                } else {
                    copyText += `\nMonthly Dues: ${listing.monthlyDues}`;
                }
            }

            let footer = '';

            // Update date
            let datePrefix = 'Last Update Unknown';
            if (listing.columnBC) {
                const parts = listing.columnBC.split(' | ');
                const datePart = parts[0]?.trim();
                if (datePart) {
                    const date = new Date(datePart);
                    if (!isNaN(date.getTime())) {
                        const formattedDate = date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        });
                        datePrefix = `${formattedDate} update`;
                    }
                }
            }
            footer += datePrefix;

            // Remove existing Verified Map Location from copyText to move it to footer
            const verifiedMapRegex = /\n?Verified Map Location:.*?(\n|$)/gi;
            const existingMapLineMatch = copyText.match(verifiedMapRegex);
            copyText = copyText.replace(verifiedMapRegex, '').trimEnd();

            // Map link
            const hasGooglePin = /google\s*pin\s*:/i.test(copyText);
            if (existingMapLineMatch) {
                // If it was already in the text, append it exactly
                footer += `\n${existingMapLineMatch[0].trim()}`;
            } else if (mapsLink && listing.mapVerified && !hasGooglePin) {
                footer += `\nVerified Map Location: ${mapsLink}`;
            }

            // Note
            if (notes) {
                footer += `\nThere's a NOTE in this listing. Check it in the app`;
            }

            copyText = `${copyText}\n\n${footer}`;

            navigator.clipboard.writeText(copyText);
            setIsCopied(true);
        }
    };

    const handleCopyColumnK = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.columnK) {
            // Strip "Owner - " prefix if present
            const ownerName = listing.columnK.replace(/^Owner\s*-\s*/i, '');
            let copyText = ownerName;
            if (listing.columnBD) {
                // Swap order: Owner first, then Ownership
                copyText = `${ownerName}\n${listing.columnBD}`;
            }
            navigator.clipboard.writeText(copyText);
            setIsColumnKCopied(true);
        }
    };



    const handleCopyPhotoLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (listing.photoLink) {
            navigator.clipboard.writeText(listing.photoLink);
            setIsPhotoLinkCopied(true);
        }
    };

    const handleCopyMapLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (role !== 'superadmin') return;
        if (!listing.lat || !listing.lng) return;
        const url = `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`;
        navigator.clipboard.writeText(url);
        setIsMapLinkCopied(true);
    };
    
    const handleCopyClientVersion = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // AI Client Version Generation: Kiu group and superadmin only
        if (role !== 'superadmin' && fbGroup !== 'Kiu') return;
        if (isClientLoading) return;

        const rawText = (listing.summary || '').trim();
        if (!rawText) {
            setIsClientEmpty(true);
            return;
        }

        setIsClientLoading(true);
        setIsClientError(false);
        try {
            const result = await extractClientVersion(
                `${GEMINI_PROMPT_PREFIX}\n\nINPUT:\n${rawText}`
            );
            const output2 = result.output2 || '';
            if (!output2.trim()) throw new Error('Empty output2 from Gemini');

            await navigator.clipboard.writeText(output2);
            setIsClientCopied(true);
        } catch (err) {
            console.error('[ListingCard] Gemini extraction error:', err);
            const msg = err instanceof Error ? err.message : String(err);
            // Show a short version: first 60 chars so it fits in the card
            setClientErrorMsg(msg.length > 60 ? msg.slice(0, 57) + '…' : msg);
            setIsClientError(true);
        } finally {
            setIsClientLoading(false);
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
        if (isPhotoLinkCopied) {
            const timer = setTimeout(() => setIsPhotoLinkCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isPhotoLinkCopied]);

    useEffect(() => {
        if (isMapLinkCopied) {
            const timer = setTimeout(() => setIsMapLinkCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isMapLinkCopied]);

    useEffect(() => {
        if (isClientCopied) {
            const timer = setTimeout(() => setIsClientCopied(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isClientCopied]);

    useEffect(() => {
        if (isClientEmpty) {
            const timer = setTimeout(() => setIsClientEmpty(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isClientEmpty]);

    useEffect(() => {
        if (isClientError) {
            const timer = setTimeout(() => setIsClientError(false), 2500);
            return () => clearTimeout(timer);
        }
    }, [isClientError]);

    useEffect(() => {
        if (!permissions.view_photos || !listing.photoLink) {
            setPhotoUrl(null);
            setIsPhotoLoading(false);
            setPhotoError(false);
            return;
        }

        const { isGooglePhotos, directUrl } = getImageUrl(listing.photoLink);
        if (!isGooglePhotos) {
            setPhotoUrl(directUrl || null);
            setIsPhotoLoading(false);
            setPhotoError(false);
            return;
        }

        const cacheKey = `gphoto_thumb_${listing.id}`;
        
        const cached = localStorage.getItem(cacheKey);
        if (cached && cached !== 'FAILED') {
            setPhotoUrl(cached);
            setIsPhotoLoading(false);
            setPhotoError(false);
            return;
        } else if (cached === 'FAILED') {
            localStorage.removeItem(cacheKey);
        }

        if (failedPhotoExtractions.has(listing.id)) {
            setPhotoError(true);
            setIsPhotoLoading(false);
            return;
        }

        let isMounted = true;
        setIsPhotoLoading(true);
        setPhotoError(false);

        const resolvePhoto = async () => {
            try {
                const proxyUrl = `/api/photo-proxy?url=${encodeURIComponent(listing.photoLink!)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                const html = await res.text();
                
                const regex = /https:\/\/[a-zA-Z0-9\.\-]+\.googleusercontent\.com\/pw\/[a-zA-Z0-9_\-]+/g;
                const matches = html.match(regex);
                if (matches && matches.length > 0) {
                    const resolvedUrl = matches[0] + '=w600';
                    if (isMounted) {
                        localStorage.setItem(cacheKey, resolvedUrl);
                        setPhotoUrl(resolvedUrl);
                        setIsPhotoLoading(false);
                    }
                    return;
                }
                throw new Error('No image URLs found in response');
            } catch (err) {
                console.error(`[ListingCard] Failed to extract photo for ${listing.id}:`, err);
                if (isMounted) {
                    failedPhotoExtractions.add(listing.id);
                    setPhotoError(true);
                    setIsPhotoLoading(false);
                }
            }
        };

        resolvePhoto();

        return () => {
            isMounted = false;
        };
    }, [listing.id, listing.photoLink, permissions.view_photos]);

    const status = (listing.statusAQ || '').toLowerCase().trim();
    const isNotAvailable = status !== 'available' && status !== '';
    const isUnderNego = status === 'under nego';
    const isUndecisiveSeller = status === 'undecisive seller';
    // Removed red outline per user request: "UPDATE - no red outline on all NOT AVAILABLE situations"
    const cardClassName = `
                group relative bg-white rounded-3xl transition-all duration-300
                border-t-4
                ${isUndecisiveSeller ? 'border-t-amber-100 hover:border-t-amber-700'
                    : isUnderNego    ? 'border-t-blue-100  hover:border-t-blue-600'
                    : isNotAvailable ? 'border-t-red-100   hover:border-t-red-600'
                    :                  'border-t-green-100 hover:border-t-green-600'}
                ${isSelected
            ? 'ring-4 ring-blue-500 ring-offset-4 shadow-2xl scale-[1.02] z-10'
            : isUndecisiveSeller
                ? 'bg-white border-gray-100 hover:shadow-amber-100'
                : isUnderNego
                ? 'bg-white border-gray-100 hover:shadow-blue-100'
                : isNotAvailable
                ? 'bg-white border-gray-100 hover:shadow-red-100'
                : 'border border-gray-100 hover:shadow-xl hover:shadow-green-50'
        }
    `;

    // Watermark: group logo (or group name text) in top-right corner of photo/placeholder
    const renderWatermark = () => {
        const logoSrc = fbGroup === 'Luxe' ? '/luxe-logo.png'
            : fbGroup === 'Kiu' ? kiuLogo
            : null;
        if (logoSrc) {
            return (
                <div className="absolute top-3 right-3 z-20 pointer-events-none">
                    <img
                        src={logoSrc}
                        alt={fbGroup || ''}
                        className="h-9 w-auto opacity-60 drop-shadow-md object-contain"
                    />
                </div>
            );
        }
        if (fbGroup) {
            return (
                <div className="absolute top-3 right-3 z-20 pointer-events-none">
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white opacity-75 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                        {fbGroup}
                    </span>
                </div>
            );
        }
        return null;
    };

    const renderPriceModule = (isOverlay: boolean) => {
        let bgClass = '';
        if (isClientLoading) {
            bgClass = isOverlay
                ? 'backdrop-blur-md bg-blue-100/75 border border-white/65 shadow-[0_2px_12px_rgba(0,0,0,0.18)]'
                : 'bg-blue-50 shadow-md';
        } else if (isClientCopied) {
            bgClass = isOverlay
                ? 'backdrop-blur-md bg-green-100/75 border border-white/65 shadow-[0_2px_12px_rgba(0,0,0,0.18)] scale-[1.02]'
                : 'bg-green-100 shadow-md scale-[1.02]';
        } else if (isClientError || isClientEmpty) {
            bgClass = isOverlay
                ? 'backdrop-blur-md bg-red-100/75 border border-white/65 shadow-[0_2px_12px_rgba(0,0,0,0.18)]'
                : 'bg-red-50 shadow-md';
        } else if (role === 'superadmin' || fbGroup === 'Kiu') {
            bgClass = isOverlay
                ? 'backdrop-blur-md bg-white/75 border border-white/65 shadow-[0_2px_12px_rgba(0,0,0,0.18)]'
                : 'bg-gray-100 hover:bg-gray-200 shadow-inner';
        } else {
            bgClass = isOverlay
                ? 'backdrop-blur-md bg-white/75 border border-white/65 shadow-[0_2px_12px_rgba(0,0,0,0.18)]'
                : 'bg-gray-100 shadow-inner';
        }

        return (
            <div 
                onClick={handleCopyClientVersion}
                className={`w-full px-3 py-2.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-center transition-all duration-200
                    ${(role === 'superadmin' || fbGroup === 'Kiu') ? 'cursor-pointer' : 'cursor-default'}
                    ${bgClass}
                `}
                title={(role === 'superadmin' || fbGroup === 'Kiu') ? 'Click to generate & copy Client Version (via AI)' : undefined}
            >
                {!permissions.view_pricing && (
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Price Hidden</span>
                )}
                {permissions.view_pricing && <>
                    {isClientLoading ? (
                        <span className="flex items-center gap-2 text-sm font-black text-blue-500 uppercase tracking-widest">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Generating...
                        </span>
                    ) : isClientCopied ? (
                        <span className="text-sm font-black text-green-600 uppercase tracking-widest animate-pulse">Copied!</span>
                    ) : isClientError ? (
                        <>
                            <span className="text-xs font-black text-red-500 uppercase tracking-widest">AI Error — Try Again</span>
                            {clientErrorMsg && <span className="text-[10px] text-red-400 font-mono leading-tight">{clientErrorMsg}</span>}
                        </>
                    ) : isClientEmpty ? (
                        <span className="text-sm font-black text-red-500 uppercase tracking-widest">Nothing to copy</span>
                    ) : (
                        <>
                        {/* Column BD: Top of Price, Light Green Theme */}
                        {permissions.view_listing_ownership && listing.columnBD && !['available', 'sold', 'leased out', 'off market', 'on hold', 'under nego', 'undecisive seller'].includes(listing.columnBD.toLowerCase().trim()) && (
                            <div
                                className="mb-0.5 text-xs font-bold px-1.5 py-0.5 rounded border border-green-200 bg-green-50 text-green-600 shadow-sm w-fit cursor-default"
                            >
                                {listing.columnBD}
                            </div>
                        )}
                        </>
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
                                    {effectiveLeasePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-800/80">
                                            ({formatPrice(effectiveLeasePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                            {listing.price > 0 && (
                                <div className="flex items-baseline gap-2 justify-center">
                                    <span className="text-xl font-bold text-gray-900">{formatPrice(listing.price)}</span>
                                    {effectivePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-800/80">
                                            ({formatPrice(effectivePricePerSqm)}/sqm)
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
                                    {effectivePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-800/80">
                                            ({formatPrice(effectivePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                            {listing.leasePrice > 0 && (
                                <div className="flex items-baseline gap-1 text-gray-900 justify-center">
                                    <span className="text-xl font-bold">{formatPrice(listing.leasePrice)}/month</span>
                                    {effectiveLeasePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-800/80">
                                            ({formatPrice(effectiveLeasePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </>}
            </div>
        );
    };

    return (
        <div
            className={`${cardClassName} ${isDisabled && !isSelected ? 'opacity-50' : ''} p-5`}
        >
            {/* Header Row: owner name left when preview_pic on, status pill left otherwise — GEO-ID always right */}
            <div className="flex items-center justify-between mb-3">
                {/* Left side: owner name (preview_pic ON) OR status pill (preview_pic OFF) */}
                {permissions.preview_pic ? (
                    /* preview_pic ON — show owner name on the left, same line as GEO-ID */
                    permissions.view_col_k && listing.columnK ? (
                        <div
                            onClick={handleCopyColumnK}
                            className={`text-sm font-extrabold leading-tight cursor-pointer transition-colors truncate mr-3
                                ${isColumnKCopied ? 'text-green-600' : 'text-gray-900 hover:text-blue-600'}
                            `}
                            title="Click to copy"
                        >
                            {isColumnKCopied ? 'COPIED!' : `${index ? `${index}. ` : ''}${listing.columnK}`}
                        </div>
                    ) : <div />
                ) : (
                    /* preview_pic OFF — show status pill on the left */
                    <div className={`bg-white border-2 px-6 py-1.5 rounded-2xl shadow-sm flex items-center justify-center min-w-[140px] 
                        ${isUndecisiveSeller ? 'border-amber-800' : 
                          isUnderNego ? 'border-blue-500' : 
                          isNotAvailable ? 'border-red-600' : 
                          'border-green-600'}`}>
                        <span className={`text-[12px] font-black uppercase tracking-[0.25em] 
                            ${isUndecisiveSeller ? 'text-amber-800' : 
                              isUnderNego ? 'text-blue-500' : 
                              isNotAvailable ? 'text-red-600' : 
                              'text-green-600'}`}>
                            {(listing.statusAQ?.toUpperCase() === 'OFF THE MARKET' ? 'OFF MARKET' : listing.statusAQ) || 'Available'}
                        </span>
                    </div>
                )}

                {/* Right: Social Media Links and Listing ID */}
                <div className="flex items-center gap-2 flex-shrink-0">
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
                        const url = (fbGroup && groupPostLink[fbGroup]) || '';
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
                            className={`text-2xl font-black text-black font-sans transition-colors tracking-tighter ${permissions.geo_id_click ? 'cursor-pointer hover:text-blue-600 hover:underline' : 'cursor-default'} ${isPopupView ? 'underline' : ''}`}
                            title={permissions.geo_id_click ? (isPopupView ? "Back" : "View on Map") : undefined}
                        >
                            {listing.id}
                        </span>
                    )}
                </div>
            </div>

            {/* Owner name — only shown as own row when preview_pic is OFF (otherwise it's in the header) */}
            {permissions.view_col_k && listing.columnK && !permissions.preview_pic && (
                <div
                    onClick={handleCopyColumnK}
                    className={`text-sm font-extrabold leading-tight cursor-pointer transition-colors mb-3
                        ${isColumnKCopied ? 'text-green-600' : 'text-gray-900 hover:text-blue-600'}
                    `}
                    title="Click to copy"
                >
                    {isColumnKCopied ? 'COPIED!' : `${index ? `${index}. ` : ''}${listing.columnK}`}
                </div>
            )}

            {/* Photo Preview Module with Overlaid Price + iOS-glass Status Badge */}
            {permissions.view_photos && permissions.preview_pic && listing.photoLink && !photoError ? (
                <div className="mt-0.5 mb-4">
                    {isPhotoLoading ? (
                        <div className="w-full aspect-[4/3] rounded-2xl bg-gray-100 animate-pulse flex items-center justify-center border border-gray-100 relative">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Loading Photo...</span>
                            <div className="absolute bottom-2 left-2 right-2 z-10">
                                {renderPriceModule(true)}
                            </div>
                        </div>
                    ) : photoUrl ? (
                        <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gray-100 relative group/photo shadow-sm border border-gray-100">
                            <a
                                href={listing.photoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="block w-full h-full"
                            >
                                <img
                                    src={photoUrl}
                                    alt={`Listing ${listing.id}`}
                                    className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                    onError={() => {
                                        setPhotoError(true);
                                        setPhotoUrl(null);
                                        failedPhotoExtractions.add(listing.id);
                                    }}
                                />
                            </a>

                            {/* iOS frosted-glass status badge — top-left overlay */}
                            <div className="absolute top-4 left-4 z-20">
                                <div className={`
                                    inline-flex items-center px-4 py-2 rounded-full
                                    backdrop-blur-md border border-white/65
                                    shadow-[0_2px_14px_rgba(0,0,0,0.22)]
                                    ${
                                        isUndecisiveSeller
                                            ? 'bg-amber-100/50 ring-1 ring-amber-400/70'
                                            : isUnderNego
                                            ? 'bg-blue-100/50 ring-1 ring-blue-400/70'
                                            : isNotAvailable
                                            ? 'bg-red-100/50 ring-1 ring-red-400/70'
                                            : 'bg-emerald-100/50 ring-1 ring-green-400/70'
                                    }
                                `}>
                                    {/* Coloured dot */}
                                    <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 shadow-sm ${
                                        isUndecisiveSeller ? 'bg-amber-500' :
                                        isUnderNego      ? 'bg-blue-500'  :
                                        isNotAvailable   ? 'bg-red-500'   :
                                        'bg-emerald-500'
                                    }`} />
                                    <span className={`text-[12px] font-black uppercase tracking-[0.22em] ${
                                        isUndecisiveSeller ? 'text-amber-900' :
                                        isUnderNego      ? 'text-blue-900'  :
                                        isNotAvailable   ? 'text-red-900'   :
                                        'text-emerald-900'
                                    }`}>
                                        {(listing.statusAQ?.toUpperCase() === 'OFF THE MARKET' ? 'OFF MARKET' : listing.statusAQ) || 'Available'}
                                    </span>
                                </div>
                            </div>

                            {/* Watermark — top-right */}
                            {renderWatermark()}

                            {/* Price overlay — bottom */}
                            <div className="absolute bottom-2 left-2 right-2 z-10">
                                {renderPriceModule(true)}
                            </div>
                        </div>
                    ) : (
                        /* Fallback to normal price box if photoUrl resolution failed but no error triggered yet */
                        <div className="mb-4 mt-0.5">
                            {renderPriceModule(false)}
                        </div>
                    )}
                </div>
            ) : permissions.view_photos && listing.photoLink && !photoError && !permissions.preview_pic ? (
                /* Photo visible but preview_pic off — show photo without glass badge */
                <div className="mt-0.5 mb-4">
                    {isPhotoLoading ? (
                        <div className="w-full aspect-[4/3] rounded-2xl bg-gray-100 animate-pulse flex items-center justify-center border border-gray-100 relative">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Loading Photo...</span>
                            <div className="absolute bottom-2 left-2 right-2 z-10">{renderPriceModule(true)}</div>
                        </div>
                    ) : photoUrl ? (
                        <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-gray-100 relative group/photo shadow-sm border border-gray-100">
                            <a href={listing.photoLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block w-full h-full">
                                <img src={photoUrl} alt={`Listing ${listing.id}`} className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-500" loading="lazy"
                                    onError={() => { setPhotoError(true); setPhotoUrl(null); failedPhotoExtractions.add(listing.id); }} />
                            </a>
                            <div className="absolute bottom-2 left-2 right-2 z-10">{renderPriceModule(true)}</div>
                        </div>
                    ) : (
                        <div className="mb-4 mt-0.5">{renderPriceModule(false)}</div>
                    )}
                </div>
            ) : permissions.preview_pic && (!listing.photoLink || photoError) ? (
                <div className="mt-0.5 mb-4">
                    <div className="w-full aspect-[4/3] rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 relative flex flex-col items-center justify-center border border-gray-200 shadow-inner overflow-hidden">
                        <div className="absolute inset-0 opacity-30"
                            style={{ backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                        {/* STATUS badge — top-left, same position as photo overlay */}
                        <div className="absolute top-4 left-4 z-20">
                            <div className={`
                                inline-flex items-center px-4 py-2 rounded-full
                                backdrop-blur-md border border-white/65
                                shadow-[0_2px_14px_rgba(0,0,0,0.22)]
                                ${
                                    isUndecisiveSeller
                                        ? 'bg-amber-100/50 ring-1 ring-amber-400/70'
                                        : isUnderNego
                                        ? 'bg-blue-100/50 ring-1 ring-blue-400/70'
                                        : isNotAvailable
                                        ? 'bg-red-100/50 ring-1 ring-red-400/70'
                                        : 'bg-emerald-100/50 ring-1 ring-green-400/70'
                                }
                            `}>
                                <span className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 shadow-sm ${
                                    isUndecisiveSeller ? 'bg-amber-500' :
                                    isUnderNego      ? 'bg-blue-500'  :
                                    isNotAvailable   ? 'bg-red-500'   :
                                    'bg-emerald-500'
                                }`} />
                                <span className={`text-[12px] font-black uppercase tracking-[0.22em] ${
                                    isUndecisiveSeller ? 'text-amber-900' :
                                    isUnderNego      ? 'text-blue-900'  :
                                    isNotAvailable   ? 'text-red-900'   :
                                    'text-emerald-900'
                                }`}>
                                    {(listing.statusAQ?.toUpperCase() === 'OFF THE MARKET' ? 'OFF MARKET' : listing.statusAQ) || 'Available'}
                                </span>
                            </div>
                        </div>
                        {/* Watermark — top-right */}
                        {renderWatermark()}
                        <div className="relative z-10 flex flex-col items-center gap-2">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5A1.5 1.5 0 0021.75 16.5V7.5A1.5 1.5 0 0020.25 6H3.75A1.5 1.5 0 002.25 7.5v9A1.5 1.5 0 003.75 18z" />
                            </svg>
                            <span className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Photos to Follow</span>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 z-10">
                            {renderPriceModule(true)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-4 mt-0.5">
                    {renderPriceModule(false)}
                </div>
            )}

            <div className="mb-4 mt-0.5">
                {permissions.view_col_aa && listing.displaySummary && (
                    <div className="relative">
                        <div
                            className={`text-sm font-medium text-black mt-1 leading-relaxed whitespace-pre-line
                                ${!isExpanded ? 'line-clamp-4' : ''}
                            `}
                        >
                            {listing.displaySummary.split('\n').filter(line => !line.toLowerCase().includes('http://') && !line.toLowerCase().includes('https://')).join('\n')}
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
                    className={`flex items-center gap-2 ${listing.photoLink && permissions.copy_photo_link ? 'cursor-pointer' : ''}`}
                    onClick={listing.photoLink && permissions.copy_photo_link ? handleCopyPhotoLink : undefined}
                    title={listing.photoLink && permissions.copy_photo_link ? 'Click to copy photo link' : undefined}
                >
                    <MapPin className={`w-4 h-4 ${isPhotoLinkCopied ? 'text-green-500' : ''}`} />
                    <span className={`truncate transition-colors ${isPhotoLinkCopied ? 'text-green-600 font-semibold' : listing.photoLink && permissions.copy_photo_link ? 'hover:text-blue-600' : ''}`}>
                        {isPhotoLinkCopied ? 'Photo link copied!' : `${listing.city}, ${listing.province}`}
                    </span>
                </div>
                {(listing.building || listing.area || listing.barangay) && (
                    <div
                        className={`flex items-center gap-2 ${
                            role === 'superadmin' && listing.lat && listing.lng
                                ? 'cursor-pointer'
                                : ''
                        }`}
                        onClick={role === 'superadmin' && listing.lat && listing.lng ? handleCopyMapLink : undefined}
                        title={role === 'superadmin' && listing.lat && listing.lng ? 'Copy map link (lat/long)' : undefined}
                    >
                        <Building className={`w-4 h-4 flex-shrink-0 ${isMapLinkCopied ? 'text-green-500' : ''}`} />
                        <span className={`truncate transition-colors ${isMapLinkCopied ? 'text-green-600 font-semibold' : ''}`}>
                            {isMapLinkCopied ? 'Map link copied!' : (listing.building || listing.area || listing.barangay)}
                        </span>
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
                {listing.monthlyDues && (
                    <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        <span>Monthly Dues: {listing.monthlyDues}</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <Maximize className="w-4 h-4 flex-shrink-0" />
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
                            {listing.mapVerified ? 'MAP (V)' : 'MAP'}
                        </a>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                alert(`No map coordinates available for ${listing.id}`);
                            }}
                            className="flex-1 text-center py-2 bg-gray-100 text-gray-400 rounded-lg text-[10px] sm:text-xs font-bold cursor-not-allowed uppercase tracking-wider"
                        >
                            {listing.mapVerified ? 'MAP (V)' : 'MAP'}
                        </button>
                    )
                ) : null}
                {permissions.view_photos && listing.photoLink && !permissions.preview_pic && (
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
                        className={`flex-1 text-center py-2 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold hover:bg-yellow-100 transition-colors uppercase tracking-wider
                            ${listing.columnV ? 'italic' : ''}
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
                        className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-colors uppercase tracking-wider bg-green-50 text-green-600 hover:bg-green-100`}
                    >
                        EDIT
                    </button>
                )}
                {(role === 'superadmin' || fbGroup === 'Luxe') && permissions.viewing_listing && (() => {
                    const inList = isInViewing(listing.id);
                    const disabled = isFull && !inList;
                    return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (inList) {
                                    removeFromViewing(listing.id);
                                } else if (!disabled) {
                                    addToViewing(listing);
                                }
                            }}
                            title={disabled ? 'Viewing list is full (max 10)' : inList ? 'Remove from viewing list' : 'Add to viewing list'}
                            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all duration-200 uppercase tracking-wider
                                ${
                                    inList
                                        ? 'bg-orange-400 text-white shadow-sm'
                                        : disabled
                                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                }
                            `}
                        >
                            {inList ? '✓ VIEWING' : 'VIEWING'}
                        </button>
                    );
                })()}
            </div>

            {/* Last Update */}
            {permissions.view_last_update && listing.columnBC && !isPopupView && (() => {
                const parts = listing.columnBC.split(' | ');
                const isOldFormat = /^\d{4}-\d{2}-\d{2}$/.test(parts[0]);
                
                // Robust part extraction
                let datePart = parts[0] || '';
                let typePart = '';
                let userPart = '';
                
                if (isOldFormat) {
                    // Old: YYYY-MM-DD | User | Type (usually STATUS)
                    typePart = parts[2] || '';
                    userPart = parts[1] || '';
                } else {
                    // New: MMM DD, YYYY | Type/Type | User
                    // Or: Type/Type | User (if date failed to generate)
                    if (parts.length === 3) {
                        typePart = parts[1];
                        userPart = parts[2];
                        
                        // Handle case where old code incorrectly wrote "Date | User | STATUS"
                        if (userPart === 'STATUS' || userPart === 'PRICE' || userPart.includes('COMMENTS') || userPart === 'LISTING') {
                            const temp = typePart;
                            typePart = userPart;
                            userPart = temp;
                        }
                    } else if (parts.length === 2) {
                        // Check if first part looks like a date
                        const hasMonth = /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(parts[0]);
                        if (hasMonth) {
                            typePart = parts[1];
                        } else {
                            // Format: Type/Type | User
                            typePart = parts[0];
                            userPart = parts[1];
                            datePart = '';
                        }
                    } else if (parts.length === 1) {
                        typePart = parts[0];
                    }
                }

                const displayDate = formatDate(datePart);
                const labels: string[] = [];
                const upperType = typePart?.toUpperCase() || '';
                
                if (upperType.includes('STATUS')) labels.push('Status');
                if (upperType.includes('PRICE')) labels.push('Price');
                // if (upperType.includes('LOCATION')) labels.push('Location');
                if (upperType.includes('COMMENTS')) labels.push('Comments');
                if (upperType.includes('LISTING')) labels.push('Listing');

                const label = labels.length > 0
                    ? `${labels.join('/')} Update`
                    : 'Listing Update';

                // Calculate age of update in days (Phil Standard Time)
                // Assuming local browser time is PHT as per metadata (+08:00)
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                // Parse datePart (e.g. "Oct 16, 2025")
                const updateDateObj = new Date(datePart.includes(' | ') ? datePart.split(' | ')[0] : datePart);
                const updateDate = isNaN(updateDateObj.getTime()) 
                    ? null 
                    : new Date(updateDateObj.getFullYear(), updateDateObj.getMonth(), updateDateObj.getDate());
                
                let textColorClass = 'text-black';
                let fontWeightClass = '';

                if (updateDate) {
                    const diffTime = today.getTime() - updateDate.getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= 0 && diffDays <= 30) {
                        fontWeightClass = 'font-black'; // BOLD BLACK for 0-30 days
                    } else if (diffDays > 30 && diffDays <= 180) {
                        // Current style: regular black for 31-180 days
                    } else if (diffDays > 180) {
                        textColorClass = 'text-orange-600'; // Orange for 181+ days
                    }
                }

                return (
                    <div className={`mt-2 text-xs ${textColorClass} ${fontWeightClass} text-center`}>
                        {label}{displayDate ? ` - ${displayDate}` : ''}{userPart ? `, by ${userPart}` : ''}
                    </div>
                );
})()}

            {rowNumber && (
                <div className="mt-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center">
                    Row #{rowNumber}
                </div>
            )}

        </div >
    );
});
