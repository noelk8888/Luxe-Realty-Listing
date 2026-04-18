import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Listing } from '../types';
import { useAuth } from './AuthContext';

const MAX_VIEWING = 10;

interface ViewingContextType {
    viewingList: Listing[];
    addToViewing: (listing: Listing) => void;
    removeFromViewing: (id: string) => void;
    resetViewing: () => void;
    isInViewing: (id: string) => boolean;
    isFull: boolean;
}

const ViewingContext = createContext<ViewingContextType | undefined>(undefined);

export function ViewingProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [viewingList, setViewingList] = useState<Listing[]>([]);

    // Clear viewing list when user logs out
    useEffect(() => {
        if (!user) {
            setViewingList([]);
        }
    }, [user]);

    const addToViewing = (listing: Listing) => {
        setViewingList(prev => {
            if (prev.some(l => l.id === listing.id)) return prev; // already in list
            if (prev.length >= MAX_VIEWING) return prev;           // max reached
            return [...prev, listing];
        });
    };

    const removeFromViewing = (id: string) => {
        setViewingList(prev => prev.filter(l => l.id !== id));
    };

    const resetViewing = () => {
        setViewingList([]);
    };

    const isInViewing = (id: string) => viewingList.some(l => l.id === id);

    return (
        <ViewingContext.Provider value={{
            viewingList,
            addToViewing,
            removeFromViewing,
            resetViewing,
            isInViewing,
            isFull: viewingList.length >= MAX_VIEWING,
        }}>
            {children}
        </ViewingContext.Provider>
    );
}

export function useViewing() {
    const ctx = useContext(ViewingContext);
    if (!ctx) throw new Error('useViewing must be used within a ViewingProvider');
    return ctx;
}
