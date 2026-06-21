import fs from 'fs';

const filePath = '/Users/noelk/repos/Luxe Listing/src/components/ListingCard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replacement 1: getImageUrl & failedPhotoExtractions
const target1 = `export const ListingCard: React.FC<ListingCardProps> = React.memo(({`;
const replacement1 = `const getImageUrl = (photoLink: string | undefined): { isGooglePhotos: boolean; directUrl?: string } => {
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

export const ListingCard: React.FC<ListingCardProps> = React.memo(({`;

if (!content.includes(target1)) {
    console.error('Target 1 not found!');
    process.exit(1);
}
content = content.replace(target1, replacement1);

// Replacement 2: State Variables
const target2 = `    const [isExpanded, setIsExpanded] = useState(false);`;
const replacement2 = `    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [isPhotoLoading, setIsPhotoLoading] = useState(false);
    const [photoError, setPhotoError] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);`;

if (!content.includes(target2)) {
    console.error('Target 2 not found!');
    process.exit(1);
}
content = content.replace(target2, replacement2);

// Replacement 3: useEffect hook for fetching
const target3 = `    useEffect(() => {
        if (isClientError) {
            const timer = setTimeout(() => setIsClientError(false), 2500);
            return () => clearTimeout(timer);
        }
    }, [isClientError]);

    const status = (listing.statusAQ || '').toLowerCase().trim();`;

const replacement3 = `    useEffect(() => {
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
                if (!res.ok) throw new Error(\`HTTP error \${res.status}\`);
                const html = await res.text();
                
                const regex = /https:\\/\\/[a-zA-Z0-9\\.\\-]+\\.googleusercontent\\.com\\/pw\\/[a-zA-Z0-9_\\-]+/g;
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
                console.error(\`[ListingCard] Failed to extract photo for \${listing.id}:\`, err);
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

    const status = (listing.statusAQ || '').toLowerCase().trim();`;

if (!content.includes(target3)) {
    console.error('Target 3 not found!');
    process.exit(1);
}
content = content.replace(target3, replacement3);

// Replacement 4: renderPriceModule and unified overlay layout
const target4 = `    return (
        <div
            className={\`\${cardClassName} \${isDisabled && !isSelected ? 'opacity-50' : ''} p-5\`}
        >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-[50]">`;

const replacement4 = `    const renderPriceModule = (isOverlay: boolean) => {
        let bgClass = '';
        if (isClientLoading) {
            bgClass = isOverlay ? 'bg-blue-50/90 backdrop-blur-sm' : 'bg-blue-50 shadow-md';
        } else if (isClientCopied) {
            bgClass = isOverlay ? 'bg-green-100/90 backdrop-blur-sm scale-[1.02]' : 'bg-green-100 shadow-md scale-[1.02]';
        } else if (isClientError || isClientEmpty) {
            bgClass = isOverlay ? 'bg-red-50/90 backdrop-blur-sm' : 'bg-red-50 shadow-md';
        } else if (role === 'superadmin' || fbGroup === 'Kiu') {
            bgClass = isOverlay ? 'bg-white/95 backdrop-blur-sm hover:bg-white shadow-sm border border-gray-100/30' : 'bg-gray-100 hover:bg-gray-200 shadow-inner';
        } else {
            bgClass = isOverlay ? 'bg-white/95 backdrop-blur-sm shadow-sm border border-gray-100/30' : 'bg-gray-100 shadow-inner';
        }

        return (
            <div 
                onClick={handleCopyClientVersion}
                className={\`w-full p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-center transition-all duration-200
                    \${(role === 'superadmin' || fbGroup === 'Kiu') ? 'cursor-pointer' : 'cursor-default'}
                    \${bgClass}
                \`}
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
                                        <span className="text-sm font-normal text-gray-500">
                                            ({formatPrice(effectiveLeasePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                            {listing.price > 0 && (
                                <div className="flex items-baseline gap-2 justify-center">
                                    <span className="text-xl font-bold text-gray-900">{formatPrice(listing.price)}</span>
                                    {effectivePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-500">
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
                                        <span className="text-sm font-normal text-gray-500">
                                            ({formatPrice(effectivePricePerSqm)}/sqm)
                                        </span>
                                    )}
                                </div>
                            )}
                            {listing.leasePrice > 0 && (
                                <div className="flex items-baseline gap-1 text-gray-900 justify-center">
                                    <span className="text-xl font-bold">{formatPrice(listing.leasePrice)}/month</span>
                                    {effectiveLeasePricePerSqm > 0 && (
                                        <span className="text-sm font-normal text-gray-500">
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
            className={\`\${cardClassName} \${isDisabled && !isSelected ? 'opacity-50' : ''} p-5\`}
        >
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-[50]">`;

if (!content.includes(target4)) {
    console.error('Target 4 not found!');
    process.exit(1);
}
content = content.replace(target4, replacement4);

// Replacement 5: the original pricing module markup and old photo preview markup
const target5Start = `            {/* Removed combined BC/BD block from bottom - moved to specific locations */}

            <div className="mb-4 mt-0.5">`;

const target5End = `            {permissions.view_photos && listing.photoLink && !photoError && (
                <div className="mt-3 mb-3">`;

// Instead of string replacement which can be flaky due to exact whitespace, let's find the indices of target5Start and columnBD removed line
const startIdx = content.indexOf(`{/* Removed combined BC/BD block from bottom - moved to specific locations */}`);
const endIdx = content.indexOf(`{/* Column BD removed from here */}`);

if (startIdx === -1 || endIdx === -1) {
    console.error('Pricing block/BD markers not found!');
    process.exit(1);
}

// We want to replace everything from startIdx to endIdx with the new unified layout!
const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

const replacement5 = `{/* If we don't have photos or photos are disabled/errored, render price in original spot */}
            {(!permissions.view_photos || !listing.photoLink || photoError) && (
                <div className="mb-4 mt-0.5">
                    {renderPriceModule(false)}
                </div>
            )}

            {/* Photo Preview (with overlayed pricing module) */}
            {permissions.view_photos && listing.photoLink && !photoError && (
                <div className="mt-0.5 mb-4">
                    {isPhotoLoading ? (
                        <div className="w-full aspect-[4/3] rounded-2xl bg-gray-100 animate-pulse flex items-center justify-center border border-gray-100 relative">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Loading Photo...</span>
                            <div className="absolute bottom-2 left-2 right-2 z-10">
                                {renderPriceModule(true)}
                            </div>
                        </div>
                    ) : photoUrl ? (
                        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 relative group/photo shadow-sm border border-gray-100">
                            <a
                                href={listing.photoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="block w-full h-full"
                            >
                                <img
                                    src={photoUrl}
                                    alt={\`Listing \${listing.id}\`}
                                    className="w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                    onError={() => {
                                        setPhotoError(true);
                                        setPhotoUrl(null);
                                        failedPhotoExtractions.add(listing.id);
                                    }}
                                />
                            </a>
                            <div className="absolute bottom-2 left-2 right-2 z-10">
                                {renderPriceModule(true)}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}

            `;

content = before + replacement5 + after;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully modified ListingCard.tsx!');
