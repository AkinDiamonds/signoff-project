import type { RouteObject } from 'react-router';
import { Layout } from './Layout';
import { HomePage, NotFoundPage, PlaceholderPage } from './pages';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'guide', element: <PlaceholderPage title="Judge guide" step="33" /> },
      { path: 'app', element: <PlaceholderPage title="Dashboard" step="28" /> },
      { path: 'app/disputes', element: <PlaceholderPage title="Disputes" step="25" /> },
      { path: 'app/disputes/:id', element: <PlaceholderPage title="Dispute detail" step="25" /> },
      { path: 'app/charter', element: <PlaceholderPage title="Authority Charter" step="27" /> },
      { path: 'app/demo', element: <PlaceholderPage title="Demo scenarios" step="27" /> },
      { path: 'approve/:token', element: <PlaceholderPage title="Approval" step="26" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
