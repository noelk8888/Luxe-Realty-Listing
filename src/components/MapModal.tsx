import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { X, ArrowLeft } from 'lucide-react';
import type { Listing } from '../types';
import { calculateDistance } from '../utils/geoUtils';
import { ListingCard } from './ListingCard';

// Fix for default marker icon in Leaflet with Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const getIconOptions = (color: 'red' | 'blue' | 'gray') => {
    if (color === 'red') {
        return {
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41] as [number, number], // Type assertion for tuple
            iconAnchor: [12, 41] as [number, number],
            popupAnchor: [1, -34] as [number, number],
            shadowSize: [41, 41] as [number, number],
            className: 'marker-red'
        };
    }
    if (color === 'blue') {
        return {
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41] as [number, number],
            iconAnchor: [12, 41] as [number, number],
            popupAnchor: [1, -34] as [number, number],
            shadowSize: [41, 41] as [number, number],
            className: 'marker-blue'
        };
    }
    // Gray (Default)
    return {
        className: 'custom-gray-pin marker-gray',
        html: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="25" height="41" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#9ca3af" stroke="#000000" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
    `,
        iconSize: [25, 41] as [number, number],
        iconAnchor: [12, 41] as [number, number],
        popupAnchor: [1, -34] as [number, number]
    };
};

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    centerListing: Listing | null;
    allListings: Listing[];
    filteredListingsIds: Set<string>;
    onNotesClick?: (id: string) => void;
    onShowNote?: (note: string, id: string) => void;
}





export const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, centerListing, allListings, filteredListingsIds: _filteredListingsIds, onNotesClick, onShowNote }) => {
    const [focusedListing, setFocusedListing] = useState<Listing | null>(null);
    const [groupedViewListings, setGroupedViewListings] = useState<Listing[] | null>(null);

    // Toggle states for map controls
    const [showSimilar, setShowSimilar] = useState(true);
    const [similarRadius, setSimilarRadius] = useState<2 | 5>(2);
    const [showNearby, setShowNearby] = useState(true);

    // Wrapper to close modal when notes button is clicked
    const handleNotesClick = (id: string) => {
        if (onNotesClick) {
            onNotesClick(id);
            onClose(); // Close the map modal
        }
    };

    if (!isOpen || !centerListing || !centerListing.lat || !centerListing.lng) return null;

    const center: [number, number] = [centerListing.lat, centerListing.lng];

    // Helper function to check if a listing is "Similar" to the featured listing
    const isSimilarListing = (item: Listing): boolean => {
        // 1. Distance check (within selected radius)
        const dist = calculateDistance(centerListing.lat, centerListing.lng, item.lat, item.lng);
        if (dist > similarRadius) return false;

        // 2. Price check (within ±20% of featured listing's price)
        // Use the primary price (sale price if available, otherwise lease price)
        const featuredPrice = centerListing.price > 0 ? centerListing.price : centerListing.leasePrice;
        const itemPrice = item.price > 0 ? item.price : item.leasePrice;

        if (featuredPrice > 0 && itemPrice > 0) {
            const minPrice = featuredPrice * 0.8;
            const maxPrice = featuredPrice * 1.2;
            if (itemPrice < minPrice || itemPrice > maxPrice) return false;
        } else {
            // If either has no price, not similar
            return false;
        }

        // 3. Area check (at least ONE must match within ±20%)
        let areaMatch = false;

        // Check Lot Area
        if (centerListing.lotArea > 0 && item.lotArea > 0) {
            const minLot = centerListing.lotArea * 0.8;
            const maxLot = centerListing.lotArea * 1.2;
            if (item.lotArea >= minLot && item.lotArea <= maxLot) {
                areaMatch = true;
            }
        }

        // Check Floor Area (if lot area didn't match)
        if (!areaMatch && centerListing.floorArea > 0 && item.floorArea > 0) {
            const minFloor = centerListing.floorArea * 0.8;
            const maxFloor = centerListing.floorArea * 1.2;
            if (item.floorArea >= minFloor && item.floorArea <= maxFloor) {
                areaMatch = true;
            }
        }

        return areaMatch;
    };

    // Find neighbors within selected radius
    const nearbyRadius = 1; // Fixed 1km for nearby (gray pins)
    const neighbors = allListings.filter(l => {
        if (l.id === centerListing.id || !l.lat || !l.lng) return false;
        const dist = calculateDistance(centerListing.lat, centerListing.lng, l.lat, l.lng);

        const isSimilar = isSimilarListing(l);

        // Similar listings (blue) - meets all criteria within similarRadius
        if (isSimilar && showSimilar) {
            return true;
        }

        // Nearby listings (gray) - within 1km but NOT similar
        if (!isSimilar && showNearby && dist <= nearbyRadius) {
            return true;
        }

        return false;
    });

    // Create a set of similar listing IDs for icon coloring
    const similarListingIds = new Set(
        allListings
            .filter(l => l.id !== centerListing.id && l.lat && l.lng && isSimilarListing(l))
            .map(l => l.id)
    );

    // Group all relevant listings by coordinates
    const allRelevant = [centerListing, ...neighbors];
    const groupedListings: Record<string, Listing[]> = {};
    allRelevant.forEach(l => {
        if (l.lat && l.lng) {
            const key = `${l.lat},${l.lng}`;
            if (!groupedListings[key]) groupedListings[key] = [];
            groupedListings[key].push(l);
        }
    });

    // Helper to get group icon
    const getGroupIcon = (listings: Listing[], isCenterGroup: boolean) => {
        const count = listings.length;
        const hasCenter = isCenterGroup;
        const hasFilteredMatch = listings.some(l => similarListingIds.has(l.id));

        let colorKey: 'red' | 'blue' | 'gray' = 'gray';
        let colorHex = '#9ca3af';

        if (hasCenter) {
            colorKey = 'red';
            colorHex = '#ef4444';
        } else if (hasFilteredMatch) {
            colorKey = 'blue';
            colorHex = '#3b82f6';
        }

        if (count === 1) {
            const options = getIconOptions(colorKey);
            if (colorKey === 'gray') {
                return L.divIcon(options as L.DivIconOptions);
            }
            return new L.Icon(options as L.IconOptions);
        }

        return L.divIcon({
            className: `custom-grouped-pin marker-${colorKey}`,
            html: `
                <div style="position: relative; width: 30px; height: 41px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="41" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">
                        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="${colorHex}" stroke="#000000" stroke-width="1"/>
                        <circle cx="12" cy="12" r="4" fill="white"/>
                    </svg>
                    <div style="
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: #1f2937;
                        color: white;
                        border-radius: 999px;
                        padding: 2px 6px;
                        font-size: 10px;
                        font-weight: bold;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        min-width: 18px;
                        text-align: center;
                    ">${count}</div>
                </div>
            `,
            iconSize: [30, 41],
            iconAnchor: [15, 41],
            popupAnchor: [0, -34]
        });
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[70vh] overflow-hidden flex flex-col relative shadow-2xl border border-gray-100">
                {/* Header */}
                <div className="p-3 border-b border-gray-50 flex justify-between items-center bg-white z-[1001] relative">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">
                            Location: <span
                                onClick={() => setGroupedViewListings(null)}
                                className="cursor-pointer hover:text-blue-600 transition-colors underline"
                                title="Click to return to map"
                            >
                                {centerListing.id}
                            </span>
                        </h3>
                        <p className="text-xs text-gray-500">
                            {neighbors.length} neighbors found within 1km
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Map Content */}
                <div className="flex-1 relative z-0">
                    <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MarkerClusterGroup
                            chunkedLoading
                            spiderfyOnMaxZoom={true}
                            showCoverageOnHover={false}
                            zoomToBoundsOnClick={false}
                            spiderfyDistanceMultiplier={1.5}
                            iconCreateFunction={(cluster: any) => {
                                const markers = cluster.getAllChildMarkers();
                                let hasRed = false; // Center Listing
                                let hasBlue = false; // Filtered Match 


                                markers.forEach((marker: any) => {
                                    // Check options className (Robust method)
                                    const className = marker.options.icon?.options?.className || '';
                                    if (className.includes('marker-red')) hasRed = true;
                                    if (className.includes('marker-blue')) hasBlue = true;
                                });

                                let color = '#9ca3af'; // Gray
                                if (hasRed) {
                                    color = '#ef4444'; // Red
                                } else if (hasBlue) {
                                    color = '#3b82f6'; // Blue
                                }

                                return L.divIcon({
                                    html: `
                                        <div style="
                                            background-color: ${color};
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            color: white;
                                            font-weight: bold;
                                            font-family: sans-serif;
                                            border: 3px solid white;
                                            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                                            font-size: 14px;
                                        ">
                                            ${markers.length}
                                        </div>
                                    `,
                                    className: 'custom-cluster-icon',
                                    iconSize: L.point(40, 40, true),
                                });
                            }}
                        >
                            {Object.entries(groupedListings).map(([coordKey, listings]) => {
                                const isCenterGroup = listings.some(l => l.id === centerListing.id);
                                const [lat, lng] = coordKey.split(',').map(Number);

                                return (
                                    <Marker
                                        key={coordKey}
                                        position={[lat, lng]}
                                        icon={getGroupIcon(listings, isCenterGroup)}
                                        zIndexOffset={isCenterGroup ? 1000 : 0}
                                        eventHandlers={{
                                            click: (e) => {
                                                // Always stop propagation to prevent spider from collapsing
                                                L.DomEvent.stopPropagation(e.originalEvent);

                                                // Sort: Featured (Red) > Similar (Blue) > Nearby (Gray)
                                                const sorted = [...listings].sort((a, b) => {
                                                    const aIsCenter = a.id === centerListing.id;
                                                    const bIsCenter = b.id === centerListing.id;
                                                    if (aIsCenter && !bIsCenter) return -1;
                                                    if (!aIsCenter && bIsCenter) return 1;

                                                    const aIsMatch = similarListingIds.has(a.id);
                                                    const bIsMatch = similarListingIds.has(b.id);
                                                    if (aIsMatch && !bIsMatch) return -1;
                                                    if (!aIsMatch && bIsMatch) return 1;

                                                    return 0;
                                                });

                                                // Always open grid view for all pins (single or grouped)
                                                setGroupedViewListings(sorted);
                                            }
                                        }}
                                    />
                                );
                            })}
                        </MarkerClusterGroup>
                    </MapContainer>

                    {/* Footer Controls (Single Compact Pill) */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
                        <div className="flex items-center bg-white px-2 py-1 rounded-full shadow-2xl border border-gray-200">
                            {/* Featured (Static) */}
                            <div className="flex items-center gap-1 px-1.5">
                                <div className="w-[7px] h-[7px] rounded-full bg-[#ef4444]"></div>
                                <span className="text-[9px] font-bold text-gray-700">Featured</span>
                            </div>

                            {/* Divider */}
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>

                            {/* Similar Toggle */}
                            <button
                                onClick={() => setShowSimilar(!showSimilar)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all ${showSimilar ? 'bg-blue-50' : 'opacity-40'}`}
                            >
                                <div className="w-[7px] h-[7px] rounded-full bg-[#3b82f6]"></div>
                                <span className="text-[9px] font-bold text-gray-700">Similar</span>
                            </button>

                            {/* Radius Selector */}
                            <div className="flex items-center gap-0.5 ml-1">
                                <button
                                    onClick={() => setSimilarRadius(2)}
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${similarRadius === 2 ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    1km
                                </button>
                                <button
                                    onClick={() => setSimilarRadius(5)}
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${similarRadius === 5 ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    3km
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="w-px h-4 bg-gray-300 mx-1"></div>

                            {/* Nearby Toggle */}
                            <button
                                onClick={() => setShowNearby(!showNearby)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all ${showNearby ? 'bg-blue-600' : 'opacity-40'}`}
                            >
                                <div className={`w-[7px] h-[7px] rounded-full ${showNearby ? 'bg-white' : 'bg-[#9ca3af]'} border border-black/20`}></div>
                                <span className={`text-[9px] font-bold ${showNearby ? 'text-white' : 'text-gray-700'}`}>Nearby 1km</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid Overlay for Grouped Listings */}
                {groupedViewListings && (
                    <div className="absolute inset-0 z-[2500] bg-gray-50 flex flex-col animate-in fade-in slide-in-from-bottom-6 duration-300">
                        <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm sticky top-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setGroupedViewListings(null)}
                                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                                    title="Back to Map"
                                >
                                    <ArrowLeft size={20} className="text-gray-600" />
                                </button>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 leading-none">
                                        {groupedViewListings.length} Listings Found
                                    </h3>
                                    <p className="text-[10px] text-gray-500 font-medium mt-1 uppercase tracking-wider">
                                        {groupedViewListings[0].building || groupedViewListings[0].area || groupedViewListings[0].barangay || 'Selected Location'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setGroupedViewListings(null)}
                                className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors uppercase tracking-widest"
                            >
                                BACK TO MAP
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-100/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
                                {groupedViewListings.map((listing, idx) => {
                                    // Determine variant for each card within the grid
                                    const isCenter = listing.id === centerListing.id;
                                    const isMatch = similarListingIds.has(listing.id);
                                    let variant: 'red' | 'blue' | 'gray' = 'gray';
                                    if (isCenter) variant = 'red';
                                    else if (isMatch) variant = 'blue';

                                    return (
                                        <div key={`${listing.id}-${idx}`} className="h-full">
                                            <ListingCard
                                                listing={listing}
                                                isPopupView={true}
                                                onBack={() => setGroupedViewListings(null)}
                                                backButtonVariant={variant}
                                                onNotesClick={handleNotesClick}
                                                onShowNote={onShowNote}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Single Detail Overlay */}
                {focusedListing && (
                    <div className="absolute inset-0 z-[3000] bg-gray-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="p-3 border-b border-gray-100 flex items-center gap-3 bg-white">
                            <button
                                onClick={() => setFocusedListing(null)}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                                title="Back"
                            >
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <h3 className="text-base font-bold text-gray-900">
                                {`Back to ${groupedViewListings ? 'Group' : 'Map'}`}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start">
                            <div className="w-full max-w-sm">
                                <ListingCard
                                    listing={focusedListing}
                                    isPopupView={true}
                                    onBack={() => setFocusedListing(null)}
                                    // Single focused view - usually coming from popup click so variant isn't driven by group logic here
                                    // But we can default to blue or match the listing status
                                    backButtonVariant={focusedListing.id === centerListing.id ? 'red' : (similarListingIds.has(focusedListing.id) ? 'blue' : 'gray')}
                                    onNotesClick={handleNotesClick}
                                    onShowNote={onShowNote}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
