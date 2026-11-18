import React, { useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Download, KeyRound, LoaderCircle, MonitorPlay, Users } from 'lucide-react';
import { openCookiePreferences } from '@/lib/cookie-consent';
import { AdminPortalModal } from '@/components/interactive-games/admin-portal-modal';
import { AdminPanelModal } from '@/components/admin-panel-modal';

export function SiteFooter() {
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  const showHostingerDownload =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.run.app'));

  const handleDownloadHostingerZip = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (downloadingZip) return;
    setDownloadingZip(true);
    try {
      const response = await fetch(`/api/download-hostinger-zip?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = blobUrl;
      tempLink.download = 'the-missing-piece-hostinger.zip';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      const fallbackLink = document.createElement('a');
      fallbackLink.href = '/the-missing-piece-hostinger.zip';
      fallbackLink.download = 'the-missing-piece-hostinger.zip';
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <>
      <footer className="site-footer">
        <div className="footer-main">
          <Link to="/" className="brand" aria-label="The Missing Piece home">
            <picture>
              <source srcSet="/brand-logo.webp" type="image/webp" />
              <img
                className="brand-logo"
                src="/brand-logo.png"
                width={76}
                height={76}
                loading="lazy"
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
          <p>Find Your Space.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              to="/interactive-games/overlays"
              className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline underline-offset-4 whitespace-nowrap"
            >
              <MonitorPlay size={15} /> All interactive overlays
            </Link>
            <Link
              to="/#games"
              className="inline-flex items-center gap-2 text-xs font-medium hover:underline underline-offset-4 whitespace-nowrap"
            >
              Back to the games <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 The Missing Piece</span>
          <span>Independent of TikTok.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              type="button"
              onClick={() => setAdminModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <KeyRound size={11} /> Admin keys
            </button>
            <button
              type="button"
              onClick={() => setAdminPanelOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Users size={11} /> Admin panel
            </button>
            {showHostingerDownload && (
              <a
                href="/the-missing-piece-hostinger.zip"
                download="the-missing-piece-hostinger.zip"
                onClick={handleDownloadHostingerZip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 700,
                  color: 'var(--ink)',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  cursor: downloadingZip ? 'wait' : 'pointer',
                  opacity: downloadingZip ? 0.7 : 1,
                }}
              >
                {downloadingZip ? (
                  <>
                    <LoaderCircle size={12} className="animate-spin" /> Preparing .zip...
                  </>
                ) : (
                  <>
                    <Download size={12} /> Download Hostinger .zip
                  </>
                )}
              </a>
            )}
            <button type="button" onClick={openCookiePreferences}>
              Cookie settings
            </button>
          </div>
        </div>
      </footer>

      <AdminPortalModal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />
      <AdminPanelModal
        open={adminPanelOpen}
        onClose={() => setAdminPanelOpen(false)}
      />
    </>
  );
}
