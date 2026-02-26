import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Clock, Trophy, Target, ChevronDown, UserPlus, Share2, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/* ─── Status Badge ─── */
const StatusBadge = ({ status }) => {
  const config = {
    LIVE: { label: 'LIVE', cls: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' },
    IN_PLAY: { label: 'LIVE', cls: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' },
    FINISHED: { label: 'FT', cls: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
    NOT_STARTED: { label: 'Upcoming', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    SCHEDULED: { label: 'Scheduled', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  };
  const c = config[status] || config.NOT_STARTED;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase border ${c.cls}`} data-testid="match-status-badge">
      {status === 'LIVE' || status === 'IN_PLAY' ? <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5" /> : null}
      {c.label}
    </span>
  );
};

/* ─── Vote Button ─── */
const VoteButton = ({ type, label, votes, percentage, isSelected, onClick, disabled }) => (
  <button
    onClick={() => !disabled && onClick(type)}
    disabled={disabled}
    data-testid={`detail-vote-btn-${type}`}
    className={`flex-1 flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl transition-all duration-200 border-2 ${
      disabled ? 'opacity-40 cursor-not-allowed border-border/20' :
      isSelected
        ? 'bg-primary/15 border-primary text-primary shadow-[0_0_20px_-4px] shadow-primary/20 scale-[1.02]'
        : 'bg-card/50 border-border/30 hover:border-border/60 hover:bg-card/80 active:scale-[0.98]'
    }`}
  >
    <span className={`text-2xl font-black ${isSelected ? 'text-primary' : 'text-foreground'}`}>{label}</span>
    <span className="text-[10px] text-muted-foreground font-medium">{votes} votes</span>
    <div className="w-full h-1.5 rounded-full bg-background/50 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${isSelected ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        style={{ width: `${percentage || 0}%` }}
      />
    </div>
    <span className="text-[10px] font-bold text-muted-foreground">{percentage || 0}%</span>
  </button>
);

/* ─── Exact Score Section ─── */
const ExactScoreSection = ({ matchId, homeTeam, awayTeam, existingPrediction, isLocked, onSaved }) => {
  const [homeScore, setHomeScore] = useState(existingPrediction?.home_score ?? '');
  const [awayScore, setAwayScore] = useState(existingPrediction?.away_score ?? '');
  const [submitting, setSubmitting] = useState(false);
  const locked = !!existingPrediction || isLocked;

  useEffect(() => {
    if (existingPrediction) {
      setHomeScore(String(existingPrediction.home_score));
      setAwayScore(String(existingPrediction.away_score));
    }
  }, [existingPrediction]);

  // Strip leading zeros, allow empty, clamp 0-99
  const parseScore = (val) => {
    if (val === '' || val === undefined || val === null) return '';
    const num = parseInt(val, 10);
    if (isNaN(num)) return '';
    return String(Math.min(Math.max(num, 0), 99));
  };

  const handleSubmit = async () => {
    const h = homeScore === '' ? 0 : parseInt(homeScore, 10);
    const a = awayScore === '' ? 0 : parseInt(awayScore, 10);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/predictions/exact-score`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ match_id: matchId, home_score: h, away_score: a }),
      });
      if (res.ok) {
        toast.success('Exact score locked!');
        if (onSaved) onSaved({ home_score: h, away_score: a });
      }
    } catch { toast.error('Failed to save exact score'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="bg-card/40 rounded-2xl border border-border/20 p-5" data-testid="exact-score-section">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-bold text-foreground">Lock Exact Score</span>
        {locked && <Lock className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[80px]">{homeTeam}</span>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={homeScore}
            onChange={e => setHomeScore(parseScore(e.target.value))}
            onBlur={() => { if (homeScore === '') setHomeScore(''); }}
            placeholder="0"
            disabled={locked}
            data-testid="exact-score-home"
            className="w-16 h-12 text-center text-xl font-black bg-background/60 border border-border/30 rounded-md text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <span className="text-2xl font-black text-muted-foreground/50 mt-5">:</span>
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[80px]">{awayTeam}</span>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={awayScore}
            onChange={e => setAwayScore(parseScore(e.target.value))}
            onBlur={() => { if (awayScore === '') setAwayScore(''); }}
            placeholder="0"
            disabled={locked}
            data-testid="exact-score-away"
            className="w-16 h-12 text-center text-xl font-black bg-background/60 border border-border/30 rounded-md text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>
      {!locked && (
        <Button
          onClick={handleSubmit} disabled={submitting}
          data-testid="lock-exact-score-btn"
          className="w-full mt-4 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-bold"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" /> Lock Score</>}
        </Button>
      )}
      {locked && existingPrediction && (
        <div className="mt-3 text-center text-xs text-amber-400 font-medium">
          Locked: {existingPrediction.home_score} - {existingPrediction.away_score}
        </div>
      )}
    </div>
  );
};

/* ─── Invite Friends Section ─── */
const InviteFriendsSection = ({ matchId, match }) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(null);

  const loadFriends = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/friends/list`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setFriends(d.friends || []); }
    } catch {}
    finally { setLoading(false); setLoaded(true); }
  };

  const handleInvite = async (friend) => {
    setSending(friend.user_id);
    try {
      const matchCardData = {
        match_id: matchId, homeTeam: match.homeTeam, awayTeam: match.awayTeam,
        competition: match.competition || '', dateTime: match.dateTime || '',
        status: match.status || 'SCHEDULED', score: match.score || {}
      };
      const res = await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          receiver_id: friend.user_id,
          message: `I invited you to predict on ${match.homeTeam?.name || ''} vs ${match.awayTeam?.name || ''}! Make your guess!`,
          message_type: 'match_share', match_data: matchCardData
        })
      });
      if (res.ok) toast.success(`Sent to ${friend.nickname}!`);
    } catch { toast.error('Failed to send'); }
    finally { setSending(null); }
  };

  return (
    <div data-testid="invite-friends-section">
      {!loaded ? (
        <Button variant="outline" className="w-full gap-2" onClick={loadFriends} disabled={loading} data-testid="load-friends-btn">
          <UserPlus className="w-4 h-4" /> {loading ? 'Loading...' : 'Select Friend to Invite'}
        </Button>
      ) : friends.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No friends yet. Add friends first!</p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {friends.map(f => {
            const pic = f.picture?.startsWith('/') ? `${API_URL}${f.picture}` : f.picture;
            return (
              <div key={f.user_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/30 transition-colors">
                <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {pic ? <img src={pic} alt="" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">{(f.nickname || '?')[0].toUpperCase()}</div>}
                </div>
                <span className="text-sm text-foreground font-medium truncate flex-1">{f.nickname}</span>
                <button
                  onClick={() => handleInvite(f)}
                  disabled={sending === f.user_id}
                  data-testid={`detail-invite-${f.user_id}`}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    sending === f.user_id ? 'bg-secondary text-muted-foreground' : 'bg-primary/15 text-primary hover:bg-primary/25'
                  }`}
                >
                  {sending === f.user_id ? '...' : 'Invite'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── Standings Table ─── */
const StandingsTable = ({ standings, homeTeam, awayTeam }) => {
  if (!standings || standings.length === 0) return null;

  const isHighlighted = (team) => {
    const t = team?.toLowerCase() || '';
    const h = homeTeam?.toLowerCase() || '';
    const a = awayTeam?.toLowerCase() || '';
    return t.includes(h) || h.includes(t) || t.includes(a) || a.includes(t);
  };

  return (
    <div className="bg-card/40 rounded-2xl border border-border/20 overflow-hidden" data-testid="standings-section">
      <div className="p-4 pb-3 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-foreground">League Standings</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="standings-table">
          <thead>
            <tr className="text-muted-foreground/70 border-b border-border/10">
              <th className="px-3 py-2.5 text-left font-semibold w-8">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Team</th>
              <th className="px-3 py-2.5 text-center font-semibold w-8">P</th>
              <th className="px-3 py-2.5 text-center font-semibold w-8 hidden sm:table-cell">W</th>
              <th className="px-3 py-2.5 text-center font-semibold w-8 hidden sm:table-cell">D</th>
              <th className="px-3 py-2.5 text-center font-semibold w-8 hidden sm:table-cell">L</th>
              <th className="px-3 py-2.5 text-center font-semibold w-10">GD</th>
              <th className="px-3 py-2.5 text-center font-semibold w-10">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.slice(0, 10).map((row, i) => {
              const hl = isHighlighted(row.team);
              return (
                <tr
                  key={i}
                  data-testid={`standings-row-${i}`}
                  className={`border-b border-border/5 transition-colors ${
                    hl ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-secondary/20'
                  }`}
                >
                  <td className="px-3 py-2.5 text-left">
                    <span className={`font-bold ${hl ? 'text-primary' : 'text-muted-foreground'}`}>{row.position}</span>
                  </td>
                  <td className="px-3 py-2.5 text-left">
                    <div className="flex items-center gap-2">
                      {row.teamCrest && <img src={row.teamCrest} alt="" className="w-5 h-5 object-contain flex-shrink-0" />}
                      <span className={`font-semibold truncate max-w-[120px] sm:max-w-[200px] ${hl ? 'text-primary' : 'text-foreground'}`}>{row.team}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{row.played}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground hidden sm:table-cell">{row.won}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground hidden sm:table-cell">{row.draw}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground hidden sm:table-cell">{row.lost}</td>
                  <td className="px-3 py-2.5 text-center font-semibold">
                    <span className={row.goalDifference > 0 ? 'text-emerald-400' : row.goalDifference < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                      {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`font-black ${hl ? 'text-primary' : 'text-foreground'}`}>{row.points}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ═══════ MAIN: Match Detail Page ═══════ */
export const MatchDetailPage = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(null);
  const [exactScore, setExactScore] = useState(null);
  const [standings, setStandings] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const isLocked = match?.status === 'FINISHED' || match?.status === 'LIVE' || match?.status === 'IN_PLAY';
  const hasPrediction = !!userVote || !!exactScore;

  // Scroll to top on every matchId change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [matchId]);

  // Reset state when matchId changes
  useEffect(() => {
    setMatch(null);
    setLoading(true);
    setUserVote(null);
    setExactScore(null);
    setStandings([]);
    setAdvanceOpen(false);
  }, [matchId]);

  // Load match data
  const loadMatch = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/football/match/${matchId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.match) setMatch(data.match);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [matchId]);

  // Load predictions
  const loadPredictions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [predRes, exactRes] = await Promise.all([
        fetch(`${API_URL}/api/predictions/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (predRes?.prediction) setUserVote(predRes.prediction);
      if (exactRes?.home_score !== undefined && exactRes?.home_score !== null) {
        setExactScore({ home_score: exactRes.home_score, away_score: exactRes.away_score });
      }
    } catch {}
  }, [matchId, isAuthenticated]);

  // Load standings
  const loadStandings = useCallback(async () => {
    if (!match?.competitionCode) return;
    setStandingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/football/standings/${match.competitionCode}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStandings(data.standings || []);
      }
    } catch {}
    finally { setStandingsLoading(false); }
  }, [match?.competitionCode]);

  useEffect(() => { loadMatch(); }, [loadMatch]);
  useEffect(() => { loadPredictions(); }, [loadPredictions]);
  useEffect(() => { loadStandings(); }, [loadStandings]);

  // Vote handler
  const handleVote = async (voteType) => {
    if (!isAuthenticated) { toast.error('Please sign in to predict'); return; }
    if (isLocked) return;
    setUserVote(voteType);
  };

  // Guess It handler
  const handleGuessIt = async () => {
    if (!userVote || isSubmitting || isLocked) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/predictions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ match_id: parseInt(matchId), prediction: userVote }),
      });
      if (res.ok) {
        toast.success('Prediction saved!');
        loadMatch();
      }
    } catch { toast.error('Failed to save prediction'); }
    finally { setIsSubmitting(false); }
  };

  // Remove handler
  const handleRemove = async () => {
    if (isSubmitting || isLocked) return;
    setIsSubmitting(true);
    try {
      const promises = [];
      if (userVote) promises.push(fetch(`${API_URL}/api/predictions/match/${matchId}`, { method: 'DELETE', credentials: 'include' }));
      if (exactScore) promises.push(fetch(`${API_URL}/api/predictions/exact-score/match/${matchId}`, { method: 'DELETE', credentials: 'include' }));
      await Promise.all(promises);
      setUserVote(null);
      setExactScore(null);
      toast.success('Prediction removed');
      loadMatch();
    } catch { toast.error('Failed to remove'); }
    finally { setIsSubmitting(false); }
  };

  const formatMatchDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
        ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="match-detail-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not found
  if (!match) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4" data-testid="match-detail-not-found">
        <p className="text-lg text-muted-foreground">Match not found</p>
        <Button variant="outline" onClick={() => navigate('/')} data-testid="back-home-btn">Go Home</Button>
      </div>
    );
  }

  const score = match.score || {};
  const homeScore = score.fullTime?.home ?? score.home ?? null;
  const awayScore = score.fullTime?.away ?? score.away ?? null;
  const hasScore = homeScore !== null && awayScore !== null && (match.status === 'LIVE' || match.status === 'IN_PLAY' || match.status === 'FINISHED');

  return (
    <div className="min-h-screen bg-background" data-testid="match-detail-page">
      {/* ═══ Hero Header ═══ */}
      <div className="relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

        <div className="relative max-w-2xl mx-auto px-4 pt-4 pb-8">
          {/* Back + Status row */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              data-testid="back-button"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 -ml-3 rounded-xl hover:bg-secondary/30"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Back</span>
            </button>
            <StatusBadge status={match.status} />
          </div>

          {/* Competition + Date */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/80" data-testid="match-competition">
                {match.competition || ''}
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
              <Clock className="w-3 h-3" />
              <span data-testid="match-datetime">{match.dateTime || formatMatchDate(match.utcDate)}</span>
            </div>
          </div>

          {/* ═══ Teams + Score ═══ */}
          <div className="flex items-center justify-center gap-4 sm:gap-8" data-testid="match-teams-section">
            {/* Home */}
            <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
              <div className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] rounded-2xl bg-card/60 border border-border/20 flex items-center justify-center p-2 backdrop-blur-sm">
                {match.homeTeam?.crest ? (
                  <img src={match.homeTeam.crest} alt={match.homeTeam.name} className="w-full h-full object-contain" data-testid="home-team-logo" />
                ) : (
                  <span className="text-3xl font-black text-muted-foreground/40">{(match.homeTeam?.name || '?')[0]}</span>
                )}
              </div>
              <span className="text-sm sm:text-base font-bold text-foreground text-center leading-tight truncate max-w-[100px] sm:max-w-[150px]" data-testid="home-team-name">
                {match.homeTeam?.shortName || match.homeTeam?.name || ''}
              </span>
            </div>

            {/* Score / VS */}
            <div className="flex flex-col items-center gap-1" data-testid="match-score-display">
              {hasScore ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl sm:text-6xl font-black text-foreground tabular-nums" data-testid="home-score">{homeScore}</span>
                    <span className="text-2xl font-bold text-muted-foreground/40">-</span>
                    <span className="text-5xl sm:text-6xl font-black text-foreground tabular-nums" data-testid="away-score">{awayScore}</span>
                  </div>
                  {match.matchMinute && (
                    <span className="text-[10px] font-bold text-red-400 animate-pulse">{match.matchMinute}'</span>
                  )}
                </>
              ) : (
                <span className="text-4xl sm:text-5xl font-black text-muted-foreground/30" data-testid="vs-indicator">VS</span>
              )}
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
              <div className="w-[70px] h-[70px] sm:w-[90px] sm:h-[90px] rounded-2xl bg-card/60 border border-border/20 flex items-center justify-center p-2 backdrop-blur-sm">
                {match.awayTeam?.crest ? (
                  <img src={match.awayTeam.crest} alt={match.awayTeam.name} className="w-full h-full object-contain" data-testid="away-team-logo" />
                ) : (
                  <span className="text-3xl font-black text-muted-foreground/40">{(match.awayTeam?.name || '?')[0]}</span>
                )}
              </div>
              <span className="text-sm sm:text-base font-bold text-foreground text-center leading-tight truncate max-w-[100px] sm:max-w-[150px]" data-testid="away-team-name">
                {match.awayTeam?.shortName || match.awayTeam?.name || ''}
              </span>
            </div>
          </div>

          {/* Vote stats */}
          {match.totalVotes > 0 && (
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground/60">
              <span>{match.totalVotes} total votes</span>
              {match.mostPicked && match.mostPicked !== '-' && (
                <span>Most picked: <span className="text-primary font-semibold">{match.mostPicked}</span></span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="max-w-2xl mx-auto px-4 pb-12 space-y-5 -mt-1">
        {/* ── Row 1: Vote Buttons (1 / X / 2) ── */}
        <div className="grid grid-cols-3 gap-3" data-testid="vote-buttons-section">
          <VoteButton type="home" label="1" votes={match.votes?.home?.count || 0} percentage={match.votes?.home?.percentage || 0} isSelected={userVote === 'home'} onClick={handleVote} disabled={isLocked} />
          <VoteButton type="draw" label="X" votes={match.votes?.draw?.count || 0} percentage={match.votes?.draw?.percentage || 0} isSelected={userVote === 'draw'} onClick={handleVote} disabled={isLocked} />
          <VoteButton type="away" label="2" votes={match.votes?.away?.count || 0} percentage={match.votes?.away?.percentage || 0} isSelected={userVote === 'away'} onClick={handleVote} disabled={isLocked} />
        </div>

        {/* Prediction status */}
        {hasPrediction && (
          <div className="flex items-center gap-3 px-1" data-testid="prediction-status">
            {userVote && (
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Your pick: {userVote === 'home' ? '1' : userVote === 'draw' ? 'X' : '2'}
              </span>
            )}
            {exactScore && (
              <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Exact: {exactScore.home_score}-{exactScore.away_score}
              </span>
            )}
          </div>
        )}

        {/* ── Row 2: Guess It / Remove / Lock Exact Score ── */}
        {isAuthenticated && (
          <div className="space-y-3" data-testid="action-buttons-section">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleGuessIt}
                disabled={isSubmitting || !userVote || isLocked}
                data-testid="detail-guess-it-btn"
                className={`py-3.5 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                  isLocked ? 'opacity-30 cursor-not-allowed bg-secondary/20 border-border/10 text-muted-foreground' :
                  userVote
                    ? 'bg-primary hover:bg-primary/90 border-primary text-primary-foreground hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20'
                    : 'bg-secondary/30 border-border/20 text-muted-foreground/60 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? '...' : isLocked ? 'Locked' : userVote ? 'GUESS IT' : 'Select to Guess'}
              </button>
              <button
                onClick={handleRemove}
                disabled={isSubmitting || !hasPrediction || isLocked}
                data-testid="detail-remove-btn"
                className={`py-3.5 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                  isLocked ? 'opacity-30 cursor-not-allowed bg-secondary/20 border-border/10 text-muted-foreground' :
                  hasPrediction
                    ? 'bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 active:scale-[0.99]'
                    : 'opacity-30 cursor-not-allowed bg-secondary/10 border-border/10 text-muted-foreground'
                }`}
              >
                Remove
              </button>
            </div>

            {/* Exact Score */}
            {!isLocked && (
              <ExactScoreSection
                matchId={parseInt(matchId)}
                homeTeam={match.homeTeam?.shortName || match.homeTeam?.name || ''}
                awayTeam={match.awayTeam?.shortName || match.awayTeam?.name || ''}
                existingPrediction={exactScore}
                isLocked={isLocked}
                onSaved={(data) => setExactScore(data)}
              />
            )}
          </div>
        )}

        {/* ── Row 3: Advance Section ── */}
        {isAuthenticated && !isLocked && (
          <div className="bg-card/30 rounded-2xl border border-border/15 overflow-hidden" data-testid="advance-section">
            <button
              onClick={() => setAdvanceOpen(!advanceOpen)}
              data-testid="advance-toggle-btn"
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-foreground/90 hover:bg-secondary/20 transition-colors"
            >
              <span>Advanced</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${advanceOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`transition-all duration-300 ease-out overflow-hidden ${advanceOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="px-5 pb-5 space-y-5">
                {/* Invite Friend */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <UserPlus className="w-4 h-4 text-emerald-500" />
                    <span className="font-semibold">Invite Friend</span>
                  </div>
                  <InviteFriendsSection matchId={parseInt(matchId)} match={match} />
                </div>

                {/* Share */}
                <div>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    data-testid="share-match-btn"
                    onClick={() => {
                      const url = window.location.href;
                      navigator.clipboard.writeText(url).then(() => toast.success('Link copied!')).catch(() => {});
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share Match Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sign in prompt for unauthenticated */}
        {!isAuthenticated && (
          <div className="bg-card/40 rounded-2xl border border-border/20 p-6 text-center" data-testid="sign-in-prompt">
            <p className="text-sm text-muted-foreground mb-3">Sign in to make predictions</p>
            <Button onClick={() => navigate('/login')} data-testid="detail-login-btn" className="bg-primary hover:bg-primary/90">
              Sign In
            </Button>
          </div>
        )}

        {/* ── Standings ── */}
        <StandingsTable standings={standings} homeTeam={match.homeTeam?.name} awayTeam={match.awayTeam?.name} />

        {/* Standings loading state */}
        {standingsLoading && standings.length === 0 && (
          <div className="bg-card/20 rounded-2xl border border-border/10 p-8 text-center" data-testid="standings-loading">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">Loading standings...</p>
          </div>
        )}

        {/* No standings fallback */}
        {!standingsLoading && standings.length === 0 && match.competition && (
          <div className="bg-card/20 rounded-2xl border border-border/10 p-6 text-center" data-testid="no-standings">
            <Trophy className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">Standings not available for this competition</p>
          </div>
        )}
      </div>
    </div>
  );
};
