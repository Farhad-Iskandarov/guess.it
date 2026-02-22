import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/lib/AuthContext';
import { Check, Crown, Shield, Star, Loader2, Sparkles, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const planIcons = {
  plan_standard: Shield,
  plan_champion: Star,
  plan_elite: Crown,
};

const planAccents = {
  plan_standard: {
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_30px_rgba(34,197,94,0.15)]',
    hoverGlow: 'hover:shadow-[0_0_40px_rgba(34,197,94,0.25)]',
    badge: 'bg-emerald-500/15 text-emerald-400',
    btn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    iconColor: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    checkColor: 'text-emerald-400',
  },
  plan_champion: {
    border: 'border-blue-500/40',
    glow: 'shadow-[0_0_40px_rgba(59,130,246,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_50px_rgba(59,130,246,0.35)]',
    badge: 'bg-blue-500/15 text-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white',
    iconColor: 'text-blue-400',
    ring: 'ring-blue-500/20',
    checkColor: 'text-blue-400',
  },
  plan_elite: {
    border: 'border-purple-500/40',
    glow: 'shadow-[0_0_40px_rgba(168,85,247,0.2)]',
    hoverGlow: 'hover:shadow-[0_0_50px_rgba(168,85,247,0.35)]',
    badge: 'bg-purple-500/15 text-purple-400',
    btn: 'bg-purple-600 hover:bg-purple-500 text-white',
    iconColor: 'text-purple-400',
    ring: 'ring-purple-500/20',
    checkColor: 'text-purple-400',
  },
};

const PlanCard = ({ plan, accent, isPopular, onSubscribe, isLoading, currentPlan }) => {
  const Icon = planIcons[plan.plan_id] || Shield;
  const isCurrentPlan = currentPlan === plan.plan_id;

  return (
    <div
      className={`relative group rounded-2xl border ${accent.border} ${accent.glow} ${accent.hoverGlow} bg-[#1a242d]/80 backdrop-blur-xl p-6 md:p-8 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1 ${isPopular ? 'md:scale-105 md:-translate-y-2 z-10' : ''}`}
      data-testid={`plan-card-${plan.plan_id}`}
    >
      {isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5" />
          Most Popular
        </div>
      )}

      {/* Icon */}
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${accent.badge} ring-1 ${accent.ring}`}>
        <Icon className={`w-7 h-7 ${accent.iconColor}`} />
      </div>

      {/* Name */}
      <h3 className="text-xl font-bold text-white tracking-tight mb-1">{plan.name}</h3>
      
      {/* Badge */}
      <span className={`inline-block text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full ${accent.badge} mb-5`}>
        {plan.interval === 'month' ? 'Monthly' : plan.interval}
      </span>

      {/* Price */}
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl md:text-5xl font-black text-white tracking-tighter">${plan.price}</span>
        <span className="text-sm text-gray-400 font-medium">/mo</span>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {plan.features?.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-sm">
            <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${accent.checkColor}`} />
            <span className="text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrentPlan ? (
        <div className={`w-full py-3 rounded-xl text-center text-sm font-semibold ${accent.badge} border ${accent.border}`} data-testid={`plan-active-${plan.plan_id}`}>
          Current Plan
        </div>
      ) : (
        <Button
          onClick={() => onSubscribe(plan.plan_id)}
          disabled={isLoading}
          className={`w-full py-3 h-12 rounded-xl text-sm font-bold transition-all duration-300 ${accent.btn} hover:scale-[1.02] active:scale-[0.98]`}
          data-testid={`plan-subscribe-${plan.plan_id}`}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe Now'}
        </Button>
      )}
    </div>
  );
};

// Success page shown after Stripe payment
const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking');
  const [sub, setSub] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (!sessionId) { setStatus('error'); return; }

    let attempts = 0;
    const maxAttempts = 10;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/subscriptions/checkout/status/${sessionId}`, { credentials: 'include' });
        const data = await res.json();

        if (data.payment_status === 'paid') {
          setStatus('success');
          setSub(data.subscription);
          return;
        }
        if (data.status === 'expired') { setStatus('expired'); return; }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000);
        } else {
          setStatus('timeout');
        }
      } catch {
        setStatus('error');
      }
    };
    checkStatus();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === 'checking' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <h2 className="text-xl font-bold text-white">Confirming your payment...</h2>
            <p className="text-gray-400 text-sm">Please wait while we verify your subscription.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Subscription Activated!</h2>
            <p className="text-gray-400">Welcome to <span className="text-white font-semibold">{sub?.plan_name}</span>. Your premium features are now active.</p>
            <Button onClick={() => navigate('/')} className="mt-4 gap-2" data-testid="success-go-home">
              <ArrowLeft className="w-4 h-4" /> Go to Homepage
            </Button>
          </>
        )}
        {(status === 'error' || status === 'expired' || status === 'timeout') && (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {status === 'expired' ? 'Session Expired' : 'Something went wrong'}
            </h2>
            <p className="text-gray-400 text-sm">
              {status === 'expired' ? 'Your checkout session has expired. Please try again.' : 'We couldn\'t verify your payment. Please contact support if you were charged.'}
            </p>
            <Button onClick={() => navigate('/subscribe')} variant="outline" className="mt-4 gap-2" data-testid="retry-subscribe">
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// Main Subscription Page
const SubscriptionPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [mySub, setMySub] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, subRes] = await Promise.all([
          fetch(`${API_URL}/api/subscriptions/plans`).then(r => r.json()),
          isAuthenticated
            ? fetch(`${API_URL}/api/subscriptions/my-subscription`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
            : Promise.resolve(null)
        ]);
        setPlans(plansRes.plans || []);
        if (subRes?.subscription) setMySub(subRes.subscription);
      } catch (err) {
        console.error('Failed to load plans:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAuthenticated]);

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setSubscribing(planId);
    try {
      const res = await fetch(`${API_URL}/api/subscriptions/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plan_id: planId,
          origin_url: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create checkout');
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;
    try {
      const res = await fetch(`${API_URL}/api/subscriptions/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setMySub(null);
        window.location.reload();
      }
    } catch (err) {
      alert('Failed to cancel subscription');
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="subscription-page">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-12 md:mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase mb-4">
            <Crown className="w-3.5 h-3.5" />
            Premium Plans
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            Upgrade Your <span className="text-primary">Game</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            Get exclusive prediction insights, premium badges, and advanced analytics to dominate the leaderboard.
          </p>
        </div>

        {/* Plans Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 lg:gap-6 items-start">
            {plans.map((plan) => (
              <PlanCard
                key={plan.plan_id}
                plan={plan}
                accent={planAccents[plan.plan_id] || planAccents.plan_standard}
                isPopular={plan.plan_id === 'plan_champion'}
                onSubscribe={handleSubscribe}
                isLoading={subscribing === plan.plan_id}
                currentPlan={mySub?.plan_id}
              />
            ))}
          </div>
        )}

        {/* Active Subscription Banner */}
        {mySub && (
          <div className="mt-10 p-5 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-4" data-testid="active-subscription-banner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Active: {mySub.plan_name} Plan</p>
                <p className="text-xs text-gray-400">Since {new Date(mySub.activated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCancel} className="text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid="cancel-subscription-btn">
              Cancel Subscription
            </Button>
          </div>
        )}

        {/* FAQ hint */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            All plans are billed monthly. Cancel anytime. No hidden fees.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export { SubscriptionPage, SubscriptionSuccess };
export default SubscriptionPage;
