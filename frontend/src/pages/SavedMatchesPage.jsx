import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { getFavoriteMatches, removeFavoriteMatch } from '@/services/messages';
import { Button } from '@/components/ui/button';
import { Bookmark, Trash2, Loader2, ArrowLeft, Clock, Radio } from 'lucide-react';

// ============ Saved Match Card ============
const SavedMatchCard = memo(({ match, onRemove, removing }) => {
  const navigate = useNavigate();
  const statusColor = match.status === 'LIVE' || match.status === 'IN_PLAY'
    ? 'text-emerald-400' : match.status === 'FINISHED'
    ? 'text-muted-foreground' : 'text-amber-400';
  const statusIcon = match.status === 'LIVE' || match.status === 'IN_PLAY'
    ? Radio : Clock;
  const StatusIcon = statusIcon;
  const statusLabel = match.status === 'LIVE' || match.status === 'IN_PLAY'
    ? 'LIVE' : match.status === 'FINISHED'
    ? 'Ended' : match.status || 'Scheduled';

  const matchDate = match.date_time
    ? new Date(match.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className="bg-card rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
      data-testid={`saved-match-${match.match_id}`}
      onClick={() => navigate(`/match/${match.match_id}`)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">{match.competition}</span>
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${statusColor}`}>
            <StatusIcon className="w-3 h-3" />
            {statusLabel}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(match.match_id); }}
          disabled={removing}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
          data-testid={`remove-saved-${match.match_id}`}
        >
          {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Teams */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary overflow-hidden">
            {match.home_crest ? (
              <img src={match.home_crest} alt="" className="w-5 h-5 object-contain" />
            ) : '⚽'}
          </div>
          <span className="text-base font-medium text-foreground flex-1">{match.home_team}</span>
          {(match.score_home !== null && match.score_home !== undefined) && (
            <span className="text-lg font-bold text-foreground tabular-nums">{match.score_home}</span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary overflow-hidden">
            {match.away_crest ? (
              <img src={match.away_crest} alt="" className="w-5 h-5 object-contain" />
            ) : '⚽'}
          </div>
          <span className="text-base font-medium text-foreground flex-1">{match.away_team}</span>
          {(match.score_away !== null && match.score_away !== undefined) && (
            <span className="text-lg font-bold text-foreground tabular-nums">{match.score_away}</span>
          )}
        </div>
      </div>

      {/* Footer */}
      {matchDate && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <span className="text-[11px] text-muted-foreground">{matchDate}</span>
        </div>
      )}
    </div>
  );
});
SavedMatchCard.displayName = 'SavedMatchCard';

// ============ Skeleton ============
const CardSkeleton = () => (
  <div className="bg-card rounded-xl border border-border/50 p-4 animate-pulse">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-3 w-20 bg-muted rounded" />
      <div className="h-3 w-12 bg-muted rounded" />
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-muted" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-muted" />
        <div className="h-4 w-28 bg-muted rounded" />
      </div>
    </div>
  </div>
);

// ============ Main Page ============
export const SavedMatchesPage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);

  const fetchSaved = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFavoriteMatches();
      setMatches(data.favorites || []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const handleRemove = useCallback(async (matchId) => {
    try {
      setRemovingId(matchId);
      await removeFavoriteMatch(matchId);
      setMatches(prev => prev.filter(m => m.match_id !== matchId));
    } catch {} finally {
      setRemovingId(null);
    }
  }, []);

  const handleLogout = useCallback(() => { logout(); navigate('/login'); }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-background" data-testid="saved-matches-page">
      <Header user={user} isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <main className="container mx-auto px-4 md:px-6 py-8 max-w-4xl">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-primary" />
              Saved Matches
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {matches.length} match{matches.length !== 1 ? 'es' : ''} saved
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : matches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {matches.map(m => (
              <SavedMatchCard
                key={m.match_id}
                match={m}
                onRemove={handleRemove}
                removing={removingId === m.match_id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Bookmark className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No saved matches</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Bookmark matches from the homepage to see them here
            </p>
            <Button onClick={() => navigate('/')} data-testid="browse-matches-btn">
              Browse Matches
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default SavedMatchesPage;
