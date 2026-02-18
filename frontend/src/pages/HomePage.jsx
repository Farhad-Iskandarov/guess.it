import { useState, useCallback, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PromoBanner } from '@/components/home/PromoBanner';
import { TabsSection } from '@/components/home/TabsSection';
import { LeagueFilters } from '@/components/home/LeagueFilters';
import { TopMatchesCards } from '@/components/home/TopMatchesCards';
import { MatchList } from '@/components/home/MatchList';
import { useAuth } from '@/lib/AuthContext';
import { getMyPredictions, savePrediction } from '@/services/predictions';
import { 
  mockMatches, 
  mockLeagues, 
  mockTabs, 
  mockBannerSlides 
} from '@/data/mockData';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Mock notification counts (in real app, would come from backend)
const mockNotifications = {
  messages: 10,
  friends: 3,
  alerts: 5,
};

export const HomePage = () => {
  const [activeTab, setActiveTab] = useState('popular');
  const [activeLeague, setActiveLeague] = useState('ucl');
  
  // Saved predictions from backend
  const [savedPredictions, setSavedPredictions] = useState({});
  
  // Real authentication from AuthContext
  const { user, isAuthenticated, logout } = useAuth();

  // Fetch user's predictions on mount and when auth changes
  useEffect(() => {
    const fetchPredictions = async () => {
      if (isAuthenticated) {
        try {
          const data = await getMyPredictions();
          // Convert array to object keyed by match_id
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
              
              // Save the pending prediction
              const result = await savePrediction(pending.matchId, pending.prediction);
              setSavedPredictions(prev => ({
                ...prev,
                [pending.matchId]: pending.prediction
              }));
              
              toast.success('Prediction saved!', {
                description: `Your pending prediction has been saved.`,
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

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleLeagueChange = useCallback((leagueId) => {
    setActiveLeague(leagueId);
  }, []);

  // Handle when a prediction is saved
  const handlePredictionSaved = useCallback((matchId, prediction) => {
    setSavedPredictions(prev => ({
      ...prev,
      [matchId]: prediction
    }));
  }, []);

  // Logout handler
  const handleLogout = useCallback(async () => {
    await logout();
    setSavedPredictions({});
    toast.info('Logged out successfully', {
      duration: 2000,
    });
  }, [logout]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Shows different UI based on real auth state */}
      <Header 
        user={user} 
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        notifications={isAuthenticated ? mockNotifications : {}}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        {/* Promo Banner Carousel */}
        <PromoBanner slides={mockBannerSlides} />

        {/* Tabs Section */}
        <TabsSection 
          tabs={mockTabs} 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />

        {/* League Filters */}
        <LeagueFilters 
          leagues={mockLeagues} 
          activeLeague={activeLeague} 
          onLeagueChange={handleLeagueChange} 
        />

        {/* Top Matches Cards (Featured) */}
        <TopMatchesCards 
          matches={mockMatches} 
          savedPredictions={savedPredictions}
          onPredictionSaved={handlePredictionSaved}
        />

        {/* Full Match List */}
        <MatchList 
          matches={mockMatches} 
          savedPredictions={savedPredictions}
          onPredictionSaved={handlePredictionSaved}
          activeLeague={activeLeague}
        />
      </main>

      {/* Footer */}
      <Footer />

      {/* Toast Notifications */}
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
};

export default HomePage;
