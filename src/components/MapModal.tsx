import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { X, ArrowLeft } from 'lucide-react';
import type { Listing } from '../types';
import L from 'leaflet';
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
const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    centerListing: Listing | null;
    allListings: Listing[];
}

// Component to update map center when prop changes
function MapController({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

const formatPrice = (price: number) => {
    const formatted = new Intl.NumberFormat('en-PH', {
        maximumFractionDigits: 0
    }).format(price);
    return `P${formatted}`;
};

export const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, centerListing, allListings }) => {
    const [focusedListing, setFocusedListing] = useState<Listing | null>(null);

    if (!isOpen || !centerListing || !centerListing.lat || !centerListing.lng) return null;

    const center: [number, number] = [centerListing.lat, centerListing.lng];

    // Find neighbors within 2km
    const neighbors = allListings.filter(l => {
        if (l.id === centerListing.id || !l.lat || !l.lng) return false;
        const dist = calculateDistance(centerListing.lat, centerListing.lng, l.lat, l.lng);
        return dist <= 2;
    });

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[70vh] overflow-hidden flex flex-col relative shadow-2xl border border-gray-100">
                {/* Header */}
                <div className="p-3 border-b border-gray-50 flex justify-between items-center bg-white z-[1001] relative">
                    <div>
                        <h3 className="text-base font-bold text-gray-900">
                            {`Location: ${centerListing.id}`}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {neighbors.length} neighbors found within 2km
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
                        <MapController center={center} />

                        {/* Center Marker (Red) */}
                        <Marker position={center} icon={redIcon} zIndexOffset={1000}>
                            <Popup>
                                <div
                                    onClick={() => setFocusedListing(centerListing)}
                                    className="text-sm font-bold cursor-pointer text-blue-600 hover:underline mb-1"
                                >
                                    {centerListing.id}
                                </div>
                                <div className="text-xs">
                                    {centerListing.price > 0 && (
                                        <div className="font-bold text-gray-900">
                                            {`P${centerListing.price.toLocaleString()}`}
                                            {centerListing.pricePerSqm > 0 && (
                                                <span className="text-[10px] font-normal text-gray-500 ml-1">
                                                    (P{centerListing.pricePerSqm.toLocaleString()}/sqm)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {centerListing.leasePrice > 0 && (
                                        <div className="text-gray-800">
                                            {formatPrice(centerListing.leasePrice)}/month
                                            {centerListing.leasePricePerSqm > 0 && (
                                                <span className="text-[10px] font-normal text-gray-500 ml-1">
                                                    ({formatPrice(centerListing.leasePricePerSqm)}/sqm)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {centerListing.price === 0 && centerListing.leasePrice === 0 && 'Price on Request'}
                                </div>
                                {(centerListing.building || centerListing.area || centerListing.barangay) && (
                                    <div className="text-xs text-gray-600 font-medium">
                                        {centerListing.building || centerListing.area || centerListing.barangay}
                                    </div>
                                )}
                            </Popup>
                        </Marker>

                        {/* Neighbor Markers (Blue) */}
                        {neighbors.map(l => (
                            <Marker key={l.id} position={[l.lat, l.lng]} icon={blueIcon}>
                                <Popup>
                                    <div
                                        onClick={() => setFocusedListing(l)}
                                        className="text-sm font-bold cursor-pointer text-blue-600 hover:underline mb-1"
                                    >
                                        {l.id}
                                    </div>
                                    <div className="flex flex-col gap-0.5 mb-1.5">
                                        {l.price > 0 && (
                                            <div className="font-bold text-gray-900 leading-tight">
                                                P{l.price.toLocaleString()}
                                                {l.pricePerSqm > 0 && (
                                                    <span className="text-[10px] font-normal text-gray-500 ml-1">
                                                        (P{l.pricePerSqm.toLocaleString()}/sqm)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {l.leasePrice > 0 && (
                                            <div className="popup-price lease-price">
                                                {formatPrice(l.leasePrice)}/month
                                                {l.leasePricePerSqm > 0 && (
                                                    <span className="sqm-badge ml-1">
                                                        ({formatPrice(l.leasePricePerSqm)}/sqm)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {(l.building || l.area || l.barangay) && (
                                        <div className="text-xs text-gray-600 font-medium">
                                            {l.building || l.area || l.barangay}
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-500 mt-1">
                                        {calculateDistance(centerListing.lat, centerListing.lng, l.lat, l.lng).toFixed(2)} km away
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {/* Detail Overlay */}
                {focusedListing && (
                    <div className="absolute inset-0 z-[2000] bg-gray-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="p-3 border-b border-gray-100 flex items-center gap-3 bg-white">
                            <button
                                onClick={() => setFocusedListing(null)}
                                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center"
                                title="Back to Map"
                            >
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <h3 className="text-base font-bold text-gray-900">
                                {`Back to Map: Neighbors of ${centerListing.id}`}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 flex justify-center items-start">
                            <div className="w-full max-w-sm">
                                <ListingCard
                                    listing={focusedListing}
                                    isPopupView={true}
                                    onBack={() => setFocusedListing(null)}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
