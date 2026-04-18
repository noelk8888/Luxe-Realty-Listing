import React, { useState } from 'react';
import { X, Map, RotateCcw } from 'lucide-react';
import { useViewing } from '../contexts/ViewingContext';
import { ViewingMapModal } from './ViewingMapModal';
import type { Listing } from '../types';

const MAX_VIEWING = 10;

interface ViewingSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

function ListingPreview({ listing, onRemove }: { listing: Listing; onRemove: () => void }) {
    const lines = (listing.displaySummary || '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .slice(0, 5);

    return (
        <div className="relative bg-white rounded-xl border border-orange-100 p-3 shadow-sm group">
            {/* Remove button */}
            <button
                onClick={onRemove}
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Remove from viewing list"
            >
                <X size={11} />
            </button>

            {/* GEO ID */}
            <div className="text-sm font-black text-orange-500 tracking-tight mb-1.5 pr-6">
                {listing.id}
            </div>

            {/* Listing preview lines */}
            <div className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-line font-medium">
                {lines.join('\n')}
                {(listing.displaySummary || '').split('\n').filter(Boolean).length > 5 && (
                    <span className="text-gray-300"> …</span>
                )}
            </div>
        </div>
    );
}

export const ViewingSidebar: React.FC<ViewingSidebarProps> = ({ isOpen, onClose }) => {
    const { viewingList, removeFromViewing, resetViewing } = useViewing();
    const [showMapModal, setShowMapModal] = useState(false);

    const handleReset = () => {
        resetViewing();
        onClose();
    };

    return (
        <>
            {/* Backdrop — subtle, only on mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[900] bg-black/10 sm:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Panel */}
            <div
                className={`
                    fixed top-0 right-0 h-full z-[901]
                    w-[320px] max-w-[90vw]
                    bg-gray-50 border-l border-orange-100 shadow-2xl
                    flex flex-col
                    transition-transform duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-5 pb-3 bg-white border-b border-orange-100 flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                                Viewing List
                            </h2>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                viewingList.length >= MAX_VIEWING
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-orange-100 text-orange-600'
                            }`}>
                                {viewingList.length}/{MAX_VIEWING}
                            </span>
                        </div>
                        {viewingList.length >= MAX_VIEWING && (
                            <p className="text-[10px] text-red-500 font-medium mt-0.5">Maximum reached</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Listing List */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                    {viewingList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 text-gray-400">
                            <div className="text-4xl mb-3">🏡</div>
                            <p className="text-sm font-semibold text-gray-500">No listings yet</p>
                            <p className="text-xs mt-1">Click VIEWING on a listing card to add it here.</p>
                        </div>
                    ) : (
                        viewingList.map(listing => (
                            <ListingPreview
                                key={listing.id}
                                listing={listing}
                                onRemove={() => removeFromViewing(listing.id)}
                            />
                        ))
                    )}
                </div>

                {/* Action Buttons */}
                {viewingList.length > 0 && (
                    <div className="flex-shrink-0 px-3 py-4 border-t border-orange-100 bg-white space-y-2">
                        <button
                            onClick={() => setShowMapModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors uppercase tracking-widest shadow-sm"
                        >
                            <Map size={14} />
                            MAP VIEW
                        </button>
                        <button
                            onClick={handleReset}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 text-xs font-bold rounded-xl transition-colors uppercase tracking-widest"
                        >
                            <RotateCcw size={13} />
                            RESET
                        </button>
                    </div>
                )}
            </div>

            {/* Viewing Map Modal */}
            <ViewingMapModal
                isOpen={showMapModal}
                onClose={() => setShowMapModal(false)}
                listings={viewingList}
            />
        </>
    );
};
