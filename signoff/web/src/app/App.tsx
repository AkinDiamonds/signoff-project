import React from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';

export interface AppProps {
  router: DataRouter;
  queryClient: QueryClient;
}

export const App: React.FC<AppProps> = ({ router, queryClient }) => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
