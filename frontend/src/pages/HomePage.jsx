import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PromoBanner } from '@/components/home/PromoBanner';
import { TabsSection } from '@/components/home/TabsSection';
import { LeagueFilters } from '@/components/home/LeagueFilters';
import { MatchFilters } from '@/components/home/MatchFilters';
import { HomeSidebar } from '@/components/home/HomeSidebar';

import { MatchList } from '@/components/home/MatchList';
import { useAuth } from '@/lib/AuthContext';
import { getMyPredictions, savePrediction } from '@/services/predictions';
import { getFavoriteClubs, addFavoriteClub, removeFavoriteClub } from '@/services/favorites';
import { getFavoriteMatches, addFavoriteMatch, removeFavoriteMatch } from '@/services/messages';
import { fetchMatches, fetchLiveMatches, fetchCompetitionMatches, getStaleCachedMatches, fetchEndedMatches } from '@/services/matches';
import { formatLocalDateTime } from '@/utils/formatTime';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { mockBannerSlides } from '@/data/mockData';
import { toast } from 'sonner';
import { Loader2, Wifi, WifiOff, LayoutGrid, List, Heart, Clock, Bookmark, Radio, TrendingUp, ChevronUp } from 'lucide-react';

// League filters - maps to competition codes
const leagueFilters = [
  { id: 'all', name: 'All Matches', active: false },
  { id: 'live', name: 'Live', active: false },
  { id: 'CL', name: 'UCL', active: true },
  { id: 'PL', name: 'Premier League', active: false },
  { id: 'PD', name: 'La Liga', active: false },
  { id: 'SA', name: 'Serie A', active: false },
  { id: 'BL1', name: 'Bundesliga', active: false },
  { id: 'FL1', name: 'Ligue 1', active: false },
];

const baseTabs = [
  { id: 'top-matches', name: 'Top Matches', icon: 'fire' },
  { id: 'popular', name: 'Popular', active: true },
  { id: 'top-live', name: 'Top Live' },
  { id: 'soon', name: 'Soon' },
  { id: 'ended', name: 'Ended' },
];

// ============ Loading Skeleton ============
const MatchSkeleton = ({ delay = 0 }) => (
  <div className="match-skeleton" style={{ animationDelay: `${delay}ms` }}>
    {/* Meta bar: status badge + datetime + competition */}
    <div className="flex items-center gap-2 mb-3">
      <div className="skeleton-line w-14 h-5 rounded-full" />
      <div className="skeleton-line w-20 h-3" />
      <div className="skeleton-line w-1 h-3 hidden sm:block" />
      <div className="skeleton-line w-28 h-3 hidden sm:block" />
      <div className="ml-auto skeleton-line w-5 h-5 rounded" />
    </div>
    {/* Teams: number + crest + name */}
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="skeleton-line w-3 h-3" />
        <div className="skeleton-circle w-6 h-6 sm:w-7 sm:h-7" />
        <div className="skeleton-line h-4 flex-1 max-w-[140px]" />
      </div>
      <div className="flex items-center justify-center py-0.5">
        <div className="skeleton-line w-5 h-3" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="skeleton-line w-3 h-3" />
        <div className="skeleton-circle w-6 h-6 sm:w-7 sm:h-7" />
        <div className="skeleton-line h-4 flex-1 max-w-[120px]" />
      </div>
    </div>
    {/* Vote buttons + action buttons */}
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 mt-3">
      <div className="flex items-center gap-1 flex-1">
        <div className="skeleton-line h-14 sm:h-16 flex-1 rounded-lg" />
        <div className="skeleton-line h-14 sm:h-16 flex-1 rounded-lg" />
        <div className="skeleton-line h-14 sm:h-16 flex-1 rounded-lg" />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="skeleton-line h-14 sm:h-16 w-16 sm:w-20 rounded-xl" />
        <div className="skeleton-line h-14 sm:h-16 w-14 sm:w-16 rounded-xl" />
        <div className="skeleton-line h-14 sm:h-16 w-14 sm:w-16 rounded-xl" />
      </div>
    </div>
    {/* Footer stats */}
    <div className="flex items-center gap-3 pt-2.5 mt-2.5 border-t border-border/20">
      <div className="skeleton-line w-20 h-3" />
      <div className="skeleton-line w-24 h-3" />
    </div>
  </div>
);

const MatchSkeletonGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 skeleton-grid-stable" data-testid="match-skeleton-grid">
    {[...Array(6)].map((_, i) => <MatchSkeleton key={i} delay={i * 60} />)}
  </div>
);

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('top-matches');
  const [activeLeague, setActiveLeague] = useState('all');

  // === New mobile-first match filters ===
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Selected league filter (competition name) — set when user taps a league header
  const [selectedLeague, setSelectedLeague] = useState(null);
  // Initialize from cache to prevent loading flash on navigation
  const [matches, setMatches] = useState(() => {
    const cached = getStaleCachedMatches('all');
    return (cached && cached.matches) ? cached.matches : [];
  });
  const [isLoadingMatches, setIsLoadingMatches] = useState(() => {
    const cached = getStaleCachedMatches('all');
    return !(cached && cached.matches && cached.matches.length > 0);
  });
  const [matchError, setMatchError] = useState(null);
  // Track whether initial fetch has completed — prevents error flash before first response
  // If we have cached data, consider initial fetch as done to avoid skeleton flash
  const hasCachedData = !!(getStaleCachedMatches('all')?.matches?.length > 0);
  const initialFetchDone = useRef(hasCachedData);
  // Monotonically increasing fetch ID — only the latest fetch can modify state
  // This prevents race conditions between auto-refresh, filter switches, and retries
  const fetchIdRef = useRef(0);

  // View mode
  const [viewMode, setViewMode] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('guessit-view-mode')) || 'grid'
  );
  const [viewTransitioning, setViewTransitioning] = useState(false);

  // Saved predictions from backend
  const [savedPredictions, setSavedPredictions] = useState({});

  // Favorites state
  const [favoriteTeamIds, setFavoriteTeamIds] = useState(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);


  // Banner slides state
  const [bannerSlides, setBannerSlides] = useState([]);

  // Favorite matches state
  const [favoriteMatchIds, setFavoriteMatchIds] = useState(new Set());
  const [favoriteMatchList, setFavoriteMatchList] = useState([]);

  // Ended matches state
  const [endedMatches, setEndedMatches] = useState([]);
  const [endedLoading, setEndedLoading] = useState(false);

  // Filter animation key — triggers re-animation on filter change
  const [filterKey, setFilterKey] = useState(0);

  // AbortController ref for cancelling in-flight requests
  const abortControllerRef = useRef(null);

  // Real authentication from AuthContext
  const { user, isAuthenticated, logout } = useAuth();

  // Build tabs: add Favorite tab only when authenticated
  const tabs = isAuthenticated
    ? [...baseTabs, { id: 'favorite', name: 'Favorite', icon: 'heart' }]
    : baseTabs;

  // Location for highlight from search navigation
  const location = useLocation();

  // Handle match highlight from search or navigation
  const handleMatchHighlight = useCallback((matchId) => {
    // Small delay to allow DOM to render
    setTimeout(() => {
      const el = document.querySelector(`[data-match-id="${matchId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('match-highlight');
        setTimeout(() => el.classList.remove('match-highlight'), 2500);
      }
    }, 200);
  }, []);

  // Check for highlight state from navigation (search on a different page)
  useEffect(() => {
    if (location.state?.highlightMatchId) {
      handleMatchHighlight(location.state.highlightMatchId);
      // Clear the state to avoid re-highlighting on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state, handleMatchHighlight]);

  // Ref to avoid stale closures in WebSocket callback
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  // Finished matches extracted from main data for the Ended tab
  const finishedMatches = useMemo(() => {
    const finished = matches.filter(m =>
      m.status === 'FINISHED' || m.status === 'AFTER_EXTRA_TIME' || m.status === 'PENALTY_SHOOTOUT'
    );
    // Sort by date descending (most recent first)
    return finished.sort((a, b) => {
      const da = a.utcDate ? new Date(a.utcDate) : new Date(0);
      const db = b.utcDate ? new Date(b.utcDate) : new Date(0);
      return db - da;
    });
  }, [matches]);

  // Filter out FINISHED matches — they belong ONLY in the Ended tab
  const activeMatches = useMemo(() => {
    return matches.filter(match => 
      match.status !== 'FINISHED' && 
      match.status !== 'AFTER_EXTRA_TIME' && 
      match.status !== 'PENALTY_SHOOTOUT'
    );
  }, [matches]);

  // Tab-specific filtered matches
  const tabFilteredMatches = useMemo(() => {
    switch (activeTab) {
      case 'popular': {
        // Top 10 matches with highest number of user predictions, sorted by most guessed first
        const sorted = [...activeMatches].sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
        return sorted.slice(0, 10);
      }
      case 'top-live': {
        // Top 10 live matches with highest number of user predictions
        const liveOnly = activeMatches.filter(m => m.status === 'LIVE' || m.status === 'IN_PLAY' || m.status === 'HALFTIME' || m.status === 'PAUSED');
        const sorted = [...liveOnly].sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0));
        return sorted.slice(0, 10);
      }
      case 'soon': {
        // All upcoming/scheduled matches (sorted soonest first)
        const scheduled = matches.filter(m =>
          m.status === 'NOT_STARTED' || m.status === 'TIMED' || m.status === 'SCHEDULED'
        );
        // Sort by date ascending (soonest first)
        scheduled.sort((a, b) => {
          const da = a.utcDate ? new Date(a.utcDate) : new Date(0);
          const db = b.utcDate ? new Date(b.utcDate) : new Date(0);
          return da - db;
        });
        return scheduled;
      }
      case 'top-matches':
      default:
        // Default: show upcoming + live matches sorted by kickoff time (soonest first)
        return [...activeMatches].sort((a, b) => {
          // Live matches first
          const aLive = ['LIVE', 'IN_PLAY', 'HALFTIME', 'PAUSED'].includes(a.status) ? 0 : 1;
          const bLive = ['LIVE', 'IN_PLAY', 'HALFTIME', 'PAUSED'].includes(b.status) ? 0 : 1;
          if (aLive !== bLive) return aLive - bLive;
          // Then by date ascending
          const da = a.utcDate ? new Date(a.utcDate) : new Date(0);
          const db = b.utcDate ? new Date(b.utcDate) : new Date(0);
          return da - db;
        });
    }
  }, [activeTab, activeMatches, matches]);

  // ============ NEW: Mobile-first date + category filter pipeline ============
  const liveMatchCount = useMemo(
    () =>
      matches.filter((m) =>
        ['LIVE', 'IN_PLAY', 'HALFTIME', 'PAUSED'].includes(m.status)
      ).length,
    [matches]
  );

  // Helper: compare a match's local date with selectedDate (YYYY-MM-DD)
  const matchLocalISO = (m) => {
    if (!m.utcDate) return null;
    const d = new Date(m.utcDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const filteredMatches = useMemo(() => {
    // 1. Date filter — skipped for personal categories (favorites / predictions)
    //    so users see ALL their saved/predicted matches regardless of date.
    const skipDateFilter = selectedCategory === 'favorites' || selectedCategory === 'predictions';
    let result;
    if (skipDateFilter) {
      result = [...matches];
    } else if (selectedDate === 'live') {
      result = matches.filter((m) =>
        ['LIVE', 'IN_PLAY', 'HALFTIME', 'PAUSED'].includes(m.status)
      );
    } else {
      result = matches.filter((m) => matchLocalISO(m) === selectedDate);
    }

    // 2. League filter (when a specific league is tapped from a header)
    if (selectedLeague) {
      result = result.filter((m) => (m.competition || '') === selectedLeague);
    }

    // 3. Category filter
    if (selectedCategory === 'top') {
      // Top by total user predictions (engagement); break tie by date asc
      result = [...result].sort((a, b) => {
        const av = a.totalVotes || 0;
        const bv = b.totalVotes || 0;
        if (bv !== av) return bv - av;
        const da = a.utcDate ? new Date(a.utcDate) : new Date(0);
        const db = b.utcDate ? new Date(b.utcDate) : new Date(0);
        return da - db;
      });
    } else if (selectedCategory === 'favorites') {
      // Show matches whose home OR away club is in user's favorite clubs
      // (also keep manually-bookmarked matches working)
      result = result.filter((m) => {
        const homeFav = m.homeTeam?.id != null && favoriteTeamIds.has(m.homeTeam.id);
        const awayFav = m.awayTeam?.id != null && favoriteTeamIds.has(m.awayTeam.id);
        const matchFav = favoriteMatchIds.has(m.id);
        return homeFav || awayFav || matchFav;
      });
    } else if (selectedCategory === 'predictions') {
      // Match by string-normalized ID to avoid type mismatch (BUG FIX)
      result = result.filter((m) => !!savedPredictions[String(m.id)]);
    }

    return result;
  }, [matches, selectedDate, selectedCategory, selectedLeague, favoriteMatchIds, favoriteTeamIds, savedPredictions]);

  const handleDateChange = useCallback((id) => {
    setSelectedDate(id);
    setFilterKey((k) => k + 1);
  }, []);

  const handleCategoryChange = useCallback((id) => {
    setSelectedCategory(id);
    setFilterKey((k) => k + 1);
  }, []);

  // Tapping a league header filters the list to that competition
  const handleLeagueClick = useCallback((competition) => {
    setSelectedLeague((prev) => (prev === competition ? null : competition));
    setFilterKey((k) => k + 1);
    const filterEl = document.querySelector('[data-testid="match-filters"]');
    if (filterEl) {
      filterEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleClearLeagueFilter = useCallback(() => {
    setSelectedLeague(null);
    setFilterKey((k) => k + 1);
  }, []);


  // Handle live WebSocket updates
  const handleLiveUpdate = useCallback((data) => {
    if (!data || !data.matches) return;

    const updatedMatches = data.matches;
    
    if (data.type === 'live_update') {
      // Live update: merge live match data into current matches
      setMatches(prev => {
        const matchMap = new Map(prev.map(m => [m.id, m]));

        updatedMatches.forEach(updated => {
          const existing = matchMap.get(updated.id);
          if (existing) {
            // Preserve featured status from initial load
            matchMap.set(updated.id, { ...updated, featured: existing.featured });
          } else {
            // New live match — add it
            matchMap.set(updated.id, updated);
          }
        });

        return Array.from(matchMap.values());
      });
    } else if (data.type === 'today_update') {
      // Today update: merge today's matches (status changes, score updates, newly started)
      setMatches(prev => {
        const matchMap = new Map(prev.map(m => [m.id, m]));

        updatedMatches.forEach(updated => {
          const existing = matchMap.get(updated.id);
          if (existing) {
            // Update status, score, matchMinute, etc. while preserving featured
            matchMap.set(updated.id, { ...updated, featured: existing.featured });
          } else {
            matchMap.set(updated.id, updated);
          }
        });

        return Array.from(matchMap.values());
      });
    } else {
      // Fallback: generic merge
      setMatches(prev => {
        const matchMap = new Map(prev.map(m => [m.id, m]));
        updatedMatches.forEach(updated => {
          const existing = matchMap.get(updated.id);
          if (existing) {
            matchMap.set(updated.id, { ...updated, featured: existing.featured });
          } else {
            matchMap.set(updated.id, updated);
          }
        });
        return Array.from(matchMap.values());
      });
    }
  }, []);

  // Connect to WebSocket for live updates (defined before loadMatches — reconnect handled via ref)
  const loadMatchesRef = useRef(null);
  const activeLeagueRef = useRef(activeLeague);
  activeLeagueRef.current = activeLeague;

  // Force refresh matches on WebSocket reconnection
  const handleWsReconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    if (loadMatchesRef.current) {
      loadMatchesRef.current(activeLeagueRef.current, controller.signal);
    }
  }, []);

  const { isConnected } = useLiveMatches(handleLiveUpdate, handleWsReconnect);


  // Fetch carousel banners
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/football/banners`);
        if (response.ok) {
          const data = await response.json();
          // Transform to match the new card format
          const formattedBanners = data.banners.map(b => ({
            id: b.banner_id,
            image: b.image_url?.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${b.image_url}` : b.image_url,
            score: b.score || null,
            homeCrest: b.home_crest || null,
            awayCrest: b.away_crest || null,
            details: b.details || null,
            label: b.title || null,
            badge: b.badge || null,
          }));
          setBannerSlides(formattedBanners.length > 0 ? formattedBanners : mockBannerSlides);
        } else {
          setBannerSlides(mockBannerSlides);
        }
      } catch (error) {
        console.error('Failed to fetch banners:', error);
        setBannerSlides(mockBannerSlides);
      }
    };
    fetchBanners();
  }, []);

  // Fetch matches from API (with cache support + automatic retry + stale-fetch protection)
  const loadMatches = useCallback(async (leagueId, signal) => {
    // Claim a unique fetch ID — only THIS fetch can update state
    const myFetchId = ++fetchIdRef.current;

    // Show stale cached data instantly while refreshing
    const stale = getStaleCachedMatches(leagueId);
    if (stale && stale.matches && stale.matches.length > 0) {
      setMatches(stale.matches);
      setIsLoadingMatches(false);
    } else {
      // No cache — clear matches immediately and show skeleton
      setMatches([]);
      setIsLoadingMatches(true);
    }
    setMatchError(null);

    // Helper: check if this fetch is still the active one
    const isStale = () => signal?.aborted || fetchIdRef.current !== myFetchId;

    // Helper to perform a single fetch attempt
    const doFetch = async () => {
      if (leagueId === 'live') {
        return await fetchLiveMatches({ signal });
      } else if (leagueId === 'all') {
        return await fetchMatches({}, { signal });
      } else {
        return await fetchCompetitionMatches(leagueId, { signal });
      }
    };

    // Try up to 2 attempts (initial + 1 retry) before showing error
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await doFetch();

        // Only apply results if this is still the active fetch
        if (!isStale()) {
          if (data.matches && data.matches.length > 0) {
            setMatches(data.matches);
          } else if (!stale || !stale.matches || stale.matches.length === 0) {
            setMatches([]);
          }
          setIsLoadingMatches(false);
          setMatchError(null);
          initialFetchDone.current = true;
        }
        return; // Success — exit
      } catch (error) {
        // Ignore AbortError — means user switched filters or component unmounted
        if (error.name === 'AbortError') return;
        // If a newer fetch has been started, abandon this one silently
        if (isStale()) return;

        // If we still have retries left, wait briefly and try again
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`Match fetch attempt ${attempt} failed, retrying...`, error.message);
          await new Promise(resolve => setTimeout(resolve, 500));
          if (isStale()) return; // Bail if stale after waiting
          continue;
        }

        // Final attempt failed — show error only if still the active fetch
        console.error('Failed to fetch matches after retries:', error);
        if (!isStale()) {
          if (!stale || !stale.matches || stale.matches.length === 0) {
            setMatchError('Could not load matches. Please try again.');
            setMatches([]);
          }
          setIsLoadingMatches(false);
          initialFetchDone.current = true;
        }
      }
    }
  }, []);

  // Keep loadMatchesRef in sync for WebSocket reconnect handler
  loadMatchesRef.current = loadMatches;

  // Load matches on mount and when league changes — cancel previous request
  useEffect(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    loadMatches(activeLeague, controller.signal);

    return () => {
      controller.abort();
    };
  }, [activeLeague, loadMatches]);

  // Auto-refresh matches periodically (fallback for reliability)
  // Connected: every 120s (light refresh, WebSocket handles live)
  // Disconnected: every 30s (more aggressive, compensate for no WebSocket)
  useEffect(() => {
    let refreshController = null;
    const intervalMs = isConnected ? 120000 : 30000;
    const interval = setInterval(() => {
      // Abort previous auto-refresh if still in-flight
      if (refreshController) refreshController.abort();
      refreshController = new AbortController();
      loadMatches(activeLeague, refreshController.signal);
    }, intervalMs);

    return () => {
      clearInterval(interval);
      // Abort any in-flight auto-refresh on cleanup (filter switch / unmount)
      if (refreshController) refreshController.abort();
    };
  }, [activeLeague, isConnected, loadMatches]);

  // Fetch user's predictions on mount and when auth changes
  useEffect(() => {
    const fetchPredictions = async () => {
      if (isAuthenticated) {
        try {
          const data = await getMyPredictions();
          const predictionsMap = {};
          data.predictions.forEach(p => {
            // Normalize match_id to string to avoid type mismatch when filtering
            predictionsMap[String(p.match_id)] = p.prediction;
          });
          setSavedPredictions(predictionsMap);

          // Check for pending prediction from before login
          const pendingRaw = sessionStorage.getItem('pendingPrediction');
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              sessionStorage.removeItem('pendingPrediction');
              await savePrediction(pending.matchId, pending.prediction);
              setSavedPredictions(prev => ({
                ...prev,
                [String(pending.matchId)]: pending.prediction,
              }));
              toast.success('Prediction saved!', {
                description: 'Your pending prediction has been saved.',
                duration: 3000,
              });
            } catch (error) {
              console.error('Failed to save pending prediction:', error);
            }
          }
        } catch (error) {
          console.error('Failed to fetch predictions:', error);
        }
      } else {
        setSavedPredictions({});
      }
    };

    fetchPredictions();
  }, [isAuthenticated]);

  // Fetch favorite clubs when authenticated
  useEffect(() => {
    const fetchFavorites = async () => {
      if (isAuthenticated) {
        try {
          const data = await getFavoriteClubs();
          const ids = new Set((data.favorites || []).map(f => f.team_id));
          setFavoriteTeamIds(ids);
          setFavoritesLoaded(true);
        } catch (error) {
          console.error('Failed to fetch favorites:', error);
          setFavoritesLoaded(true);
        }
      } else {
        setFavoriteTeamIds(new Set());
        setFavoritesLoaded(false);
        // If user logs out while on Favorite tab, switch away
        if (activeTab === 'favorite') setActiveTab('popular');
      }
    };
    fetchFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Toggle favorite handler
  const handleToggleFavorite = useCallback(async (teamId, teamName, teamCrest, shouldAdd) => {
    try {
      if (shouldAdd) {
        await addFavoriteClub(teamId, teamName, teamCrest);
        setFavoriteTeamIds(prev => new Set([...prev, teamId]));
        toast.success('Added to favorites', { duration: 2000 });
      } else {
        await removeFavoriteClub(teamId);
        setFavoriteTeamIds(prev => {
          const next = new Set(prev);
          next.delete(teamId);
          return next;
        });
        toast.success('Removed from favorites', { duration: 2000 });
      }
    } catch (error) {
      toast.error('Could not update favorites', { description: 'Please try again.', duration: 3000 });
      throw error;
    }
  }, []);

  // Fetch favorite matches
  useEffect(() => {
    const fetchFavMatches = async () => {
      if (isAuthenticated) {
        try {
          const data = await getFavoriteMatches();
          const items = data.favorites || [];
          setFavoriteMatchList(items);
          setFavoriteMatchIds(new Set(items.map(f => f.match_id)));
        } catch (error) {
          console.error('Failed to fetch favorite matches:', error);
        }
      } else {
        setFavoriteMatchIds(new Set());
        setFavoriteMatchList([]);
      }
    };
    fetchFavMatches();
  }, [isAuthenticated]);

  // Toggle favorite match handler
  const handleToggleFavoriteMatch = useCallback(async (match, shouldAdd) => {
    try {
      if (shouldAdd) {
        await addFavoriteMatch({
          match_id: match.id,
          home_team: match.homeTeam?.name,
          away_team: match.awayTeam?.name,
          home_crest: match.homeTeam?.crest,
          away_crest: match.awayTeam?.crest,
          competition: match.competition,
          date_time: match.dateTime,
          utc_date: match.utcDate,
          status: match.status,
          score_home: match.score?.home,
          score_away: match.score?.away,
        });
        setFavoriteMatchIds(prev => new Set([...prev, match.id]));
        setFavoriteMatchList(prev => [...prev, {
          match_id: match.id,
          home_team: match.homeTeam?.name,
          away_team: match.awayTeam?.name,
          home_crest: match.homeTeam?.crest,
          away_crest: match.awayTeam?.crest,
          competition: match.competition,
          date_time: match.dateTime,
          utc_date: match.utcDate,
          status: match.status,
          score_home: match.score?.home,
          score_away: match.score?.away,
        }]);
      } else {
        await removeFavoriteMatch(match.id);
        setFavoriteMatchIds(prev => {
          const next = new Set(prev);
          next.delete(match.id);
          return next;
        });
        setFavoriteMatchList(prev => prev.filter(f => f.match_id !== match.id));
      }
    } catch (error) {
      console.error('Could not update bookmark:', error);
    }
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    // When switching to favorite tab, reset league to 'all'
    if (tabId === 'favorite') {
      setActiveLeague('all');
    }
    // When switching to ended tab, populate from finishedMatches if available, else fetch
    if (tabId === 'ended' && endedMatches.length === 0) {
      if (finishedMatches.length > 0) {
        setEndedMatches(finishedMatches);
      } else {
        // Fallback: fetch from dedicated endpoint
        setEndedLoading(true);
        const controller = new AbortController();
        fetchEndedMatches({ signal: controller.signal })
          .then(data => {
            if (!controller.signal.aborted) {
              setEndedMatches(data.matches || []);
            }
          })
          .catch(e => {
            if (e.name !== 'AbortError') console.error('Failed to fetch ended matches:', e);
          })
          .finally(() => {
            if (!controller.signal.aborted) setEndedLoading(false);
          });
      }
    }
  }, [endedMatches.length, finishedMatches]);

  const handleLeagueChange = useCallback((leagueId) => {
    if (leagueId === activeLeague) return; // Prevent duplicate calls on same filter
    setActiveLeague(leagueId);
    setFilterKey(prev => prev + 1);
    // Immediately clear old matches & show skeleton for responsive feel
    const stale = getStaleCachedMatches(leagueId);
    if (!stale || !stale.matches || stale.matches.length === 0) {
      setMatches([]);
      setIsLoadingMatches(true);
    }
  }, [activeLeague]);

  const handlePredictionSaved = useCallback((matchId, prediction) => {
    const key = String(matchId);
    // Get the old prediction before updating
    const oldPrediction = savedPredictions[key] || null;

    // Update saved predictions
    setSavedPredictions(prev => {
      if (prediction === null) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: prediction };
    });

    // Optimistically update match vote counts/percentages
    if (prediction !== oldPrediction) {
      setMatches(prevMatches => prevMatches.map(match => {
        if (match.id !== matchId) return match;
        const votes = match.votes || {};
        const newVotes = {
          home: { count: votes.home?.count || 0, percentage: 0 },
          draw: { count: votes.draw?.count || 0, percentage: 0 },
          away: { count: votes.away?.count || 0, percentage: 0 },
        };

        // Decrement old vote
        if (oldPrediction && newVotes[oldPrediction]) {
          newVotes[oldPrediction].count = Math.max(0, newVotes[oldPrediction].count - 1);
        }
        // Increment new vote
        if (prediction && newVotes[prediction]) {
          newVotes[prediction].count += 1;
        }

        // Recalculate percentages
        const total = newVotes.home.count + newVotes.draw.count + newVotes.away.count;
        if (total > 0) {
          newVotes.home.percentage = Math.round((newVotes.home.count / total) * 100);
          newVotes.draw.percentage = Math.round((newVotes.draw.count / total) * 100);
          newVotes.away.percentage = Math.round((newVotes.away.count / total) * 100);
          const sum = newVotes.home.percentage + newVotes.draw.percentage + newVotes.away.percentage;
          if (sum !== 100) {
            const maxKey = Object.keys(newVotes).reduce((a, b) => newVotes[a].count >= newVotes[b].count ? a : b);
            newVotes[maxKey].percentage += (100 - sum);
          }
        }

        return {
          ...match,
          votes: newVotes,
          totalVotes: total,
          mostPicked: total > 0
            ? (newVotes.home.count >= newVotes.draw.count && newVotes.home.count >= newVotes.away.count ? '1'
              : newVotes.draw.count >= newVotes.away.count ? 'X' : '2')
            : '-',
        };
      }));
    }
  }, [savedPredictions]);

  const handleLogout = useCallback(async () => {
    await logout();
    setSavedPredictions({});
    toast.info('Logged out successfully', { duration: 2000 });
  }, [logout]);

  const handleViewModeChange = useCallback((mode) => {
    if (mode === viewMode || viewTransitioning) return;
    setViewTransitioning(true);
    // After fade-out animation completes, swap layout and fade in
    setTimeout(() => {
      setViewMode(mode);
      localStorage.setItem('guessit-view-mode', mode);
      // Small extra frame to let React render new layout before fading in
      requestAnimationFrame(() => {
        setViewTransitioning(false);
      });
    }, 200);
  }, [viewMode, viewTransitioning]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        onMatchSelect={handleMatchHighlight}
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 xl:gap-8">
          {/* ===== Left column: matches ===== */}
          <div className="min-w-0">
            {/* Promo Banner */}
            {bannerSlides.length > 0 && <PromoBanner slides={bannerSlides} />}

            {/* Connection Status */}
            <div className="flex items-center mt-3 mb-1">
              {isConnected ? (
                <div className="flex items-center gap-1.5 text-xs text-primary" data-testid="ws-connected">
                  <Wifi className="w-3 h-3" />
                  <span>Live updates active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="ws-disconnected">
                  <WifiOff className="w-3 h-3" />
                  <span>Auto-refreshing every 30s</span>
                </div>
              )}
            </div>

        {/* === Match Filters: date + category (sticky) === */}
        <MatchFilters
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          liveCount={liveMatchCount}
          favoritesCount={favoriteMatchIds.size}
          predictionsCount={Object.keys(savedPredictions).length}
          isAuthenticated={isAuthenticated}
        />

        {/* Loading State — only show skeleton when no matches to display */}
        {isLoadingMatches && matches.length === 0 && (
          <div data-testid="match-loading-skeleton">
            <MatchSkeletonGrid />
          </div>
        )}

        {/* Error State */}
        {!isLoadingMatches && initialFetchDone.current && matchError && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="matches-error">
            <p className="text-muted-foreground">{matchError}</p>
            <button
              onClick={() => loadMatches(activeLeague)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* No Matches — based on filtered result */}
        {!isLoadingMatches && initialFetchDone.current && !matchError && matches.length > 0 && filteredMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 content-fade-in" data-testid="no-filtered-matches">
            <p className="text-lg text-foreground font-medium">
              {selectedCategory === 'favorites'
                ? 'No favorite matches yet'
                : selectedCategory === 'predictions'
                ? 'No predictions for this date'
                : selectedDate === 'live'
                ? 'No live matches right now'
                : 'No matches on this date'}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedCategory === 'favorites'
                ? 'Tap the bookmark icon on any match to save it here.'
                : selectedCategory === 'predictions'
                ? 'Make a prediction to track it here.'
                : 'Try a different date or category.'}
            </p>
          </div>
        )}

        {/* No Matches at all */}
        {!isLoadingMatches && initialFetchDone.current && !matchError && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 content-fade-in" data-testid="no-matches">
            <p className="text-lg text-foreground font-medium">No matches found</p>
            <p className="text-sm text-muted-foreground">No matches scheduled. Check back later!</p>
          </div>
        )}

        {/* Match Content — grouped by league */}
        {!isLoadingMatches && filteredMatches.length > 0 && (
          <div key={filterKey} className="match-list-animate-in content-fade-in">
            {selectedLeague && (
              <div
                className="flex items-center justify-between gap-3 mt-4 mb-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30"
                data-testid="league-filter-banner"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">League</span>
                  <span className="text-sm font-bold text-foreground truncate">{selectedLeague}</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearLeagueFilter}
                  className="text-xs font-semibold text-primary hover:text-primary/80 underline-offset-2 hover:underline whitespace-nowrap"
                  data-testid="clear-league-filter-btn"
                >
                  Show all leagues
                </button>
              </div>
            )}
            <MatchList
              matches={filteredMatches}
              savedPredictions={savedPredictions}
              onPredictionSaved={handlePredictionSaved}
              activeLeague={activeLeague}
              viewMode="list"
              favoriteTeamIds={favoriteTeamIds}
              onToggleFavorite={handleToggleFavorite}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={handleToggleFavoriteMatch}
              onLeagueClick={handleLeagueClick}
            />
          </div>
        )}
          </div>

          {/* ===== Right column: desktop-only sidebar ===== */}
          <div className="hidden lg:block">
            <div className="sticky top-[80px]">
              <HomeSidebar isAuthenticated={isAuthenticated} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Scroll to Top Button */}
      <ScrollToTopButton />
    </div>
  );
};

// ============ Scroll to Top Button ============
const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      const prev = lastScrollY.current;
      const scrollingDown = currentY > prev + 5;
      const scrollingUp = currentY < prev - 5;
      const nearTop = currentY <= 100;

      if (nearTop) {
        // At/near top → hide
        setVisible(false);
      } else if (scrollingUp) {
        // Scrolling up & not near top → show (and keep visible)
        setVisible(true);
      } else if (scrollingDown) {
        // Scrolling down → hide
        setVisible(false);
      }
      // If not scrolling (stopped) → do nothing, keep current state

      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      data-testid="scroll-to-top-btn"
      className={`fixed bottom-20 right-5 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-black/25 hover:bg-primary/90 active:scale-90 transition-all duration-300 ease-in-out md:hidden ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
};

export default HomePage;
