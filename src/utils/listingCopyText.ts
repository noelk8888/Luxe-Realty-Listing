import type { Listing } from '../types';

interface ListingCopyOptions {
    isLuxeGroupMember: boolean;
    includeFooter?: boolean;
}

/**
 * Builds the same text used by a listing card's COPY button.
 * The footer can be omitted for combined text listings so the listing's own
 * Photos/Google Pin line remains at the end of its block.
 */
export function buildListingCopyText(
    listing: Listing,
    { isLuxeGroupMember, includeFooter = true }: ListingCopyOptions
): string {
    if (!listing.summary) return '';

    // summary = the listing body followed by two newlines and columnV notes.
    const notes = listing.columnV?.trim() || '';
    const mainBody = notes && listing.summary.endsWith('\n\n' + notes)
        ? listing.summary.slice(0, -(notes.length + 2))
        : listing.summary;

    const cleanId = listing.id.trim();
    const cleanBody = mainBody.trim();
    let copyText = cleanBody.startsWith(cleanId) ? mainBody : `${cleanId}\n${mainBody}`;

    if (isLuxeGroupMember) {
        const lines = copyText.split(/\r?\n/);
        if (lines[0]?.trim().toLowerCase() === cleanId.toLowerCase()) {
            lines.shift();
        }

        const updateLineIndex = lines.findIndex(line =>
            /^\s*(?:[A-Z][a-z]{2,8}\.?\s+\d{1,2},\s*\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+update\b/i.test(line)
        );
        copyText = (updateLineIndex >= 0 ? lines.slice(0, updateLineIndex) : lines).join('\n').trim();
    }

    if (listing.monthlyDues && !copyText.toLowerCase().includes('monthly dues:')) {
        const priceMatch = copyText.match(/\n(?=\s*(?:Lease Price|Sale Price|Price)\s*:)/i);
        if (priceMatch && priceMatch.index !== undefined) {
            copyText = copyText.slice(0, priceMatch.index)
                + `\nMonthly Dues: ${listing.monthlyDues}`
                + copyText.slice(priceMatch.index);
        } else {
            copyText += `\nMonthly Dues: ${listing.monthlyDues}`;
        }
    }

    if (isLuxeGroupMember || !includeFooter) return copyText.trim();

    let datePrefix = 'Last Update Unknown';
    if (listing.columnBC) {
        const datePart = listing.columnBC.split(' | ')[0]?.trim();
        if (datePart) {
            const date = new Date(datePart);
            if (!isNaN(date.getTime())) {
                datePrefix = `${date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })} update`;
            }
        }
    }

    const mapsLink = (listing.lat && listing.lng)
        ? `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`
        : '';
    const verifiedMapRegex = /\n?Verified Map Location:.*?(\n|$)/gi;
    const existingMapLineMatch = copyText.match(verifiedMapRegex);
    copyText = copyText.replace(verifiedMapRegex, '').trimEnd();

    let footer = datePrefix;
    const hasGooglePin = /google\s*pin\s*:/i.test(copyText);
    if (existingMapLineMatch) {
        footer += `\n${existingMapLineMatch[0].trim()}`;
    } else if (mapsLink && listing.mapVerified && !hasGooglePin) {
        footer += `\nVerified Map Location: ${mapsLink}`;
    }

    if (notes) {
        footer += `\nThere's a NOTE in this listing. Check it in the app`;
    }

    return `${copyText}\n\n${footer}`;
}

export function buildViewingListText(listings: Listing[], isLuxeGroupMember: boolean): string {
    return listings
        .map((listing, index) => {
            const copyDetails = buildListingCopyText(listing, {
                isLuxeGroupMember,
                includeFooter: false
            });
            const lines = copyDetails.split(/\r?\n/);
            const finalLinkLineIndex = lines.reduce((lastIndex, line, lineIndex) => {
                const normalizedLine = line.trim();
                return /^(?:photos?|google\s*pin)\s*:/i.test(normalizedLine)
                    ? lineIndex
                    : lastIndex;
            }, -1);
            const details = (finalLinkLineIndex >= 0 ? lines.slice(0, finalLinkLineIndex + 1) : lines)
                .join('\n')
                .trim();
            return `LISTING ${index + 1}:\n${details}`;
        })
        .join('\n\n');
}
