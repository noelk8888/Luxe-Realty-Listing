import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { X } from 'lucide-react';
import type { Listing } from '../types';
import L from 'leaflet';
import { calculateDistance } from '../utils/geoUtils';

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

const yellowIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
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

export const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, centerListing, allListings }) => {
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
                                <div className="text-sm font-bold">{centerListing.id}</div>
                                <div className="text-xs">{centerListing.price > 0 ? `₱${centerListing.price.toLocaleString()}` : 'Price on Request'}</div>
                                {(centerListing.building || centerListing.area || centerListing.barangay) && (
                                    <div className="text-xs text-gray-600 font-medium">
                                        {centerListing.building || centerListing.area || centerListing.barangay}
                                    </div>
                                )}
                            </Popup>
                        </Marker>

                        {/* Neighbor Markers (Yellow) */}
                        {neighbors.map(l => (
                            <Marker key={l.id} position={[l.lat, l.lng]} icon={yellowIcon}>
                                <Popup>
                                    <div className="text-sm font-bold">{l.id}</div>
                                    <div className="text-xs">{l.price > 0 ? `₱${l.price.toLocaleString()}` : 'Price on Request'}</div>
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
            </div>
        </div>
    );
};
