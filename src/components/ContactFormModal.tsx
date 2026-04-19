import React, { useState, useEffect } from 'react';
import { X, MapPin, Locate } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Listing } from '../types';


interface ContactFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedListings: string[];
    initialSuggestedEdit?: string;
    listing?: Listing | null;
    /** Called on submit to save coords + verification to the database (like Edit Module) */
    onSaveCoords?: (listingId: string, latLong: string, mapVerified: string, fbLink: string) => Promise<void>;
}

export const ContactFormModal: React.FC<ContactFormModalProps> = ({
    isOpen,
    onClose,
    selectedListings,
    initialSuggestedEdit = '',
    listing = null,
    onSaveCoords,
}) => {
    const { fbGroup, groupBranding, userName } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        additionalQuestions: '',
    });

    // Coordinates section state (shown for all users)
    const [latLong, setLatLong] = useState('');
    const [mapVerified, setMapVerified] = useState('');
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    // Social media section state (shown only for owner group)
    const [fbLink, setFbLink] = useState('');

    // Determine if user is the listing owner group
    const isOwnerGroup = (() => {
        if (!listing) return false;
        const ownerString = (listing.columnBD || 'Luxe').toLowerCase();
        const userGroup = (fbGroup || '').toLowerCase();
        const name = (userName || '').toLowerCase();
        const isGroupMatch = userGroup && ownerString.includes(userGroup);
        const isNameMatch = name && ownerString.includes(name);
        return !!(isGroupMatch || isNameMatch);
    })();

    // Initialize all fields when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: groupBranding?.brandName ?? fbGroup ?? '',
                additionalQuestions: initialSuggestedEdit,
            });

            if (listing) {
                // Pre-populate coordinates from the listing
                setLatLong(listing.lat && listing.lng ? `${listing.lat}, ${listing.lng}` : '');
                setMapVerified(listing.mapVerified || '');

                // Pre-populate social media link based on current user's group
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
            } else {
                setLatLong('');
                setMapVerified('');
                setFbLink('');
            }
            setLocationError(null);
        }
    }, [isOpen, initialSuggestedEdit, fbGroup, listing?.id]);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Reset form state on close
    useEffect(() => {
        if (!isOpen) {
            setSubmitStatus('idle');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');

        try {
            // ── STEP 1: Save coordinates + verification to Supabase (Edit Module behaviour) ──
            // This runs for all users who have a listing, even if coords haven't changed.
            // We only call it when there is a listing context and the callback is provided.
            if (listing && onSaveCoords) {
                await onSaveCoords(
                    listing.id,
                    latLong.trim(),
                    mapVerified.trim(),
                    isOwnerGroup ? fbLink.trim() : ''   // fbLink only saved for owner group
                );
            }

            // ── STEP 2: Submit suggested-edit note to Google Form (Notes Module behaviour) ──
            const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/u/0/d/e/1FAIpQLScsBzxO6PgWWJjDVf4rd1uXHiwQZlFYHOMTkg4jk-IxGPtOWg/formResponse";
            const formBody = new FormData();
            formBody.append("entry.524309596", formData.name);               // Your Group
            formBody.append("entry.1404259207", selectedListings.join(', ')); // Selected Property
            formBody.append("entry.94649554", formData.additionalQuestions);  // Suggested Edits

            await fetch(GOOGLE_FORM_ACTION_URL, {
                method: "POST",
                mode: "no-cors",
                body: formBody,
            });

            // ── STEP 3: Write a submission event to Supabase so admins are notified ──
            // Fire-and-forget — don't let this block the success flow
            supabase
                .from('luxe_note_submissions')
                .insert({
                    listing_id: selectedListings.join(', '),
                    group_name: formData.name,
                    submitted_at: new Date().toISOString(),
                })
                .then(({ error }) => {
                    if (error) console.warn('Note event insert failed:', error.message);
                });

            setSubmitStatus('success');
            setTimeout(() => {
                onClose();
                resetForm();
            }, 2000);

        } catch (error) {
            console.error("Form submission error:", error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', additionalQuestions: '' });
        setLatLong('');
        setMapVerified('');
        setFbLink('');
        setLocationError(null);
        setSubmitStatus('idle');
    };

    // GPS: populates the Coordinates field
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
                setLatLong(`${latitude.toFixed(7)}, ${longitude.toFixed(7)}`);
                // Clear verification whenever coordinates change
                setMapVerified('');
                setIsGettingLocation(false);
            },
            (err) => {
                setLocationError(`Location error: ${err.message}`);
                setIsGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Parse lat/long for the preview line
    const parsedCoords = (() => {
        const parts = latLong.split(',').map(s => s.trim());
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
        return null;
    })();

    const todayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                    <h2 className="text-2xl font-bold text-gray-900">Suggested Edit on NOTES</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {submitStatus === 'success' ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-green-800 mb-2">Suggestion Sent!</h3>
                            <p className="text-gray-600">Thank you for your interest. We will get back to you shortly.</p>
                        </div>
                    ) : (
                        <>
                            {submitStatus === 'error' && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                                    <span className="block sm:inline">Something went wrong. Please try again.</span>
                                </div>
                            )}

                            {/* Your Group */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Your Group</label>
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <p className="text-sm text-gray-600">{formData.name}</p>
                                </div>
                            </div>

                            {/* Selected Property */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Selected Property</label>
                                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                    <p className="text-sm text-gray-600">{selectedListings.join(', ')}</p>
                                </div>
                            </div>

                            {/* Suggested Edits — no GPS Coordinates button here */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Suggested Edits
                                </label>
                                <textarea
                                    value={formData.additionalQuestions}
                                    onChange={(e) => setFormData({ ...formData, additionalQuestions: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Any specific questions about the selected properties..."
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* ── COORDINATES SECTION (shown for ALL users) ── */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                    Coordinates (Lat, Long)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={latLong}
                                        onChange={(e) => {
                                            setLatLong(e.target.value);
                                            setMapVerified(''); // Clear verification on manual edit
                                        }}
                                        placeholder="e.g. 14.5995, 120.9842"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={isGettingLocation || isSubmitting}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        title="Use my current GPS location"
                                    >
                                        {isGettingLocation
                                            ? <Locate className="w-3 h-3 animate-spin" />
                                            : <MapPin className="w-3 h-3" />
                                        }
                                        HERE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const author = fbGroup || 'System';
                                            setMapVerified(`${todayStr()} | ${author}`);
                                        }}
                                        disabled={!latLong.trim() || isSubmitting}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Mark coordinates as verified"
                                    >
                                        VERIFIED
                                    </button>
                                </div>
                                {mapVerified ? (
                                    <p className="text-xs text-green-600 font-medium mt-1">
                                        {(() => {
                                            const parts = mapVerified.split(' | ');
                                            const date = parts[0];
                                            const group = parts[1] || 'System';
                                            return `Verified by ${group} on ${date}`;
                                        })()}
                                    </p>
                                ) : parsedCoords ? (
                                    <p className="text-xs text-gray-500 mt-1">
                                        LAT: {parsedCoords.lat}&nbsp;|&nbsp;LONG: {parsedCoords.lng}
                                    </p>
                                ) : null}
                                {locationError && (
                                    <p className="text-xs text-red-500 mt-1">{locationError}</p>
                                )}
                            </div>

                            {/* ── SOCIAL MEDIA SECTION (owner group only) ── */}
                            {isOwnerGroup && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                        Social Media Post Link
                                    </label>
                                    <input
                                        type="url"
                                        value={fbLink}
                                        onChange={(e) => setFbLink(e.target.value)}
                                        placeholder="https://www.facebook.com/..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`w-full text-white py-3 rounded-lg font-semibold transition-colors
                                ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {isSubmitting ? 'Sending...' : 'Submit FORM'}
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};
