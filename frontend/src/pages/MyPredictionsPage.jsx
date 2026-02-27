import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { savePrediction, deletePrediction, getMyDetailedPredictions, deleteExactScorePrediction, updateExactScorePrediction } from '@/services/predictions';
import { toast } from 'sonner';
import {
  Trophy, Clock, CheckCircle2, XCircle, AlertCircle,
  Radio, ArrowRight, Filter, TrendingUp, Calendar, Search, X,
  Pencil, Trash2, Check, Loader2, LayoutGrid, List, Star, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
const SummaryCard = memo(({ icon: Icon, label, value, color, active, onClick, filterKey }) => (
  <button
    onClick={() => onClick(filterKey)}
    className={`flex items-center gap-3 bg-card rounded-xl p-4 border shadow-sm text-left w-full cursor-pointer ${
      active
        ? 'border-primary ring-2 ring-primary/30 shadow-md'
        : 'border-border/50 hover:border-border'
    }`}
    data-testid={`summary-${label.toLowerCase()}`}
    style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, ring 0.2s ease' }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0,0,0,0.15)'; }}}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = active ? '' : ''; }}
  >
    <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </button>
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

// ============ Edit Vote Button ============
const EditVoteButton = memo(({ type, isSelected, onClick }) => {
  const labels = { home: '1', draw: 'X', away: '2' };
  const fullLabels = { home: 'Home', draw: 'Draw', away: 'Away' };

  return (
    <button
      onClick={() => onClick(type)}
      data-testid={`edit-vote-${type}`}
      className={`flex flex-col items-center justify-center px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
        isSelected
          ? 'bg-primary/20 border-primary text-primary shadow-glow ring-1 ring-primary/30'
          : 'bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5'
      }`}
    >
      <span className={`text-lg font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{labels[type]}</span>
      <span className="text-[10px]">{fullLabels[type]}</span>
    </button>
  );
});
EditVoteButton.displayName = 'EditVoteButton';

// ============ Prediction Card ============
const PredictionCard = memo(({ data, index, viewMode = 'grid', onEdit, onRemove, onEditExactScore, onRemoveExactScore }) => {
  const { prediction, match, result, created_at } = data;
  const navigate = useNavigate();
  const exactScore = data.exact_score;
  const predictionType = data.prediction_type || (prediction ? 'winner' : 'exact_score');
  const isExactScoreOnly = predictionType === 'exact_score' && !prediction;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editSelection, setEditSelection] = useState(prediction);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  
  // Exact score edit state
  const [isEditingExactScore, setIsEditingExactScore] = useState(false);
  const [editHomeScore, setEditHomeScore] = useState(exactScore?.home_score !== undefined ? String(exactScore.home_score) : '');
  const [editAwayScore, setEditAwayScore] = useState(exactScore?.away_score !== undefined ? String(exactScore.away_score) : '');
  const [isSavingExactScore, setIsSavingExactScore] = useState(false);
  const [isRemovingExactScore, setIsRemovingExactScore] = useState(false);

  const isUpcoming = match && match.status === 'NOT_STARTED';
  const isFinished = match && match.status === 'FINISHED';
  const canEdit = isUpcoming && !match.predictionLocked;
  const isList = viewMode === 'list';
  
  // For exact score: can only edit if not yet awarded points
  const canEditExactScore = canEdit && exactScore && !exactScore.exact_score_points_awarded;

  if (!match) {
    return (
      <div
        className="bg-card rounded-xl p-5 border border-border/50 opacity-60"
        data-testid={`prediction-card-${index}`}
      >
        <p className="text-sm text-muted-foreground">Match data unavailable (match ID: {data.match_id})</p>
        {!isExactScoreOnly && <PredictionBadge prediction={prediction} result="pending" />}
        {exactScore && (
          <div className="mt-2 flex items-center gap-2 text-amber-500">
            <Target className="w-4 h-4" />
            <span className="font-semibold">Exact Score: {exactScore.home_score} - {exactScore.away_score}</span>
          </div>
        )}
      </div>
    );
  }

  // Enhanced styling for finished matches - use orange for exact score only
  const cardAccentColor = isExactScoreOnly ? 'amber' : (result === 'correct' ? 'emerald' : result === 'wrong' ? 'red' : null);
  
  const borderColor = isExactScoreOnly
    ? (isFinished 
        ? (result === 'correct' ? 'border-emerald-500/40 hover:border-emerald-500/60' : result === 'wrong' ? 'border-red-500/40 hover:border-red-500/60' : 'border-amber-500/40 hover:border-amber-500/60')
        : 'border-amber-500/30 hover:border-amber-500/50')
    : {
        correct: isFinished ? 'border-emerald-500/40 hover:border-emerald-500/60' : 'border-emerald-500/30 hover:border-emerald-500/50',
        wrong: isFinished ? 'border-red-500/40 hover:border-red-500/60' : 'border-red-500/20 hover:border-red-500/40',
        pending: 'border-border/50 hover:border-border',
      }[result] || 'border-border/50 hover:border-border';

  const bgAccent = isExactScoreOnly
    ? (isFinished
        ? (result === 'correct' ? 'bg-emerald-500/[0.08]' : result === 'wrong' ? 'bg-red-500/[0.07]' : 'bg-amber-500/[0.06]')
        : 'bg-amber-500/[0.04]')
    : {
        correct: isFinished ? 'bg-emerald-500/[0.08]' : 'bg-emerald-500/[0.03]',
        wrong: isFinished ? 'bg-red-500/[0.07]' : 'bg-red-500/[0.02]',
        pending: '',
      }[result] || '';

  // Left accent bar color for finished matches
  const accentBar = isFinished && result === 'correct'
    ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-emerald-500 before:rounded-l-xl'
    : isFinished && result === 'wrong'
      ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-red-500 before:rounded-l-xl'
      : isExactScoreOnly && !isFinished
        ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-amber-500 before:rounded-l-xl'
        : '';

  const votedDate = created_at ? new Date(created_at) : null;
  const votedStr = votedDate
    ? votedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      votedDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleStartEdit = () => {
    if (isExactScoreOnly) {
      setEditHomeScore(exactScore?.home_score !== undefined ? String(exactScore.home_score) : '');
      setEditAwayScore(exactScore?.away_score !== undefined ? String(exactScore.away_score) : '');
      setIsEditingExactScore(true);
    } else {
      setEditSelection(prediction);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setEditSelection(prediction);
    setIsEditing(false);
    setIsEditingExactScore(false);
  };

  const handleSubmitEdit = async () => {
    if (editSelection === prediction) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onEdit(data.match_id, editSelection);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSubmitExactScoreEdit = async () => {
    const h = editHomeScore === '' ? 0 : parseInt(editHomeScore, 10);
    const a = editAwayScore === '' ? 0 : parseInt(editAwayScore, 10);
    if (h === exactScore?.home_score && a === exactScore?.away_score) {
      setIsEditingExactScore(false);
      return;
    }
    setIsSavingExactScore(true);
    try {
      await onEditExactScore(data.match_id, h, a);
      setIsEditingExactScore(false);
    } finally {
      setIsSavingExactScore(false);
    }
  };

  const handleRemove = async () => {
    if (isExactScoreOnly) {
      setIsRemovingExactScore(true);
      try {
        await onRemoveExactScore(data.match_id);
      } finally {
        setIsRemovingExactScore(false);
      }
    } else {
      setIsRemoving(true);
      try {
        await onRemove(data.match_id);
      } finally {
        setIsRemoving(false);
      }
    }
  };

  const isRemovingAny = isRemoving || isRemovingExactScore;

  return (
    <div
      className={`prediction-card relative ${bgAccent} rounded-xl border overflow-hidden ${borderColor} ${(isEditing || isEditingExactScore) ? 'ring-1 ring-primary/30' : ''} ${accentBar}`}
      data-testid={`prediction-card-${index}`}
      style={{
        animationDelay: `${index * 60}ms`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={e => { if (!isEditing && !isEditingExactScore) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px -8px rgba(0,0,0,0.2)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* ======= LIST VIEW ======= */}
      {isList && !isEditing && !isEditingExactScore && (
        <div className="px-4 py-3">
          {/* League name on top */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[250px]" title={match.competition}>
              {match.competition}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Status + Meta */}
            <div className="flex items-center gap-2 flex-shrink-0 min-w-[140px]">
              <StatusBadge status={match.status} matchMinute={match.matchMinute} />
              <span className="text-xs text-muted-foreground">{match.dateTime}</span>
            </div>

            {/* Teams row — clickable to open match detail */}
            <div
              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/match/${data.match_id}`)}
              data-testid={`prediction-match-link-${data.match_id}`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <TeamCrest team={match.homeTeam} />
                <span className="text-sm font-medium text-foreground truncate">{match.homeTeam.name}</span>
              </div>
              <span className="text-xs text-muted-foreground/60 font-medium flex-shrink-0 px-1">vs</span>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <TeamCrest team={match.awayTeam} />
                <span className="text-sm font-medium text-foreground truncate">{match.awayTeam.name}</span>
              </div>
            </div>

            {/* Score */}
            <div className="flex-shrink-0 w-12 text-center">
              {match.score.home !== null ? (
                <span className="text-base font-bold tabular-nums text-foreground">{match.score.home} - {match.score.away}</span>
              ) : (
                <span className="text-sm text-muted-foreground/40 font-medium">-</span>
              )}
            </div>

            {/* Pick */}
            {prediction && <PredictionBadge prediction={prediction} result={result} />}
            {exactScore && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${
                result === 'correct' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                result === 'wrong' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`} data-testid="exact-score-badge">
                <Target className="w-4 h-4" />
                <span className="font-bold text-lg">{exactScore.home_score}-{exactScore.away_score}</span>
              </div>
            )}

            {/* Actions */}
            {canEdit && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleStartEdit}
                  data-testid={`edit-prediction-${data.match_id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isRemovingAny}
                  data-testid={`remove-prediction-${data.match_id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:border-destructive/40 transition-all disabled:opacity-50"
                >
                  {isRemovingAny ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Remove
                </button>
              </div>
            )}
            {result === 'correct' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Correct
              </span>
            )}
            {result === 'wrong' && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-400 flex-shrink-0">
                <XCircle className="w-3.5 h-3.5" /> Wrong
              </span>
            )}
          </div>
        </div>
      )}

      {/* ======= GRID VIEW (or editing in list) ======= */}
      {(!isList || isEditing || isEditingExactScore) && (
        <>
          {/* League name at top */}
          <div className="px-5 pt-3 pb-0">
            <span className="text-[11px] font-medium text-muted-foreground truncate block max-w-full" title={match.competition} data-testid="card-league-name">
              {match.competition}
            </span>
          </div>

          {/* Top meta bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge status={match.status} matchMinute={match.matchMinute} />
              <span>{match.dateTime}</span>
            </div>
            <div className="flex items-center gap-2">
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
              {canEdit && !isEditing && !isEditingExactScore && (
                <div className="flex items-center gap-1.5 ml-2">
                  <button
                    onClick={handleStartEdit}
                    data-testid={`edit-prediction-${data.match_id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 transition-all"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={isRemovingAny}
                    data-testid={`remove-prediction-${data.match_id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 hover:border-destructive/40 transition-all disabled:opacity-50"
                  >
                    {isRemovingAny ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Match content */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-4">
              {/* Teams with vs — clickable to open match detail */}
              <div
                className="flex flex-col gap-1 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/match/${data.match_id}`)}
                data-testid={`prediction-grid-link-${data.match_id}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground w-3 text-right flex-shrink-0">1</span>
                  <TeamCrest team={match.homeTeam} />
                  <span className="text-sm font-medium text-foreground truncate">{match.homeTeam.name}</span>
                </div>
                <div className="flex items-center gap-2.5 pl-[22px]">
                  <span className="text-xs font-medium text-muted-foreground/60 italic">vs</span>
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
                  <span className="text-lg font-bold text-muted-foreground/40">-</span>
                )}
              </div>

              {/* User prediction */}
              {!isEditing && !isEditingExactScore && (
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Your Pick</span>
                  {prediction && <PredictionBadge prediction={prediction} result={result} />}
                  {exactScore && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${
                      result === 'correct' && isExactScoreOnly ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
                      result === 'wrong' && isExactScoreOnly ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                      'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`} data-testid="exact-score-pick">
                      <Target className="w-4 h-4" />
                      <span className="font-bold">{exactScore.home_score} - {exactScore.away_score}</span>
                      <span className="text-xs opacity-80">Exact</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Edit Mode - Normal Prediction */}
          {isEditing && (
            <div className="px-5 pb-3" data-testid={`edit-panel-${data.match_id}`}>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Change your prediction</p>
                <div className="flex items-center gap-2 mb-4">
                  <EditVoteButton type="home" isSelected={editSelection === 'home'} onClick={setEditSelection} />
                  <EditVoteButton type="draw" isSelected={editSelection === 'draw'} onClick={setEditSelection} />
                  <EditVoteButton type="away" isSelected={editSelection === 'away'} onClick={setEditSelection} />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSubmitEdit}
                    disabled={isSaving}
                    data-testid={`submit-edit-${data.match_id}`}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 text-sm"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {editSelection !== prediction ? 'Submit' : 'No Change'}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    data-testid={`cancel-edit-${data.match_id}`}
                    className="text-muted-foreground h-9 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Edit Mode - Exact Score */}
          {isEditingExactScore && (
            <div className="px-5 pb-3" data-testid={`edit-exact-score-panel-${data.match_id}`}>
              <div className="bg-amber-500/5 rounded-lg p-4 border border-amber-500/20">
                <p className="text-xs font-medium text-amber-500 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Edit Exact Score
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 text-center">
                    <label className="text-xs text-muted-foreground block mb-1 truncate">{match.homeTeam.name}</label>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*"
                      value={editHomeScore}
                      onChange={e => { const v = e.target.value; if (v === '') { setEditHomeScore(''); return; } const n = parseInt(v, 10); if (!isNaN(n)) setEditHomeScore(String(Math.min(Math.max(n, 0), 99))); }}
                      placeholder="0"
                      className="flex h-10 w-full rounded-md border border-border/30 bg-background px-3 py-2 text-lg font-bold text-center text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      data-testid={`edit-exact-home-${data.match_id}`}
                    />
                  </div>
                  <span className="text-xl font-bold text-muted-foreground pt-5">-</span>
                  <div className="flex-1 text-center">
                    <label className="text-xs text-muted-foreground block mb-1 truncate">{match.awayTeam.name}</label>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*"
                      value={editAwayScore}
                      onChange={e => { const v = e.target.value; if (v === '') { setEditAwayScore(''); return; } const n = parseInt(v, 10); if (!isNaN(n)) setEditAwayScore(String(Math.min(Math.max(n, 0), 99))); }}
                      placeholder="0"
                      className="flex h-10 w-full rounded-md border border-border/30 bg-background px-3 py-2 text-lg font-bold text-center text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      data-testid={`edit-exact-away-${data.match_id}`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSubmitExactScoreEdit}
                    disabled={isSavingExactScore}
                    data-testid={`submit-exact-edit-${data.match_id}`}
                    className="bg-amber-500 hover:bg-amber-500/90 text-white gap-1.5 h-9 text-sm"
                  >
                    {isSavingExactScore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {((editHomeScore === '' ? 0 : parseInt(editHomeScore, 10)) !== exactScore?.home_score || (editAwayScore === '' ? 0 : parseInt(editAwayScore, 10)) !== exactScore?.away_score) ? 'Update Score' : 'No Change'}
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    data-testid={`cancel-exact-edit-${data.match_id}`}
                    className="text-muted-foreground h-9 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30 bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Voted on: {votedStr}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {data.points_awarded && data.points_value !== 0 && (
                <span
                  className={`font-semibold ${data.points_value > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  data-testid={`points-badge-${data.match_id}`}
                >
                  {data.points_value > 0 ? '+' : ''}{data.points_value} pts
                </span>
              )}
              {exactScore?.exact_score_points_awarded && exactScore?.exact_score_points_value > 0 && (
                <span className="font-semibold text-amber-400" data-testid={`exact-score-bonus-${data.match_id}`}>
                  +{exactScore.exact_score_points_value} bonus
                </span>
              )}
              <span>Total votes: <span className="text-foreground font-medium">{match.totalVotes}</span></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
PredictionCard.displayName = 'PredictionCard';

// ============ Empty State ============
const EmptyState = memo(({ filter, isSearch }) => {
  const navigate = useNavigate();
  const message = isSearch
    ? 'No matches found'
    : filter === 'all'
      ? "You haven't made any predictions yet."
      : `No ${filter} predictions found.`;

  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state"
    >
      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
        {isSearch ? (
          <Search className="w-10 h-10 text-muted-foreground/50" />
        ) : (
          <Trophy className="w-10 h-10 text-muted-foreground/50" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{message}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {isSearch
          ? 'Try searching with a different team name.'
          : 'Start predicting match outcomes and track your accuracy here.'}
      </p>
      {!isSearch && (
        <Button
          onClick={() => navigate('/')}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          data-testid="explore-matches-btn"
        >
          Explore Matches
          <ArrowRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
});
EmptyState.displayName = 'EmptyState';

// ============ Loading Skeleton ============
const LoadingSkeleton = () => (
  <div className="space-y-6" data-testid="loading-skeleton">
    {/* Summary cards skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 bg-card rounded-xl p-4 border border-border/50">
          <div className="w-10 h-10 rounded-lg skeleton-bone flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-10 skeleton-bone rounded" />
            <div className="h-3 w-14 skeleton-bone rounded" />
          </div>
        </div>
      ))}
    </div>
    {/* Search + filter skeleton */}
    <div className="space-y-4">
      <div className="h-10 w-full skeleton-bone rounded-lg" />
      <div className="flex items-center gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-20 skeleton-bone rounded-lg" />
        ))}
      </div>
    </div>
    {/* Prediction cards skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border/50 overflow-hidden">
          {/* League name */}
          <div className="px-5 pt-3 pb-0">
            <div className="h-3 w-32 skeleton-bone" />
          </div>
          {/* Meta bar */}
          <div className="flex items-center justify-between px-5 pt-2 pb-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 skeleton-bone rounded-full" />
              <div className="h-3 w-20 skeleton-bone" />
            </div>
          </div>
          {/* Match content */}
          <div className="px-5 py-3">
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 skeleton-bone" />
                  <div className="w-7 h-7 skeleton-bone-circle" />
                  <div className="h-4 w-28 skeleton-bone" />
                </div>
                <div className="pl-6">
                  <div className="h-3 w-5 skeleton-bone" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 skeleton-bone" />
                  <div className="w-7 h-7 skeleton-bone-circle" />
                  <div className="h-4 w-24 skeleton-bone" />
                </div>
              </div>
              <div className="h-10 w-16 skeleton-bone rounded" />
              <div className="h-10 w-28 skeleton-bone rounded-lg" />
            </div>
          </div>
          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/20">
            <div className="h-3 w-32 skeleton-bone" />
            <div className="h-3 w-20 skeleton-bone" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ============ Main Page ============
export const MyPredictionsPage = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [summary, setSummary] = useState({ correct: 0, wrong: 0, pending: 0, points: 0 });
  const [total, setTotal] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const [userLevel, setUserLevel] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [summaryFilter, setSummaryFilter] = useState('total');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('guessit-predictions-view')) || 'grid';
  });
  const [viewTransitioning, setViewTransitioning] = useState(false);

  const handleViewModeChange = useCallback((mode) => {
    if (mode === viewMode || viewTransitioning) return;
    setViewTransitioning(true);
    setTimeout(() => {
      setViewMode(mode);
      localStorage.setItem('guessit-predictions-view', mode);
      requestAnimationFrame(() => {
        setViewTransitioning(false);
      });
    }, 200);
  }, [viewMode, viewTransitioning]);

  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMyDetailedPredictions();
      setPredictions(data.predictions || []);
      setSummary(data.summary || { correct: 0, wrong: 0, pending: 0, points: 0 });
      setTotal(data.total || 0);
      setUserPoints(data.user_points ?? data.summary?.points ?? 0);
      setUserLevel(data.user_level ?? 0);
    } catch (err) {
      if (err.message?.includes('401')) {
        navigate('/login');
        return;
      }
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

  // Edit prediction handler
  const handleEditPrediction = useCallback(async (matchId, newPrediction) => {
    try {
      await savePrediction(matchId, newPrediction);
      // Update local state
      setPredictions(prev => prev.map(p =>
        p.match_id === matchId ? { ...p, prediction: newPrediction } : p
      ));
      toast.success('Prediction updated!', {
        description: `Changed to: ${newPrediction === 'home' ? 'Home Win (1)' : newPrediction === 'draw' ? 'Draw (X)' : 'Away Win (2)'}`,
        duration: 2000,
      });
    } catch (err) {
      toast.error('Failed to update prediction', { description: err.message, duration: 3000 });
      throw err;
    }
  }, []);

  // Remove prediction handler
  const handleRemovePrediction = useCallback(async (matchId) => {
    try {
      await deletePrediction(matchId);
      // Remove from local state
      setPredictions(prev => prev.filter(p => p.match_id !== matchId));
      setTotal(prev => prev - 1);
      setSummary(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
      toast.success('Prediction removed', {
        description: 'Your prediction has been deleted.',
        duration: 2000,
      });
    } catch (err) {
      toast.error('Failed to remove prediction', { description: err.message, duration: 3000 });
      throw err;
    }
  }, []);

  // Edit exact score handler
  const handleEditExactScore = useCallback(async (matchId, homeScore, awayScore) => {
    try {
      await updateExactScorePrediction(matchId, homeScore, awayScore);
      setPredictions(prev => prev.map(p =>
        p.match_id === matchId
          ? {
              ...p,
              exact_score: p.exact_score
                ? { ...p.exact_score, home_score: homeScore, away_score: awayScore }
                : { home_score: homeScore, away_score: awayScore }
            }
          : p
      ));
      toast.success('Exact score updated!', {
        description: `New prediction: ${homeScore} - ${awayScore}`,
        duration: 2000,
      });
    } catch (err) {
      toast.error('Failed to update exact score', { description: err.message, duration: 3000 });
      throw err;
    }
  }, []);

  // Remove exact score handler
  const handleRemoveExactScore = useCallback(async (matchId) => {
    try {
      await deleteExactScorePrediction(matchId);
      // If this prediction also has a normal prediction, just remove exact_score data
      setPredictions(prev => {
        const pred = prev.find(p => p.match_id === matchId);
        if (pred && pred.prediction) {
          // Has a normal prediction too - just remove exact score data
          return prev.map(p =>
            p.match_id === matchId
              ? { ...p, exact_score: null, prediction_type: 'winner' }
              : p
          );
        } else {
          // Exact score only - remove entirely
          return prev.filter(p => p.match_id !== matchId);
        }
      });
      setTotal(prev => {
        const pred = predictions.find(p => p.match_id === matchId);
        return (pred && !pred.prediction) ? prev - 1 : prev;
      });
      toast.success('Exact score prediction removed', {
        description: 'Your exact score prediction has been deleted.',
        duration: 2000,
      });
    } catch (err) {
      toast.error('Failed to remove exact score', { description: err.message, duration: 3000 });
      throw err;
    }
  }, [predictions]);

  // Filter + search predictions
  const filtered = useMemo(() => {
    let result = predictions;

    // Summary card filter (by result)
    if (summaryFilter === 'correct') {
      result = result.filter(p => p.result === 'correct');
    } else if (summaryFilter === 'wrong') {
      result = result.filter(p => p.result === 'wrong');
    } else if (summaryFilter === 'pending') {
      result = result.filter(p => p.result === 'pending');
    } else if (summaryFilter === 'points') {
      result = result.filter(p => p.points_awarded && p.points_value !== 0);
    }
    // 'total' shows all

    // Status filter (by match status)
    if (activeFilter !== 'all') {
      result = result.filter(p => {
        if (!p.match) return false;
        if (activeFilter === 'live') return p.match.status === 'LIVE';
        if (activeFilter === 'upcoming') return p.match.status === 'NOT_STARTED';
        if (activeFilter === 'finished') return p.match.status === 'FINISHED';
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => {
        if (!p.match) return false;
        const homeName = p.match.homeTeam?.name?.toLowerCase() || '';
        const awayName = p.match.awayTeam?.name?.toLowerCase() || '';
        return homeName.includes(q) || awayName.includes(q);
      });
    }

    return result;
  }, [predictions, activeFilter, summaryFilter, searchQuery]);

  const filterCounts = {
    all: predictions.length,
    live: predictions.filter(p => p.match?.status === 'LIVE').length,
    upcoming: predictions.filter(p => p.match?.status === 'NOT_STARTED').length,
    finished: predictions.filter(p => p.match?.status === 'FINISHED').length,
  };

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-background" data-testid="my-predictions-page">
      <Header
        user={user}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
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
          {!isLoading && (
            <div className="flex items-center gap-3 ml-[52px] mt-2" data-testid="level-progress">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Level {userLevel}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
                <Star className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-primary">{userPoints} points</span>
              </div>
            </div>
          )}
        </div>

        {/* Summary cards - clickable filters */}
        {!isLoading && total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8" data-testid="summary-section">
            <SummaryCard
              icon={TrendingUp}
              label="Total"
              value={total}
              color="bg-primary/15 text-primary"
              active={summaryFilter === 'total'}
              onClick={setSummaryFilter}
              filterKey="total"
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Correct"
              value={summary.correct}
              color="bg-emerald-500/15 text-emerald-400"
              active={summaryFilter === 'correct'}
              onClick={setSummaryFilter}
              filterKey="correct"
            />
            <SummaryCard
              icon={XCircle}
              label="Wrong"
              value={summary.wrong}
              color="bg-red-500/15 text-red-400"
              active={summaryFilter === 'wrong'}
              onClick={setSummaryFilter}
              filterKey="wrong"
            />
            <SummaryCard
              icon={Clock}
              label="Pending"
              value={summary.pending}
              color="bg-amber-500/15 text-amber-400"
              active={summaryFilter === 'pending'}
              onClick={setSummaryFilter}
              filterKey="pending"
            />
            <SummaryCard
              icon={Star}
              label="Points"
              value={userPoints}
              color="bg-violet-500/15 text-violet-400"
              active={summaryFilter === 'points'}
              onClick={setSummaryFilter}
              filterKey="points"
            />
          </div>
        )}

        {/* Search + Filters */}
        {!isLoading && total > 0 && (
          <div className="space-y-4 mb-6">
            {/* Search */}
            <div className="relative" data-testid="predictions-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by club name..."
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-card border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                data-testid="predictions-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="predictions-search-clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters + View Toggle */}
            <div className="flex items-center justify-between gap-2 flex-wrap" data-testid="filter-section">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground mr-1" />
                <FilterTab label="All" value="all" active={activeFilter === 'all'} count={filterCounts.all} onClick={setActiveFilter} />
                <FilterTab label="Live" value="live" active={activeFilter === 'live'} count={filterCounts.live} onClick={setActiveFilter} />
                <FilterTab label="Upcoming" value="upcoming" active={activeFilter === 'upcoming'} count={filterCounts.upcoming} onClick={setActiveFilter} />
                <FilterTab label="Finished" value="finished" active={activeFilter === 'finished'} count={filterCounts.finished} onClick={setActiveFilter} />
              </div>
              {/* View Toggle - hidden on mobile */}
              <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-lg bg-secondary border border-border" data-testid="predictions-view-toggle">
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  data-testid="predictions-view-toggle-grid"
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
                  data-testid="predictions-view-toggle-list"
                  aria-label="List view"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
              </div>
            </div>
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
          <EmptyState filter={summaryFilter !== 'total' ? summaryFilter : activeFilter} isSearch={!!searchQuery.trim()} />
        ) : (
          <div
            key={`${summaryFilter}-${activeFilter}`}
            className={`predictions-list-container content-fade-in view-switch-wrapper ${viewTransitioning ? 'view-switch-out' : 'view-switch-in'} ${
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 gap-3'
                : 'space-y-3'
            }`}
            data-testid="predictions-list"
            data-view-mode={viewMode}
          >
            {filtered.map((pred, i) => (
              <PredictionCard
                key={pred.prediction_id}
                data={pred}
                index={i}
                viewMode={viewMode}
                onEdit={handleEditPrediction}
                onRemove={handleRemovePrediction}
                onEditExactScore={handleEditExactScore}
                onRemoveExactScore={handleRemoveExactScore}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default MyPredictionsPage;
