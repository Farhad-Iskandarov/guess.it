import { useNavigate } from 'react-router-dom';
import { Trophy, Users, Star, TrendingUp, Award, Target, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const HowItWorksPage = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: Trophy,
      title: 'Browse Live Matches',
      description: 'Explore upcoming and live football matches from top leagues worldwide.'
    },
    {
      icon: Target,
      title: 'Make Your Prediction',
      description: 'Choose your predicted outcome: Home Win, Draw, or Away Win for each match.'
    },
    {
      icon: CheckCircle,
      title: 'Earn Points',
      description: 'Get +10 points for correct predictions, -5 points for wrong ones. Track your accuracy!'
    },
    {
      icon: TrendingUp,
      title: 'Level Up',
      description: 'Gain experience and unlock new levels as you make more predictions.'
    },
    {
      icon: Users,
      title: 'Compete with Friends',
      description: 'Add friends, compare scores, and see who\'s the best predictor.'
    },
    {
      icon: Award,
      title: 'Climb the Leaderboard',
      description: 'Compete globally and rise to the top of the leaderboard rankings!'
    }
  ];

  const features = [
    { title: 'Live Match Updates', description: 'Real-time scores and match status via WebSocket' },
    { title: 'Prediction Streaks', description: 'Track your winning and losing streaks' },
    { title: 'Friend System', description: 'Send requests, chat, and compare predictions' },
    { title: 'Level & Points', description: 'Gamified progression system with ranks' },
    { title: 'Favorite Teams', description: 'Follow your favorite teams and get quick access' },
    { title: 'Dark/Light Mode', description: 'Customizable theme for comfortable viewing' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            How <span className="text-primary">GuessIt</span> Works
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Predict football match outcomes, earn points, compete with friends, and climb the leaderboard!
          </p>
        </div>
      </div>

      {/* Steps Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div 
                key={idx} 
                className="relative p-6 rounded-2xl border border-border bg-card hover:bg-card/80 hover:border-primary/50 transition-all duration-300 group"
                data-testid={`step-${idx}`}
              >
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-secondary/30 border-y border-border py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Platform Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-background border border-border hover:border-primary/50 transition-colors">
                <h4 className="font-semibold text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">Join thousands of football fans making predictions!</p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" onClick={() => navigate('/register')} data-testid="cta-register">
            Create Account
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/')} data-testid="cta-browse">
            Browse Matches
          </Button>
        </div>
      </div>
    </div>
  );
};
