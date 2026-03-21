import React, { useState, useEffect } from 'react';
import { X, MapPin, Locate } from 'lucide-react';
import type { Listing } from '../types';
import { usePermissions } from '../contexts/PermissionsContext';
import { useAuth } from '../contexts/AuthContext';

interface EditListingModalProps {
    isOpen: boolean;
    listing: Listing | null;
    onClose: () => void;
    onSave: (listingId: string, updates: {
        salePrice: number;
        leasePrice: number;
        monthlyDues: string;
        notes: string;
        updateDate: string | null;
        latLong: string;
        fbLink: string;
        mapVerified: string;
        sourceTab?: string;
    }) => Promise<void>;
    groupName?: string;
}

export const EditListingModal: React.FC<EditListingModalProps> = ({
    isOpen,
    listing,
    onClose,
    onSave,
    groupName = 'Kiu'
}) => {
    const [salePrice, setSalePrice] = useState('');
    const [leasePrice, setLeasePrice] = useState('');
    const [monthlyDues, setMonthlyDues] = useState('');
    const [notes, setNotes] = useState('');
    const [updateDate, setUpdateDate] = useState(false);
    const todayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const [customDate, setCustomDate] = useState(todayStr);
    const [latLong, setLatLong] = useState('');
    const [fbLink, setFbLink] = useState('');
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [mapVerified, setMapVerified] = useState('');
    const { permissions } = usePermissions();
    const { fbGroup, user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when listing changes
    useEffect(() => {
        if (listing) {
            setSalePrice(listing.price > 0 ? listing.price.toString() : '');
            setLeasePrice(listing.leasePrice > 0 ? listing.leasePrice.toString() : '');
            setMonthlyDues(listing.monthlyDues || '');
            setNotes(listing.columnV || '');
            setUpdateDate(false);
            setCustomDate(todayStr());
            setLatLong(listing.lat && listing.lng ? `${listing.lat}, ${listing.lng}` : '');
            const groupPostLink: Record<string, string | undefined> = {
                'Luxe': listing.postLinkLuxe,
                'Nexia': listing.postLinkNexia,
                'Adolf': listing.postLinkAdolf,
                'PCO': listing.postLinkPco,
                'SLoo': listing.postLinkSloo,
                'Taoke': listing.postLinkTaoke,
                'Kiu': listing.facebookLink,
            };
            setFbLink((fbGroup ? groupPostLink[fbGroup] : listing.facebookLink) || '');
            setMapVerified(listing.mapVerified || '');
            setLocationError(null);
            setError(null);
        }
    }, [listing]);

    // Auto-clear verification if coordinates change
    useEffect(() => {
        if (!listing) return;
        
        const currentCoords = latLong.trim().split(',').map(s => s.trim()).filter(Boolean);
        if (currentCoords.length === 2) {
            const originalLat = listing.lat?.toString().trim();
            const originalLng = listing.lng?.toString().trim();
            
            // Compare normalized strings
            const latChanged = currentCoords[0] !== originalLat && parseFloat(currentCoords[0]) !== parseFloat(originalLat || '');
            const lngChanged = currentCoords[1] !== originalLng && parseFloat(currentCoords[1]) !== parseFloat(originalLng || '');
            
            if (latChanged || lngChanged) {
                setMapVerified('');
            }
        }
    }, [latLong, listing]);

    if (!isOpen || !listing) return null;

    const formatNumberInput = (value: string): string => {
        // Remove non-numeric characters except decimal point
        const cleaned = value.replace(/[^0-9.]/g, '');
        // Format with commas
        const parts = cleaned.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    };

    const parseNumber = (value: string): number => {
        return parseFloat(value.replace(/,/g, '')) || 0;
    };

    // Calculate sale price per sqm - prioritize LOT AREA (land being sold)
    const calculateSalePricePerSqm = (price: number): number => {
        const area = listing.lotArea > 0 ? listing.lotArea : listing.floorArea;
        if (area > 0 && price > 0) {
            return Math.round(price / area);
        }
        return 0;
    };

    // Calculate lease price per sqm - prioritize FLOOR AREA (space being rented)
    const calculateLeasePricePerSqm = (price: number): number => {
        const area = listing.floorArea > 0 ? listing.floorArea : listing.lotArea;
        if (area > 0 && price > 0) {
            return Math.round(price / area);
        }
        return 0;
    };

    const salePriceNum = parseNumber(salePrice);
    const leasePriceNum = parseNumber(leasePrice);
    const salePricePerSqm = calculateSalePricePerSqm(salePriceNum);
    const leasePricePerSqm = calculateLeasePricePerSqm(leasePriceNum);

    // Parse lat/long from the input for preview
    const parsedCoords = (() => {
        const parts = latLong.split(',').map(s => s.trim());
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
        return null;
    })();

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported by this browser');
            return;
        }
        setIsGettingLocation(true);
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const rounded = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                setLatLong(rounded);
                setIsGettingLocation(false);
            },
            (err) => {
                setLocationError(`Location error: ${err.message}`);
                setIsGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            // Generate a fresh verification stamp if verified (matches Dashboard behavior)
            // This forces Supabase to see a "change" and send the webhook to GSheet
            let finalMapVerified = mapVerified.trim();
            if (finalMapVerified && finalMapVerified.includes('Location Verified by')) {
                const today = new Date().toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
                finalMapVerified = `Location Verified by ${groupName} on ${today}`;
            }

            await onSave(listing.id, {
                salePrice: salePriceNum,
                leasePrice: leasePriceNum,
                monthlyDues: monthlyDues.trim(),
                notes: notes.trim(),
                updateDate: updateDate ? customDate : null,
                latLong: latLong.trim(),
                fbLink: fbLink.trim(),
                mapVerified: finalMapVerified,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Update Listing</h2>
                        <p className="text-sm text-gray-500 mt-1">{listing.id} - {listing.columnK || listing.building || listing.city}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Quick action buttons at top */}
                    <div className="flex gap-3 pb-3 border-b border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    {/* Sale Price */}
                    {permissions.edit_sale_price && (
                    <div className="flex items-start gap-3">
                        <label className="text-sm font-bold text-gray-700 whitespace-nowrap pt-3 w-36 shrink-0">
                            Sale Price (PHP)
                        </label>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={salePrice ? formatNumberInput(salePrice) : ''}
                                onChange={(e) => setSalePrice(e.target.value.replace(/,/g, ''))}
                                placeholder="e.g. 5,000,000"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {salePricePerSqm > 0 && (
                                <p className="text-xs text-gray-500 mt-1">= P{salePricePerSqm.toLocaleString()}/sqm</p>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Lease Price */}
                    {permissions.edit_lease_price && (
                    <div className="flex items-start gap-3">
                        <label className="text-sm font-bold text-gray-700 whitespace-nowrap pt-3 w-36 shrink-0">
                            Lease Price (PHP/month)
                        </label>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={leasePrice ? formatNumberInput(leasePrice) : ''}
                                onChange={(e) => setLeasePrice(e.target.value.replace(/,/g, ''))}
                                placeholder="e.g. 50,000"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {leasePricePerSqm > 0 && (
                                <p className="text-xs text-gray-500 mt-1">= P{leasePricePerSqm.toLocaleString()}/sqm</p>
                            )}
                        </div>
                    </div>
                    )}

                    {/* Monthly Dues */}
                    {permissions.edit_monthly_dues && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Monthly Dues (PHP)
                        </label>
                        <input
                            type="text"
                            value={monthlyDues}
                            onChange={(e) => setMonthlyDues(e.target.value)}
                            placeholder="e.g. 2,681.92/month"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    )}

                    {/* Notes */}
                    {permissions.edit_notes && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Notes
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this listing..."
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>
                    )}

                    {/* LAT LONG */}
                    {permissions.edit_coordinates && <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Coordinates (Lat, Long)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={latLong}
                                onChange={(e) => setLatLong(e.target.value)}
                                placeholder="e.g. 14.5995, 120.9842"
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {permissions.geocoding && (
                            <button
                                type="button"
                                onClick={handleGetLocation}
                                disabled={isGettingLocation}
                                className="flex items-center gap-1.5 px-4 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                title="Use my current location"
                            >
                                {isGettingLocation
                                    ? <Locate className="w-4 h-4 animate-spin" />
                                    : <MapPin className="w-4 h-4" />
                                }
                                HERE
                            </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    const dateStr = todayStr();
                                    const author = fbGroup || (user?.user_metadata?.full_name || user?.email || 'System');
                                    setMapVerified(`${dateStr} | ${author}`);
                                }}
                                className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                                title="Mark coordinates as verified"
                            >
                                VERIFIED
                            </button>
                        </div>
                        {mapVerified ? (
                            <p className="text-xs text-green-600 font-medium mt-1">
                                {(() => {
                                    if (mapVerified.includes('Location Verified by')) {
                                        const match = mapVerified.match(/Location Verified by (.*?) on (.*)/);
                                        if (match) {
                                            const group = match[1];
                                            const date = match[2].split('T')[0];
                                            return `Verified by ${group} on ${date}`;
                                        }
                                    }
                                    const parts = mapVerified.split(' | ');
                                    const date = parts[0];
                                    const group = parts[1] || 'System';
                                    return `Verified by ${group} on ${date}`;
                                })()}
                            </p>
                        ) : parsedCoords ? (
                            <p className="text-xs text-gray-500 mt-1">
                                LAT: {parsedCoords.lat} &nbsp;|&nbsp; LONG: {parsedCoords.lng}
                            </p>
                        ) : null}
                        {locationError && (
                            <p className="text-xs text-red-500 mt-1">{locationError}</p>
                        )}
                    </div>}

                    {/* FB Link */}
                    {permissions.edit_fb_link && <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Social Media Post Link
                        </label>
                        <input
                            type="url"
                            value={fbLink}
                            onChange={(e) => setFbLink(e.target.value)}
                            placeholder="https://www.facebook.com/..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>}

                    {/* Update Date Toggle */}
                    {permissions.edit_update_date && <div className="py-2 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-gray-700">Update Date</p>
                                <p className="text-xs text-gray-400">Set DATE UPDATED</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setUpdateDate(prev => !prev)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${updateDate ? 'bg-blue-600' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${updateDate ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        {updateDate && (
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        )}
                    </div>}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
