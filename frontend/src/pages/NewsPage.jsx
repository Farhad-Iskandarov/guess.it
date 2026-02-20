import { Calendar, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NewsPage = () => {
  const newsArticles = [
    {
      id: 1,
      title: 'GuessIt Launches Global Leaderboard',
      excerpt: 'Compete with players worldwide and see how you rank among the best predictors.',
      date: '2026-02-15',
      category: 'Feature',
      image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&h=400&fit=crop'
    },
    {
      id: 2,
      title: 'New Prediction Streaks Feature',
      excerpt: 'Track your winning and losing streaks. Can you maintain a perfect record?',
      date: '2026-02-10',
      category: 'Update',
      image: 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=800&h=400&fit=crop'
    },
    {
      id: 3,
      title: 'Real-Time Match Updates Now Live',
      excerpt: 'Get instant score updates via WebSocket technology. Never miss a goal!',
      date: '2026-02-05',
      category: 'Feature',
      image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&h=400&fit=crop'
    },
    {
      id: 4,
      title: 'Friend System & Messaging',
      excerpt: 'Add friends, chat, and compare predictions. Football is better with friends!',
      date: '2026-01-28',
      category: 'Feature',
      image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=400&fit=crop'
    },
    {
      id: 5,
      title: 'Dark Mode Now Available',
      excerpt: 'Switch between light and dark themes for comfortable viewing anytime.',
      date: '2026-01-20',
      category: 'Update',
      image: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=800&h=400&fit=crop'
    },
    {
      id: 6,
      title: 'Level System & Rewards',
      excerpt: 'Earn XP, level up, and unlock achievements as you make more predictions.',
      date: '2026-01-15',
      category: 'Feature',
      image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=400&fit=crop'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/20 via-background to-background border-b border-border">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Latest <span className="text-primary">News</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stay updated with new features, updates, and announcements from GuessIt.
          </p>
        </div>
      </div>

      {/* News Grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {newsArticles.map((article) => (
            <article 
              key={article.id} 
              className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
              data-testid={`news-article-${article.id}`}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden bg-secondary">
                <img 
                  src={article.image} 
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-xs font-semibold">
                    <Tag className="w-3 h-3" />
                    {article.category}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {article.excerpt}
                </p>
                <Button variant="ghost" size="sm" className="group/btn gap-2 p-0 h-auto hover:bg-transparent">
                  <span className="text-primary font-semibold">Read More</span>
                  <ArrowRight className="w-4 h-4 text-primary group-hover/btn:translate-x-1 transition-transform" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Newsletter CTA */}
      <div className="bg-secondary/30 border-t border-border py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Never Miss an Update</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Subscribe to our newsletter and be the first to know about new features and updates.
          </p>
          <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
            <input 
              type="email" 
              placeholder="Enter your email"
              className="flex-1 h-10 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button>Subscribe</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
