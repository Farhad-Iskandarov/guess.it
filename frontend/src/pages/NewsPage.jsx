import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const NewsPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`${API_URL}/api/news`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <div className="min-h-screen bg-background" data-testid="news-page">
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
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground">No news articles yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Check back soon for updates!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => {
              const imageUrl = article.image_url?.startsWith('/') ? `${API_URL}${article.image_url}` : article.image_url;
              return (
                <article 
                  key={article.article_id} 
                  className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
                  data-testid={`news-article-${article.article_id}`}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden bg-secondary">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Tag className="w-12 h-12 opacity-30" />
                      </div>
                    )}
                    {article.category && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-xs font-semibold">
                          <Tag className="w-3 h-3" />
                          {article.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>
                    <Link to={`/news/${article.article_id}`}>
                      <Button variant="ghost" size="sm" className="group/btn gap-2 p-0 h-auto hover:bg-transparent" data-testid={`read-more-${article.article_id}`}>
                        <span className="text-primary font-semibold">Read More</span>
                        <ArrowRight className="w-4 h-4 text-primary group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsPage;
