import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowUp, ArrowDown, Facebook, Instagram, Youtube, Eye, Share2, Check } from 'lucide-react';
import { DualRangeSlider } from './components/DualRangeSlider';
import { fetchListings, refreshListings } from './services/dataService';
import { searchListings } from './services/searchEngine';
// import { hybridSearch, isSemanticSearchAvailable } from './services/semanticSearch'; // DISABLED: Semantic search turned off
import type { Listing } from './types';
import { ListingCard } from './components/ListingCard';
import { ContactFormModal } from './components/ContactFormModal';
import { MapModal } from './components/MapModal';
import { NoteModal } from './components/NoteModal';
import { EditListingModal } from './components/EditListingModal';
import { UserManagementModal } from './components/UserManagementModal';
import { ViewingSidebar } from './components/ViewingSidebar';
import Pagination from './components/Pagination';
import { ScrollToTop } from './components/ScrollToTop';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './contexts/PermissionsContext';
import { useViewing } from './contexts/ViewingContext';
import { LoginScreen } from './components/LoginScreen';
import { AccessDenied } from './components/AccessDenied';
import { supabase } from './lib/supabase';
import { clearCache } from './services/listingsCache';
import { listingMatchesPropertyType } from './utils/propertyTypeFilters';

function App() {
  const { user, role, displayRole, fbGroup, userName, groupBranding, isLoading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { permissions } = usePermissions();
  const { viewingList, addManyToViewing } = useViewing();

  const [sessionAccepted, setSessionAccepted] = useState(() => {
    return sessionStorage.getItem('termsAccepted') === 'true';
  });

  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  const [showViewingSidebar, setShowViewingSidebar] = useState(false);
  const [showViewingListView, setShowViewingListView] = useState(() => new URLSearchParams(window.location.search).get('viewingMode') === 'true');

  // ── New Note Submitted alert ──
  // Visible only to: superadmin, or admin/editor whose fbGroup === 'Luxe'
  const NOTES_GSHEET_URL = 'https://docs.google.com/spreadsheets/d/1x0as4KKRqQ4YZYQ30gDxdW6qyggh4n4gtnVOXBYvs-8/edit?resourcekey=&gid=1150742435#gid=1150742435';
  const LS_KEY = 'luxe_notes_last_seen';
  const [hasNewNote, setHasNewNote] = useState(false);

  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [hasSearched, setHasSearched] = useState(() => !!new URLSearchParams(window.location.search).get('q'));
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshNeeded, setIsRefreshNeeded] = useState(false);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(10);
  const lastRefreshTimeRef = useRef<number>(Date.now());
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [results, setResults] = useState<Listing[]>([]);

  const visibleListings = useMemo(() => {
    const forbiddenWords = [
      'DISCREET',
      'DO NOT POST ONLINE',
      'DO NOT SHARE ONLINE',
      'NO POSTING ONLINE',
      'NO ONLINE POSTING'
    ];
    return allListings.filter(item => {
      const summaryUpper = (item.summary || '').toUpperCase();
      const isDiscreet = forbiddenWords.some(word => summaryUpper.includes(word));
      if (isDiscreet) {
        if (role === 'superadmin') return true;
        return !!permissions.discreet;
      }
      return true;
    });
  }, [allListings, role, permissions.discreet]);

  const [selectedType, setSelectedType] = useState<string | null>(() => new URLSearchParams(window.location.search).get('type')); // Default null (No filter)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(() => new URLSearchParams(window.location.search).get('category')); // 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural' | null
  const [selectedDirect, setSelectedDirect] = useState<boolean>(() => new URLSearchParams(window.location.search).get('direct') === 'true');
  const [showAllListings, setShowAllListings] = useState<boolean>(() => {
    const showAllVal = new URLSearchParams(window.location.search).get('showAll');
    return showAllVal !== null ? showAllVal === 'true' : true;
  });

  // Area Filter State
  const [selectedRegion, setSelectedRegion] = useState<string | null>(() => new URLSearchParams(window.location.search).get('region'));
  const [selectedProvince, setSelectedProvince] = useState<string | null>(() => new URLSearchParams(window.location.search).get('province'));
  const [selectedCity, setSelectedCity] = useState<string | null>(() => new URLSearchParams(window.location.search).get('city'));
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(() => new URLSearchParams(window.location.search).get('barangay'));
  const [selectedBedrooms, setSelectedBedrooms] = useState<string[]>(() => {
    const val = new URLSearchParams(window.location.search).get('bedrooms');
    return val ? val.split(',') : [];
  });
  const [selectedParking, setSelectedParking] = useState<string[]>(() => {
    const val = new URLSearchParams(window.location.search).get('parking');
    return val ? val.split(',') : [];
  });
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(() => {
    const val = new URLSearchParams(window.location.search).get('propertyTypes');
    return val ? val.split(',') : [];
  });

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('sortKey');
    const dir = params.get('sortDir');
    return key && dir ? { key, direction: dir as 'asc' | 'desc' } : null;
  });

  // Price Range State
  const [isPriceFilterOpen, setIsPriceFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const min = params.get('priceMin');
    const max = params.get('priceMax');
    return min && max ? [parseFloat(min), parseFloat(max)] : null;
  });
  const [useExactPrice, setUseExactPrice] = useState<boolean>(() => new URLSearchParams(window.location.search).get('useExactPrice') === 'true');
  const [manualPrice, setManualPrice] = useState<string>(() => new URLSearchParams(window.location.search).get('manualPrice') || '');

  const [isPricePerSqmFilterOpen, setIsPricePerSqmFilterOpen] = useState(false);
  const [pricePerSqmRange, setPricePerSqmRange] = useState<[number, number] | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const min = params.get('ppsMin');
    const max = params.get('ppsMax');
    return min && max ? [parseFloat(min), parseFloat(max)] : null;
  });
  const [useExactPricePerSqm, setUseExactPricePerSqm] = useState<boolean>(() => new URLSearchParams(window.location.search).get('useExactPricePerSqm') === 'true');
  const [manualPricePerSqm, setManualPricePerSqm] = useState<string>(() => new URLSearchParams(window.location.search).get('manualPricePerSqm') || '');

  const [isLotAreaFilterOpen, setIsLotAreaFilterOpen] = useState(false);
  const [lotAreaRange, setLotAreaRange] = useState<[number, number] | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const min = params.get('lotMin');
    const max = params.get('lotMax');
    return min && max ? [parseFloat(min), parseFloat(max)] : null;
  });
  const [useExactLotArea, setUseExactLotArea] = useState<boolean>(() => new URLSearchParams(window.location.search).get('useExactLotArea') === 'true');
  const [manualLotArea, setManualLotArea] = useState<string>(() => new URLSearchParams(window.location.search).get('manualLotArea') || '');

  const [isFloorAreaFilterOpen, setIsFloorAreaFilterOpen] = useState(false);
  const [floorAreaRange, setFloorAreaRange] = useState<[number, number] | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const min = params.get('floorMin');
    const max = params.get('floorMax');
    return min && max ? [parseFloat(min), parseFloat(max)] : null;
  });
  const [useExactFloorArea, setUseExactFloorArea] = useState<boolean>(() => new URLSearchParams(window.location.search).get('useExactFloorArea') === 'true');
  const [manualFloorArea, setManualFloorArea] = useState<string>(() => new URLSearchParams(window.location.search).get('manualFloorArea') || '');
  const PRICE_EXACT_MATCH_TOLERANCE_PERCENT = 0.01;
  const AREA_EXACT_MATCH_TOLERANCE = 1;

  // Share Toast notification state
  const [showShareToast, setShowShareToast] = useState(false);

  // Graceful handling of Access Denied flash (especially during sign-out)
  useEffect(() => {
    if (user && !role && !authLoading) {
      // Wait 500ms before showing the Access Denied screen
      // This gives sign-out processes enough time to clear the 'user' object 
      // without ever showing the error screen.
      const timer = setTimeout(() => setShowAccessDenied(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowAccessDenied(false);
    }
  }, [user, role, authLoading]);

  // Auto-open the viewing sidebar when the first listing is added
  useEffect(() => {
    if (viewingList.length > 0) {
      setShowViewingSidebar(true);
    }
  }, [viewingList.length]);

  useEffect(() => {
    if (viewingList.length === 0) {
      setShowViewingListView(false);
    }
  }, [viewingList.length]);

  useEffect(() => {
    if (loading || visibleListings.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const ids = (params.get('viewing') || '')
      .split(',')
      .map(id => id.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 10);

    if (ids.length === 0) return;

    const listingsById = new Map(visibleListings.map(listing => [listing.id.toUpperCase(), listing]));
    const sharedListings = ids
      .map(id => listingsById.get(id))
      .filter((listing): listing is Listing => Boolean(listing));

    if (sharedListings.length > 0) {
      addManyToViewing(sharedListings);
      setShowViewingSidebar(true);
      setShowViewingListView(params.get('viewingMode') === 'true');
    }
  }, [loading, visibleListings, addManyToViewing]);

  // ── Note submission alert: poll Supabase every 30 s ──
  const canSeeNoteAlert =
    role === 'superadmin' ||
    ((role === 'admin' || role === 'editor') && fbGroup === 'Luxe');

  useEffect(() => {
    if (!canSeeNoteAlert) return;

    const checkNewNotes = async () => {
      const lastSeen = localStorage.getItem(LS_KEY) ?? '1970-01-01T00:00:00.000Z';
      const { data, error } = await supabase
        .from('luxe_note_submissions')
        .select('id', { count: 'exact', head: false })
        .gt('submitted_at', lastSeen)
        .limit(1);
      if (!error && data && data.length > 0) {
        // Mark as seen immediately so repeated page loads don't re-trigger the same alert.
        // The link in the notification still opens the GSheet on click.
        localStorage.setItem(LS_KEY, new Date().toISOString());
        setHasNewNote(true);
      }
    };

    checkNewNotes(); // run immediately on mount
    const interval = setInterval(checkNewNotes, 3 * 60 * 60 * 1000); // then every 3 hours
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeNoteAlert]);

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
      setSelectedType(null);
      setSelectedCategory(null);
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

  // SUPERADMIN Sort State
  const [adminSortMode, setAdminSortMode] = useState<'SOCMED' | 'GEO-ID' | 'LISTING DATE'>('LISTING DATE');
  const [isAdminSortMenuOpen, setIsAdminSortMenuOpen] = useState(false);
  const adminSortRef = useRef<HTMLDivElement>(null);

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
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rowNumbers, setRowNumbers] = useState<Record<string, number>>({});
  const rowNumbersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    rowNumbersRef.current = rowNumbers;
  }, [rowNumbers]);

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

  // Auto-accept session for users who skip the confidentiality agreement (superadmins, leslie)
  // Without this, sessionAccepted stays false on fresh mobile sessions and data never loads
  useEffect(() => {
    if (!role || !user?.email) return;
    const skip = role === 'superadmin' || user.email.toLowerCase() === 'leslie@luxerealtyph.com';
    if (skip && !sessionAccepted) {
      sessionStorage.setItem('termsAccepted', 'true');
      setSessionAccepted(true);
    }
  }, [role, user?.email, sessionAccepted]);

  // Initial Data Load
  useEffect(() => {
    if (!sessionAccepted || !role) return;

    setLoading(true);
    fetchListings().then(data => {
      console.log('Fetched listings:', data.length);
      setAllListings(data);
      // Initialize results with all data so "Show All" works immediately (filtered based on discreet permissions)
      const initialResults = data.filter(item => {
        const summaryUpper = (item.summary || '').toUpperCase();
        const isDiscreet = [
          'DISCREET',
          'DO NOT POST ONLINE',
          'DO NOT SHARE ONLINE',
          'NO POSTING ONLINE',
          'NO ONLINE POSTING'
        ].some(word => summaryUpper.includes(word));
        if (isDiscreet) {
          if (role === 'superadmin') return true;
          return !!permissions.discreet;
        }
        return true;
      });
      setResults(initialResults);
      setLoadingProgress(100);
      setTimeout(() => setLoading(false), 400);
    }).catch(error => {
      console.error('Failed to fetch listings:', error);
      setLoadingProgress(100);
      setTimeout(() => setLoading(false), 400);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAccepted, role]);

  // Simulated loading progress bar
  // Phase 1: 0→80% fast, Phase 2: 80→97.5% slow creep (so it never looks stuck)
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 97.5) return prev; // Cap at 97.5%, actual 100% comes from data load
        if (prev < 80) {
          // Phase 1: Quick ramp to 80%
          const increment = Math.max(0.5, (80 - prev) * 0.08);
          return Math.min(80, prev + increment);
        }
        // Phase 2: Slow creep from 80% to 97.5% — keeps the bar moving on slow connections
        const remaining = 97.5 - prev;
        const increment = Math.max(0.05, remaining * 0.02);
        return prev + increment;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [loading]);

  // Handle initial loader removal
  useEffect(() => {
    if (!authLoading) {
      // Remove loader immediately if user needs to login or is denied access
      if (!sessionAccepted || !role || !loading) {
        document.body.classList.add('loaded');
      }
    }
  }, [authLoading, loading, sessionAccepted, role]);

  // Manual Refresh Handler

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowRefreshPrompt(false);
    setIsRefreshNeeded(false);
    setRefreshCountdown(10);
    try {
      const data = await refreshListings();
      console.log('Refreshed listings:', data.length);
      setAllListings(data);
      const refreshedResults = data.filter(item => {
        const summaryUpper = (item.summary || '').toUpperCase();
        const isDiscreet = [
          'DISCREET',
          'DO NOT POST ONLINE',
          'DO NOT SHARE ONLINE',
          'NO POSTING ONLINE',
          'NO ONLINE POSTING'
        ].some(word => summaryUpper.includes(word));
        if (isDiscreet) {
          if (role === 'superadmin') return true;
          return !!permissions.discreet;
        }
        return true;
      });
      setResults(refreshedResults);
      // Reset search and filters
      setQuery('');
      setDebouncedQuery('');
      setSelectedListings([]);
      setHasSearched(false);
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
      setShowAllListings(true);
      lastRefreshTimeRef.current = Date.now();
    } catch (error) {
      console.error('Failed to refresh listings:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-Refresh: Check every minute if 3 hours have passed since last refresh
  useEffect(() => {
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastRefreshTimeRef.current;
      if (elapsed >= THREE_HOURS_MS && !isRefreshNeeded && !isRefreshing) {
        setIsRefreshNeeded(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isRefreshNeeded, isRefreshing]);

  // Countdown timer: when prompt is visible, count down from 10 to 0, then auto-refresh
  // useEffect(() => {
  //   if (!showRefreshPrompt) return;

  //   if (refreshCountdown <= 0) {
  //     handleRefresh();
  //     return;
  //   }

  //   const timerId = setTimeout(() => {
  //     setRefreshCountdown(prev => prev - 1);
  //   }, 1000);

  //   return () => clearTimeout(timerId);
  // }, [showRefreshPrompt, refreshCountdown]);

  // Copy current URL to clipboard and trigger toast success message
  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2500);
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
      });
  };

  const handleShareViewingList = () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('viewing', viewingList.map(listing => listing.id).join(','));
    shareUrl.searchParams.set('viewingMode', 'true');

    navigator.clipboard.writeText(shareUrl.toString())
      .then(() => {
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2500);
      })
      .catch((err) => {
        console.error('Failed to copy viewing list link: ', err);
      });
  };

  const handleSelectViewingGeoId = (geoId: string) => {
    const normalizedGeoId = geoId.trim();
    if (!normalizedGeoId) return;

    setShowViewingListView(false);
    setShowViewingSidebar(false);
    setQuery(normalizedGeoId);
    setDebouncedQuery(normalizedGeoId);
    setHasSearched(true);
    setSelectedListings([]);
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
    setShowAllListings(true);
    setCurrentPage(1);
  };

  // Synchronize all filter and sort states with URL parameters
  useEffect(() => {
    // Only synchronize once initial loading is done, to prevent overwriting URL parameters with empty values on mount
    if (loading) return;

    const params = new URLSearchParams();

    if (debouncedQuery) params.set('q', debouncedQuery);
    if (selectedType) params.set('type', selectedType);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedDirect) params.set('direct', 'true');
    if (!showAllListings) params.set('showAll', 'false');

    if (selectedRegion) params.set('region', selectedRegion);
    if (selectedProvince) params.set('province', selectedProvince);
    if (selectedCity) params.set('city', selectedCity);
    if (selectedBarangay) params.set('barangay', selectedBarangay);

    if (priceRange) {
      params.set('priceMin', priceRange[0].toString());
      params.set('priceMax', priceRange[1].toString());
    }
    if (useExactPrice) params.set('useExactPrice', 'true');
    if (manualPrice) params.set('manualPrice', manualPrice);

    if (pricePerSqmRange) {
      params.set('ppsMin', pricePerSqmRange[0].toString());
      params.set('ppsMax', pricePerSqmRange[1].toString());
    }
    if (useExactPricePerSqm) params.set('useExactPricePerSqm', 'true');
    if (manualPricePerSqm) params.set('manualPricePerSqm', manualPricePerSqm);

    if (lotAreaRange) {
      params.set('lotMin', lotAreaRange[0].toString());
      params.set('lotMax', lotAreaRange[1].toString());
    }
    if (useExactLotArea) params.set('useExactLotArea', 'true');
    if (manualLotArea) params.set('manualLotArea', manualLotArea);

    if (floorAreaRange) {
      params.set('floorMin', floorAreaRange[0].toString());
      params.set('floorMax', floorAreaRange[1].toString());
    }
    if (useExactFloorArea) params.set('useExactFloorArea', 'true');
    if (manualFloorArea) params.set('manualFloorArea', manualFloorArea);

    if (selectedBedrooms.length > 0) params.set('bedrooms', selectedBedrooms.join(','));
    if (selectedParking.length > 0) params.set('parking', selectedParking.join(','));
    if (selectedPropertyTypes.length > 0) params.set('propertyTypes', selectedPropertyTypes.join(','));
    if (viewingList.length > 0) params.set('viewing', viewingList.map(listing => listing.id).join(','));
    if (showViewingListView && viewingList.length > 0) params.set('viewingMode', 'true');

    if (sortConfig) {
      params.set('sortKey', sortConfig.key);
      params.set('sortDir', sortConfig.direction);
    }

    const currentQuery = window.location.search;
    const newQuery = params.toString() ? `?${params.toString()}` : '';
    if (currentQuery !== newQuery) {
      const newUrl = `${window.location.pathname}${newQuery}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [
    loading,
    debouncedQuery,
    selectedType,
    selectedCategory,
    selectedDirect,
    showAllListings,
    selectedRegion,
    selectedProvince,
    selectedCity,
    selectedBarangay,
    priceRange,
    useExactPrice,
    manualPrice,
    pricePerSqmRange,
    useExactPricePerSqm,
    manualPricePerSqm,
    lotAreaRange,
    useExactLotArea,
    manualLotArea,
    floorAreaRange,
    useExactFloorArea,
    manualFloorArea,
    selectedBedrooms,
    selectedParking,
    selectedPropertyTypes,
    viewingList,
    showViewingListView,
    sortConfig
  ]);

  // Effect: Re-search when debouncedQuery changes (always uses smart/broad match)
  useEffect(() => {
    if (debouncedQuery.trim() || hasSearched) {
      setHasSearched(true);

      // Keyword search only (semantic search disabled)
      const performSearch = async () => {
        let keywordResults = searchListings(visibleListings, debouncedQuery, 0); // Always use broad match (0)

        console.log('🔍 Using keyword search only');
        setResults(keywordResults);
      };

      performSearch();
    }
  }, [debouncedQuery, visibleListings]);

  // Effect: Keep results synchronized with visibleListings when search query is empty
  useEffect(() => {
    if (!query && !debouncedQuery && !hasSearched) {
      setResults(visibleListings);
    }
  }, [visibleListings, query, debouncedQuery, hasSearched]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Debounce handles the search, this just prevents default and blurs input
  };

  // Re-run filter and sort when filters change
  const baseFilteredResults = results.filter(item => {
    // 0a. Sheet2 visibility — all users can now see Sheet2 listings

    // 0. Base Filter (Show All)
    // console.log(`Filtering item: ${item.id}, status: ${item.statusAQ}, showAll: ${showAllListings}`);
    // If showAllListings is false OR show_all permission is missing, only show AVAILABLE items
    if (!showAllListings || !permissions.show_all) {
      const status = (item.statusAQ || '').toUpperCase().trim();
      if (status !== 'AVAILABLE') {
        return false;
      }
    }

    // 0. ID Search Override
    // If the query is an exact ID match or a series match (A/B/G), we show it regardless of other filters.
    const trimmedQuery = debouncedQuery.trim().toUpperCase();
    const itemId = (item.id || '').toUpperCase();
    
    // Check if it's a multi-series ID search (A/B/G + digits)
    const seriesMatchMatch = trimmedQuery.match(/^([ABG])(\d+)$/);
    let isSeriesMatch = false;
    if (seriesMatchMatch) {
      const digits = seriesMatchMatch[2];
      isSeriesMatch = /^[ABG]/.test(itemId) && itemId.substring(1) === digits;
    }

    const isExactIdMatch = trimmedQuery === itemId || isSeriesMatch;


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
    // If a filter is selected but no results yet (and no query), we should populate results with visibleListings
    // so filtering can happen on the full set.
    if ((selectedType || selectedCategory || selectedDirect || selectedRegion || selectedProvince || selectedCity || selectedBarangay) && results.length === 0 && !query) {
      setResults(visibleListings);
    }
  }, [selectedType, selectedCategory, selectedDirect, selectedRegion, selectedProvince, selectedCity, selectedBarangay, results.length, query, visibleListings]);

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
      const priceToCompare = getPrice(item);
      if (priceToCompare < priceVal * (1 - PRICE_EXACT_MATCH_TOLERANCE_PERCENT) || priceToCompare > priceVal * (1 + PRICE_EXACT_MATCH_TOLERANCE_PERCENT)) return false;
    } else if (priceRange) {
      const priceToCompare = (selectedType === 'Lease' || selectedType === 'FOR LEASE') ? item.leasePrice : item.price;
      if (priceToCompare < priceRange[0] || priceToCompare > priceRange[1]) return false;
    }


    // Filter by Price/Sqm Range
    if (useExactPricePerSqm && manualPricePerSqm) {
      const ppsVal = parseFloat(manualPricePerSqm.replace(/,/g, ''));
      const getPps = (l: Listing) => (selectedType === 'Lease' || selectedType === 'FOR LEASE') ? l.leasePricePerSqm : l.pricePerSqm;
      const ppsToCompare = getPps(item);
      if (ppsToCompare < ppsVal * (1 - PRICE_EXACT_MATCH_TOLERANCE_PERCENT) || ppsToCompare > ppsVal * (1 + PRICE_EXACT_MATCH_TOLERANCE_PERCENT)) return false;
    } else if (pricePerSqmRange) {
      const sqmToCompare = (selectedType === 'Lease' || selectedType === 'FOR LEASE') ? item.leasePricePerSqm : item.pricePerSqm;
      if (sqmToCompare < pricePerSqmRange[0] || sqmToCompare > pricePerSqmRange[1]) return false;
    }

    // Filter by Lot Area Range
    if (useExactLotArea && manualLotArea) {
      const lotVal = parseFloat(manualLotArea.replace(/,/g, ''));
      if (item.lotArea < lotVal - AREA_EXACT_MATCH_TOLERANCE || item.lotArea > lotVal + AREA_EXACT_MATCH_TOLERANCE) return false;
    } else if (lotAreaRange) {
      if (item.lotArea < lotAreaRange[0] || item.lotArea > lotAreaRange[1]) return false;
    }

    // Filter by Floor Area Range
    if (useExactFloorArea && manualFloorArea) {
      const floorVal = parseFloat(manualFloorArea.replace(/,/g, ''));
      if (item.floorArea < floorVal - AREA_EXACT_MATCH_TOLERANCE || item.floorArea > floorVal + AREA_EXACT_MATCH_TOLERANCE) return false;
    } else if (floorAreaRange) {
      if (item.floorArea < floorAreaRange[0] || item.floorArea > floorAreaRange[1]) return false;
    }
    // Filter by Bedrooms (Multi-select)
    if (selectedBedrooms.length > 0) {
      // Check for specific matches (handle both number and potential null/undefined)
      const bedroomCount = item.bedrooms || 0;
      const isStudio = selectedBedrooms.includes('STUDIO') && bedroomCount === 0;
      const isOne = selectedBedrooms.includes('1') && bedroomCount === 1;
      const isTwo = selectedBedrooms.includes('2') && bedroomCount === 2;
      const isThree = selectedBedrooms.includes('3') && bedroomCount === 3;
      const isFour = selectedBedrooms.includes('4') && bedroomCount === 4;
      const isFivePlus = selectedBedrooms.includes('5+') && bedroomCount >= 5;

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
      const matchesType = selectedPropertyTypes.some(type => listingMatchesPropertyType(item.typeDescription || '', type));
      if (!matchesType) return false;
    }
    return true;
  }).sort((a, b) => {
    // ALWAYS sort NOT AVAILABLE listings to the end
    const aAvailable = (a.statusAQ || '').toLowerCase().trim() === 'available';
    const bAvailable = (b.statusAQ || '').toLowerCase().trim() === 'available';
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;

    // When using exact match for LOT AREA, prioritize exact matches first, then sort by ascending value
    if (useExactLotArea && manualLotArea) {
      const lotVal = parseFloat(manualLotArea.replace(/,/g, ''));
      const aExact = Math.abs(a.lotArea - lotVal) < 0.01;
      const bExact = Math.abs(b.lotArea - lotVal) < 0.01;
      // Exact matches come first
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      // Then sort by ascending lot area value
      return a.lotArea - b.lotArea;
    }

    // When using exact match for FLOOR AREA, prioritize exact matches first, then sort by ascending value
    if (useExactFloorArea && manualFloorArea) {
      const floorVal = parseFloat(manualFloorArea.replace(/,/g, ''));
      const aExact = Math.abs(a.floorArea - floorVal) < 0.01;
      const bExact = Math.abs(b.floorArea - floorVal) < 0.01;
      // Exact matches come first
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      // Then sort by ascending floor area value
      return a.floorArea - b.floorArea;
    }

    if (!sortConfig) {
      if (role === 'superadmin') {
        if (adminSortMode === 'SOCMED') {
          const hasSocmedA = !!(a.facebookLink || a.postLinkLuxe || a.postLinkNexia || a.postLinkAdolf || a.postLinkPco || a.postLinkSloo || a.postLinkTaoke);
          const hasSocmedB = !!(b.facebookLink || b.postLinkLuxe || b.postLinkNexia || b.postLinkAdolf || b.postLinkPco || b.postLinkSloo || b.postLinkTaoke);
          if (hasSocmedA && !hasSocmedB) return -1;
          if (!hasSocmedA && hasSocmedB) return 1;
          
          // Secondary sort: Listing Update Date (newest first)
          const dateA = a.columnBC ? new Date(a.columnBC.split(' | ')[0]).getTime() : 0;
          const dateB = b.columnBC ? new Date(b.columnBC.split(' | ')[0]).getTime() : 0;
          if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return dateB - dateA;
          
          // Tertiary sort: GEO-ID
          const geoA = parseInt((a.id || '').match(/\d+/)?.join('') || '0', 10);
          const geoB = parseInt((b.id || '').match(/\d+/)?.join('') || '0', 10);
          return geoB - geoA;
        } else if (adminSortMode === 'LISTING DATE') {
          // 1st: Listing Update Date (newest first)
          const dateA = a.columnBC ? new Date(a.columnBC.split(' | ')[0]).getTime() : 0;
          const dateB = b.columnBC ? new Date(b.columnBC.split(' | ')[0]).getTime() : 0;
          if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return dateB - dateA;
          
          // Secondary sort: GEO-ID
          const geoA = parseInt((a.id || '').match(/\d+/)?.join('') || '0', 10);
          const geoB = parseInt((b.id || '').match(/\d+/)?.join('') || '0', 10);
          return geoB - geoA;
        } else {
          // Default: GEO-ID
          const geoA = parseInt((a.id || '').match(/\d+/)?.join('') || '0', 10);
          const geoB = parseInt((b.id || '').match(/\d+/)?.join('') || '0', 10);
          return geoB - geoA;
        }
      } else {
        // PRIORITY for all other roles — order depends on SHOW ALL state
        const ownerA = (a.columnBD || 'Luxe').toLowerCase();
        const ownerB = (b.columnBD || 'Luxe').toLowerCase();
        const userGrp = (fbGroup || '').toLowerCase();
        const userNm = (userName || '').toLowerCase();
        const aOwnerMatch = (userGrp && ownerA.includes(userGrp)) || (userNm && ownerA.includes(userNm));
        const bOwnerMatch = (userGrp && ownerB.includes(userGrp)) || (userNm && ownerB.includes(userNm));

        const getGroupSocmed = (l: Listing) => {
          if (!fbGroup) return false;
          if (fbGroup === 'Luxe') return !!l.postLinkLuxe;
          if (fbGroup === 'Nexia') return !!l.postLinkNexia;
          if (fbGroup === 'Adolf') return !!l.postLinkAdolf;
          if (fbGroup === 'PCO') return !!l.postLinkPco;
          if (fbGroup === 'SLoo') return !!l.postLinkSloo;
          if (fbGroup === 'Taoke') return !!l.postLinkTaoke;
          if (fbGroup === 'Kiu') return !!l.facebookLink;
          return false;
        };
        const aHasMySocmed = getGroupSocmed(a);
        const bHasMySocmed = getGroupSocmed(b);

        const dateA = a.columnBC ? new Date(a.columnBC.split(' | ')[0]).getTime() : 0;
        const dateB = b.columnBC ? new Date(b.columnBC.split(' | ')[0]).getTime() : 0;

        const geoA = parseInt((a.id || '').match(/\d+/)?.join('') || '0', 10);
        const geoB = parseInt((b.id || '').match(/\d+/)?.join('') || '0', 10);

        if (showAllListings) {
          // SHOW ALL = ON: Date > Ownership > Socmed > Map Verified > GEO-ID
          if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return dateB - dateA;
          if (aOwnerMatch && !bOwnerMatch) return -1;
          if (!aOwnerMatch && bOwnerMatch) return 1;
          if (aHasMySocmed && !bHasMySocmed) return -1;
          if (!aHasMySocmed && bHasMySocmed) return 1;
          if (a.mapVerified && !b.mapVerified) return -1;
          if (!a.mapVerified && b.mapVerified) return 1;
          return geoB - geoA;
        } else {
          // SHOW ALL = OFF: Date > Ownership > Socmed > Map Verified > GEO-ID
          if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) return dateB - dateA;
          if (aOwnerMatch && !bOwnerMatch) return -1;
          if (!aOwnerMatch && bOwnerMatch) return 1;
          if (aHasMySocmed && !bHasMySocmed) return -1;
          if (!aHasMySocmed && bHasMySocmed) return 1;
          if (a.mapVerified && !b.mapVerified) return -1;
          if (!a.mapVerified && b.mapVerified) return 1;
          return geoB - geoA;
        }
      }
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

  const visibleIdsKey = paginatedResults?.map(l => l.id).join(',') || '';

  useEffect(() => {
    if (!visibleIdsKey) return;
    const ids = visibleIdsKey.split(',').filter(Boolean);
    if (ids.length === 0) return;

    const idsToFetch = ids.filter(id => rowNumbersRef.current[id] === undefined);
    if (idsToFetch.length === 0) return;

    let isMounted = true;
    const fetchRowNumbers = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('sync-listing-edits', {
          body: {
            action: 'find_rows',
            ids: idsToFetch
          }
        });

        if (error) {
          console.error('Error invoking sync-listing-edits for find_rows:', error);
          return;
        }

        if (data && data.success && data.rows && isMounted) {
          setRowNumbers(prev => ({
            ...prev,
            ...data.rows
          }));
        }
      } catch (err) {
        console.error('Failed to fetch row numbers:', err);
      }
    };

    fetchRowNumbers();

    return () => {
      isMounted = false;
    };
  }, [visibleIdsKey]);

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

  /**
   * Called by ContactFormModal on submit.
   * Saves ONLY coordinates + map verification + social media link to Supabase,
   * mirroring the behaviour of EditListingModal without touching price / notes / dates.
   */
  const handleNotesCoordsSave = async (
    listingId: string,
    latLongStr: string,
    mapVerified: string,
    fbLinkStr: string,
  ) => {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return; // nothing to do if listing not found

    // Parse coordinates
    let parsedLat: number | null = null;
    let parsedLng: number | null = null;
    if (latLongStr) {
      const parts = latLongStr.split(',').map(s => s.trim());
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          parsedLat = lat;
          parsedLng = lng;
        }
      }
    }

    // Only commit if something has actually changed
    const oldLat = listing.lat || 0;
    const oldLng = listing.lng || 0;
    const coordsChanged = parsedLat !== null && parsedLng !== null &&
      (Math.abs(parsedLat - oldLat) > 0.000001 || Math.abs(parsedLng - oldLng) > 0.000001);
    const verifiedChanged = mapVerified !== (listing.mapVerified || '');
    const socmedChanged = fbLinkStr !== undefined;

    if (!coordsChanged && !verifiedChanged && !socmedChanged) return;

    // Determine which social media column to write (same logic as full edit)
    const socmedColMap: Record<string, string> = {
      Luxe: 'BP', Nexia: 'BQ', Adolf: 'BR', PCO: 'BS', SLoo: 'BT', Taoke: 'BU',
    };
    const socmedCol = fbGroup ? (socmedColMap[fbGroup] ?? 'FB LINK') : 'FB LINK';

    await supabase
      .from('KIU Properties')
      .update({
        'LAT LONG': latLongStr || listing.latLong || null,
        'LAT': parsedLat !== null ? parsedLat.toString() : (listing.lat?.toString() || null),
        'LONG': parsedLng !== null ? parsedLng.toString() : (listing.lng?.toString() || null),
        'MAP VERIFIED': mapVerified || null,
        // Auto-generate MAP LINK when verifying
        ...(mapVerified && parsedLat !== null && parsedLng !== null && {
          'MAP LINK': `https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`,
        }),
        ...(fbLinkStr !== undefined && { [socmedCol]: fbLinkStr || null }),
      })
      .eq('"GEO ID"', listingId);

    // Optimistic local state update
    const updateFn = (l: typeof listing): typeof listing =>
      l.id !== listingId ? l : {
        ...l,
        ...(parsedLat !== null && { lat: parsedLat }),
        ...(parsedLng !== null && { lng: parsedLng }),
        mapVerified,
        ...(mapVerified && parsedLat !== null && parsedLng !== null && {
          mapLink: `https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`,
        }),
        facebookLink: fbGroup === 'Kiu' || !fbGroup ? fbLinkStr : l.facebookLink,
        postLinkLuxe: fbGroup === 'Luxe' ? fbLinkStr : l.postLinkLuxe,
        postLinkNexia: fbGroup === 'Nexia' ? fbLinkStr : l.postLinkNexia,
        postLinkAdolf: fbGroup === 'Adolf' ? fbLinkStr : l.postLinkAdolf,
        postLinkPco: fbGroup === 'PCO' ? fbLinkStr : l.postLinkPco,
        postLinkSloo: fbGroup === 'SLoo' ? fbLinkStr : l.postLinkSloo,
        postLinkTaoke: fbGroup === 'Taoke' ? fbLinkStr : l.postLinkTaoke,
      };

    setAllListings(prev => prev.map(updateFn));
    setResults(prev => prev.map(updateFn));
    clearCache().catch(() => {});
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



  // Handle listing edits (price, notes)
  const handleEditClick = (listing: Listing) => {
    setEditingListing(listing);
    setShowEditModal(true);
  };

  const handleListingEdit = async (listingId: string, updates: {
    salePrice: number;
    leasePrice: number;
    monthlyDues: string;
    notes: string;
    updateDate: string | null;
    latLong: string;
    fbLink: string;
    mapVerified: string;
    mapLink: string;
    sourceTab?: string;
    residential: boolean;
    commercial: boolean;
    industrial: boolean;
    agricultural: boolean;
  }) => {
    console.log('Editing listing:', { listingId, updates });

    // Calculate price per sqm
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }

    const saleArea = listing.lotArea > 0 ? listing.lotArea : listing.floorArea;
    const leaseArea = listing.floorArea > 0 ? listing.floorArea : listing.lotArea;
    const salePricePerSqm = saleArea > 0 && updates.salePrice > 0 ? Math.round(updates.salePrice / saleArea) : 0;
    const leasePricePerSqm = leaseArea > 0 && updates.leasePrice > 0 ? Math.round(updates.leasePrice / leaseArea) : 0;

    // Parse lat/long from "lat, long" string
    let parsedLat: number | null = null;
    let parsedLng: number | null = null;
    if (updates.latLong) {
      const parts = updates.latLong.split(',').map(s => s.trim());
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          parsedLat = lat;
          parsedLng = lng;
        }
      }
    }

    // Always compute change type annotation
    const changeTypes: string[] = [];
    const oldPrice = Math.round(listing.price || 0);
    const newPrice = Math.round(updates.salePrice || 0);
    const oldLease = Math.round(listing.leasePrice || 0);
    const newLease = Math.round(updates.leasePrice || 0);

    if (oldPrice !== newPrice || oldLease !== newLease) changeTypes.push('PRICE');
    if (updates.notes.trim() !== (listing.columnV || '').trim()) changeTypes.push('COMMENTS');
    
    // Improved location change detection - use small epsilon for float comparison
    const oldLat = listing.lat || 0;
    const oldLng = listing.lng || 0;
    const hasNewCoords = updates.latLong && parsedLat !== null && parsedLng !== null;
    const coordsActuallyChanged = hasNewCoords && (Math.abs(parsedLat! - oldLat) > 0.000001 || Math.abs(parsedLng! - oldLng) > 0.000001);
    
    // Also trigger LOCATION update if verification changed (e.g. user clicked VERIFIED button)
    const verificationChanged = updates.mapVerified && updates.mapVerified !== listing.mapVerified;
    
    if (coordsActuallyChanged || verificationChanged) changeTypes.push('LOCATION');
    if (changeTypes.length === 0) changeTypes.push('LISTING');
    
    // Detect if we are adding a NEW listing (no existing listing ID)
    const author = fbGroup || (user?.user_metadata?.full_name || user?.email || 'System');

    const formatDateStamp = (d: Date) => {
      const dateToUse = isNaN(d.getTime()) ? new Date() : d;
      return dateToUse.toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      });
    };

    // Date: use custom date if toggle is ON, else preserve existing stamp
    let newStamp: string | undefined;
    if (updates.updateDate) {
      const datePart = formatDateStamp(new Date(updates.updateDate + 'T00:00:00'));
      newStamp = `${datePart} | ${changeTypes.join('/')} | ${author}`;
    }
    // If updateDate is null (toggle OFF), newStamp stays undefined → we won't overwrite DATE UPDATED

    const { data, error } = await supabase
      .from('KIU Properties')
      .update({
        'Extracted Sale Price': updates.salePrice || null,
        'Sale Price/Sqm': salePricePerSqm || null,
        'Extracted Lease Price': updates.leasePrice || null,
        'Lease Price/Sqm': leasePricePerSqm || null,
        'MONTHLY DUES': updates.monthlyDues || null,
        'COMMENTS': updates.notes || null,
        ...(newStamp ? { 'DATE UPDATED': newStamp } : {}),
        'LAT LONG': updates.latLong || listing.latLong || null,
        'LAT': parsedLat !== null ? parsedLat.toString() : (listing.lat?.toString() || null),
        'LONG': parsedLng !== null ? parsedLng.toString() : (listing.lng?.toString() || null),
        'MAP VERIFIED': updates.mapVerified !== undefined ? (updates.mapVerified || null) : (listing.mapVerified || null),
        'RESIDENTIAL': updates.residential ? 'TRUE' : null,
        'COMMERCIAL': updates.commercial ? 'TRUE' : null,
        'INDUSTRIAL': updates.industrial ? 'TRUE' : null,
        'AGRICULTURAL': updates.agricultural ? 'TRUE' : null,
        ...(updates.mapLink !== undefined && { 'MAP LINK': updates.mapLink || null }),
        ...(updates.fbLink !== undefined && {
          [fbGroup === 'Nexia' ? 'BQ'
            : fbGroup === 'Adolf' ? 'BR'
            : fbGroup === 'PCO' ? 'BS'
            : fbGroup === 'SLoo' ? 'BT'
            : fbGroup === 'Taoke' ? 'BU'
            : fbGroup === 'Luxe' ? 'BP'
            : 'FB LINK']: updates.fbLink || null,
        }),
      })
      .eq('"GEO ID"', listingId)
      .select('"GEO ID"');

    console.log('Edit result:', { data, error });

    if (error) {
      console.error('Failed to update listing:', error);
      throw new Error(`Failed to update: ${error.message}`);
    }

    // data.length === 0 can happen when RLS allows UPDATE but restricts SELECT on the result.
    // The DB was still updated, so proceed with optimistic local state update.
    if (error === null && !data) {
       console.warn('No data returned from update, but no error reported.');
    }

    // Update local state
    const updateListing = (l: Listing): Listing =>
      l.id === listingId ? {
        ...l,
        price: updates.salePrice,
        pricePerSqm: salePricePerSqm,
        leasePrice: updates.leasePrice,
        leasePricePerSqm: leasePricePerSqm,
        monthlyDues: updates.monthlyDues,
        columnV: updates.notes,
        columnBC: newStamp || l.columnBC,
        ...(parsedLat !== null && { lat: parsedLat }),
        ...(parsedLng !== null && { lng: parsedLng }),
        facebookLink: fbGroup === 'Kiu' || !fbGroup ? updates.fbLink : l.facebookLink,
        postLinkLuxe: fbGroup === 'Luxe' ? updates.fbLink : l.postLinkLuxe,
        postLinkNexia: fbGroup === 'Nexia' ? updates.fbLink : l.postLinkNexia,
        postLinkAdolf: fbGroup === 'Adolf' ? updates.fbLink : l.postLinkAdolf,
        postLinkPco: fbGroup === 'PCO' ? updates.fbLink : l.postLinkPco,
        postLinkSloo: fbGroup === 'SLoo' ? updates.fbLink : l.postLinkSloo,
        postLinkTaoke: fbGroup === 'Taoke' ? updates.fbLink : l.postLinkTaoke,
        mapVerified: updates.mapVerified,
        mapLink: updates.mapLink || l.mapLink,
      } : l;

    setAllListings(prev => prev.map(updateListing));
    setResults(prev => prev.map(updateListing));

    // Also call edge function directly as a backup — webhook handles Kiu/Col Z but direct call
    // ensures BP-BU sync for non-Kiu groups. Function deployed with --no-verify-jwt.
    if (fbGroup && fbGroup !== 'Kiu' && updates.fbLink !== undefined) {
      const socmedCol = fbGroup === 'Luxe' ? 'BP'
        : fbGroup === 'Nexia' ? 'BQ'
        : fbGroup === 'Adolf' ? 'BR'
        : fbGroup === 'PCO' ? 'BS'
        : fbGroup === 'SLoo' ? 'BT'
        : fbGroup === 'Taoke' ? 'BU'
        : null;
      if (socmedCol) {
        supabase.functions.invoke('sync-listing-edits', {
          body: {
            record: { 'GEO ID': listingId, [socmedCol]: updates.fbLink || null },
            old_record: {},
          },
        }).catch(err => console.warn('GSheet direct sync failed:', err));
      }
    }

    // Invalidate cache so next reload reflects the change
    // Don't await — IndexedDB can hang on iOS Safari
    clearCache().catch(() => { });
  };

  // Auth gating
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-1.5 w-40 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full animate-pulse w-2/3" />
          </div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest animate-pulse">Loading Portal...</span>
        </div>
      </div>
    );
  }

  // Step 1: Not logged in → Welcome page
  if (!user) {
    return (
      <LoginScreen
        mode="welcome"
        onSignIn={signInWithGoogle}
      />
    );
  }

  // Step 2: Logged in but no role yet → verifying or access denied
  if (!role) {
    if (!showAccessDenied) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-1.5 w-40 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse w-2/3" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest animate-pulse">Verifying Credentials...</span>
          </div>
        </div>
      );
    }
    return <AccessDenied email={user.email || ''} onSignOut={signOut} />;
  }

  // Step 3: Superadmins and leslie skip the confidentiality agreement
  const skipAgreement = role === 'superadmin' || (user.email || '').toLowerCase() === 'leslie@luxerealtyph.com';

  // Step 4: Non-privileged users must accept confidentiality agreement (once per session)
  if (!skipAgreement && !sessionAccepted) {
    return (
      <LoginScreen
        mode="agreement"
        onSignIn={signInWithGoogle}
        onProceed={() => {
          sessionStorage.setItem('termsAccepted', 'true');
          setSessionAccepted(true);
        }}
      />
    );
  }

  const canUseViewingList = (role === 'superadmin' || fbGroup === 'Luxe') && permissions.viewing_listing;
  const isViewingListViewActive = canUseViewingList && showViewingListView && viewingList.length > 0;
  const hasActiveResultsView =
    isViewingListViewActive ||
    hasSearched ||
    selectedType ||
    selectedCategory ||
    selectedDirect ||
    selectedRegion ||
    selectedProvince ||
    selectedCity ||
    selectedBarangay ||
    selectedBedrooms.length > 0 ||
    selectedParking.length > 0 ||
    selectedPropertyTypes.length > 0 ||
    priceRange !== null ||
    pricePerSqmRange !== null ||
    lotAreaRange !== null ||
    floorAreaRange !== null ||
    (useExactPrice && manualPrice !== '') ||
    (useExactPricePerSqm && manualPricePerSqm !== '') ||
    (useExactLotArea && manualLotArea !== '') ||
    (useExactFloorArea && manualFloorArea !== '');

  return (
    <div
      className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 transition-all duration-300"
      style={{ paddingRight: showViewingSidebar && canUseViewingList ? '320px' : '0px' }}
    >
      <ScrollToTop />

      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 w-full py-4 bg-white border-b border-gray-100 flex items-center justify-center px-4 z-50 transition-all duration-300"
        style={{ paddingRight: showViewingSidebar && canUseViewingList ? 'calc(320px + 1rem)' : '1rem' }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {(groupBranding?.logoUrl || groupBranding?.brandName) && (
            <div className="flex items-center gap-2">
              {groupBranding.logoUrl && (
                <img
                  src={(() => {
                    let url = groupBranding.logoUrl.trim();
                    if (url.startsWith('/')) return url;
                    if (!url.startsWith('http')) url = `https://${url}`;
                    // Strip 'www.' as it often breaks Vercel subdomains
                    return url.replace('https://www.', 'https://');
                  })()}
                  alt="Logo"
                  className="h-8 w-auto"
                  onError={(e) => {
                    // Fallback to relative path if absolute fails
                    const img = e.currentTarget;
                    if (!img.src.endsWith('/luxe-logo.png')) {
                      img.src = '/luxe-logo.png';
                    }
                  }}
                />
              )}
              {groupBranding.brandName && <span className="font-bold text-gray-900 text-xl tracking-tight">{groupBranding.brandName}</span>}
            </div>
          )}

          <div className="hidden sm:block w-px h-6 bg-gray-200"></div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium truncate max-w-[160px]">
              {user.email}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              (displayRole === 'admin' || displayRole === 'superadmin') ? 'bg-green-50 text-green-600'
              : displayRole === 'editor'  ? 'bg-amber-50 text-amber-700'
              : displayRole === 'broker'  ? 'bg-blue-50 text-blue-600'
              : 'bg-gray-100 text-gray-500'
            }`}>
              {(displayRole === 'admin' || displayRole === 'superadmin') ? 'ADMIN'
                : displayRole === 'editor' ? 'EDITOR'
                : displayRole === 'broker' ? 'BROKER'
                : displayRole === 'v2' ? 'V2'
                : 'V1'}
            </span>
            {(role === 'superadmin' || role === 'admin') && (
              <button
                onClick={() => setShowUserManagement(true)}
                className="text-xs text-green-700 hover:text-green-900 font-bold transition-colors border border-green-200 hover:border-green-400 px-2 py-0.5 rounded-full"
              >
                Users
              </button>
            )}
            {/* New Note Submitted alert — superadmin or Luxe admin/editor only */}
            {canSeeNoteAlert && hasNewNote && (
              <a
                href={NOTES_GSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Mark as seen: save current UTC timestamp to localStorage
                  localStorage.setItem(LS_KEY, new Date().toISOString());
                  setHasNewNote(false);
                }}
                className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors animate-pulse whitespace-nowrap"
                title="Open Notes GSheet"
              >
                ● New Note Submitted
              </a>
            )}
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Search Section */}
      < div className={`flex flex-col items-center justify-center transition-all duration-500 ease-out px-4 pt-28 ${hasActiveResultsView ? 'py-12 min-h-[30vh]' : 'min-h-[100vh]'
        }`}>
        <div className={`w-full max-w-2xl text-center space-y-6 transition-all duration-500 ${hasActiveResultsView ? 'translate-y-0' : '-translate-y-8'
          }`}>

          <div className={`font-bold text-gray-900 tracking-tight transition-all duration-500 ${hasActiveResultsView ? 'text-2xl mb-4 mt-4' : 'text-4xl sm:text-5xl mb-8'}`}>
            {isViewingListViewActive
              ? <>Viewing List</>
              : (selectedType || selectedCategory || hasSearched || (selectedBedrooms.length > 0) || (selectedParking.length > 0) || (selectedPropertyTypes.length > 0))
              ? <>Found {displayedResults.length.toLocaleString()} of {visibleListings.filter(l => l.sourceTab === 'Sheet1').length.toLocaleString()} Available <span className="relative inline-block" ref={adminSortRef}>
                  {role === 'superadmin' ? (
                    <span onClick={() => setIsAdminSortMenuOpen(!isAdminSortMenuOpen)} className="cursor-pointer hover:text-blue-600 transition-colors border-b border-dashed border-gray-400 pb-0.5" title="Listings Sort Options">Listings</span>
                  ) : (
                    <span>Listings</span>
                  )}
                  {role === 'superadmin' && isAdminSortMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-[9999] text-sm font-medium animate-fade-in-up">
                      <button onClick={() => { setAdminSortMode('SOCMED'); setIsAdminSortMenuOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${adminSortMode === 'SOCMED' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        <span>SOCMED</span>
                        {adminSortMode === 'SOCMED' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto"></span>}
                      </button>
                      <button onClick={() => { setAdminSortMode('GEO-ID'); setIsAdminSortMenuOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${adminSortMode === 'GEO-ID' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        <span>GEO-ID</span>
                        {adminSortMode === 'GEO-ID' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto"></span>}
                      </button>
                      <button onClick={() => { setAdminSortMode('LISTING DATE'); setIsAdminSortMenuOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${adminSortMode === 'LISTING DATE' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        <span>LISTING DATE</span>
                        {adminSortMode === 'LISTING DATE' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto"></span>}
                      </button>
                    </div>
                  )}
                </span></>
              : visibleListings.filter(l => l.sourceTab === 'Sheet1').length > 0 ? <>{visibleListings.filter(l => l.sourceTab === 'Sheet1').length.toLocaleString()} Available <span className="relative inline-block" ref={adminSortRef}>
                  {role === 'superadmin' ? (
                    <span onClick={() => setIsAdminSortMenuOpen(!isAdminSortMenuOpen)} className="cursor-pointer hover:text-blue-600 transition-colors border-b border-dashed border-gray-400 pb-0.5" title="Listings Sort Options">Listings</span>
                  ) : (
                    <span>Listings</span>
                  )}
                  {role === 'superadmin' && isAdminSortMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-[9999] text-sm font-medium animate-fade-in-up">
                      <button onClick={() => { setAdminSortMode('SOCMED'); setIsAdminSortMenuOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${adminSortMode === 'SOCMED' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        <span>SOCMED</span>
                        {adminSortMode === 'SOCMED' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto"></span>}
                      </button>
                      <button onClick={() => { setAdminSortMode('GEO-ID'); setIsAdminSortMenuOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${adminSortMode === 'GEO-ID' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        <span>GEO-ID</span>
                        {adminSortMode === 'GEO-ID' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto"></span>}
                      </button>
                      <button onClick={() => { setAdminSortMode('LISTING DATE'); setIsAdminSortMenuOpen(false); }} className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 ${adminSortMode === 'LISTING DATE' ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                        <span>LISTING DATE</span>
                        {adminSortMode === 'LISTING DATE' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 ml-auto"></span>}
                      </button>
                    </div>
                  )}
                </span></> : 'Loading properties...'
            }
          </div>

          {/* Animated Loading Progress Bar */}
          {loading && (
            <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6">
              <div className="w-full">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest animate-pulse">Retrieving listings...</span>
                  <p className="text-sm text-gray-400 font-bold">{Math.round(loadingProgress)}%</p>
                </div>
              </div>
            </div>
          )}



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
                  'Residential': visibleListings.some(item => (item.category || '').toUpperCase().includes('RESIDENTIAL')),
                  'Commercial': visibleListings.some(item => (item.category || '').toUpperCase().includes('COMMERCIAL')),
                  'Industrial': visibleListings.some(item => (item.category || '').toUpperCase().includes('INDUSTRIAL')),
                  'Agricultural': visibleListings.some(item => (item.category || '').toUpperCase().includes('AGRICULTURAL'))
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
                            setResults(visibleListings); // Reset to all listings
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
                            setShowAllListings(true); // Reset to Show All
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
                {permissions.show_all && (
                <div
                  className="hidden sm:flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer h-[calc(100%-4px)]"
                  onClick={() => setShowAllListings(!showAllListings)}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${showAllListings ? 'border-blue-600 bg-white' : 'border-gray-300 bg-gray-50'}`}>
                    {showAllListings && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                  <span className={`text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap select-none ${showAllListings ? 'text-blue-600' : 'text-gray-400'}`}>ALL</span>
                </div>
                )}

                {/* Refresh Button (Desktop Only) */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="hidden sm:flex items-center bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 h-[calc(100%-4px)] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh data from server"
                >
                  <span className={`text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap select-none ${isRefreshNeeded ? 'text-red-600 animate-pulse' : 'text-gray-600'}`}>
                    {isRefreshing ? 'REFRESHING...' : 'REFRESH'}
                  </span>
                </button>

                {/* Share Button (Desktop Only) */}
                <button
                  onClick={handleShareLink}
                  className="hidden sm:flex items-center bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-[calc(100%-4px)]"
                  title="Copy shareable link with current filters"
                >
                  <span className="text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap select-none text-blue-600">
                    SHARE
                  </span>
                </button>
              </div>

              {/* Mobile Only: Slider Toggle & Refresh */}
              <div className="flex sm:hidden items-center justify-center gap-3 mt-3 w-full pb-2">
                {permissions.show_all && (<>
                <span className={`text-xs font-bold ${!showAllListings ? 'text-blue-600' : 'text-gray-400'}`}>AVAILABLE</span>
                <div
                  className="w-12 h-4 bg-gray-200 rounded-full relative cursor-pointer"
                  onClick={() => setShowAllListings(!showAllListings)}
                >
                  <div className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full shadow-md transition-all duration-300 ${!showAllListings ? 'left-0 bg-blue-600' : 'left-[calc(100%-1.5rem)] bg-blue-600'}`} />
                </div>
                <span className={`text-xs font-bold ${showAllListings ? 'text-blue-600' : 'text-gray-400'}`}>ALL</span>
                </>)}

                {/* Mobile Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="ml-2 p-2 rounded-lg bg-white shadow-md disabled:opacity-50 flex items-center gap-2"
                  title="Refresh data"
                >
                  <svg
                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : (isRefreshNeeded ? 'text-red-600' : 'text-gray-600')}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {(role === 'v1' || role === 'v2') && (
                    <span className="text-[10px] font-bold text-gray-600 uppercase">Refresh Listings</span>
                  )}
                </button>

                {/* Mobile Share Button */}
                <button
                  onClick={handleShareLink}
                  className="ml-2 p-2 rounded-lg bg-white shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-200"
                  title="Share link"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Share</span>
                </button>
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
                        {['HOUSE AND LOT', 'TOWNHOUSE', 'CONDO', 'VACANT LOT', 'WAREHOUSE', 'BUILDING', 'OFFICE/COMMERCIAL', 'CLUB SHARE / BUSINESS'].map(option => {
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
                        ? 'bg-blue-600 text-white shadow-sm z-10'
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
        // Show results when search, filters, or viewing-list mode is active
        hasActiveResultsView ? (
          <div className="max-w-7xl mx-auto px-4 pb-20 animate-fade-in-up">
            {isViewingListViewActive ? (
              <>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest">Viewing List</h2>
                    <p className="text-sm text-gray-500 mt-1">{viewingList.length} selected listing{viewingList.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {viewingList.map((listing, idx) => (
                    <ListingCard
                      key={`viewing-${listing.id}-${idx}`}
                      listing={listing}
                      isSelected={selectedListings.includes(listing.id)}
                      onToggleSelection={handleToggleSelection}
                      isDisabled={selectedListings.length >= 5}
                      onNotesClick={handleSendForm}
                      onShowNote={handleShowNote}
                      onMapClick={handleMapClick}
                      index={idx + 1}
                      activeFilter={selectedType}
                      onEditClick={handleEditClick}
                      rowNumber={rowNumbers[listing.id]}
                    />
                  ))}
                </div>
              </>
            ) : paginatedResults.length === 0 ? (
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
                      onEditClick={handleEditClick}
                      rowNumber={rowNumbers[listing.id]}
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
        ) : null
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
            ? visibleListings.find(l => l.id === selectedListings[0])?.columnV || ''
            : ''
        }
        listing={
          selectedListings.length > 0
            ? visibleListings.find(l => l.id === selectedListings[0]) ?? null
            : null
        }
        onSaveCoords={handleNotesCoordsSave}
      />

      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        centerListing={mapCenterListing}
        allListings={visibleListings}
        filteredListingsIds={new Set(displayedResults.map(l => l.id))}
        onNotesClick={handleSendForm}
        onShowNote={handleShowNote}
        fullScreen={true}
        initialPropertyTypes={selectedPropertyTypes}
        initialSaleTypes={
          selectedType === 'Sale' ? ['FOR SALE'] :
          selectedType === 'Lease' ? ['FOR LEASE'] :
          selectedType === 'Sale/Lease' ? ['FOR SALE', 'FOR LEASE'] :
          []
        }
        initialCategories={selectedCategory ? [selectedCategory.toUpperCase()] : []}
        initialDirect={selectedDirect}
        rowNumbers={rowNumbers}
      />

      <NoteModal
        isOpen={noteModalData.isOpen}
        onClose={() => setNoteModalData(prev => ({ ...prev, isOpen: false }))}
        content={noteModalData.content}
        title={noteModalData.title}
      />

      <EditListingModal
        isOpen={showEditModal}
        listing={editingListing}
        rowNumber={editingListing ? rowNumbers[editingListing.id] : undefined}
        onClose={() => {
          setShowEditModal(false);
          setEditingListing(null);
        }}
        onSave={handleListingEdit}
        groupName={groupBranding?.brandName || undefined}
      />

      <UserManagementModal
        isOpen={showUserManagement}
        onClose={() => setShowUserManagement(false)}
      />

      {/* Footer */}
      <footer className="w-full py-6 bg-white border-t border-gray-100 mt-12">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center gap-4">
          <div className="text-center text-xs sm:text-sm text-gray-400 max-w-2xl leading-relaxed">
            <p className="font-semibold text-gray-500 mb-1 tracking-wider">CONFIDENTIALITY NOTICE</p>
            <p>This site is exclusively for the privileged few. All listings are strictly confidential—do not distribute or share without prior notice. Prices and property details are subject to change at any time without notice.</p>
          </div>
          {(groupBranding?.messengerUrl || groupBranding?.facebookUrl || groupBranding?.instagramUrl || groupBranding?.tiktokUrl || groupBranding?.youtubeUrl) && (
            <div className="flex items-center justify-center gap-3">
              {groupBranding.messengerUrl && (
                <a href={groupBranding.messengerUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.03 2 11c0 2.87 1.43 5.39 3.75 7.03v3.74c0 .8.88 1.28 1.59.87l2.48-1.24c.71.13 1.45.2 2.18.2 5.52 0 10-4.03 10-9S17.52 2 12 2zm1 14.24-2.5-2.73-4.86 2.73 5.35-5.68 2.5 2.73 4.86-2.73-5.35 5.68z" />
                  </svg>
                </a>
              )}
              {groupBranding.facebookUrl && (
                <a href={groupBranding.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#1877F2] transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {groupBranding.instagramUrl && (
                <a href={groupBranding.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#E4405F] transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {groupBranding.tiktokUrl && (
                <a href={groupBranding.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-black transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
                  </svg>
                </a>
              )}
              {groupBranding.youtubeUrl && (
                <a href={groupBranding.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#FF0000] transition-colors">
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Auto-Refresh Prompt Toast */}
      {showRefreshPrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 px-6 py-4 flex flex-col gap-3 min-w-[340px] max-w-[420px]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Database Refresh Available</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Auto-refreshing in <span className="font-bold text-blue-600">{refreshCountdown}s</span>
                </p>
              </div>
            </div>
            {/* Countdown progress bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${(refreshCountdown / 10) * 100}%` }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRefreshPrompt(false);
                  setRefreshCountdown(10);
                  lastRefreshTimeRef.current = Date.now(); // Postpone for another 3 hours
                }}
                className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                DISMISS
              </button>
              <button
                onClick={handleRefresh}
                className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
              >
                REFRESH NOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Toast Notification */}
      {showShareToast && (
        <div className="fixed bottom-24 right-6 z-[999] animate-toast-slide-in">
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md px-5 py-4 rounded-2xl border border-gray-100 shadow-2xl transition-all duration-300">
            <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center shadow-inner">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Link copied!</p>
              <p className="text-xs text-gray-500 mt-1">The share link is ready.</p>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Sidebar */}
      {canUseViewingList && (
        <ViewingSidebar
          isOpen={showViewingSidebar}
          onClose={() => setShowViewingSidebar(false)}
          isListViewActive={showViewingListView}
          onListViewChange={setShowViewingListView}
          onShare={handleShareViewingList}
          onSelectGeoId={handleSelectViewingGeoId}
        />
      )}

      {/* Viewing FAB — bottom-right floating button */}
      {canUseViewingList && viewingList.length > 0 && (
        <button
          onClick={() => setShowViewingSidebar(v => !v)}
          className="fixed bottom-6 right-6 z-[800] flex items-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-2xl shadow-2xl transition-all duration-200 uppercase tracking-widest"
          title="Toggle Viewing List"
        >
          <Eye size={15} />
          <span>{viewingList.length}</span>
        </button>
      )}
    </div >
  );
}

export default App;
