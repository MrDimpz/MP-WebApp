import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, LogIn, Mail, Moon, Sun } from 'lucide-react';
import { getCleanDisplayName, useUnifiedAuth } from '@/lib/unified-game-auth';
import { LoggedInIndicator } from '@/components/logged-in-indicator';
import { UserProfileIcon } from '@/components/user-profile-icon';
import { UnifiedAuthModal } from '@/components/solo-games/unified-auth-modal';
import { AdminPortalModal } from '@/components/interactive-games/admin-portal-modal';
import { ContactUsModal } from '@/components/contact-us-modal';
import { LanguageMenu } from '@/components/language-menu';

const SITE_DARK_MODE_KEY = 'mp_site_dark_mode_v2';

export function SiteHeader() {
  const { user } = useUnifiedAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'account' | 'leaderboards'>('account');
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SITE_DARK_MODE_KEY);
      if (saved !== null) return saved !== 'false';
    } catch {}
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(SITE_DARK_MODE_KEY, String(darkMode));
    } catch {}
  }, [darkMode]);

  useEffect(() => {
    const handleOpenAuth = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: 'account' | 'leaderboards' }>).detail;
      setAuthModalTab(detail?.tab || 'account');
      setAuthModalOpen(true);
    };
    window.addEventListener('open-site-auth-modal', handleOpenAuth);

    const params = new URLSearchParams(window.location.search);
    if (params.get('oobCode') || params.get('resetToken') || params.get('reset_token')) {
      setAuthModalTab('account');
      setAuthModalOpen(true);
    }
    return () => window.removeEventListener('open-site-auth-modal', handleOpenAuth);
  }, []);

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="The Missing Piece home">
          <picture>
            <source srcSet="/brand-logo.webp" type="image/webp" />
            <img
              className="brand-logo"
              src="/brand-logo.png"
              width={76}
              height={76}
              decoding="async"
              alt="The Missing Piece — Find your space"
            />
          </picture>
          <span className="brand-name">
            THE MISSING
            <br />
            <span>PIECE</span>
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <Link to="/interactive-games">
            TikTok interactive <ArrowUpRight size={15} />
          </Link>
          <Link to="/solo-games">
            Solo games <ArrowUpRight size={15} />
          </Link>
          <a
            href="https://thegorillashack.co.uk/"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Gorilla Shack <ArrowUpRight size={15} />
          </a>
        </nav>

        <div className="header-actions">
          <LoggedInIndicator />
          <button
            type="button"
            className="header-auth-btn"
            onClick={() => {
              setAuthModalTab('account');
              setAuthModalOpen(true);
            }}
          >
            {user ? (
              <>
                <UserProfileIcon user={user} size={18} className="w-4 h-4 shrink-0" />
                <span>{getCleanDisplayName(user)}</span>
              </>
            ) : (
              <>
                <LogIn size={15} />
                <span>Sign in</span>
              </>
            )}
          </button>
          <LanguageMenu variant="header" />
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="header-action"
            aria-label="Contact us by email"
          >
            <Mail size={15} />
            <span>Contact us</span>
          </button>
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="header-action"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <UnifiedAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={user}
        initialTab={authModalTab}
      />
      <AdminPortalModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />
      <ContactUsModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />
    </>
  );
}
