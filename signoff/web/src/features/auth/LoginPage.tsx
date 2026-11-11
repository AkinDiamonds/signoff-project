import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, typography } from '@signoff/ui';
import { safeReturnPath, signIn, useOwnerSession } from './session';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const navigate = useNavigate();
  const client = useQueryClient();
  const session = useOwnerSession();
  const state: unknown = useLocation().state;
  const returnTo = safeReturnPath(state && typeof state === 'object' && 'returnTo' in state ? state.returnTo : null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(null);
    try {
      const next = await signIn(email, password);
      if (!next.authenticated) throw new Error('Sign-in could not be completed. Please try again.');
      client.setQueryData(['owner-session'], next);
      setPassword('');
      void navigate(returnTo, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith('Your browser could not keep') ? failure.message : 'Sign-in failed. Check your details and try again.');
    } finally { setPending(false); }
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '12px 14px',
    font: 'inherit', border: '1px solid #43505d', borderRadius: 8,
    background: '#0a0d12', color: '#f9fafb',
  };
  return (
    <main style={{ minHeight: '100dvh', boxSizing: 'border-box', padding: 'clamp(24px, 7vw, 72px) 20px',
      background: '#0a0d12', color: '#f9fafb', fontFamily: typography.fontFamily, display: 'grid', alignContent: 'center' }}>
      <style>{`
        .signin-page :focus-visible { outline: 3px solid #2dd4bf; outline-offset: 3px; }
        .signin-page input:focus-visible { border-color: #2dd4bf; }
        .signin-submit:not(:disabled):hover { background-color: #115e59 !important; }
      `}</style>
      <div className="signin-page" style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', textDecoration: 'none' }}><img src="/icon.svg" alt="" style={{ width: 36, height: 36 }} />Signoff</Link>
        <h1 style={{ fontSize: 'clamp(28px, 7vw, 34px)', lineHeight: 1.2, letterSpacing: '-0.04em', margin: '48px 0 32px' }}>Seller sign-in</h1>
        {session.data?.authenticated ? (
          <Button onClick={() => { void navigate(returnTo, { replace: true }); }}>Continue to your dashboard</Button>
        ) : (
          <form onSubmit={event => { void submit(event); }} style={{ display: 'grid', gap: 20 }}>
            <div><label htmlFor="owner-email" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Your email address</label>
              <input id="owner-email" type="email" autoComplete="username" required maxLength={254}
                value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} disabled={pending} />
            </div>
            <div><label htmlFor="owner-password" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Your password</label>
              <input id="owner-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={1024}
                value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} disabled={pending} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ border: 0, background: 'none', color: '#5eead4', padding: '10px 0', minHeight: 44, font: 'inherit', fontSize: 14, cursor: 'pointer' }}>
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            {error && <p ref={errorRef} tabIndex={-1} role="alert" style={{ color: '#fda4af', margin: 0 }}>{error}</p>}
            {session.isError && <p role="alert">We couldn’t check your session. You can still try signing in.</p>}
            {session.data?.required && !session.data.configured && <p role="status">Sign-in is temporarily unavailable. Contact the store owner.</p>}
            <Button className="signin-submit" type="submit" style={{ backgroundColor: '#0f766e', borderRadius: 8, fontFamily: 'inherit', fontWeight: 600 }} disabled={pending || (session.data?.required === true && !session.data.configured)}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
};
