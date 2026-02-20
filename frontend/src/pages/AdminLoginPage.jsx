import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loginEmail, logout } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [accessDenied, setAccessDenied] = useState(false);

  // If already authenticated as admin, go to dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    setAccessDenied(false);

    try {
      const result = await loginEmail(email, password);

      // Check if user has admin role
      if (result.user?.role !== 'admin') {
        // Not an admin — log them out immediately and show denied
        await logout();
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      // Check if nickname needs to be set first
      if (result.requires_nickname) {
        navigate('/choose-nickname', { state: { returnTo: '/itguess/admin/login' } });
        return;
      }

      toast.success('Admin access granted', {
        description: `Welcome, ${result.user.nickname || result.user.email}`,
      });
      navigate('/admin', { replace: true });
    } catch (error) {
      const msg = error.message || 'Invalid credentials';
      toast.error('Login failed', { description: msg });
      setErrors({ form: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,6%)] flex flex-col items-center justify-center p-4 relative overflow-hidden" data-testid="admin-login-page">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-emerald-600/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      </div>

      {/* Main card */}
      <div className="relative w-full max-w-[400px]">
        {/* Shield icon + title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Panel</h1>
          <p className="text-sm text-zinc-500 mt-1">Authorized personnel only</p>
        </div>

        {/* Access Denied state */}
        {accessDenied && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in duration-300" data-testid="admin-access-denied">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400">Access Denied</p>
              <p className="text-xs text-red-400/70 mt-0.5">This account does not have administrator privileges. Contact the system administrator if you believe this is an error.</p>
            </div>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="admin-login-form">
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 space-y-4 backdrop-blur-sm">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setAccessDenied(false); }}
                  className={`pl-10 h-11 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 ${errors.email ? 'border-red-500/50' : ''}`}
                  disabled={isLoading}
                  data-testid="admin-email-input"
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setAccessDenied(false); }}
                  className={`pl-10 pr-10 h-11 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 ${errors.password ? 'border-red-500/50' : ''}`}
                  disabled={isLoading}
                  data-testid="admin-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            {errors.form && <p className="text-xs text-red-400 text-center">{errors.form}</p>}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            disabled={isLoading}
            data-testid="admin-login-submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Sign In to Admin Panel
              </>
            )}
          </Button>
        </form>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            data-testid="admin-back-to-home"
          >
            Back to GuessIt
          </button>
        </div>

        {/* Security notice */}
        <div className="mt-8 flex items-center justify-center gap-2 text-zinc-700">
          <Lock className="w-3 h-3" />
          <span className="text-[10px] uppercase tracking-widest font-medium">Secured access</span>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
