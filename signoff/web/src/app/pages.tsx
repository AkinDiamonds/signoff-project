import React from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@signoff/ui';

import { LandingPage } from '../features/site';

export const HomePage: React.FC = () => {
  return <LandingPage />;
};

export const PlaceholderPage: React.FC<{ title: string; step: string }> = ({ title, step }) => (
  <EmptyState
    testId="placeholder-page"
    title={title}
    description={`This screen is built in step ${step}.`}
    action={<Link to="/">Back to home</Link>}
  />
);

export const NotFoundPage: React.FC = () => (
  <EmptyState
    testId="not-found-page"
    title="Page not found"
    description="The address you opened does not exist in Signoff."
    action={<Link to="/">Go to home</Link>}
  />
);
