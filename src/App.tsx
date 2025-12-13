import React, { useState, useEffect } from 'react';
import { Search, Info } from 'lucide-react';
import { fetchListings } from './services/dataService';
import { searchListings } from './services/searchEngine';
import type { Listing } from './types';
import { ListingCard } from './components/ListingCard';
import { ContactFormModal } from './components/ContactFormModal';

function App() {
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [results, setResults] = useState<Listing[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null); // Default null
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: 'price' | 'pricePerSqm' | 'relevance' | 'lotArea' | 'floorArea', direction: 'asc' | 'desc' } | null>(null);

  // Relevance Score: 0-100.
  // We align this with the 5 stages requested: 100, 75, 50, 25, 0.
  // Initialize from URL if present.
  const getInitialScore = () => {
    const params = new URLSearchParams(window.location.search);
    const score = params.get('relevance');
    return score ? parseInt(score) : 50; // Default 50
  };

  const [relevanceScore, setRelevanceScore] = useState<number>(getInitialScore());
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);

  // Initial Data Load
  useEffect(() => {
    fetchListings().then(data => {
      setAllListings(data);
      setLoading(false);
    });
  }, []);

  // Post-load search if URL had query
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (!loading && q && !hasSearched) {
      setHasSearched(true);
      setQuery(q);
      let filtered = searchListings(allListings, q, relevanceScore);
      setResults(filtered);
    }
  }, [loading, allListings, hasSearched, relevanceScore]);

  const updateUrlParams = (q: string, score: number) => {
    const params = new URLSearchParams(window.location.search);
    if (q) params.set('q', q);
    else params.delete('q');

    params.set('relevance', score.toString());

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setHasSearched(true);
    updateUrlParams(query, relevanceScore);

    let filtered = searchListings(allListings, query, relevanceScore);
    setResults(filtered);
  };

  // Effect: Re-search when relevanceScore changes
  useEffect(() => {
    if (hasSearched && query.trim()) {
      updateUrlParams(query, relevanceScore);
      let filtered = searchListings(allListings, query, relevanceScore);
      setResults(filtered);
    }
  }, [relevanceScore]); // Trigger re-search on score change

  // Re-run filter and sort when filters change
  const displayedResults = results.filter(item => {
    // 1. If no type is selected, show NOTHING (as per requirements)
    if (!selectedType) return false;

    // 2. Type Match Logic (Single Select)
    let typeMatch = false;
    const itemType = item.saleType?.toLowerCase() || '';
    if (selectedType === 'Sale') typeMatch = (itemType === 'sale' || itemType === 'sale/lease');
    else if (selectedType === 'Lease') typeMatch = (itemType === 'lease' || itemType === 'sale/lease');
    else if (selectedType === 'Sale/Lease') typeMatch = (itemType === 'sale/lease');

    // 3. Category Match Logic (Multi Select)
    // If NO category selected, allow ALL (ignore category filter)
    let categoryMatch = true;
    if (selectedCategories.length > 0) {
      const itemCat = (item.category || '').trim().toLowerCase();
      const itemAE = (item.columnAE || '').trim().toLowerCase(); // Check visual badge source (Col AE) too

      categoryMatch = selectedCategories.some(filter => {
        if (filter === 'Residential') {
          return itemCat === 'residential' || itemAE === 'residential';
        }
        if (filter === 'Commercial') {
          const targets = ['industrial', 'commercial', 'industrial/commercial'];
          return targets.includes(itemCat) || targets.includes(itemAE);
        }
        return false;
      });
    }

    return typeMatch && categoryMatch;
  }).sort((a, b) => {
    if (!sortConfig) return 0;

    let comparison = 0;
    if (sortConfig.key === 'price') {
      comparison = a.price - b.price;
    } else if (sortConfig.key === 'pricePerSqm') {
      comparison = a.pricePerSqm - b.pricePerSqm;
    } else if (sortConfig.key === 'lotArea') {
      comparison = a.lotArea - b.lotArea;
    } else if (sortConfig.key === 'floorArea') {
      comparison = a.floorArea - b.floorArea;
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  // Relevance sort = null sortConfig (uses original array order from searchEngine)
  const handleSort = (key: 'price' | 'pricePerSqm' | 'relevance' | 'lotArea' | 'floorArea') => {
    if (key === 'relevance') {
      setSortConfig(null);
      return;
    }

    setSortConfig(current => {
      if (current?.key === key) {
        // Toggle direction if same key
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      // Default to High-Low (desc) for new key as implies "Best/Expensive" first usually
      return { key, direction: 'desc' };
    });
  };

  const handleToggleSelection = (listingId: string) => {
    setSelectedListings(prev => {
      if (prev.includes(listingId)) {
        // Deselect
        return prev.filter(id => id !== listingId);
      } else {
        // Select (only if less than 3)
        if (prev.length < 3) {
          return [...prev, listingId];
        }
        return prev;
      }
    });
  };

  const handleSendForm = () => {
    setShowFormModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100">

      {/* Hero / Search Section */}
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ease-out px-4 ${hasSearched ? 'py-12 min-h-[30vh]' : 'min-h-[100vh]'
        }`}>
        <div className={`w-full max-w-2xl text-center space-y-6 transition-all duration-500 ${hasSearched ? 'translate-y-0' : '-translate-y-8'
          }`}>
          <p className={`font-bold text-gray-900 tracking-tight transition-all duration-500 ${hasSearched ? 'text-2xl mb-4' : 'text-4xl sm:text-5xl mb-8'}`}>
            {(selectedType || hasSearched)
              ? `Found ${displayedResults.length} of ${allListings.length} Available Listings`
              : allListings.length > 0 ? `${allListings.length} Available Listings` : 'Loading properties...'
            }
          </p>



          {/* Filter Buttons - Split with separator */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8 max-w-4xl mx-auto">

            {/* Group 1: Property Type (Single Select) */}
            <div className="flex gap-2">
              {['Sale', 'Lease', 'Sale/Lease'].map((filter) => {
                let label = filter.toUpperCase();
                if (filter === 'Sale') label = 'FOR SALE';
                if (filter === 'Lease') label = 'FOR LEASE';

                const isActive = selectedType === filter;

                return (
                  <button
                    key={filter}
                    onClick={() => setSelectedType(current => current === filter ? null : filter)}
                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all border
                          ${isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'
                      }
                    `}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Separator Line */}
            <div className="h-8 w-px bg-blue-600 mx-2"></div>

            {/* Group 2: Category (Multi Select) */}
            <div className="flex gap-2">
              {['Residential', 'Commercial'].map((filter) => {
                const isActive = selectedCategories.includes(filter);
                return (
                  <button
                    key={filter}
                    onClick={() => {
                      setSelectedCategories(prev => {
                        if (prev.includes(filter)) return prev.filter(f => f !== filter);
                        return [...prev, filter];
                      });
                    }}
                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all border
                          ${isActive
                        ? 'border-blue-600 text-blue-600 bg-white ring-2 ring-blue-600 font-extrabold'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'
                      }
                          ${isActive ? 'shadow-md' : ''}
                    `}
                  >
                    {filter.toUpperCase()}
                  </button>
                )
              })}
            </div>

          </div>

          <form onSubmit={handleSearch} className="relative w-full group">
            <div className="absolute inset-y-0 left-2 flex items-center">
              <div className="bg-blue-600 p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors shadow-sm" onClick={handleSearch}>
                <Search className="w-5 h-5 text-white" />
              </div>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="" // Placeholder removed for cleaner look or keep if needed?
              className={`w-full bg-white border-2 transition-all duration-300 rounded-2xl outline-none text-lg
                        ${hasSearched
                  ? 'py-3 pl-14 pr-20 border-gray-200 focus:border-blue-500 shadow-sm'
                  : 'py-4 pl-14 pr-20 border-transparent shadow-xl hover:shadow-2xl focus:ring-4 focus:ring-blue-100'
                }
                    `}
            />
            {/* RESET Button inside Search Bar */}
            {(hasSearched || selectedType) && (
              <div className="absolute inset-y-0 right-4 flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelectedListings([]);
                    setHasSearched(false);
                    setResults([]);
                    setSelectedType(null);
                    setSelectedCategories([]);
                    window.location.href = window.location.pathname;
                  }}
                  className="text-sm font-bold text-red-500 hover:text-red-700 underline tracking-wide bg-white pl-2"
                >
                  RESET
                </button>
              </div>
            )}
          </form>

          {/* Results Bar: Sort Controls Only (Centered below search) */}
          {(hasSearched || selectedType) && (
            <>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 mt-6 animate-fade-in-up w-full">
                {/* Relevance Slider */}
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                  <span className="text-sm font-bold text-gray-500">Relevance:</span>
                  <div className="relative group flex items-center">
                    <Info className="w-4 h-4 text-gray-400 cursor-help mr-2" />
                    <input
                      type="range"
                      min="0"
                      max="4"
                      step="1"
                      value={(100 - relevanceScore) / 25}
                      onChange={(e) => {
                        const index = parseInt(e.target.value);
                        const newScore = 100 - (index * 25);
                        setRelevanceScore(newScore);
                      }}
                      className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-sm font-extrabold text-gray-800 ml-3 min-w-[3ch]">
                      {relevanceScore}%
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-gray-300 hidden md:block"></div>

                {/* Sort Buttons */}
                <div className="flex gap-2 bg-white p-1 rounded-full border border-gray-100 shadow-sm">
                  {[
                    { id: 'price', label: 'Price' },
                    { id: 'pricePerSqm', label: 'Price/Sqm' },
                    { id: 'lotArea', label: 'Lot Area' },
                    { id: 'floorArea', label: 'Floor Area' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => handleSort(btn.id as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1
                            ${sortConfig?.key === btn.id
                          ? 'bg-gray-900 text-white shadow-md'
                          : 'bg-transparent text-gray-500 hover:bg-gray-100'
                        }
                        `}
                    >
                      {btn.label}
                      {sortConfig?.key === btn.id && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                    </button>
                  ))}
                </div>
              </div>


              {/* Instructional Text - Shows in middle when no selections */}
              {selectedListings.length === 0 && (
                <div className="w-full max-w-2xl mt-6 text-center animate-fade-in-up">
                  <p className="text-sm text-gray-500 font-medium">
                    If you're interested in any of our listings, please select up to 3 and send us the completed form.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Floating Selection Status Bar - Only shows when selections > 0 */}
        {selectedListings.length > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white shadow-2xl border-4 border-blue-500 rounded-xl px-8 py-4 max-w-3xl flex flex-col items-center">
            <p className="text-base text-gray-700 font-medium text-center">
              You may select up to 3{" "}
              <span className="font-bold text-blue-600">({selectedListings.length}/3 selected)</span>{" "}
              -{" "}
              <button
                onClick={handleSendForm}
                className="font-bold text-red-600 underline hover:text-red-800 transition-colors cursor-pointer ml-1"
              >
                SEND FORM
              </button>
            </p>
            <p className="text-xs text-gray-400 mt-1 italic">
              Listed details are subject to change without prior notice
            </p>
          </div>
        )}


        {!hasSearched && (
          <p className="text-gray-500 text-sm animate-pulse">
            {loading ? 'Initializing AI Engine...' : 'Ready. Try "Lot in Cavite" or "BGC Condo"'}
          </p>
        )}
      </div>

      {/* Results Section */}
      {
        hasSearched && (
          <div className="max-w-7xl mx-auto px-4 pb-20 animate-fade-in-up">


            {displayedResults.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100">
                <p className="text-lg">
                  No matches found for "{query}"
                  {selectedType ? ` with type "${selectedType}"` : ''}
                  {selectedCategories.length > 0 ? ` and category "${selectedCategories.join(', ')}"` : ''}
                </p>
                <p className="text-sm mt-2">Try adjusting your price, location, or filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedResults.map((listing, idx) => (
                  <ListingCard
                    key={`${listing.id}-${idx}`}
                    listing={listing}
                    isSelected={selectedListings.includes(listing.id)}
                    onToggleSelection={handleToggleSelection}
                    isDisabled={selectedListings.length >= 3}
                  />
                ))}
              </div>
            )}
          </div>
        )
      }

      {/* Contact Form Modal */}
      <ContactFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        selectedListings={selectedListings}
      />
    </div >
  );
}

export default App;
