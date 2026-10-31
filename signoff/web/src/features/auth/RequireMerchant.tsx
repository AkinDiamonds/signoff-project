import React from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button } from '@signoff/ui';
import { useOwnerSession } from './session';

export const RequireMerchant: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useOwnerSession();
  const location = useLocation();
  if (session.isPending) return <main role="status" style={{ padding: 32 }}>Checking your session…</main>;
  if (session.isError) return (
    <main style={{ padding: 32 }}>
      <p role="alert">We couldn’t verify your sign-in status.</p>
      <Button onClick={() => { void session.refetch(); }}>Try again</Button>
    </main>
  );
  if (session.data.required && !session.data.authenticated) {
    return <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />;
  }
  return <>{children}</>;
};
