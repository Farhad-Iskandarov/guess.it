import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, User, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const ChooseNicknamePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, requiresNickname, setNickname, checkNickname } = useAuth();
  
  const [nickname, setNicknameValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');

  const debouncedNickname = useDebounce(nickname, 500);

  // Redirect if not authenticated or nickname already set
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (!requiresNickname && user?.nickname_set) {
      navigate('/');
    }
  }, [isAuthenticated, requiresNickname, user, navigate]);

  // Check nickname availability when debounced value changes
  useEffect(() => {
    const checkAvailability = async () => {
      if (!debouncedNickname || debouncedNickname.length < 3) {
        setAvailability(null);
        setSuggestions([]);
        return;
      }

      // Client-side validation
      if (debouncedNickname.length > 20) {
        setAvailability({ available: false, message: 'Nickname must be 3-20 characters' });
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(debouncedNickname)) {
        setAvailability({ available: false, message: 'Only letters, numbers, and underscores allowed' });
        return;
      }

      setIsChecking(true);
      try {
        const result = await checkNickname(debouncedNickname);
        setAvailability(result);
        setSuggestions(result.suggestions || []);
      } catch (error) {
        console.error('Nickname check error:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAvailability();
  }, [debouncedNickname, checkNickname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!nickname || nickname.length < 3) {
      setError('Nickname must be at least 3 characters');
      return;
    }

    if (!availability?.available) {
      setError('Please choose an available nickname');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await setNickname(nickname);
      toast.success('Nickname set!', {
        description: `Welcome to GuessIt, ${nickname}!`,
      });
      navigate('/');
    } catch (error) {
      setError(error.message);
      if (error.suggestions) {
        setSuggestions(error.suggestions);
      }
      toast.error('Failed to set nickname', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setNicknameValue(suggestion);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
            <span className="text-primary font-bold text-xl">G</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-primary">GUESS</span>
            <span className="text-foreground">IT</span>
          </span>
        </Link>

        <Card className="bg-card border-border">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Choose Your Nickname</CardTitle>
            <CardDescription>
              This is how other players will see you. Pick something memorable!
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="Enter your nickname"
                    value={nickname}
                    onChange={(e) => setNicknameValue(e.target.value.trim())}
                    className={`pl-9 pr-9 ${
                      availability?.available === false ? 'border-destructive' : 
                      availability?.available === true ? 'border-primary' : ''
                    }`}
                    disabled={isLoading}
                    maxLength={20}
                  />
                  <div className="absolute right-3 top-3">
                    {isChecking ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : availability?.available === true ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : availability?.available === false ? (
                      <X className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                </div>
                
                {/* Availability message */}
                {availability && (
                  <p className={`text-sm ${availability.available ? 'text-primary' : 'text-destructive'}`}>
                    {availability.message}
                  </p>
                )}
                
                {/* Requirements */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 3-20 characters</p>
                  <p>• Letters, numbers, and underscores only</p>
                  <p>• No spaces</p>
                </div>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Suggested alternatives:</Label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/20 hover:border-primary transition-colors"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90"
                disabled={isLoading || isChecking || !availability?.available}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting nickname...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChooseNicknamePage;
