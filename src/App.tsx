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
  const [selectedType, setSelectedType] = useState<string | null>('Sale'); // Default 'Sale'
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Single Select (null = All)
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

  // Dynamic Placeholder Text
  const [placeholderText, setPlaceholderText] = useState('Ready. Try "Lot in Caloocan"');
  useEffect(() => {
    const examples = [
      "Lot in Quezon City",
      "Condo in Makati",
      "Office Space in Ortigas",
      "Warehouse in Paranaque",
      "Lot in Caloocan",
      "BGC Condo"
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % examples.length;
      setPlaceholderText(`Ready. Try "${examples[index]}"`);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
    // 1. Type Match Logic (If null, allow all types)
    let typeMatch = true;
    if (selectedType) {
      const itemType = item.saleType?.toLowerCase() || '';
      if (selectedType === 'Sale') typeMatch = (itemType === 'sale' || itemType === 'sale/lease');
      else if (selectedType === 'Lease') typeMatch = (itemType === 'lease' || itemType === 'sale/lease');
      else if (selectedType === 'Sale/Lease') typeMatch = (itemType === 'sale/lease');
    }

    // 2. Category Match Logic (Single Select)
    // If NO category selected (null), allow ALL
    let categoryMatch = true;
    if (selectedCategory) {
      const itemCat = (item.category || '').trim().toLowerCase();
      const itemAE = (item.columnAE || '').trim().toLowerCase(); // Check visual badge source (Col AE) too

      if (selectedCategory === 'Residential') {
        categoryMatch = itemCat === 'residential' || itemAE === 'residential';
      } else if (selectedCategory === 'Commercial') {
        const targets = ['industrial', 'commercial', 'industrial/commercial'];
        categoryMatch = targets.includes(itemCat) || targets.includes(itemAE);
      }
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



          {/* Filter Buttons - iOS Style Segmented Controls */}
          <div className="flex flex-col gap-4 mb-8 w-full max-w-5xl mx-auto items-center">

            {/* Row 1: Property Type */}
            <div className="inline-flex bg-gray-100 p-1.5 rounded-xl shadow-inner relative z-0">
              {['Sale', 'Lease', 'Sale/Lease'].map((filter) => {
                let label = filter.toUpperCase();
                if (filter === 'Sale') label = 'FOR SALE';
                if (filter === 'Lease') label = 'FOR LEASE';
                if (filter === 'Sale/Lease') label = 'SALE OR LEASE';

                const isActive = selectedType === filter;

                return (
                  <button
                    key={filter}
                    onClick={() => setSelectedType(current => current === filter ? null : filter)}
                    className={`relative px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 min-w-[100px]
                          ${isActive
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Row 2: Category */}
            <div className="inline-flex bg-gray-100 p-1.5 rounded-xl shadow-inner relative z-0">
              {['Residential', 'Commercial'].map((filter) => {
                const isActive = selectedCategory === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setSelectedCategory(current => current === filter ? null : filter)}
                    className={`relative px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 min-w-[100px]
                          ${isActive
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    {filter.toUpperCase()}
                  </button>
                )
              })}

              <button
                onClick={() => setSelectedCategory(null)}
                className={`relative px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 min-w-[100px]
                    ${selectedCategory === null
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                  }
                `}
              >
                BOTH
              </button>
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
              placeholder={placeholderText}
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
                    setSelectedCategory(null);
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
                  <span className="text-sm font-bold text-gray-500">Search Precision:</span>
                  <div className="relative group flex items-center" title="100% -Exact Match">
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
                  {selectedCategory ? ` and category "${selectedCategory}"` : ''}
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
