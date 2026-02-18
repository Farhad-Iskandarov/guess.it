import { Link } from 'react-router-dom';
import { 
  Twitter, 
  Instagram, 
  Facebook, 
  Mail,
  Trophy,
  Users,
  Home,
  Calendar,
  HelpCircle,
  FileText,
  Shield,
  Info
} from 'lucide-react';

const FooterLogo = () => {
  const handleClick = (e) => {
    e.preventDefault();
    if (window.location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.href = '/';
    }
  };

  return (
    <a href="/" onClick={handleClick} className="flex items-center gap-2 group no-underline cursor-pointer" data-testid="footer-logo">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-lg">
        G
      </div>
      <span className="text-xl font-bold">
        <span className="text-primary">GUESS</span>
        <span className="text-foreground">IT</span>
      </span>
    </a>
  );
};

const FooterLink = ({ to, icon: Icon, children, external }) => {
  const baseClasses = "flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors duration-200 text-sm";
  
  if (external) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={baseClasses}>
        {Icon && <Icon className="w-4 h-4" />}
        <span>{children}</span>
      </a>
    );
  }
  
  return (
    <Link to={to} className={baseClasses}>
      {Icon && <Icon className="w-4 h-4" />}
      <span>{children}</span>
    </Link>
  );
};

const SocialIcon = ({ href, icon: Icon, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={label}
    className="flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 hover:bg-primary/20 hover:text-primary text-muted-foreground transition-all duration-200"
  >
    <Icon className="w-5 h-5" />
  </a>
);

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-card/80 border-t border-border mt-auto" data-testid="footer">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Section 1: Brand */}
          <div className="space-y-4">
            <FooterLogo />
            <p className="text-muted-foreground text-sm leading-relaxed">
              GuessIt is a football prediction and social platform where fans analyze, predict, and compete with friends.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
              <Trophy className="w-4 h-4 text-primary" />
              <span>Predict. Compete. Win bragging rights.</span>
            </div>
          </div>

          {/* Section 2: Platform Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Platform
            </h4>
            <nav className="flex flex-col gap-3">
              <FooterLink to="/" icon={Home}>Home</FooterLink>
              <FooterLink to="/" icon={Calendar}>Matches</FooterLink>
              <FooterLink to="/" icon={Trophy}>Leaderboard</FooterLink>
              <FooterLink to="/" icon={Users}>Community</FooterLink>
              <FooterLink to="/" icon={HelpCircle}>How It Works</FooterLink>
            </nav>
          </div>

          {/* Section 3: Legal & Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Company
            </h4>
            <nav className="flex flex-col gap-3">
              <FooterLink to="/" icon={Info}>About Us</FooterLink>
              <FooterLink to="/" icon={FileText}>Terms of Service</FooterLink>
              <FooterLink to="/" icon={Shield}>Privacy Policy</FooterLink>
              <FooterLink to="/" icon={Mail}>Contact</FooterLink>
            </nav>
            
            {/* Disclaimer */}
            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-primary font-medium">Important:</span> GuessIt is not a gambling platform. No real money is involved. This is a social prediction game for entertainment only.
              </p>
            </div>
          </div>

          {/* Section 4: Social & Newsletter */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Connect
            </h4>
            
            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <SocialIcon href="https://twitter.com" icon={Twitter} label="Twitter" />
              <SocialIcon href="https://instagram.com" icon={Instagram} label="Instagram" />
              <SocialIcon href="https://facebook.com" icon={Facebook} label="Facebook" />
            </div>
            
            {/* Newsletter Placeholder */}
            <div className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Stay updated with match predictions and community news.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-3 py-2 text-sm rounded-lg bg-muted/50 border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  disabled
                />
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors duration-200 disabled:opacity-50"
                  disabled
                  title="Coming soon"
                >
                  Subscribe
                </button>
              </div>
              <p className="text-xs text-muted-foreground/60">Newsletter coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-xs text-muted-foreground text-center md:text-left">
              © {currentYear} GuessIt. All rights reserved.
            </p>
            
            {/* Bottom Links */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary transition-colors">Terms</Link>
              <span className="text-border">|</span>
              <Link to="/" className="hover:text-primary transition-colors">Privacy</Link>
              <span className="text-border">|</span>
              <Link to="/" className="hover:text-primary transition-colors">Cookies</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
