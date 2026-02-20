import { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, TrendingUp, Award } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const LeaderboardPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${API_URL}/api/football/leaderboard?limit=50`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-600" />;
    return null;
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400 to-gray-500 text-white';
    if (rank === 3) return 'bg-gradient-to-r from-orange-500 to-orange-700 text-white';
    return 'bg-secondary text-foreground';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-16 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Global <span className="text-primary">Leaderboard</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See who's dominating the prediction game. Can you make it to the top?
          </p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="container mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-secondary/30 px-6 py-4 border-b border-border">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-muted-foreground">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-5 sm:col-span-6">Player</div>
              <div className="col-span-2 text-center hidden sm:block">Level</div>
              <div className="col-span-3 sm:col-span-2 text-right">Points</div>
              <div className="col-span-3 sm:col-span-1 text-right">Accuracy</div>
            </div>
          </div>

          {/* Body */}
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">Loading leaderboard...</div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No users yet. Be the first!</div>
            ) : (
              users.map((user, idx) => {
                const rank = idx + 1;
                const accuracy = user.predictions_count > 0 
                  ? Math.round((user.correct_predictions / user.predictions_count) * 100) 
                  : 0;

                return (
                  <div 
                    key={user.user_id} 
                    className={`grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-secondary/20 transition-colors ${rank <= 3 ? 'bg-primary/5' : ''}`}
                    data-testid={`leaderboard-row-${rank}`}
                  >
                    {/* Rank */}
                    <div className="col-span-1 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${getRankBadge(rank)}`}>
                        {getRankIcon(rank) || rank}
                      </div>
                    </div>

                    {/* Player */}
                    <div className="col-span-5 sm:col-span-6 flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.picture?.startsWith('/') ? `${API_URL}${user.picture}` : user.picture} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {(user.nickname || user.email || '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{user.nickname || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.predictions_count || 0} predictions</p>
                      </div>
                    </div>

                    {/* Level */}
                    <div className="col-span-2 text-center hidden sm:block">
                      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        <Award className="w-3.5 h-3.5" />
                        {user.level || 1}
                      </div>
                    </div>

                    {/* Points */}
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <div className="inline-flex items-center gap-1 font-bold text-lg text-foreground">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        {user.points || 0}
                      </div>
                    </div>

                    {/* Accuracy */}
                    <div className="col-span-3 sm:col-span-1 text-right">
                      <span className={`font-semibold text-sm ${
                        accuracy >= 70 ? 'text-emerald-500' : 
                        accuracy >= 50 ? 'text-amber-500' : 
                        'text-red-500'
                      }`}>
                        {accuracy}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
