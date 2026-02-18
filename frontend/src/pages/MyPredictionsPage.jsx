import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import {
  Trophy, Clock, CheckCircle2, XCircle, AlertCircle,
  Radio, ArrowRight, Filter, TrendingUp, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ Filter Tab ============
const FilterTab = memo(({ label, value, active, count, onClick }) => (
  <button
    onClick={() => onClick(value)}
    data-testid={`filter-${value}`}
    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
      active
        ? 'bg-primary text-primary-foreground shadow-md'
        : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground border border-border/50'
    }`}
    style={{ transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease' }}
  >
    {label}
    {count > 0 && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
        active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {count}
      </span>
    )}
  </button>
));
FilterTab.displayName = 'FilterTab';

// ============ Summary Card ============
const SummaryCard = memo(({ icon: Icon, label, value, color }) => (
  <div
    className="flex items-center gap-3 bg-card rounded-xl p-4 border border-border/50 shadow-sm"
    data-testid={`summary-${label.toLowerCase()}`}
    style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0,0,0,0.15)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
  >
    <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
));
SummaryCard.displayName = 'SummaryCard';

// ============ Team Crest ============
const TeamCrest = memo(({ team }) => {
  if (team.crest) {
    return (
      <img
        src={team.crest}
        alt={team.name}
        className="w-7 h-7 rounded-full object-contain bg-secondary flex-shrink-0"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-sm flex-shrink-0">
      {team.flag || ''}
    </div>
  );
});
TeamCrest.displayName = 'TeamCrest';

// ============ Status Badge ============
const StatusBadge = memo(({ status, matchMinute }) => {
  if (status === 'LIVE') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/30">
          <Radio className="w-3 h-3 live-pulse-icon" />
          Live
        </span>
        {matchMinute && <span className="text-[11px] font-bold text-red-400 tabular-nums">{matchMinute}</span>}
      </div>
    );
  }
  if (status === 'FINISHED') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border">
        FT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/30">
      <Clock className="w-3 h-3" />
      Upcoming
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ============ Prediction Badge ============
const PredictionBadge = memo(({ prediction, result }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const fullLabels = { home: 'Home Win', draw: 'Draw', away: 'Away Win' };

  const colorMap = {
    correct: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10',
    wrong: 'bg-red-500/15 text-red-400 border-red-500/30 shadow-red-500/10',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-amber-500/10',
  };

  const iconMap = {
    correct: <CheckCircle2 className="w-4 h-4" />,
    wrong: <XCircle className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />,
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${colorMap[result]}`} data-testid="prediction-badge">
      {iconMap[result]}
      <span className="font-bold text-lg">{labels[prediction]}</span>
      <span className="text-xs opacity-80">{fullLabels[prediction]}</span>
    </div>
  );
});
PredictionBadge.displayName = 'PredictionBadge';

// ============ Prediction Card ============
const PredictionCard = memo(({ data, index }) => {
  const { prediction, match, result, created_at } = data;

  if (!match) {
    return (
      <div
        className="bg-card rounded-xl p-5 border border-border/50 opacity-60"
        data-testid={`prediction-card-${index}`}
      >
        <p className="text-sm text-muted-foreground">Match data unavailable (match ID: {data.match_id})</p>
        <PredictionBadge prediction={prediction} result="pending" />
      </div>
    );
  }

  const borderColor = {
    correct: 'border-emerald-500/30 hover:border-emerald-500/50',
    wrong: 'border-red-500/20 hover:border-red-500/40',
    pending: 'border-border/50 hover:border-border',
  };

  const bgAccent = {
    correct: 'bg-emerald-500/[0.03]',
    wrong: 'bg-red-500/[0.02]',
    pending: '',
  };

  const votedDate = created_at ? new Date(created_at) : null;
  const votedStr = votedDate
    ? votedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      votedDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`prediction-card bg-card ${bgAccent[result]} rounded-xl border overflow-hidden ${borderColor[result]}`}
      data-testid={`prediction-card-${index}`}
      style={{
        animationDelay: `${index * 60}ms`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px -8px rgba(0,0,0,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Top meta bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={match.status} matchMinute={match.matchMinute} />
          <span>{match.dateTime}</span>
          <span className="text-border">|</span>
          <span className="truncate">{match.competition}</span>
        </div>
        {result === 'correct' && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Correct
          </span>
        )}
        {result === 'wrong' && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
            <XCircle className="w-3.5 h-3.5" /> Wrong
          </span>
        )}
      </div>

      {/* Match content */}
      <div className="px-5 py-3">
        <div className="flex items-center gap-4">
          {/* Teams */}
          <div className="flex flex-col gap-2.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0">1</span>
              <TeamCrest team={match.homeTeam} />
              <span className="text-sm font-medium text-foreground truncate">{match.homeTeam.name}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0">2</span>
              <TeamCrest team={match.awayTeam} />
              <span className="text-sm font-medium text-foreground truncate">{match.awayTeam.name}</span>
            </div>
          </div>

          {/* Score */}
          <div className="score-block flex flex-col items-center justify-center">
            {match.status === 'LIVE' && match.matchMinute ? (
              <span className="text-xs font-semibold text-red-400 tabular-nums mb-1">{match.matchMinute}</span>
            ) : (
              <span className="text-xs mb-1 invisible">00'</span>
            )}
            {match.score.home !== null ? (
              <div className="flex items-center gap-1.5 text-2xl font-bold tabular-nums">
                <span className="text-foreground">{match.score.home}</span>
                <span className="text-muted-foreground/50 text-lg">-</span>
                <span className="text-foreground">{match.score.away}</span>
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">vs</span>
            )}
          </div>

          {/* User prediction */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Your Pick</span>
            <PredictionBadge prediction={prediction} result={result} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-muted/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>Voted on: {votedStr}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Total votes: <span className="text-foreground font-medium">{match.totalVotes}</span></span>
        </div>
      </div>
    </div>
  );
});
PredictionCard.displayName = 'PredictionCard';

