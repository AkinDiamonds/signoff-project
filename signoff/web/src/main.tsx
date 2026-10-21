import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router';
import { App } from './app/App';
import { routes } from './app/routes';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});
const router = createBrowserRouter(routes);

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App router={router} queryClient={queryClient} />
    </React.StrictMode>
  );
}
