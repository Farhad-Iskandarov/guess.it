import { useState, useCallback, useEffect, useRef } from 'react';
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
import { fetchMatches, fetchLiveMatches, fetchCompetitionMatches, getStaleCachedMatches } from '@/services/matches';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { mockBannerSlides } from '@/data/mockData';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Loader2, Wifi, WifiOff, LayoutGrid, List, Heart } from 'lucide-react';

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
];

const mockNotifications = {
  messages: 10,
  friends: 3,
  alerts: 5,
};

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('popular');
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

  // View mode: use ref + direct DOM toggle for instant CSS switch (no React re-render)
  const viewModeRef = useRef(
    (typeof window !== 'undefined' && localStorage.getItem('guessit-view-mode')) || 'grid'
  );
  const [viewMode, setViewMode] = useState(viewModeRef.current);
  const matchListRef = useRef(null);

  // Saved predictions from backend
  const [savedPredictions, setSavedPredictions] = useState({});

  // Favorites state
  const [favoriteTeamIds, setFavoriteTeamIds] = useState(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

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

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    // When switching to favorite tab, reset league to 'all' to show all matches
    if (tabId === 'favorite') {
      setActiveLeague('all');
    }
  }, []);

  const handleLeagueChange = useCallback((leagueId) => {
    setActiveLeague(leagueId);
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
    // Direct DOM class toggle for instant CSS switch - bypass React re-render
    viewModeRef.current = mode;
    setViewMode(mode); // Update button highlight state only
    localStorage.setItem('guessit-view-mode', mode);
    const container = matchListRef.current || document.querySelector('[data-testid="match-list-container"]');
    if (container) {
      container.className = `match-list-container ${mode === 'grid' ? 'match-view-grid' : 'match-view-list'}`;
      container.setAttribute('data-view-mode', mode);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        notifications={isAuthenticated ? mockNotifications : {}}
        onMatchSelect={handleMatchHighlight}
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        {/* Promo Banner */}
        <PromoBanner slides={mockBannerSlides} />

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

        {/* Loading State */}
        {isLoadingMatches && matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="matches-loading">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Loading matches...</p>
          </div>
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
        {!isLoadingMatches && !matchError && matches.length === 0 && activeTab !== 'favorite' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="no-matches">
            <p className="text-lg text-foreground font-medium">No matches found</p>
            <p className="text-sm text-muted-foreground">
              {activeLeague === 'live'
                ? 'No live matches at the moment. Check back later!'
                : 'No matches scheduled for this filter. Try a different league or date range.'}
            </p>
          </div>
        )}

        {/* Favorite Tab Content */}
        {activeTab === 'favorite' && isAuthenticated && (
          <>
            {(() => {
              const favoriteMatches = matches.filter(m =>
                favoriteTeamIds.has(m.homeTeam.id) || favoriteTeamIds.has(m.awayTeam.id)
              );
              if (favoriteTeamIds.size === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 favorite-empty-state" data-testid="favorite-empty">
                    <Heart className="w-12 h-12 text-muted-foreground/30" />
                    <p className="text-lg text-foreground font-medium">No favorite clubs yet</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Tap the heart icon next to any club name in a match card to add it to your favorites.
                    </p>
                  </div>
                );
              }
              if (favoriteMatches.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 favorite-empty-state" data-testid="favorite-no-matches">
                    <Heart className="w-12 h-12 text-red-500/30" />
                    <p className="text-lg text-foreground font-medium">No matches for your favorites</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      None of your favorite clubs have upcoming matches right now. Check back later!
                    </p>
                  </div>
                );
              }
              return (
                <MatchList
                  matches={favoriteMatches}
                  savedPredictions={savedPredictions}
                  onPredictionSaved={handlePredictionSaved}
                  activeLeague={activeLeague}
                  viewMode={viewMode}
                  favoriteTeamIds={favoriteTeamIds}
                  onToggleFavorite={handleToggleFavorite}
                />
              );
            })()}
          </>
        )}

        {/* Match Content (non-favorite tabs) */}
        {matches.length > 0 && activeTab !== 'favorite' && (
          <>
            {/* Full Match List */}
            <MatchList
              matches={matches}
              savedPredictions={savedPredictions}
              onPredictionSaved={handlePredictionSaved}
              activeLeague={activeLeague}
              viewMode={viewMode}
              favoriteTeamIds={favoriteTeamIds}
              onToggleFavorite={handleToggleFavorite}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Toast Notifications */}
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
};

export default HomePage;
