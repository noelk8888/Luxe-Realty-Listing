import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X } from 'lucide-react';
import type { Listing } from '../types';

// Fix leaflet default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });

// Orange pin icon for viewing list
const orangeIcon = L.divIcon({
    className: 'custom-orange-pin',
    html: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="25" height="41" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" fill="#f97316" stroke="#c2410c" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
    `,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

// Component to auto-fit map bounds to all markers
function FitBounds({ listings }: { listings: Listing[] }) {
    const map = useMap();
    const fitted = useRef(false);

    useEffect(() => {
        const valid = listings.filter(l => l.lat && l.lng);
        if (!valid.length || fitted.current) return;

        if (valid.length === 1) {
            map.setView([valid[0].lat, valid[0].lng], 15);
        } else {
            const bounds = L.latLngBounds(valid.map(l => [l.lat, l.lng] as [number, number]));
            map.fitBounds(bounds, { padding: [60, 60] });
        }
        fitted.current = true;
    }, [listings, map]);

    return null;
}

interface ViewingMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    listings: Listing[];
}

export const ViewingMapModal: React.FC<ViewingMapModalProps> = ({ isOpen, onClose, listings }) => {
    if (!isOpen || listings.length === 0) return null;

    const validListings = listings.filter(l => l.lat && l.lng);
    const defaultCenter: [number, number] = validListings.length
        ? [validListings[0].lat, validListings[0].lng]
        : [14.5995, 120.9842]; // Manila fallback

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-4xl h-[75vh] shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">
                            Viewing List —{' '}
                            <span className="text-orange-500">{listings.length}</span>{' '}
                            Listing{listings.length !== 1 ? 's' : ''}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {validListings.length < listings.length
                                ? `${listings.length - validListings.length} listing(s) missing coordinates`
                                : 'All listings have map coordinates'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {validListings.length > 0 && (
                            <button
                                onClick={() => {
                                    // Build Google Maps multi-stop directions URL
                                    // Format: /maps/dir/lat1,lng1/lat2,lng2/...
                                    const stops = validListings
                                        .map(l => `${l.lat},${l.lng}`)
                                        .join('/');
                                    const url = `https://www.google.com/maps/dir/${stops}`;
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                className="px-3 py-1.5 bg-white border-2 border-gray-800 text-gray-800 text-xs font-black uppercase tracking-widest rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
                                title="Open all stops in Google Maps for trip planning"
                            >
                                Generate
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} className="text-gray-400" />
                        </button>
                    </div>
                </div>


                {/* Map */}
                <div className="flex-1 relative z-0">
                    {validListings.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                            No listings with map coordinates in your viewing list.
                        </div>
                    ) : (
                        <MapContainer
                            center={defaultCenter}
                            zoom={13}
                            maxZoom={20}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                maxZoom={20}
                            />
                            <FitBounds listings={validListings} />
                            {validListings.map(listing => (
                                <Marker
                                    key={listing.id}
                                    position={[listing.lat, listing.lng]}
                                    icon={orangeIcon}
                                >
                                    <Tooltip
                                        direction="top"
                                        offset={[0, -35]}
                                        opacity={1}
                                        sticky={true}
                                        className="custom-map-tooltip"
                                    >
                                        <div className="text-base leading-relaxed font-sans text-gray-900 whitespace-pre-wrap max-w-[280px]">
                                            {(() => {
                                                const formatTooltipPrice = (val: number) =>
                                                    `₱${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(val)}`;

                                                const salePricePerSqm = listing.pricePerSqm > 0
                                                    ? listing.pricePerSqm
                                                    : (() => {
                                                        const area = listing.lotArea > 0 ? listing.lotArea : listing.floorArea;
                                                        return (area > 0 && listing.price > 0) ? Math.round(listing.price / area) : 0;
                                                    })();

                                                const leasePricePerSqm = listing.leasePricePerSqm > 0
                                                    ? listing.leasePricePerSqm
                                                    : (() => {
                                                        const area = listing.floorArea > 0 ? listing.floorArea : listing.lotArea;
                                                        return (area > 0 && listing.leasePrice > 0) ? Math.round(listing.leasePrice / area) : 0;
                                                    })();

                                                const bcParts = (listing.columnBC || '').split(' | ');
                                                const datePart = bcParts[0] || '';
                                                const updateDateObj = new Date(datePart);
                                                const hasValidDate = !isNaN(updateDateObj.getTime());
                                                const formattedUpdateDate = hasValidDate
                                                    ? updateDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                                                    : '';

                                                let dateColorClass = 'text-gray-400';
                                                if (hasValidDate) {
                                                    const now = new Date();
                                                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                                    const ud = new Date(updateDateObj.getFullYear(), updateDateObj.getMonth(), updateDateObj.getDate());
                                                    const diffDays = Math.floor((today.getTime() - ud.getTime()) / (1000 * 60 * 60 * 24));
                                                    if (diffDays >= 0 && diffDays <= 30) dateColorClass = 'text-gray-700 font-bold';
                                                    else if (diffDays > 180) dateColorClass = 'text-orange-500 font-semibold';
                                                }

                                                const summaryLines = (listing.displaySummary || '')
                                                    .split('\n').map(l => l.trim()).filter(Boolean).slice(0, 5);

                                                return (
                                                    <>
                                                        <div className="font-black text-orange-500 mb-1 border-b border-orange-50 pb-1 text-lg">
                                                            {listing.id}
                                                        </div>
                                                        {listing.price > 0 && (
                                                            <div className="text-gray-900 font-bold text-base">
                                                                {formatTooltipPrice(listing.price)}
                                                                {salePricePerSqm > 0 && (
                                                                    <span className="text-xs font-normal text-gray-400 ml-1">
                                                                        ({formatTooltipPrice(salePricePerSqm)}/sqm)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {listing.leasePrice > 0 && (
                                                            <div className="text-gray-900 font-bold text-base">
                                                                {formatTooltipPrice(listing.leasePrice)}/mo
                                                                {leasePricePerSqm > 0 && (
                                                                    <span className="text-xs font-normal text-gray-400 ml-1">
                                                                        ({formatTooltipPrice(leasePricePerSqm)}/sqm)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {listing.price === 0 && listing.leasePrice === 0 && (
                                                            <div className="text-gray-500 font-bold text-sm">Price on Request</div>
                                                        )}
                                                        <div className="mt-1">
                                                            {summaryLines.join('\n')}
                                                            {(listing.displaySummary || '').split('\n').filter(Boolean).length > 5 && '...'}
                                                        </div>
                                                        {formattedUpdateDate && (
                                                            <div className={`text-xs mt-1 ${dateColorClass}`}>
                                                                Updated: {formattedUpdateDate}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </Tooltip>
                                </Marker>
                            ))}
                        </MapContainer>
                    )}
                </div>

                {/* Footer legend */}
                <div className="px-4 py-2 border-t border-gray-50 bg-white flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Viewing List Pins</span>
                    {listings.length - validListings.length > 0 && (
                        <span className="ml-auto text-[10px] text-orange-500 font-medium">
                            ⚠ {listings.length - validListings.length} listing(s) have no coordinates
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
