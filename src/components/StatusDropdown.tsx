import React, { useState } from 'react';

interface StatusDropdownProps {
    currentStatus: string;
    listingId: string;
    onUpdate: (id: string, status: string) => Promise<void>;
}

const STATUS_OPTIONS = ['Available', 'SOLD', 'LEASED OUT', 'OFF MARKET', 'ON HOLD', 'UNDER NEGO', 'UNDECISIVE SELLER'];

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
    currentStatus, listingId, onUpdate
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const isNotAvailable = currentStatus.toLowerCase().trim() !== 'available';
    const isUnderNego = currentStatus.toLowerCase().trim() === 'under nego';
    const isUndecisiveSeller = currentStatus.toLowerCase().trim() === 'undecisive seller';

    const handleSelect = async (newStatus: string) => {
        if (newStatus === currentStatus) {
            setIsOpen(false);
            return;
        }
        setIsUpdating(true);
        try {
            await onUpdate(listingId, newStatus);
        } finally {
            setIsUpdating(false);
            setIsOpen(false);
        }
    };

    return (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-[50]">
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                disabled={isUpdating}
                className={`px-4 py-1.5 rounded-2xl shadow-md border-2 text-[11px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer
                    ${isUndecisiveSeller
                        ? 'bg-white border-amber-800 text-amber-800 hover:bg-amber-50'
                        : isUnderNego
                        ? 'bg-white border-blue-500 text-blue-500 hover:bg-blue-50'
                        : isNotAvailable
                        ? 'bg-white border-red-600 text-red-600 hover:bg-red-50'
                        : 'bg-white border-green-500 text-green-600 hover:bg-green-50'}
                    ${isUpdating ? 'opacity-50' : ''}
                `}
            >
                {isUpdating ? 'UPDATING...' : currentStatus}
            </button>
            {isOpen && (
                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] z-[60]">
                    {STATUS_OPTIONS.map(status => (
                        <button
                            key={status}
                            onClick={(e) => { e.stopPropagation(); handleSelect(status); }}
                            className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-gray-50 transition-colors
                                ${status === currentStatus ? 'text-blue-600 bg-blue-50' : 'text-gray-700'}
                            `}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
