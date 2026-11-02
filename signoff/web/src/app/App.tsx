import React from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';
import { ThemeProvider, ToastProvider } from '@signoff/ui';

export interface AppProps {
  router: DataRouter;
  queryClient: QueryClient;
}

export const App: React.FC<AppProps> = ({ router, queryClient }) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ToastProvider><RouterProvider router={router} /></ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
