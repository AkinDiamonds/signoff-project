import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, colors, spacing, radius } from '@signoff/ui';
import { safeReturnPath, signIn, useOwnerSession } from './session';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setError(failure instanceof Error ? failure.message : 'Sign-in failed. Please try again.');
    } finally { setPending(false); }
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', minHeight: 48, padding: '12px 14px',
    font: 'inherit', border: `1px solid ${colors.border}`, borderRadius: radius.control,
    background: '#fff', color: '#111827',
  };
  return (
    <main style={{ minHeight: '100dvh', boxSizing: 'border-box', padding: 'clamp(24px, 7vw, 72px) 20px',
      background: '#f6f8f7', color: '#13201c', display: 'grid', alignContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
        <Link to="/" style={{ color: '#115e59', fontSize: 22, fontWeight: 750, textDecoration: 'none' }}>signoff<span aria-hidden="true">.</span></Link>
        <h1 style={{ fontSize: 'clamp(30px, 8vw, 40px)', letterSpacing: '-0.04em', margin: '32px 0 12px' }}>Your shop.<br />Your decisions.</h1>
        <p style={{ color: '#52605a', lineHeight: 1.6, marginBottom: 28 }}>Sign in to review disputes, inspect evidence, and manage your signing limits.</p>
        {session.data?.authenticated ? (
          <Button onClick={() => { void navigate(returnTo, { replace: true }); }}>Continue to your dashboard</Button>
        ) : (
          <form onSubmit={event => { void submit(event); }} style={{ display: 'grid', gap: spacing[3] }}>
            <div><label htmlFor="owner-email" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Email</label>
              <input id="owner-email" type="email" autoComplete="username" required maxLength={254}
                value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} disabled={pending} />
            </div>
            <div><label htmlFor="owner-password" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Password</label>
              <input id="owner-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={1024}
                value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} disabled={pending} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ border: 0, background: 'none', color: '#115e59', padding: '10px 0', minHeight: 44, font: 'inherit', cursor: 'pointer' }}>
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>
            {error && <p role="alert" style={{ color: '#9f1239', margin: 0 }}>{error}</p>}
            {session.isError && <p role="alert">We couldn’t check your session. You can still try signing in.</p>}
            {session.data?.required && !session.data.configured && <p role="status">Sign-in is temporarily unavailable. Contact the store owner.</p>}
            <Button type="submit" disabled={pending || (session.data?.required === true && !session.data.configured)}>
              {pending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
        <p style={{ color: '#66736c', fontSize: 13, lineHeight: 1.6, marginTop: 28 }}>Sandbox payments. Merchant-controlled decisions.</p>
      </div>
    </main>
  );
};
