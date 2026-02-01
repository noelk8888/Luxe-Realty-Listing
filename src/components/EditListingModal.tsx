import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Listing } from '../types';

interface EditListingModalProps {
    isOpen: boolean;
    listing: Listing | null;
    onClose: () => void;
    onSave: (listingId: string, updates: {
        salePrice: number;
        leasePrice: number;
        notes: string;
    }) => Promise<void>;
}

export const EditListingModal: React.FC<EditListingModalProps> = ({
    isOpen,
    listing,
    onClose,
    onSave,
}) => {
    const [salePrice, setSalePrice] = useState('');
    const [leasePrice, setLeasePrice] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when listing changes
    useEffect(() => {
        if (listing) {
            setSalePrice(listing.price > 0 ? listing.price.toString() : '');
            setLeasePrice(listing.leasePrice > 0 ? listing.leasePrice.toString() : '');
            setNotes(listing.columnV || '');
            setError(null);
        }
    }, [listing]);

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

    // Calculate price per sqm
    const calculatePricePerSqm = (price: number): number => {
        // Use floor area if available, otherwise lot area
        const area = listing.floorArea > 0 ? listing.floorArea : listing.lotArea;
        if (area > 0 && price > 0) {
            return Math.round(price / area);
        }
        return 0;
    };

    const salePriceNum = parseNumber(salePrice);
    const leasePriceNum = parseNumber(leasePrice);
    const salePricePerSqm = calculatePricePerSqm(salePriceNum);
    const leasePricePerSqm = calculatePricePerSqm(leasePriceNum);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await onSave(listing.id, {
                salePrice: salePriceNum,
                leasePrice: leasePriceNum,
                notes: notes.trim(),
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
                        <h2 className="text-xl font-bold text-gray-900">Edit Listing</h2>
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
                    {/* Sale Price */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Sale Price (PHP)
                        </label>
                        <input
                            type="text"
                            value={salePrice ? formatNumberInput(salePrice) : ''}
                            onChange={(e) => setSalePrice(e.target.value.replace(/,/g, ''))}
                            placeholder="e.g. 5,000,000"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {salePricePerSqm > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                = P{salePricePerSqm.toLocaleString()}/sqm
                            </p>
                        )}
                    </div>

                    {/* Lease Price */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">
                            Lease Price (PHP/month)
                        </label>
                        <input
                            type="text"
                            value={leasePrice ? formatNumberInput(leasePrice) : ''}
                            onChange={(e) => setLeasePrice(e.target.value.replace(/,/g, ''))}
                            placeholder="e.g. 50,000"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {leasePricePerSqm > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                = P{leasePricePerSqm.toLocaleString()}/sqm
                            </p>
                        )}
                    </div>

                    {/* Notes */}
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