// ============ Empty State ============
const EmptyState = memo(({ filter }) => {
  const navigate = useNavigate();
  const message = filter === 'all'
    ? "You haven't made any predictions yet."
    : `No ${filter} predictions found.`;

  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
        <Trophy className="w-10 h-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{message}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Start predicting match outcomes and track your accuracy here.
      </p>
      <Button
        onClick={() => navigate('/')}
        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        data-testid="explore-matches-btn"
      >
        Explore Matches
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
});
EmptyState.displayName = 'EmptyState';

// ============ Loading Skeleton ============
const LoadingSkeleton = () => (
  <div className="space-y-4" data-testid="loading-skeleton">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-card rounded-xl border border-border/50 p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-16 bg-muted rounded-full" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-muted rounded-full" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-muted rounded-full" />
              <div className="h-4 w-36 bg-muted rounded" />
            </div>
          </div>
          <div className="h-10 w-16 bg-muted rounded" />
          <div className="h-10 w-24 bg-muted rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

// ============ Main Page ============
export const MyPredictionsPage = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [summary, setSummary] = useState({ correct: 0, wrong: 0, pending: 0 });
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/predictions/me/detailed`, {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch predictions');
      }
      const data = await res.json();
      setPredictions(data.predictions || []);
      setSummary(data.summary || { correct: 0, wrong: 0, pending: 0 });
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchPredictions();
    } else if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, fetchPredictions, navigate]);

  // Filter predictions
  const filtered = predictions.filter(p => {
    if (activeFilter === 'all') return true;
    if (!p.match) return false;
    if (activeFilter === 'live') return p.match.status === 'LIVE';
    if (activeFilter === 'upcoming') return p.match.status === 'NOT_STARTED';
    if (activeFilter === 'finished') return p.match.status === 'FINISHED';
    return true;
  });

  const filterCounts = {
    all: predictions.length,
    live: predictions.filter(p => p.match?.status === 'LIVE').length,
    upcoming: predictions.filter(p => p.match?.status === 'NOT_STARTED').length,
    finished: predictions.filter(p => p.match?.status === 'FINISHED').length,
  };

  return (
    <div className="min-h-screen bg-background" data-testid="my-predictions-page">
      <Header />
      <main className="container mx-auto px-4 md:px-6 py-8 max-w-5xl">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="page-title">
              My Predictions
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            Track all your match predictions and see how accurate you are.
          </p>
        </div>

        {/* Summary cards */}
        {!isLoading && total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" data-testid="summary-section">
            <SummaryCard
              icon={TrendingUp}
              label="Total"
              value={total}
              color="bg-primary/15 text-primary"
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Correct"
              value={summary.correct}
              color="bg-emerald-500/15 text-emerald-400"
            />
            <SummaryCard
              icon={XCircle}
              label="Wrong"
              value={summary.wrong}
              color="bg-red-500/15 text-red-400"
            />
            <SummaryCard
              icon={Clock}
              label="Pending"
              value={summary.pending}
              color="bg-amber-500/15 text-amber-400"
            />
          </div>
        )}

        {/* Filters */}
        {!isLoading && total > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap" data-testid="filter-section">
            <Filter className="w-4 h-4 text-muted-foreground mr-1" />
            <FilterTab label="All" value="all" active={activeFilter === 'all'} count={filterCounts.all} onClick={setActiveFilter} />
            <FilterTab label="Live" value="live" active={activeFilter === 'live'} count={filterCounts.live} onClick={setActiveFilter} />
            <FilterTab label="Upcoming" value="upcoming" active={activeFilter === 'upcoming'} count={filterCounts.upcoming} onClick={setActiveFilter} />
            <FilterTab label="Finished" value="finished" active={activeFilter === 'finished'} count={filterCounts.finished} onClick={setActiveFilter} />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center py-12 text-center" data-testid="error-state">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <p className="text-foreground font-medium mb-2">Something went wrong</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchPredictions} variant="outline">Try Again</Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div className="space-y-3" data-testid="predictions-list">
            {filtered.map((pred, i) => (
              <PredictionCard key={pred.prediction_id} data={pred} index={i} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MyPredictionsPage;
