import { Component } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Global + Section Error Boundary
 *
 * variant="global"  → full-screen takeover (outermost fallback)
 * variant="section" → inline card inside existing layout (per-route)
 *
 * Automatically reports errors to backend for admin visibility.
 * Rate-limited client-side (max 5 per minute) to prevent spam.
 */

// ── Client-side rate limiter ──
const _reportLog = [];
const MAX_REPORTS = 5;
const WINDOW_MS = 60_000;

function canReport() {
  const now = Date.now();
  while (_reportLog.length && _reportLog[0] < now - WINDOW_MS) _reportLog.shift();
  if (_reportLog.length >= MAX_REPORTS) return false;
  _reportLog.push(now);
  return true;
}

function reportToBackend(error, errorInfo, label) {
  if (!canReport()) return;

  const payload = {
    message: error?.message || String(error),
    stack: error?.stack || '',
    componentStack: errorInfo?.componentStack || '',
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    boundaryLabel: label || 'Unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    screen: typeof window !== 'undefined' ? `${window.screen?.width}x${window.screen?.height}` : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
  };

  // Try to attach userId from cookie-based session (stored in localStorage by app)
  try {
    const stored = localStorage.getItem('guessit-user');
    if (stored) {
      const u = JSON.parse(stored);
      if (u?.user_id) payload.userId = u.user_id;
    }
  } catch { /* ignore */ }

  // Fire-and-forget — never block UI
  fetch(`${API_URL}/api/error-logs/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => { /* silently ignore network failures */ });
}


class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const label = this.props.label || 'Unknown';
    console.error(`[ErrorBoundary:${label}] Caught error:`, error);
    console.error(`[ErrorBoundary:${label}] Component stack:`, errorInfo?.componentStack);

    // Silent POST to backend
    reportToBackend(error, errorInfo, label);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const variant = this.props.variant || 'global';
    return variant === 'section' ? this.renderSection() : this.renderGlobal();
  }

  /* ─── Inline section fallback ─── */
  renderSection() {
    const testId = this.props.testId || 'section-error-fallback';
    return (
      <div
        className="flex flex-col items-center justify-center py-24 px-6 text-center"
        data-testid={testId}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(142,70%,45%)]/10 border border-[hsl(142,70%,45%)]/20 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[hsl(142,70%,45%)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-foreground tracking-tight mb-1">
          Something went wrong in this section
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          An unexpected error occurred. Please try again.
        </p>

        <div className="flex gap-3">
          <button
            onClick={this.handleRetry}
            data-testid={`${testId}-retry-btn`}
            className="px-5 py-2 rounded-xl bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white text-sm font-semibold transition-colors"
          >
            Retry
          </button>
          <button
            onClick={this.handleGoHome}
            data-testid={`${testId}-home-btn`}
            className="px-5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground text-sm font-medium transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  /* ─── Full-page global fallback ─── */
  renderGlobal() {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[hsl(0,0%,8%)]"
        data-testid="error-boundary-fallback"
      >
        <div className="absolute w-[260px] h-[260px] rounded-full bg-[hsl(142,70%,45%)] opacity-[0.04] blur-[90px]" />

        <div className="relative flex flex-col items-center gap-5 max-w-sm px-6 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(142,70%,45%)]/10 border border-[hsl(142,70%,45%)]/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-[hsl(142,70%,45%)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-[hsl(0,0%,50%)] leading-relaxed">
              An unexpected error occurred. Please try again.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 w-full mt-1">
            <button
              onClick={this.handleReload}
              data-testid="error-boundary-reload-btn"
              className="w-full px-5 py-2.5 rounded-xl bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white text-sm font-semibold transition-colors"
            >
              Reload page
            </button>
            <button
              onClick={this.handleGoHome}
              data-testid="error-boundary-home-btn"
              className="w-full px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[hsl(0,0%,65%)] text-sm font-medium transition-colors"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
