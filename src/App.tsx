import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowUp, ArrowDown, Facebook, Instagram, Youtube } from 'lucide-react';
import { DualRangeSlider } from './components/DualRangeSlider';
import { fetchListings } from './services/dataService';
import { searchListings } from './services/searchEngine';
import type { Listing } from './types';
import { ListingCard } from './components/ListingCard';
import { ContactFormModal } from './components/ContactFormModal';
import { MapModal } from './components/MapModal';
import { NoteModal } from './components/NoteModal';
import Pagination from './components/Pagination';
import { ScrollToTop } from './components/ScrollToTop';

function App() {

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [results, setResults] = useState<Listing[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null); // Default null (No filter)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | null
  const [selectedDirect, setSelectedDirect] = useState<boolean>(false);
  const [showAllListings, setShowAllListings] = useState<boolean>(false);

  // Area Filter State
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);
  const [selectedBedrooms, setSelectedBedrooms] = useState<string[]>([]);
  const [selectedParking, setSelectedParking] = useState<string[]>([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>([]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Price Range State
  const [isPriceFilterOpen, setIsPriceFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [useExactPrice, setUseExactPrice] = useState<boolean>(false);
  const [manualPrice, setManualPrice] = useState<string>('');

  const [isPricePerSqmFilterOpen, setIsPricePerSqmFilterOpen] = useState(false);
  const [pricePerSqmRange, setPricePerSqmRange] = useState<[number, number] | null>(null);
  const [useExactPricePerSqm, setUseExactPricePerSqm] = useState<boolean>(false);
  const [manualPricePerSqm, setManualPricePerSqm] = useState<string>('');

  const [isLotAreaFilterOpen, setIsLotAreaFilterOpen] = useState(false);
  const [lotAreaRange, setLotAreaRange] = useState<[number, number] | null>(null);
  const [useExactLotArea, setUseExactLotArea] = useState<boolean>(false);
  const [manualLotArea, setManualLotArea] = useState<string>('');

  const [isFloorAreaFilterOpen, setIsFloorAreaFilterOpen] = useState(false);
  const [floorAreaRange, setFloorAreaRange] = useState<[number, number] | null>(null);
  const [useExactFloorArea, setUseExactFloorArea] = useState<boolean>(false);
  const [manualFloorArea, setManualFloorArea] = useState<string>('');

  useEffect(() => {
    // Reset selections on search
    if (query) {
      setSelectedListings([]);
      setIsPriceFilterOpen(false);
      setPriceRange(null);
      setIsPricePerSqmFilterOpen(false);
      setPricePerSqmRange(null);
      setIsLotAreaFilterOpen(false);
      setLotAreaRange(null);
      setIsFloorAreaFilterOpen(false);
      setFloorAreaRange(null);
      setUseExactPrice(false);
      setManualPrice('');
      setUseExactPricePerSqm(false);
      setManualPricePerSqm('');
      setUseExactLotArea(false);
      setManualLotArea('');
      setUseExactFloorArea(false);
      setManualFloorArea('');
      setSelectedDirect(false);
      setSelectedBedrooms([]);
      setSelectedParking([]);
      setSelectedPropertyTypes([]);
    }
  }, [query]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Reset page when any filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedType, selectedCategory, selectedDirect, selectedRegion, selectedProvince, selectedCity, selectedBarangay, priceRange, pricePerSqmRange, lotAreaRange, floorAreaRange, sortConfig, selectedBedrooms, selectedParking, selectedPropertyTypes]);

  // Click-outside handler for Price Popover
  const pricePopoverRef = useRef<HTMLDivElement>(null);
  const priceButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  // Click-outside handler for Price/Sqm Popover
  const pricePerSqmPopoverRef = useRef<HTMLDivElement>(null);
  const pricePerSqmButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPositionPerSqm, setPopoverPositionPerSqm] = useState({ top: 0, left: 0 });

  // Click-outside handler for Lot Area Popover
  const lotAreaPopoverRef = useRef<HTMLDivElement>(null);
  const lotAreaButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPositionLot, setPopoverPositionLot] = useState({ top: 0, left: 0 });

  // Click-outside handler for Floor Area Popover
  const floorAreaPopoverRef = useRef<HTMLDivElement>(null);
  const floorAreaButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPositionFloor, setPopoverPositionFloor] = useState({ top: 0, left: 0 });

  const bedroomsPopoverRef = useRef<HTMLDivElement>(null);
  const bedroomsButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPositionBedrooms, setPopoverPositionBedrooms] = useState({ top: 0, left: 0 });

  const parkingPopoverRef = useRef<HTMLDivElement>(null);
  const parkingButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPositionParking, setPopoverPositionParking] = useState({ top: 0, left: 0 });

  const typePopoverRef = useRef<HTMLDivElement>(null);
  const typeButtonRef = useRef<HTMLButtonElement>(null);
  const [popoverPositionType, setPopoverPositionType] = useState({ top: 0, left: 0 });

  const [isBedroomsFilterOpen, setIsBedroomsFilterOpen] = useState(false);
  const [isParkingFilterOpen, setIsParkingFilterOpen] = useState(false);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);

  const sortButtonsContainerRef = useRef<HTMLDivElement>(null);

  const calculateCenteredLeft = (containerRect: DOMRect, popoverWidth: number = 288) => {
    // 288 is the pixel width for w-72
    return containerRect.left + (containerRect.width / 2) - (popoverWidth / 2);
  };

  // Consolidate Popover Positioning (Static on Open)
  useEffect(() => {
    const updateAllPositions = () => {
      if (!sortButtonsContainerRef.current) return;
      const containerRect = sortButtonsContainerRef.current.getBoundingClientRect();

      if (isPriceFilterOpen && priceButtonRef.current) {
        setPopoverPosition({
          top: priceButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
      if (isPricePerSqmFilterOpen && pricePerSqmButtonRef.current) {
        setPopoverPositionPerSqm({
          top: pricePerSqmButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
      if (isLotAreaFilterOpen && lotAreaButtonRef.current) {
        setPopoverPositionLot({
          top: lotAreaButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
      if (isFloorAreaFilterOpen && floorAreaButtonRef.current) {
        setPopoverPositionFloor({
          top: floorAreaButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
      if (isBedroomsFilterOpen && bedroomsButtonRef.current) {
        setPopoverPositionBedrooms({
          top: bedroomsButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
      if (isParkingFilterOpen && parkingButtonRef.current) {
        setPopoverPositionParking({
          top: parkingButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
      if (isTypeFilterOpen && typeButtonRef.current) {
        setPopoverPositionType({
          top: typeButtonRef.current.getBoundingClientRect().bottom + 8,
          left: calculateCenteredLeft(containerRect)
        });
      }
    };

    if (isPriceFilterOpen || isPricePerSqmFilterOpen || isLotAreaFilterOpen || isFloorAreaFilterOpen || isBedroomsFilterOpen || isParkingFilterOpen || isTypeFilterOpen) {
      updateAllPositions();

      // DISMISS ON SCROLL: The user wants it to disappear when the "screen is moved"
      const handleScroll = () => {
        setIsPriceFilterOpen(false);
        setIsPricePerSqmFilterOpen(false);
        setIsLotAreaFilterOpen(false);
        setIsFloorAreaFilterOpen(false);
        setIsBedroomsFilterOpen(false);
        setIsParkingFilterOpen(false);
        setIsTypeFilterOpen(false);
      };

      // DISMISS ON MOUSE LEAVE (with delay to allow slider dragging)
      let dismissTimeout: NodeJS.Timeout | null = null;
      // AUTO-CLOSE AFTER 4 SECONDS OF INACTIVITY
      let inactivityTimeout: NodeJS.Timeout | null = null;

      const resetInactivityTimer = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
          handleScroll(); // Closes everything after 4 seconds of inactivity
        }, 4000);
      };

      // Start the inactivity timer when popup opens
      resetInactivityTimer();

      const handleMouseMove = (e: MouseEvent) => {
        // Reset inactivity timer on any mouse movement
        resetInactivityTimer();

        // Ignore if mouse button is pressed (user is dragging a slider)
        if (e.buttons !== 0) {
          if (dismissTimeout) clearTimeout(dismissTimeout);
          return;
        }

        // Don't auto-close if any input is currently focused (user is editing a value)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          if (dismissTimeout) clearTimeout(dismissTimeout);
          return;
        }

        const target = e.target as HTMLElement;
        const isHoveringTrigger = [priceButtonRef, pricePerSqmButtonRef, lotAreaButtonRef, floorAreaButtonRef, bedroomsButtonRef, parkingButtonRef, typeButtonRef]
          .some(ref => ref.current?.contains(target));
        const isHoveringPopover = [pricePopoverRef, pricePerSqmPopoverRef, lotAreaPopoverRef, floorAreaPopoverRef, bedroomsPopoverRef, parkingPopoverRef, typePopoverRef]
          .some(ref => ref.current?.contains(target));

        // If mouse is over the interaction area, cancel any pending dismiss
        if (isHoveringTrigger || isHoveringPopover) {
          if (dismissTimeout) clearTimeout(dismissTimeout);
          return;
        }

        // Otherwise, schedule a dismiss after a short delay
        if (!dismissTimeout) {
          dismissTimeout = setTimeout(() => {
            handleScroll(); // Closes everything
            dismissTimeout = null;
          }, 150); // 150ms delay allows for brief mouse movements
        }
      };

      window.addEventListener('mousemove', handleMouseMove);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (dismissTimeout) clearTimeout(dismissTimeout);
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
      };
    }
  }, [isPriceFilterOpen, isPricePerSqmFilterOpen, isLotAreaFilterOpen, isFloorAreaFilterOpen, isBedroomsFilterOpen, isParkingFilterOpen, isTypeFilterOpen, sortConfig]);

  // Fallback Click-outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Close Price Popover (only if not clicking trigger button)
      if (pricePopoverRef.current && !pricePopoverRef.current.contains(target) &&
        priceButtonRef.current && !priceButtonRef.current.contains(target)) {
        setIsPriceFilterOpen(false);
      }
      // Close Price/Sqm Popover
      if (pricePerSqmPopoverRef.current && !pricePerSqmPopoverRef.current.contains(target) &&
        pricePerSqmButtonRef.current && !pricePerSqmButtonRef.current.contains(target)) {
        setIsPricePerSqmFilterOpen(false);
      }
      // Close Lot Area Popover
      if (lotAreaPopoverRef.current && !lotAreaPopoverRef.current.contains(target) &&
        lotAreaButtonRef.current && !lotAreaButtonRef.current.contains(target)) {
        setIsLotAreaFilterOpen(false);
      }
      // Close Floor Area Popover
      if (floorAreaPopoverRef.current && !floorAreaPopoverRef.current.contains(target) &&
        floorAreaButtonRef.current && !floorAreaButtonRef.current.contains(target)) {
        setIsFloorAreaFilterOpen(false);
      }
      // Close Bedrooms Popover
      if (bedroomsPopoverRef.current && !bedroomsPopoverRef.current.contains(target) &&
        bedroomsButtonRef.current && !bedroomsButtonRef.current.contains(target)) {
        setIsBedroomsFilterOpen(false);
      }
      // Close Parking Popover
      if (parkingPopoverRef.current && !parkingPopoverRef.current.contains(target) &&
        parkingButtonRef.current && !parkingButtonRef.current.contains(target)) {
        setIsParkingFilterOpen(false);
      }
      // Close Type Popover
      if (typePopoverRef.current && !typePopoverRef.current.contains(target) &&
        typeButtonRef.current && !typeButtonRef.current.contains(target)) {
        setIsTypeFilterOpen(false);
      }
    };

    if (isPriceFilterOpen || isPricePerSqmFilterOpen || isLotAreaFilterOpen || isFloorAreaFilterOpen || isBedroomsFilterOpen || isParkingFilterOpen || isTypeFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPriceFilterOpen, isPricePerSqmFilterOpen, isLotAreaFilterOpen, isFloorAreaFilterOpen, isBedroomsFilterOpen, isParkingFilterOpen, isTypeFilterOpen]);
  // Availability Toggle: Show only available listings or show all
  // const [showOnlyAvailable, setShowOnlyAvailable] = useState<boolean>(true); // REMOVED
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);

  // Dynamic Placeholder Text
  const [placeholderText, setPlaceholderText] = useState('"Lot in Caloocan"');
  useEffect(() => {
    const examples = [
      "Lot in Quezon City",
      "Condo in Makati",
      "Sunvalley Estates",
      "Office Space in Ortigas",
      "Warehouse in Paranaque",
      "CommercialLot in Caloocan",
      "Agri Land in Bulacan",
      "SMDC Blue Residences",
      "Luxurious BGC Condo"
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % examples.length;
      setPlaceholderText(`"${examples[index]}"`);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Debounce Effect for search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [query]);

  // Initial Data Load
  useEffect(() => {
    fetchListings().then(data => {
      setAllListings(data);
      // Initialize results with all data so "Show All" works immediately
      setResults(data);
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
      let filtered = searchListings(allListings, q, 0); // Always use broad match
      setResults(filtered);
    }
  }, [loading, allListings, hasSearched]);

  const updateUrlParams = (q: string) => {
    const params = new URLSearchParams(window.location.search);
    if (q) params.set('q', q);
    else params.delete('q');

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  // Effect: Re-search when debouncedQuery changes (always uses smart/broad match)
  useEffect(() => {
    if (debouncedQuery.trim() || hasSearched) {
      setHasSearched(true);
      updateUrlParams(debouncedQuery);
      let filtered = searchListings(allListings, debouncedQuery, 0); // Always use broad match (0)
      setResults(filtered);
    }
  }, [debouncedQuery, allListings]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Debounce handles the search, this just prevents default and blurs input
  };

  // Re-run filter and sort when filters change
  const baseFilteredResults = results.filter(item => {
    // 0. Base Filter (Show All)
    // console.log(`Filtering item: ${item.id}, status: ${item.statusAQ}, showAll: ${showAllListings}`);
    // If showAllListings is false, hide SOLD/LEASED OUT items
    if (!showAllListings) {
      const status = (item.statusAQ || '').toUpperCase().trim();
      if (status === 'SOLD' || status === 'LEASED OUT') {
        return false;
      }
    }

    // 0. ID Search Override
    // If the query is an exact ID match, we show it regardless of other filters.
    const trimmedQuery = debouncedQuery.trim().toUpperCase();
    const isExactIdMatch = trimmedQuery === (item.id || '').toUpperCase();


    if (isExactIdMatch) {
      return true;
    }

    // 1. Type Match Logic (If null, allow all types)
    let typeMatch = true;
    if (selectedType) {
      if (selectedType === 'Sale') {
        typeMatch = item.price > 0;
      } else if (selectedType === 'Lease') {
        typeMatch = item.leasePrice > 0;
      } else if (selectedType === 'Sale/Lease') {
        typeMatch = item.price > 0 && item.leasePrice > 0;
      }
    }

    // 2. Category Match Logic (Single Select)
    let categoryMatch = true;
    if (selectedCategory) {
      const itemCat = (item.category || '').trim().toLowerCase();
      const itemAE = (item.columnAE || '').trim().toLowerCase();

      if (selectedCategory === 'Residential') {
        categoryMatch = (itemCat + ' ' + itemAE).includes('residential');
      } else if (selectedCategory === 'Commercial') {
        categoryMatch = (itemCat + ' ' + itemAE).includes('commercial');
      } else if (selectedCategory === 'Industrial') {
        categoryMatch = (itemCat + ' ' + itemAE).includes('industrial');
      } else if (selectedCategory === 'Agricultural') {
        categoryMatch = (itemCat + ' ' + itemAE).includes('agri');
      }
    }

    // 3. Area Filters Match Logic
    let regionMatch = true;
    if (selectedRegion) {
      regionMatch = (item.region || '').trim() === selectedRegion;
    }

    let provinceMatch = true;
    if (selectedProvince) {
      provinceMatch = (item.province || '').trim() === selectedProvince;
    }

    let cityMatch = true;
    if (selectedCity) {
      cityMatch = (item.city || '').trim() === selectedCity;
    }

    // 4. Direct Filter Match Logic
    let directMatch = true;
    if (selectedDirect) {
      directMatch = item.isDirect;
    }

    // 5. Barangay Filter Match Logic
    let barangayMatch = true;
    if (selectedBarangay) {
      barangayMatch = (item.barangay || '').trim() === selectedBarangay;
    }

    return typeMatch && categoryMatch && regionMatch && provinceMatch && cityMatch && directMatch && barangayMatch;
  });

  // Effect: Reset child area filters when parent changes
  useEffect(() => { setSelectedProvince(null); setSelectedCity(null); setSelectedBarangay(null); }, [selectedRegion]);
  useEffect(() => { setSelectedCity(null); setSelectedBarangay(null); }, [selectedProvince]);
  useEffect(() => { setSelectedBarangay(null); }, [selectedCity]);

  useEffect(() => {
    // If a filter is selected but no results yet (and no query), we should populate results with allListings
    // so filtering can happen on the full set.
    if ((selectedType || selectedCategory || selectedDirect || selectedRegion || selectedProvince || selectedCity || selectedBarangay) && results.length === 0 && !query) {
      setResults(allListings);
    }
  }, [selectedType, selectedCategory, selectedDirect, selectedRegion, selectedProvince, selectedCity, selectedBarangay, results.length, query, allListings]);

  // Derived Min/Max from BASE results (for Slider limits)
  const availablePrices = baseFilteredResults.map(item => {
    if (selectedType === 'Lease') return item.leasePrice;
    return item.price;
  }).filter(p => p > 0);

  // Helper function to determine step size based on value magnitude
  const getStepSize = (value: number): number => {
    if (value >= 1000000) return 1000000;    // 1M for values >= 1 million
    if (value >= 1000) return 10000;         // 10K for values >= 1 thousand
    return 10;                                // 10 for values < 1 thousand
  };

  // Calculate raw min/max
  const rawMin = availablePrices.length ? Math.min(...availablePrices) : 0;
  const rawMax = availablePrices.length ? Math.max(...availablePrices) : 1000000;

  // Round min DOWN and max UP based on their respective step sizes
  const minStep = getStepSize(rawMin);
  const maxStep = getStepSize(rawMax);
  const minGlob = Math.floor(rawMin / minStep) * minStep;
  const maxGlob = Math.ceil(rawMax / maxStep) * maxStep;

  // Use the smaller step for slider granularity
  const sliderStep = Math.min(minStep, maxStep);


  // Derived Min/Max for Price/Sqm
  const availablePricePerSqm = baseFilteredResults.map(item => {
    if (selectedType === 'Lease') return item.leasePricePerSqm;
    return item.pricePerSqm;
  }).filter(p => p > 0);
  const rawMinPerSqm = availablePricePerSqm.length ? Math.min(...availablePricePerSqm) : 0;
  const rawMaxPerSqm = availablePricePerSqm.length ? Math.max(...availablePricePerSqm) : 10000;

  const minStepPerSqm = getStepSize(rawMinPerSqm);
  const maxStepPerSqm = getStepSize(rawMaxPerSqm);
  const minGlobPerSqm = Math.floor(rawMinPerSqm / minStepPerSqm) * minStepPerSqm;
  const maxGlobPerSqm = Math.ceil(rawMaxPerSqm / maxStepPerSqm) * maxStepPerSqm;

  const sliderStepPerSqm = Math.min(minStepPerSqm, maxStepPerSqm);


  // Derived Min/Max for Lot Area
  const availableLotArea = baseFilteredResults.map(i => i.lotArea).filter(p => p >= 0);
  const rawMinLot = availableLotArea.length ? Math.min(...availableLotArea) : 0;
  // Fallback max if empty? 1000? 
  const rawMaxLot = availableLotArea.length ? Math.max(...availableLotArea) : 1000;

  const minStepLot = getStepSize(rawMinLot);
  const maxStepLot = getStepSize(rawMaxLot);
  const minGlobLot = Math.floor(rawMinLot / minStepLot) * minStepLot;
  const maxGlobLot = Math.ceil(rawMaxLot / maxStepLot) * maxStepLot;
  const sliderStepLot = Math.min(minStepLot, maxStepLot);


  // Derived Min/Max for Floor Area
  const availableFloorArea = baseFilteredResults.map(i => i.floorArea).filter(p => p > 0);
  const rawMinFloor = availableFloorArea.length ? Math.min(...availableFloorArea) : 0;
  const rawMaxFloor = availableFloorArea.length ? Math.max(...availableFloorArea) : 1000;

  const minStepFloor = getStepSize(rawMinFloor);
  const maxStepFloor = getStepSize(rawMaxFloor);
  const minGlobFloor = Math.floor(rawMinFloor / minStepFloor) * minStepFloor;
  const maxGlobFloor = Math.ceil(rawMaxFloor / maxStepFloor) * maxStepFloor;
  const sliderStepFloor = Math.min(minStepFloor, maxStepFloor);

  // Helper to extraction unique values for Dropdowns
  // We use 'results' (filtered by Search/Type/Category) as the base
  // Then strictly cascade: Region -> Province -> City -> Barangay

  // 1. Available Regions (Base results only)
  // We re-compute the base matches for type/category to be safe, or just use 'results' 
  // BUT 'baseFilteredResults' has EVERYTHING applied. 'results' has only Text Search applied?
  // Wait, 'results' is output of searchListings. 'baseFilteredResults' applies Type/Cat/Area.
  // So we need an intermediate set that has ONLY Type/Cat applied.










  // Final Results (Apply Price and Price/Sqm Range)
  const displayedResults = baseFilteredResults.filter(item => {
    // Filter by Price Range
    if (useExactPrice && manualPrice) {
      const priceVal = parseFloat(manualPrice.replace(/,/g, ''));
      const getPrice = (l: Listing) => {
        if (selectedType === 'FOR LEASE') return l.leasePrice;
        if (selectedType === 'FOR SALE') return l.price;
        return l.price > 0 ? l.price : l.leasePrice;
      };
      if (getPrice(item) !== priceVal) return false;
    } else if (priceRange) {
      const priceToCompare = (selectedType === 'Lease' || selectedType === 'FOR LEASE') ? item.leasePrice : item.price;
      if (priceToCompare < priceRange[0] || priceToCompare > priceRange[1]) return false;
    }


    // Filter by Price/Sqm Range
    if (useExactPricePerSqm && manualPricePerSqm) {
      const ppsVal = parseFloat(manualPricePerSqm.replace(/,/g, ''));
      const getPps = (l: Listing) => (selectedType === 'Lease' || selectedType === 'FOR LEASE') ? l.leasePricePerSqm : l.pricePerSqm;
      if (getPps(item) !== ppsVal) return false;
    } else if (pricePerSqmRange) {
      const sqmToCompare = (selectedType === 'Lease' || selectedType === 'FOR LEASE') ? item.leasePricePerSqm : item.pricePerSqm;
      if (sqmToCompare < pricePerSqmRange[0] || sqmToCompare > pricePerSqmRange[1]) return false;
    }

    // Filter by Lot Area Range
    if (useExactLotArea && manualLotArea) {
      const lotVal = parseFloat(manualLotArea.replace(/,/g, ''));
      if (item.lotArea !== lotVal) return false;
    } else if (lotAreaRange) {
      if (item.lotArea < lotAreaRange[0] || item.lotArea > lotAreaRange[1]) return false;
    }

    // Filter by Floor Area Range
    if (useExactFloorArea && manualFloorArea) {
      const floorVal = parseFloat(manualFloorArea.replace(/,/g, ''));
      if (item.floorArea !== floorVal) return false;
    } else if (floorAreaRange) {
      if (item.floorArea < floorAreaRange[0] || item.floorArea > floorAreaRange[1]) return false;
    }
    // Filter by Bedrooms (Multi-select)
    if (selectedBedrooms.length > 0) {
      // Check for specific matches
      const isStudio = selectedBedrooms.includes('STUDIO') && item.bedrooms === 0;
      const isOne = selectedBedrooms.includes('1') && item.bedrooms === 1;
      const isTwo = selectedBedrooms.includes('2') && item.bedrooms === 2;
      const isThree = selectedBedrooms.includes('3') && item.bedrooms === 3;
      const isFour = selectedBedrooms.includes('4') && item.bedrooms === 4;
      const isFivePlus = selectedBedrooms.includes('5+') && item.bedrooms >= 5;

      if (!isStudio && !isOne && !isTwo && !isThree && !isFour && !isFivePlus) return false;
    }
    // Filter by Parking (Multi-select)
    if (selectedParking.length > 0) {
      const isZero = selectedParking.includes('0') && (item.parking === 0 || !item.parking);
      const isOne = selectedParking.includes('1') && item.parking === 1;
      const isTwo = selectedParking.includes('2') && item.parking === 2;
      const isThree = selectedParking.includes('3') && item.parking === 3;
      const isFour = selectedParking.includes('4') && item.parking === 4;
      const isFivePlus = selectedParking.includes('5+') && item.parking >= 5;

      if (!isZero && !isOne && !isTwo && !isThree && !isFour && !isFivePlus) return false;
    }
    // Filter by Property Type (Multi-select)
    if (selectedPropertyTypes.length > 0) {
      const itemType = (item.typeDescription || '').trim().toUpperCase();
      const matchesType = selectedPropertyTypes.some(type => {
        if (type === 'TOWNHOUSE') return itemType.includes('TOWNHOUSE') || itemType.includes('TOWN HOUSE');
        if (type === 'WAREHOUSE') return itemType.includes('WAREHOUSE');
        if (type === 'VACANT LOT') return itemType.includes('VACANT LOT') || itemType.includes('LOT');
        if (type === 'HOUSE AND LOT') return itemType.includes('HOUSE AND LOT') || itemType.includes('HOUSE & LOT');
        if (type === 'CONDO') return itemType.includes('CONDO');
        if (type === 'OFFICE/COMMERCIAL') return itemType.includes('OFFICE') || itemType.includes('COMMERCIAL');
        if (type === 'BUILDING') return itemType.includes('BUILDING');
        if (type === 'CLUB SHARE') return itemType.includes('CLUB SHARES') || itemType.includes('CLUB SHARE');
        return false;
      });
      if (!matchesType) return false;
    }
    return true;
  }).sort((a, b) => {
    // ALWAYS sort NOT AVAILABLE listings to the end
    const aAvailable = (a.statusAQ || '').toLowerCase().trim() === 'available';
    const bAvailable = (b.statusAQ || '').toLowerCase().trim() === 'available';
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;

    if (!sortConfig) {
      // DEFAULT SORT: Prioritize listings with Facebook links
      if (a.facebookLink && !b.facebookLink) return -1;
      if (!a.facebookLink && b.facebookLink) return 1;
      return 0;
    }

    let comparison = 0;
    if (sortConfig.key === 'price') {
      const getPrice = (l: Listing) => {
        if (selectedType === 'Lease') return l.leasePrice;
        if (selectedType === 'Sale') return l.price;
        return l.price > 0 ? l.price : l.leasePrice;
      };
      const priceA = getPrice(a);
      const priceB = getPrice(b);
      comparison = priceA - priceB;
    } else if (sortConfig.key === 'pricePerSqm') {
      const sqmA = selectedType === 'Lease' ? a.leasePricePerSqm : a.pricePerSqm;
      const sqmB = selectedType === 'Lease' ? b.leasePricePerSqm : b.pricePerSqm;
      comparison = sqmA - sqmB;
    } else if (sortConfig.key === 'lotArea') {
      comparison = a.lotArea - b.lotArea;
    } else if (sortConfig.key === 'floorArea') {
      comparison = a.floorArea - b.floorArea;
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  // Ensure initial sort is applied if no other sort is active and results are fresh
  // Actually, 'displayedResults' already applies the sortConfig. 
  // The issue might be that 'baseFilteredResults' order is mostly random or id-based.
  // With sortConfig initialized to { key: 'price', direction: 'asc' }, it should work.
  // Let's verify that 'price' exists and is non-zero for reliable sorting.
  // Currently, 0 prices might be floating to top or bottom depending on check.
  // We might want to push 0s to the bottom? 
  // For now, I will leave as is but ensure the state is correctly initialized.

  const totalPages = Math.ceil(displayedResults.length / ITEMS_PER_PAGE);

  // Pagination only - no sponsored injection
  const paginatedResults = displayedResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const finalResults = paginatedResults;

  // Relevance sort = null sortConfig (uses original array order from searchEngine)
  const handleSort = (key: 'price' | 'pricePerSqm' | 'relevance' | 'lotArea' | 'floorArea' | 'bedrooms' | 'parking') => {
    if (key === 'relevance') {
      setSortConfig(null);
      setIsPriceFilterOpen(false); // Close price popover
      setIsPricePerSqmFilterOpen(false); // Close price/sqm popover
      return;
    }

    // Close popovers if sorting by non-corresponding fields
    if (key !== 'price') {
      setIsPriceFilterOpen(false);
    }
    if (key !== 'pricePerSqm') {
      setIsPricePerSqmFilterOpen(false);
    }
    if (key !== 'lotArea') {
      setIsLotAreaFilterOpen(false);
    }
    if (key !== 'floorArea') {
      setIsFloorAreaFilterOpen(false);
    }
    if (key !== 'bedrooms') {
      setIsBedroomsFilterOpen(false);
    }
    if (key !== 'parking') {
      setIsParkingFilterOpen(false);
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
        // Select (only if less than 5)
        if (prev.length < 5) {
          return [...prev, listingId];
        }
        return prev;
      }
    });
  };

  const handleSendForm = (id?: string) => {
    if (typeof id === 'string') {
      setSelectedListings([id]);
    }
    setShowFormModal(true);
  };

  // Map Modal State
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapCenterListing, setMapCenterListing] = useState<Listing | null>(null);

  const handleMapClick = (listing: Listing) => {
    if (!listing.lat || !listing.lng) {
      alert(`No map coordinates available for ${listing.id}`);
      return;
    }
    setMapCenterListing(listing);
    setShowMapModal(true);
  };

  // Note Modal State
  const [noteModalData, setNoteModalData] = useState<{ isOpen: boolean, content: string, title: string }>({
    isOpen: false,
    content: '',
    title: ''
  });

  const handleShowNote = (content: string, id: string) => {
    setNoteModalData({
      isOpen: true,
      content,
      title: `Note for ${id}`
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100">
      <ScrollToTop />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 w-full py-4 bg-white border-b border-gray-100 flex items-center justify-center px-4 z-50">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-2">
            <img src="/footer-logo.png" alt="Kiu Realty Logo" className="h-8 w-auto" />
            <span className="font-bold text-gray-900 text-xl tracking-tight">KiuRealtyPH</span>
          </div>

          <div className="hidden sm:block w-px h-6 bg-gray-200"></div>

          <div className="flex items-center gap-3">
            <a href="https://www.messenger.com/t/kiurealtyph" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.43 5.39 3.75 7.03v3.74c0 .8.88 1.28 1.59.87l2.48-1.24c.71.13 1.45.2 2.18.2 5.52 0 10-4.03 10-9S17.52 2 12 2zm1 14.24-2.5-2.73-4.86 2.73 5.35-5.68 2.5 2.73 4.86-2.73-5.35 5.68z" />
              </svg>
            </a>
            <a href="https://www.facebook.com/kiurealtyph/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#1877F2] transition-colors">
              <Facebook className="w-5 h-5" />
            </a>
            <a href="https://www.instagram.com/kiurealtyph/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#E4405F] transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
            <a href="https://www.tiktok.com/@kiurealtyph" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </svg>
            </a>
            <a href="https://www.youtube.com/@KiuRealtyPH" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#FF0000] transition-colors">
              <Youtube className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero / Search Section */}
      < div className={`flex flex-col items-center justify-center transition-all duration-500 ease-out px-4 pt-20 ${(hasSearched || selectedType || selectedCategory || (selectedBedrooms.length > 0) || (selectedParking.length > 0) || (selectedPropertyTypes.length > 0)) ? 'py-12 min-h-[30vh]' : 'min-h-[100vh]'
        }`}>
        <div className={`w-full max-w-2xl text-center space-y-6 transition-all duration-500 ${(hasSearched || selectedType || selectedCategory || (selectedBedrooms.length > 0) || (selectedParking.length > 0) || (selectedPropertyTypes.length > 0)) ? 'translate-y-0' : '-translate-y-8'
          }`}>

          <p className={`font-bold text-gray-900 tracking-tight transition-all duration-500 ${(hasSearched || selectedType || selectedCategory || (selectedBedrooms.length > 0) || (selectedParking.length > 0) || (selectedPropertyTypes.length > 0)) ? 'text-2xl mb-4' : 'text-4xl sm:text-5xl mb-8'}`}>
            {(selectedType || selectedCategory || hasSearched || (selectedBedrooms.length > 0) || (selectedParking.length > 0) || (selectedPropertyTypes.length > 0))
              ? `Found ${displayedResults.length.toLocaleString()} of ${allListings.length.toLocaleString()} Available Listings`
              : allListings.length > 0 ? `${allListings.length.toLocaleString()} Available Listings` : 'Loading properties...'
            }
          </p>



          {/* Filter Buttons - Single Line Compact Layout */}
          <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-1 mb-2 w-full max-w-6xl mx-auto px-1">

            {/* Group 1: Property Type */}
            <div className="inline-flex bg-gray-100 p-0.5 rounded-lg shadow-inner relative z-0">
              {['Sale', 'Lease'].map((filter) => {
                let label = filter.toUpperCase();
                if (filter === 'Sale') label = 'FOR SALE';
                if (filter === 'Lease') label = 'FOR LEASE';

                const isActive = selectedType === filter;

                return (
                  <button
                    key={filter}
                    onClick={() => setSelectedType(current => current === filter ? null : filter)}
                    className={`relative px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 min-w-[50px] whitespace-nowrap
                          ${isActive
                        ? 'bg-blue-600 text-white shadow-sm z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Spacer - minimal */}
            <div className="w-0.5"></div>

            {/* Group: Direct Filter */}
            <div className="inline-flex bg-gray-100 p-0.5 rounded-lg shadow-inner relative z-0">
              <button
                onClick={() => setSelectedDirect(prev => !prev)}
                className={`relative px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 min-w-[60px] whitespace-nowrap
                  ${selectedDirect
                    ? 'bg-blue-600 text-white shadow-sm z-10'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                  }
                `}
              >
                DIRECT
              </button>
            </div>

            {/* Spacer - minimal */}
            <div className="w-0.5"></div>

            {/* Group 2: Category */}
            <div className="inline-flex bg-gray-100 p-0.5 rounded-lg shadow-inner relative z-0">
              {(() => {
                const categoryPresence = {
                  'Residential': allListings.some(item => (item.category || '').toUpperCase().includes('RESIDENTIAL')),
                  'Commercial': allListings.some(item => (item.category || '').toUpperCase().includes('COMMERCIAL')),
                  'Industrial': allListings.some(item => (item.category || '').toUpperCase().includes('INDUSTRIAL')),
                  'Agricultural': allListings.some(item => (item.category || '').toUpperCase().includes('AGRICULTURAL'))
                };

                return (['Residential', 'Commercial', 'Industrial', 'Agricultural'] as const)
                  .filter(filter => categoryPresence[filter])
                  .map((filter) => {
                    const isActive = selectedCategory === filter;
                    let label = filter.toUpperCase();
                    if (filter === 'Residential') label = "RES'L";
                    if (filter === 'Commercial') label = "COMM'L";
                    if (filter === 'Industrial') label = "IND'L";
                    if (filter === 'Agricultural') label = 'AGRI';

                    return (
                      <button
                        key={filter}
                        title={filter}
                        onClick={() => setSelectedCategory(current => current === filter ? null : filter)}
                        className={`relative px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 min-w-[60px] whitespace-nowrap
                              ${isActive
                            ? 'bg-blue-600 text-white shadow-sm z-10'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                          }
                        `}
                      >
                        {label}
                      </button>
                    )
                  });
              })()}
            </div>

          </div>



          <div className="flex flex-col xl:flex-row items-start justify-center gap-8 xl:gap-16 w-full max-w-[90rem] mx-auto px-4 mb-8">

            {/* Left Column: Search & Sort Controls (Increased Width) */}
            {/* Left Column: Search & Sort Controls (Increased Width) */}
            <div className="flex-grow w-full xl:w-[62.5%] flex flex-col gap-2.5 min-w-0">

              {/* Search Bar & Show All Toggle Container */}
              <div className="flex flex-row items-center gap-3 w-full">
                {/* Search Bar (Flex-1 to take available space) */}
                <form onSubmit={handleSearch} className="relative flex-1 group">
                  <div className="relative transform transition-all duration-300 hover:scale-[1.01]">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <div className="bg-blue-600 rounded-full p-2 shadow-md">
                        <Search className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearch(e);
                          e.currentTarget.blur();
                        }
                      }}
                      enterKeyHint="search"
                      placeholder={placeholderText}
                      className={`w-full bg-white border-2 transition-all duration-300 rounded-2xl outline-none text-lg font-medium
                            ${hasSearched
                          ? 'py-3 pl-14 pr-20 border-gray-200 focus:border-blue-500 shadow-sm'
                          : 'py-4 pl-14 pr-20 border-transparent shadow-xl hover:shadow-2xl focus:ring-4 focus:ring-blue-100'
                        }
                        `}
                    />
                    {/* RESET Button inside Search Bar */}
                    {(hasSearched || selectedType || selectedCategory || selectedRegion || selectedProvince || selectedCity) && (
                      <div className="absolute inset-y-0 right-4 flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setQuery('');
                            setDebouncedQuery('');
                            setSelectedListings([]);
                            setHasSearched(false);
                            setResults(allListings); // Reset to all listings
                            setSelectedType(null);
                            setSelectedCategory(null);
                            setSelectedDirect(false);
                            setSelectedRegion(null);
                            setSelectedProvince(null);
                            setSelectedCity(null);
                            setSelectedBarangay(null);
                            setPriceRange(null);
                            setPricePerSqmRange(null);
                            setLotAreaRange(null);
                            setFloorAreaRange(null);
                            setSelectedBedrooms([]);
                            setSelectedParking([]);
                            setSelectedPropertyTypes([]);
                            setSortConfig(null);
                            setShowAllListings(false); // Reset to Available only
                            window.history.replaceState({}, '', window.location.pathname);
                          }}
                          className="text-sm font-bold text-red-500 hover:text-red-700 underline tracking-wide bg-white pl-2"
                        >
                          RESET
                        </button>
                      </div>
                    )}
                  </div>
                </form>

                {/* Show All Toggle (Radio Button Style - Desktop Only) */}
                <div
                  className="hidden sm:flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer h-[calc(100%-4px)]"
                  onClick={() => setShowAllListings(!showAllListings)}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${showAllListings ? 'border-blue-600 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                    {showAllListings && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                  <span className={`text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap select-none ${showAllListings ? 'text-blue-600' : 'text-gray-400'}`}>SHOW ALL</span>
                </div>
              </div>

              {/* Mobile Only: Slider Toggle */}
              <div className="flex sm:hidden items-center justify-center gap-3 mt-3 w-full pb-2">
                <span className={`text-xs font-bold ${!showAllListings ? 'text-blue-600' : 'text-gray-400'}`}>AVAILABLE</span>
                <div
                  className="w-12 h-4 bg-gray-200 rounded-full relative cursor-pointer"
                  onClick={() => setShowAllListings(!showAllListings)}
                >
                  <div className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full shadow-md transition-all duration-300 ${!showAllListings ? 'left-0 bg-blue-600' : 'left-[calc(100%-1.5rem)] bg-blue-600'}`} />
                </div>
                <span className={`text-xs font-bold ${showAllListings ? 'text-blue-600' : 'text-gray-400'}`}>SHOW ALL</span>
              </div>

              {/* Sort Buttons */}
              {/* Sort Buttons */}
              <div ref={sortButtonsContainerRef} className="flex w-full bg-gray-100 p-0.5 rounded-lg shadow-inner relative z-0 flex-wrap sm:flex-nowrap justify-between">
                <div className="relative flex-1">
                  <button
                    ref={priceButtonRef}
                    onClick={() => {
                      if (sortConfig && sortConfig.key !== 'price') {
                        setSortConfig(null);
                      }
                      setIsPriceFilterOpen(!isPriceFilterOpen);
                    }}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                            ${(sortConfig?.key === 'price' || priceRange !== null || (useExactPrice && manualPrice !== ''))
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                        `}
                  >
                    Price
                    {sortConfig?.key === 'price' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </button>

                  {isPriceFilterOpen && createPortal(
                    <div
                      ref={pricePopoverRef}
                      className="fixed w-72 bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up"
                      style={{ top: `${popoverPosition.top}px`, left: `${popoverPosition.left}px` }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-900">Price Range (PHP)</span>
                        <button
                          onClick={() => handleSort('price')}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                          title="Toggle Sort Order"
                        >
                          {sortConfig?.key === 'price' && sortConfig.direction === 'asc'
                            ? <ArrowUp className="w-4 h-4 text-gray-700" />
                            : <ArrowDown className="w-4 h-4 text-gray-700" />
                          }
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div
                          onClick={() => setUseExactPrice(!useExactPrice)}
                          className={`w-4 h-4 rounded-full border border-gray-400 cursor-pointer flex items-center justify-center ${useExactPrice ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}
                        >
                        </div>
                        <span className="text-xs font-medium text-gray-700 cursor-pointer select-none" onClick={() => setUseExactPrice(!useExactPrice)}>Exact Value Match</span>
                      </div>

                      {useExactPrice ? (
                        <div className="mb-2 px-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualPrice}
                            onChange={(e) => {
                              // Allow digits and one dot
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              // Handle trailing dot or multiple dots if basic logic needed, 
                              // but simplest robust way for "comma separation" is:
                              // Remove all non-digits first for safety if re-formatting entire string
                              // But easier: use standard number format logic
                              if (val === '') {
                                setManualPrice('');
                                return;
                              }
                              // Basic parse check
                              const parts = val.split('.');
                              const numStr = parts[0].replace(/,/g, '');
                              if (!/^\d*$/.test(numStr)) return;

                              const num = parseInt(numStr, 10);
                              if (isNaN(num)) return;

                              let formatted = num.toLocaleString();
                              if (parts.length > 1) {
                                formatted += '.' + parts[1];
                              }
                              setManualPrice(formatted);
                            }}
                            placeholder="Enter exact price..."
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <DualRangeSlider
                          useLogScale={true}
                          min={minGlob}
                          max={maxGlob}
                          step={sliderStep}
                          value={priceRange || [minGlob, maxGlob]}
                          onChange={(val) => setPriceRange(val)}
                          formatMinValue={(val) => {
                            if (val >= 1000000) {
                              const millions = val / 1000000;
                              const rounded = Math.floor(millions / 10) * 10;
                              return `${rounded.toLocaleString()}M`;
                            } else if (val >= 1000) {
                              const thousands = val / 1000;
                              const rounded = Math.floor(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K`;
                            } else {
                              return `${Math.floor(val / 10) * 10}`;
                            }
                          }}
                          formatMaxValue={(val) => {
                            if (val >= 1000000) {
                              const millions = val / 1000000;
                              const rounded = Math.floor(millions / 10) * 10;
                              return `${rounded.toLocaleString()}M`;
                            } else if (val >= 1000) {
                              const thousands = val / 1000;
                              const rounded = Math.floor(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K`;
                            } else {
                              return `${Math.floor(val / 10) * 10}`;
                            }
                          }}
                        />
                      )}
                    </div>,
                    document.body
                  )}
                </div>

                {/* Price/Sqm Button */}
                <div className="relative flex-1">
                  <button
                    ref={pricePerSqmButtonRef}
                    onClick={() => {
                      if (sortConfig && sortConfig.key !== 'pricePerSqm') {
                        setSortConfig(null);
                      }
                      setIsPricePerSqmFilterOpen(!isPricePerSqmFilterOpen);
                    }}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                        ${(sortConfig?.key === 'pricePerSqm' || pricePerSqmRange !== null || (useExactPricePerSqm && manualPricePerSqm !== ''))
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    Price/Sqm
                    {sortConfig?.key === 'pricePerSqm' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </button>

                  {isPricePerSqmFilterOpen && createPortal(
                    <div
                      ref={pricePerSqmPopoverRef}
                      className="fixed w-72 bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up"
                      style={{ top: `${popoverPositionPerSqm.top}px`, left: `${popoverPositionPerSqm.left}px` }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-900">Price/Sqm Range</span>
                        <button
                          onClick={() => handleSort('pricePerSqm')}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                          title="Toggle Sort Order"
                        >
                          {sortConfig?.key === 'pricePerSqm' && sortConfig.direction === 'asc'
                            ? <ArrowUp className="w-4 h-4 text-gray-700" />
                            : <ArrowDown className="w-4 h-4 text-gray-700" />
                          }
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div
                          onClick={() => setUseExactPricePerSqm(!useExactPricePerSqm)}
                          className={`w-4 h-4 rounded-full border border-gray-400 cursor-pointer flex items-center justify-center ${useExactPricePerSqm ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}
                        >
                        </div>
                        <span className="text-xs font-medium text-gray-700 cursor-pointer select-none" onClick={() => setUseExactPricePerSqm(!useExactPricePerSqm)}>Exact Value Match</span>
                      </div>

                      {useExactPricePerSqm ? (
                        <div className="mb-2 px-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualPricePerSqm}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              if (val === '') {
                                setManualPricePerSqm('');
                                return;
                              }
                              const parts = val.split('.');
                              const numStr = parts[0].replace(/,/g, '');
                              if (!/^\d*$/.test(numStr)) return;

                              const num = parseInt(numStr, 10);
                              if (isNaN(num)) return;

                              let formatted = num.toLocaleString();
                              if (parts.length > 1) {
                                formatted += '.' + parts[1];
                              }
                              setManualPricePerSqm(formatted);
                            }}
                            placeholder="Enter exact price per sqm..."
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <DualRangeSlider
                          useLogScale={true}
                          min={minGlobPerSqm}
                          max={maxGlobPerSqm}
                          step={sliderStepPerSqm}
                          value={pricePerSqmRange || [minGlobPerSqm, maxGlobPerSqm]}
                          onChange={(val) => setPricePerSqmRange(val)}
                          formatMinValue={(val) => {
                            if (val >= 1000000) {
                              const millions = val / 1000000;
                              const rounded = Math.floor(millions / 10) * 10;
                              return `${rounded.toLocaleString()}M`;
                            } else if (val >= 1000) {
                              const thousands = val / 1000;
                              const rounded = Math.floor(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K`;
                            } else {
                              return `${Math.floor(val / 10) * 10}`;
                            }
                          }}
                          formatMaxValue={(val) => {
                            if (val >= 1000000) {
                              const millions = val / 1000000;
                              const rounded = Math.ceil(millions / 10) * 10;
                              return `${rounded.toLocaleString()}M`;
                            } else if (val >= 1000) {
                              const thousands = val / 1000;
                              const rounded = Math.ceil(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K`;
                            } else {
                              return `${Math.ceil(val / 10) * 10}`;
                            }
                          }}
                        />
                      )}
                    </div>,
                    document.body
                  )}
                </div>

                {/* Lot Area Button */}
                <div className="relative flex-1">
                  <button
                    ref={lotAreaButtonRef}
                    onClick={() => {
                      if (sortConfig && sortConfig.key !== 'lotArea') {
                        setSortConfig(null);
                      }
                      setIsLotAreaFilterOpen(!isLotAreaFilterOpen);
                    }}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                        ${(sortConfig?.key === 'lotArea' || lotAreaRange !== null || (useExactLotArea && manualLotArea !== ''))
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    Lot Area
                    {sortConfig?.key === 'lotArea' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </button>

                  {isLotAreaFilterOpen && createPortal(
                    <div
                      ref={lotAreaPopoverRef}
                      className="fixed w-72 bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up"
                      style={{ top: `${popoverPositionLot.top}px`, left: `${popoverPositionLot.left}px` }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-900">Lot Area (SQM)</span>
                        <button
                          onClick={() => handleSort('lotArea')}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                          title="Toggle Sort Order"
                        >
                          {sortConfig?.key === 'lotArea' && sortConfig.direction === 'asc'
                            ? <ArrowUp className="w-4 h-4 text-gray-700" />
                            : <ArrowDown className="w-4 h-4 text-gray-700" />
                          }
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div
                          onClick={() => setUseExactLotArea(!useExactLotArea)}
                          className={`w-4 h-4 rounded-full border border-gray-400 cursor-pointer flex items-center justify-center ${useExactLotArea ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}
                        >
                        </div>
                        <span className="text-xs font-medium text-gray-700 cursor-pointer select-none" onClick={() => setUseExactLotArea(!useExactLotArea)}>Exact Value Match</span>
                      </div>

                      {useExactLotArea ? (
                        <div className="mb-2 px-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualLotArea}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              if (val === '') {
                                setManualLotArea('');
                                return;
                              }
                              const parts = val.split('.');
                              const numStr = parts[0].replace(/,/g, '');
                              if (!/^\d*$/.test(numStr)) return;

                              const num = parseInt(numStr, 10);
                              if (isNaN(num)) return;

                              let formatted = num.toLocaleString();
                              if (parts.length > 1) {
                                formatted += '.' + parts[1];
                              }
                              setManualLotArea(formatted);
                            }}
                            placeholder="Enter exact lot area..."
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <DualRangeSlider
                          useLogScale={true}
                          min={minGlobLot}
                          max={maxGlobLot}
                          step={sliderStepLot}
                          value={lotAreaRange || [minGlobLot, maxGlobLot]}
                          onChange={(val) => setLotAreaRange(val)}
                          formatMinValue={(val) => {
                            if (val >= 10000) {
                              const thousands = val / 1000;
                              const rounded = Math.floor(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K SQM`;
                            } else {
                              return `${Math.floor(val / 10) * 10} SQM`;
                            }
                          }}
                          formatMaxValue={(val) => {
                            if (val >= 10000) {
                              const thousands = val / 1000;
                              const rounded = Math.ceil(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K SQM`;
                            } else {
                              return `${Math.ceil(val / 10) * 10} SQM`;
                            }
                          }}
                        />
                      )}
                    </div>,
                    document.body
                  )}
                </div>

                {/* Floor Area Button */}
                <div className="relative flex-1">
                  <button
                    ref={floorAreaButtonRef}
                    onClick={() => {
                      if (sortConfig && sortConfig.key !== 'floorArea') {
                        setSortConfig(null);
                      }
                      setIsFloorAreaFilterOpen(!isFloorAreaFilterOpen);
                    }}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                        ${(sortConfig?.key === 'floorArea' || floorAreaRange !== null || (useExactFloorArea && manualFloorArea !== ''))
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                    `}
                  >
                    Floor Area
                    {sortConfig?.key === 'floorArea' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </button>

                  {isFloorAreaFilterOpen && createPortal(
                    <div
                      ref={floorAreaPopoverRef}
                      className="fixed w-72 bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up"
                      style={{ top: `${popoverPositionFloor.top}px`, left: `${popoverPositionFloor.left}px` }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-900">Floor Area (SQM)</span>
                        <button
                          onClick={() => handleSort('floorArea')}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                          title="Toggle Sort Order"
                        >
                          {sortConfig?.key === 'floorArea' && sortConfig.direction === 'asc'
                            ? <ArrowUp className="w-4 h-4 text-gray-700" />
                            : <ArrowDown className="w-4 h-4 text-gray-700" />
                          }
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div
                          onClick={() => setUseExactFloorArea(!useExactFloorArea)}
                          className={`w-4 h-4 rounded-full border border-gray-400 cursor-pointer flex items-center justify-center ${useExactFloorArea ? 'bg-blue-600 border-blue-600' : 'bg-white'}`}
                        >
                        </div>
                        <span className="text-xs font-medium text-gray-700 cursor-pointer select-none" onClick={() => setUseExactFloorArea(!useExactFloorArea)}>Exact Value Match</span>
                      </div>

                      {useExactFloorArea ? (
                        <div className="mb-2 px-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={manualFloorArea}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9.]/g, '');
                              if (val === '') {
                                setManualFloorArea('');
                                return;
                              }
                              const parts = val.split('.');
                              const numStr = parts[0].replace(/,/g, '');
                              if (!/^\d*$/.test(numStr)) return;

                              const num = parseInt(numStr, 10);
                              if (isNaN(num)) return;

                              let formatted = num.toLocaleString();
                              if (parts.length > 1) {
                                formatted += '.' + parts[1];
                              }
                              setManualFloorArea(formatted);
                            }}
                            placeholder="Enter exact floor area..."
                            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <DualRangeSlider
                          useLogScale={true}
                          min={minGlobFloor}
                          max={maxGlobFloor}
                          step={sliderStepFloor}
                          value={floorAreaRange || [minGlobFloor, maxGlobFloor]}
                          onChange={(val) => setFloorAreaRange(val)}
                          formatMinValue={(val) => {
                            if (val >= 10000) {
                              const thousands = val / 1000;
                              const rounded = Math.floor(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K SQM`;
                            } else {
                              return `${Math.floor(val / 10) * 10} SQM`;
                            }
                          }}
                          formatMaxValue={(val) => {
                            if (val >= 10000) {
                              const thousands = val / 1000;
                              const rounded = Math.ceil(thousands / 10) * 10;
                              return `${rounded.toLocaleString()}K SQM`;
                            } else {
                              return `${Math.ceil(val / 10) * 10} SQM`;
                            }
                          }}
                        />
                      )}
                    </div>,
                    document.body
                  )}
                </div>

                {/* Property Type Button */}
                <div className="relative flex-1">
                  <button
                    ref={typeButtonRef}
                    onClick={() => setIsTypeFilterOpen(!isTypeFilterOpen)}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                            ${selectedPropertyTypes.length > 0
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                        `}
                  >
                    Property Type
                  </button>

                  {isTypeFilterOpen && createPortal(
                    <div
                      ref={typePopoverRef}
                      className="fixed w-[calc(100vw-32px)] sm:w-[520px] bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up max-sm:!top-1/2 max-sm:!left-1/2 max-sm:!-translate-x-1/2 max-sm:!-translate-y-1/2"
                      style={{ top: `${popoverPositionType.top}px`, left: `${popoverPositionType.left}px` }}
                    >
                      <div className="mb-2">
                        <span className="text-sm font-bold text-gray-900">Property Type</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {['HOUSE AND LOT', 'TOWNHOUSE', 'CONDO', 'VACANT LOT', 'WAREHOUSE', 'BUILDING', 'OFFICE/COMMERCIAL', 'CLUB SHARE'].map(option => {
                          const isSelected = selectedPropertyTypes.includes(option);
                          return (
                            <button
                              key={option}
                              onClick={() => {
                                let next = selectedPropertyTypes.filter(o => o !== 'ALL');
                                if (isSelected) {
                                  next = next.filter(o => o !== option);
                                } else {
                                  next = [...next, option];
                                }
                                setSelectedPropertyTypes(next.length === 0 ? [] : next);
                              }}
                              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all border text-center
                                  ${isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>

                {/* Bedrooms Button */}
                <div className="relative flex-1">
                  <button
                    ref={bedroomsButtonRef}
                    onClick={() => {
                      if (sortConfig && sortConfig.key !== 'bedrooms') {
                        setSortConfig(null);
                      }
                      setIsBedroomsFilterOpen(!isBedroomsFilterOpen);
                    }}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                            ${sortConfig?.key === 'bedrooms' || selectedBedrooms.length > 0
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                        `}
                  >
                    Bedrooms
                    {sortConfig?.key === 'bedrooms' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </button>

                  {isBedroomsFilterOpen && createPortal(
                    <div
                      ref={bedroomsPopoverRef}
                      className="fixed w-72 bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up"
                      style={{ top: `${popoverPositionBedrooms.top}px`, left: `${popoverPositionBedrooms.left}px` }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-900">Bedrooms</span>
                        <button
                          onClick={() => handleSort('bedrooms')}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                          title="Toggle Sort Order"
                        >
                          {sortConfig?.key === 'bedrooms' && sortConfig.direction === 'asc'
                            ? <ArrowUp className="w-4 h-4 text-gray-700" />
                            : <ArrowDown className="w-4 h-4 text-gray-700" />
                          }
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {['STUDIO', '1', '2', '3', '4', '5+'].map(option => {
                          const isSelected = selectedBedrooms.includes(option);
                          return (
                            <button
                              key={option}
                              onClick={() => {
                                let next = [...selectedBedrooms];
                                if (isSelected) {
                                  next = next.filter(o => o !== option);
                                } else {
                                  next = [...next, option];
                                }
                                setSelectedBedrooms(next);
                              }}
                              className={`py-2 text-xs font-bold rounded-lg transition-all border
                                  ${isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md translate-y-[-1px]'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>

                {/* Parking Button */}
                <div className="relative flex-1">
                  <button
                    ref={parkingButtonRef}
                    onClick={() => {
                      if (sortConfig && sortConfig.key !== 'parking') {
                        setSortConfig(null);
                      }
                      setIsParkingFilterOpen(!isParkingFilterOpen);
                    }}
                    className={`relative w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-1
                            ${sortConfig?.key === 'parking' || selectedParking.length > 0
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 z-10'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                      }
                        `}
                  >
                    Parking
                    {sortConfig?.key === 'parking' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </button>

                  {isParkingFilterOpen && createPortal(
                    <div
                      ref={parkingPopoverRef}
                      className="fixed w-72 bg-blue-50 rounded-xl shadow-2xl p-3 border border-blue-200 z-[9999] animate-fade-in-up"
                      style={{ top: `${popoverPositionParking.top}px`, left: `${popoverPositionParking.left}px` }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-900">Parking Slots</span>
                        <button
                          onClick={() => handleSort('parking')}
                          className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                          title="Toggle Sort Order"
                        >
                          {sortConfig?.key === 'parking' && sortConfig.direction === 'asc'
                            ? <ArrowUp className="w-4 h-4 text-gray-700" />
                            : <ArrowDown className="w-4 h-4 text-gray-700" />
                          }
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {['0', '1', '2', '3', '4', '5+'].map(option => {
                          const isSelected = selectedParking.includes(option);
                          return (
                            <button
                              key={option}
                              onClick={() => {
                                let next = [...selectedParking];
                                if (isSelected) {
                                  next = next.filter(o => o !== option);
                                } else {
                                  next = [...next, option];
                                }
                                setSelectedParking(next);
                              }}
                              className={`py-2 text-xs font-bold rounded-lg transition-all border
                                  ${isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md translate-y-[-1px]'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              </div>

              {/* Right Column: Area Filters Sidebar (Adjusted Width) - HIDDEN */}
              {/* <div className="w-full xl:w-[37.5%] flex flex-col pt-1">
                <div className="bg-blue-50/80 rounded-3xl p-4 flex flex-col gap-1 border border-blue-100/50">
                  {[
                    { label: 'Province', value: selectedProvince, setValue: setSelectedProvince, options: availableProvinces },
                    { label: 'City', value: selectedCity, setValue: setSelectedCity, options: availableCities },
                    { label: 'Barangay', value: selectedBarangay, setValue: setSelectedBarangay, options: availableBarangays },
                  ].map(({ label, value, setValue, options }) => {
                    const selectId = `filter-${label.toLowerCase()}`;
                    return (
                      <div key={label} className="relative flex items-center justify-between w-full group py-1.5 rounded-lg transition-colors hover:bg-white/50">
                        <div className="flex items-center justify-between w-full px-2 pointer-events-none z-0">
                          <span className="text-sm font-bold text-gray-500 group-hover:text-gray-800 transition-colors">
                            {label}
                          </span>
                          <span className={`text-sm font-bold transition-colors ${value ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                            {value || 'All'}
                          </span>
                        </div>

                        <select
                          id={selectId}
                          value={value || ''}
                          onChange={e => setValue(e.target.value || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                          title={`Select ${label}`}
                        >
                          <option value="">All</option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </div >

      {/* Results Section */}
      {
        (hasSearched || selectedType || selectedCategory || (selectedBedrooms.length > 0) || (selectedParking.length > 0) || (selectedPropertyTypes.length > 0)) && (
          <div className="max-w-7xl mx-auto px-4 pb-20 animate-fade-in-up">
            {paginatedResults.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100">
                <p className="text-lg">
                  No matches found for "{query}"
                  {selectedType ? ` with type "${selectedType}"` : ''}
                  {selectedCategory ? ` and category "${selectedCategory}"` : ''}
                </p>
                <p className="text-sm mt-2">Try adjusting your price, location, or filters.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {finalResults.map((listing, idx) => (
                    <ListingCard
                      key={`${listing.id}-${idx}`}
                      listing={listing}
                      isSelected={selectedListings.includes(listing.id)}
                      onToggleSelection={handleToggleSelection}
                      isDisabled={selectedListings.length >= 5}
                      onNotesClick={handleSendForm}
                      onShowNote={handleShowNote}
                      onMapClick={handleMapClick}
                      index={(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      activeFilter={selectedType}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {/* Pagination Controls */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        )
      }
      <ContactFormModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setSelectedListings([]);
        }}
        selectedListings={selectedListings}
        initialSuggestedEdit={
          selectedListings.length > 0
            ? allListings.find(l => l.id === selectedListings[0])?.columnV || ''
            : ''
        }
      />

      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        centerListing={mapCenterListing}
        allListings={allListings}
        filteredListingsIds={new Set(displayedResults.map(l => l.id))}
        onNotesClick={handleSendForm}
        onShowNote={handleShowNote}
      />

      <NoteModal
        isOpen={noteModalData.isOpen}
        onClose={() => setNoteModalData(prev => ({ ...prev, isOpen: false }))}
        content={noteModalData.content}
        title={noteModalData.title}
      />
    </div >
  );
}

export default App;
