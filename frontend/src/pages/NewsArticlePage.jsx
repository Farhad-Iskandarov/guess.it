import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, Tag, ArrowLeft } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const resolveImg = (url) => url?.startsWith('/') ? `${API_URL}${url}` : url;

export const NewsArticlePage = () => {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/news/${articleId}`);
        if (res.ok) {
          const data = await res.json();
          setArticle(data.article);
          setSimilar(data.similar || []);
        } else {
          navigate('/news', { replace: true });
        }
      } catch {
        navigate('/news', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [articleId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) return null;

  const coverImg = resolveImg(article.image_url);
  const hasBlocks = article.content_blocks && article.content_blocks.length > 0;

  return (
    <div className="min-h-screen bg-background" data-testid="news-article-page">
      {/* Cover image — full width, no overlay */}
      {coverImg && (
        <div className="w-full max-h-[480px] overflow-hidden bg-secondary">
          <img 
            src={coverImg} 
            alt={article.title} 
            className="w-full h-full object-cover"
            style={{ maxHeight: '480px' }}
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back button */}
        <button
          onClick={() => navigate('/news')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          data-testid="back-to-news"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to News
        </button>

        {/* Article meta */}
        <div className="flex items-center gap-3 mb-4">
          {article.category && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-xs font-semibold">
              <Tag className="w-3 h-3" />
              {article.category}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-10" data-testid="article-title">
          {article.title}
        </h1>

        {/* Content blocks */}
        <div className="space-y-8" data-testid="article-content">
          {hasBlocks ? (
            article.content_blocks.map((block, idx) => {
              if (block.type === 'text') {
                return (
                  <div key={idx} className="text-base md:text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {block.value}
                  </div>
                );
              }
              if (block.type === 'image' && block.url) {
                const imgUrl = resolveImg(block.url);
                return (
                  <figure key={idx} className="my-10 flex justify-center">
                    <img
                      src={imgUrl}
                      alt=""
                      className="rounded-xl max-w-full h-auto shadow-lg"
                      style={{ maxHeight: '600px' }}
                    />
                  </figure>
                );
              }
              return null;
            })
          ) : (
            // Fallback for old articles with plain content
            <div className="text-base md:text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {article.content}
            </div>
          )}
        </div>
      </div>

      {/* Similar articles */}
      {similar.length > 0 && (
        <div className="border-t border-border mt-16">
          <div className="container mx-auto px-4 py-12 max-w-5xl">
            <h2 className="text-2xl font-bold text-foreground mb-8">More News</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {similar.map((item) => {
                const img = resolveImg(item.image_url);
                return (
                  <Link
                    key={item.article_id}
                    to={`/news/${item.article_id}`}
                    className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all duration-300"
                    data-testid={`similar-article-${item.article_id}`}
                  >
                    {img && (
                      <div className="h-40 overflow-hidden bg-secondary">
                        <img src={img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">{item.title}</h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsArticlePage;
