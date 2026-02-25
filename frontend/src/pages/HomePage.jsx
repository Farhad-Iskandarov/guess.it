import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PromoBanner } from '@/components/home/PromoBanner';
import { TabsSection } from '@/components/home/TabsSection';
import { LeagueFilters } from '@/components/home/LeagueFilters';

import { MatchList } from '@/components/home/MatchList';
import { useAuth } from '@/lib/AuthContext';
import { getMyPredictions, savePrediction } from '@/services/predictions';
import { getFavoriteClubs, addFavoriteClub, removeFavoriteClub } from '@/services/favorites';
import { getFavoriteMatches, addFavoriteMatch, removeFavoriteMatch } from '@/services/messages';
import { fetchMatches, fetchLiveMatches, fetchCompetitionMatches, getStaleCachedMatches, fetchEndedMatches } from '@/services/matches';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { mockBannerSlides } from '@/data/mockData';
import { toast } from 'sonner';
import { Loader2, Wifi, WifiOff, LayoutGrid, List, Heart, Clock, Bookmark, Radio, TrendingUp } from 'lucide-react';

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
const MatchSkeleton = () => (
  <div className="match-skeleton">
    <div className="flex items-center gap-2 mb-3">
      <div className="skeleton-line w-12 h-4" />
      <div className="skeleton-line w-20 h-4" />
      <div className="skeleton-line w-16 h-4" />
    </div>
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="skeleton-circle w-6 h-6" />
        <div className="skeleton-line w-24 h-4 flex-1" />
      </div>
      <div className="flex items-center gap-2">
        <div className="skeleton-circle w-6 h-6" />
        <div className="skeleton-line w-28 h-4 flex-1" />
      </div>
    </div>
    <div className="flex gap-2 mt-3">
      <div className="skeleton-line h-12 flex-1 rounded-lg" />
      <div className="skeleton-line h-12 flex-1 rounded-lg" />
      <div className="skeleton-line h-12 flex-1 rounded-lg" />
    </div>
  </div>
);

const MatchSkeletonGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
    {[...Array(4)].map((_, i) => <MatchSkeleton key={i} />)}
  </div>
);

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('top-matches');
  const [activeLeague, setActiveLeague] = useState('all');
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

  // Filter out FINISHED matches from main matches (they should only appear in Ended tab)
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
        // All matches scheduled for the next 3 days
        const now = new Date();
        const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const scheduled = matches.filter(m => {
          if (m.status !== 'NOT_STARTED' && m.status !== 'TIMED' && m.status !== 'SCHEDULED') return false;
          const matchDate = m.utcDate ? new Date(m.utcDate) : null;
          if (!matchDate) return false;
          return matchDate >= now && matchDate <= threeDaysLater;
        });
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
        return activeMatches;
    }
  }, [activeTab, activeMatches, matches]);


  // Handle live WebSocket updates
  const handleLiveUpdate = useCallback((data) => {
    if (!data || !data.matches) return;

    const updatedMatches = data.matches;
    setMatches(prev => {
      const matchMap = new Map(prev.map(m => [m.id, m]));

      updatedMatches.forEach(updated => {
        const existing = matchMap.get(updated.id);
        if (existing) {
          // Preserve featured status from initial load
          matchMap.set(updated.id, { ...updated, featured: existing.featured });
        } else {
          matchMap.set(updated.id, updated);
        }
      });

      return Array.from(matchMap.values());
    });
  }, []);

  // Connect to WebSocket for live updates
  const { isConnected } = useLiveMatches(handleLiveUpdate);


  // Fetch carousel banners
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/football/banners`);
        if (response.ok) {
          const data = await response.json();
          // Transform to match expected format
          const formattedBanners = data.banners.map(b => ({
            id: b.banner_id,
            badge: b.title,
            headline: b.title,
            highlightedText: '',
            subtitle: b.subtitle || '',
            ctaText: b.button_text || 'Get Started',
            ctaLink: b.button_link || '/register',
            image: b.image_url?.startsWith('/') ? `${process.env.REACT_APP_BACKEND_URL}${b.image_url}` : b.image_url
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

  // Fetch matches from API (with cache support)
  const loadMatches = useCallback(async (leagueId) => {
    // Show stale cached data instantly while refreshing
    const stale = getStaleCachedMatches(leagueId);
    if (stale && stale.matches && stale.matches.length > 0) {
      setMatches(stale.matches);
      setIsLoadingMatches(false);
    } else {
      setIsLoadingMatches(true);
    }
    setMatchError(null);

    try {
      let data;
      if (leagueId === 'live') {
        data = await fetchLiveMatches();
      } else if (leagueId === 'all') {
        data = await fetchMatches();
      } else {
        data = await fetchCompetitionMatches(leagueId);
      }

      if (data.matches && data.matches.length > 0) {
        setMatches(data.matches);
      } else if (!stale || !stale.matches || stale.matches.length === 0) {
        setMatches([]);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      if (!stale || !stale.matches || stale.matches.length === 0) {
        setMatchError('Failed to load matches. Please try again.');
        setMatches([]);
      }
    } finally {
      setIsLoadingMatches(false);
    }
  }, []);

  // Load matches on mount and when league changes
  useEffect(() => {
    loadMatches(activeLeague);
  }, [activeLeague, loadMatches]);

  // Auto-refresh matches every 60 seconds (fallback for non-WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected) {
        loadMatches(activeLeague);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [activeLeague, isConnected, loadMatches]);

  // Fetch user's predictions on mount and when auth changes
  useEffect(() => {
    const fetchPredictions = async () => {
      if (isAuthenticated) {
        try {
          const data = await getMyPredictions();
          const predictionsMap = {};
          data.predictions.forEach(p => {
            predictionsMap[p.match_id] = p.prediction;
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
                [pending.matchId]: pending.prediction,
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
      toast.error('Failed to update favorites', { description: error.message, duration: 3000 });
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
          status: match.status,
          score_home: match.score?.home,
          score_away: match.score?.away,
        }]);
        toast.success('Match bookmarked', { duration: 2000 });
      } else {
        await removeFavoriteMatch(match.id);
        setFavoriteMatchIds(prev => {
          const next = new Set(prev);
          next.delete(match.id);
          return next;
        });
        setFavoriteMatchList(prev => prev.filter(f => f.match_id !== match.id));
        toast.success('Bookmark removed', { duration: 2000 });
      }
    } catch (error) {
      toast.error('Failed to update bookmark', { description: error.message, duration: 3000 });
    }
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    // Only increment filterKey for league changes, not tab switches (tabs use client-side filtering)
    // When switching to favorite tab, reset league to 'all'
    if (tabId === 'favorite') {
      setActiveLeague('all');
    }
    // When switching to ended tab, fetch ended matches (with cache)
    if (tabId === 'ended' && endedMatches.length === 0) {
      setEndedLoading(true);
      fetchEndedMatches()
        .then(data => setEndedMatches(data.matches || []))
        .catch(e => console.error('Failed to fetch ended matches:', e))
        .finally(() => setEndedLoading(false));
    }
  }, [endedMatches.length]);

  const handleLeagueChange = useCallback((leagueId) => {
    setActiveLeague(leagueId);
    setFilterKey(prev => prev + 1);
  }, []);

  const handlePredictionSaved = useCallback((matchId, prediction) => {
    setSavedPredictions(prev => {
      if (prediction === null) {
        const next = { ...prev };
        delete next[matchId];
        return next;
      }
      return { ...prev, [matchId]: prediction };
    });
  }, []);

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
        {/* Promo Banner */}
        {bannerSlides.length > 0 && <PromoBanner slides={bannerSlides} />}

        {/* Tabs */}
        <TabsSection tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

        {/* League Filters */}
        <LeagueFilters
          leagues={leagueFilters}
          activeLeague={activeLeague}
          onLeagueChange={handleLeagueChange}
        />

        {/* Connection Status + View Toggle */}
        <div className="flex items-center justify-between mt-3 mb-2">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1.5 text-xs text-primary" data-testid="ws-connected">
                <Wifi className="w-3 h-3" />
                <span>Live updates active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="ws-disconnected">
                <WifiOff className="w-3 h-3" />
                <span>Auto-refreshing every 60s</span>
              </div>
            )}
          </div>

          {/* View Toggle - hidden on mobile */}
          <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary border border-border" data-testid="view-toggle">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              data-testid="view-toggle-grid"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              data-testid="view-toggle-list"
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {/* Loading State - Skeleton */}
        {isLoadingMatches && matches.length === 0 && activeTab !== 'ended' && (
          <MatchSkeletonGrid />
        )}

        {/* Error State */}
        {matchError && matches.length === 0 && (
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

        {/* No Matches */}
        {!isLoadingMatches && !matchError && matches.length === 0 && activeTab !== 'favorite' && activeTab !== 'ended' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="no-matches">
            <p className="text-lg text-foreground font-medium">No matches found</p>
            <p className="text-sm text-muted-foreground">
              {activeLeague === 'live'
                ? 'No live matches at the moment. Check back later!'
                : 'No matches scheduled for this filter. Try a different league or date range.'}
            </p>
          </div>
        )}

        {/* Tab-specific empty states */}
        {!isLoadingMatches && matches.length > 0 && tabFilteredMatches.length === 0 && activeTab !== 'favorite' && activeTab !== 'ended' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid={`no-${activeTab}-matches`}>
            {activeTab === 'top-live' && (
              <>
                <Radio className="w-12 h-12 text-red-500/30" />
                <p className="text-lg text-foreground font-medium">No live matches right now</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  There are no live matches at the moment. Check back during match hours!
                </p>
              </>
            )}
            {activeTab === 'popular' && (
              <>
                <TrendingUp className="w-12 h-12 text-primary/30" />
                <p className="text-lg text-foreground font-medium">No popular matches yet</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Matches with user predictions will appear here. Start guessing to see popular matches!
                </p>
              </>
            )}
            {activeTab === 'soon' && (
              <>
                <Clock className="w-12 h-12 text-blue-500/30" />
                <p className="text-lg text-foreground font-medium">No upcoming matches</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  No matches scheduled in the next 3 days. Check back later for new fixtures!
                </p>
              </>
            )}
          </div>
        )}

        {/* Favorite Tab Content */}
        {activeTab === 'favorite' && isAuthenticated && (
          <div key={`filter-fav-${filterKey}`} className={`match-list-animate-in view-switch-wrapper ${viewTransitioning ? 'view-switch-out' : 'view-switch-in'}`}>
            {(() => {
              const favoriteMatches = matches.filter(m =>
                favoriteTeamIds.has(m.homeTeam.id) || favoriteTeamIds.has(m.awayTeam.id)
              );
              if (favoriteTeamIds.size === 0 && favoriteMatchList.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 favorite-empty-state" data-testid="favorite-empty">
                    <Heart className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-lg text-foreground font-medium">No favorites yet</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Tap the heart icon or bookmark icon on any match card to add favorites.
                    </p>
                  </div>
                );
              }
              return (
                <>
                  {favoriteMatches.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-4 mb-3">
                        <Heart className="w-4 h-4 text-red-500" />
                        <h3 className="text-base font-semibold text-foreground">Favorite Clubs</h3>
                        <span className="text-xs text-muted-foreground">({favoriteMatches.length} matches)</span>
                      </div>
                      <MatchList
                        matches={favoriteMatches}
                        savedPredictions={savedPredictions}
                        onPredictionSaved={handlePredictionSaved}
                        activeLeague={activeLeague}
                        viewMode={viewMode}
                        favoriteTeamIds={favoriteTeamIds}
                        onToggleFavorite={handleToggleFavorite}
                        favoriteMatchIds={favoriteMatchIds}
                        onToggleFavoriteMatch={handleToggleFavoriteMatch}
                      />
                    </>
                  )}
                  {favoriteMatchList.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mt-6 mb-3">
                        <Bookmark className="w-4 h-4 text-amber-500" />
                        <h3 className="text-base font-semibold text-foreground">Bookmarked Matches</h3>
                        <span className="text-xs text-muted-foreground">({favoriteMatchList.length})</span>
                      </div>
                      <div className={`match-list-container ${viewMode === 'grid' ? 'match-view-grid' : 'match-view-list'}`}>
                        {favoriteMatchList.map(fav => (
                          <div key={fav.match_id} className="match-row-card rounded-xl border border-border bg-card hover:border-primary/30 transition-all p-3 sm:p-4" data-testid={`bookmarked-match-${fav.match_id}`}>
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm text-muted-foreground mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${fav.status === 'LIVE' ? 'bg-red-500/20 text-red-400' : fav.status === 'FINISHED' ? 'bg-muted text-muted-foreground' : 'bg-blue-500/15 text-blue-400'}`}>
                                {fav.status === 'LIVE' ? 'LIVE' : fav.status === 'FINISHED' ? 'FT' : fav.status || 'TBD'}
                              </span>
                              {fav.date_time && <span className="text-xs">{fav.date_time}</span>}
                              <span className="text-border hidden sm:inline">|</span>
                              <span className="truncate">{fav.competition}</span>
                              <div className="ml-auto">
                                <button onClick={() => handleToggleFavoriteMatch({ id: fav.match_id }, false)} className="p-1 rounded-md hover:bg-muted/50 transition-colors" data-testid={`remove-bookmark-${fav.match_id}`}>
                                  <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {fav.home_crest && <img src={fav.home_crest} alt="" className="w-5 h-5 rounded-full object-contain bg-secondary" />}
                                  <span className="text-sm font-medium truncate">{fav.home_team}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {fav.away_crest && <img src={fav.away_crest} alt="" className="w-5 h-5 rounded-full object-contain bg-secondary" />}
                                  <span className="text-sm font-medium truncate">{fav.away_team}</span>
                                </div>
                              </div>
                              {fav.score_home !== null && fav.score_home !== undefined && (
                                <div className="text-lg font-bold tabular-nums flex-shrink-0">
                                  <span>{fav.score_home}</span>
                                  <span className="text-muted-foreground mx-1">-</span>
                                  <span>{fav.score_away}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {favoriteMatches.length === 0 && favoriteMatchList.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 favorite-empty-state" data-testid="favorite-no-matches">
                      <Heart className="w-12 h-12 text-red-500/30" />
                      <p className="text-lg text-foreground font-medium">No matches for your favorites</p>
                      <p className="text-sm text-muted-foreground text-center max-w-md">
                        None of your favorite clubs have upcoming matches. Try bookmarking individual matches!
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Ended Matches Tab Content */}
        {activeTab === 'ended' && (
          <div key={`filter-ended-${filterKey}`} className={`match-list-animate-in ended-matches-section view-switch-wrapper ${viewTransitioning ? 'view-switch-out' : 'view-switch-in'}`} data-testid="ended-matches-section">
            {endedLoading ? (
              <MatchSkeletonGrid />
            ) : endedMatches.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mt-4 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-base font-semibold text-foreground">Recently Finished</h3>
                  <span className="text-xs text-muted-foreground">({endedMatches.length} matches in last 24h)</span>
                </div>
                <MatchList
                  matches={endedMatches}
                  savedPredictions={savedPredictions}
                  onPredictionSaved={handlePredictionSaved}
                  activeLeague="all"
                  viewMode={viewMode}
                  favoriteTeamIds={favoriteTeamIds}
                  onToggleFavorite={handleToggleFavorite}
                  favoriteMatchIds={favoriteMatchIds}
                  onToggleFavoriteMatch={handleToggleFavoriteMatch}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="no-ended-matches">
                <Clock className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-lg text-foreground font-medium">No recently ended matches</p>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Finished matches will appear here for 24 hours after the final whistle.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Match Content (non-favorite, non-ended tabs) */}
        {tabFilteredMatches.length > 0 && activeTab !== 'favorite' && activeTab !== 'ended' && (
          <div key={`filter-${activeLeague}`} className={`match-list-animate-in view-switch-wrapper ${viewTransitioning ? 'view-switch-out' : 'view-switch-in'}`}>
            {/* Tab-specific headers */}
            {activeTab === 'popular' && (
              <div className="flex items-center gap-2 mt-4 mb-3" data-testid="popular-header">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Most Predicted</h3>
                <span className="text-xs text-muted-foreground">(Top {tabFilteredMatches.length} by predictions)</span>
              </div>
            )}
            {activeTab === 'top-live' && (
              <div className="flex items-center gap-2 mt-4 mb-3" data-testid="top-live-header">
                <Radio className="w-4 h-4 text-red-500" />
                <h3 className="text-base font-semibold text-foreground">Top Live</h3>
                <span className="text-xs text-muted-foreground">({tabFilteredMatches.length} live matches)</span>
              </div>
            )}
            {activeTab === 'soon' && (
              <div className="flex items-center gap-2 mt-4 mb-3" data-testid="soon-header">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="text-base font-semibold text-foreground">Coming Up</h3>
                <span className="text-xs text-muted-foreground">({tabFilteredMatches.length} matches in next 3 days)</span>
              </div>
            )}
            {/* Full Match List */}
            <MatchList
              matches={tabFilteredMatches}
              savedPredictions={savedPredictions}
              onPredictionSaved={handlePredictionSaved}
              activeLeague={activeLeague}
              viewMode={viewMode}
              favoriteTeamIds={favoriteTeamIds}
              onToggleFavorite={handleToggleFavorite}
              favoriteMatchIds={favoriteMatchIds}
              onToggleFavoriteMatch={handleToggleFavoriteMatch}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;
