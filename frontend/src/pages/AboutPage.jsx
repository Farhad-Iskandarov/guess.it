import { Trophy, Target, Users, TrendingUp, Heart, Shield } from 'lucide-react';

export const AboutPage = () => {
  const values = [
    { icon: Trophy, title: 'Competition', description: 'We believe in healthy competition and the thrill of predicting match outcomes.' },
    { icon: Users, title: 'Community', description: 'Connect with fellow football fans, make friends, and share your passion.' },
    { icon: Target, title: 'Accuracy', description: 'Real-time data from Football-Data.org ensures you always have the latest match info.' },
    { icon: TrendingUp, title: 'Growth', description: 'Level up your prediction skills and track your progress over time.' },
    { icon: Heart, title: 'Passion', description: 'Built by football lovers, for football lovers. We live and breathe the game.' },
    { icon: Shield, title: 'Fair Play', description: 'Transparent scoring system. Everyone starts equal, and skill determines success.' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl md:text-5xl font-bold text-center text-foreground mb-6">
            About <span className="text-primary">GuessIt</span>
          </h1>
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
            GuessIt is a football prediction platform where fans can test their knowledge, compete with friends, 
            and climb the global leaderboard. We combine real-time match data with social features to create 
            the ultimate prediction experience.
          </p>
        </div>
      </div>

      {/* Mission */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-foreground mb-6 text-center">Our Mission</h2>
          <p className="text-muted-foreground text-lg leading-relaxed text-center mb-8">
            To bring football fans together through the excitement of predictions. We're building a platform 
            where your knowledge of the game translates into points, levels, and bragging rights. Whether you're 
            a casual fan or a football encyclopedia, GuessIt is your arena.
          </p>
        </div>
      </div>

      {/* Values */}
      <div className="bg-secondary/30 border-y border-border py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">What We Stand For</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, idx) => {
              const Icon = value.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">By the Numbers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <p className="text-4xl font-bold text-primary mb-2">10K+</p>
            <p className="text-sm text-muted-foreground">Predictions Made</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-primary mb-2">500+</p>
            <p className="text-sm text-muted-foreground">Active Users</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-primary mb-2">24/7</p>
            <p className="text-sm text-muted-foreground">Live Match Updates</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold text-primary mb-2">100%</p>
            <p className="text-sm text-muted-foreground">Free to Play</p>
          </div>
        </div>
      </div>

      {/* Technology */}
      <div className="bg-gradient-to-br from-background to-secondary/20 border-t border-border py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">Powered by Modern Technology</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
            Built with React, FastAPI, and MongoDB. Real-time updates via WebSocket. 
            Match data powered by Football-Data.org API.
          </p>
        </div>
      </div>
    </div>
  );
};
