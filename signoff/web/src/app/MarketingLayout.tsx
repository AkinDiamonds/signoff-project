import React from 'react';
import { Link, Outlet } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { typography } from '@signoff/ui';

export const MarketingLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: typography.fontFamily,
        backgroundColor: '#0A0D12',
        color: '#F3F4F6',
      }}
    >
      <style>{`
        :focus-visible {
          outline: 2px solid #0F766E !important;
          outline-offset: 2px !important;
        }
        .marketing-nav-link {
          color: #9CA3AF;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .marketing-nav-link:hover {
          color: #FFFFFF;
        }
        .marketing-cta-button {
          background-color: #0F766E;
          color: #FFFFFF;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease, transform 0.1s ease;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .marketing-cta-button:hover {
          background-color: #115E59;
          transform: translateY(-1px);
        }
      `}</style>

      {/* Global Marketing Topbar */}
      <header
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: 'rgba(10, 13, 18, 0.85)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: '#FFFFFF',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '15px',
            }}
          >
            S
          </div>
          <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Signoff
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(15, 118, 110, 0.2)',
              color: '#2DD4BF',
              border: '1px solid rgba(45, 212, 191, 0.3)',
            }}
          >
            COMMERCE
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <a href="#features" className="marketing-nav-link">
            Features
          </a>
          <a href="#limits" className="marketing-nav-link">
            Signing Limits
          </a>
          <a href="#studio" className="marketing-nav-link">
            Analytics
          </a>
          <Link to="/app" className="marketing-cta-button" data-testid="nav-open-dashboard">
            Open Dashboard &rarr;
          </Link>
        </nav>
      </header>

      {/* Main Marketing Page Content */}
      <main id="main-content" style={{ flex: 1 }}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Marketing Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#07090D',
          padding: '40px 32px 32px',
          color: '#6B7280',
          fontSize: '13px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link to="/app" style={{ color: '#9CA3AF', textDecoration: 'none' }}>
            Merchant App
          </Link>
          <span>&bull;</span>
          <a
            href="https://github.com/AkinDiamonds/signoff-project"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#9CA3AF', textDecoration: 'none' }}
          >
            GitHub
          </a>
          <span>&bull;</span>
          <span>PayPal Sandbox Verified</span>
        </div>
        <p style={{ margin: 0 }}>
          Signoff &bull; Automated PayPal dispute defense within merchant signing limits.
        </p>
      </footer>
    </div>
  );
};

