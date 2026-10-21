import type { RouteObject } from 'react-router';
import { Layout } from './Layout';
import { HomePage, NotFoundPage, PlaceholderPage } from './pages';
import { DisputeListPage, DisputeDetailPage } from '../features/disputes';
import { ApprovalPage } from '../features/approval';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'guide', element: <PlaceholderPage title="Judge guide" step="33" /> },
      { path: 'app', element: <PlaceholderPage title="Dashboard" step="28" /> },
      { path: 'app/disputes', element: <DisputeListPage /> },
      { path: 'app/disputes/:id', element: <DisputeDetailPage /> },
      { path: 'app/charter', element: <PlaceholderPage title="Authority Charter" step="27" /> },
      { path: 'app/demo', element: <PlaceholderPage title="Demo scenarios" step="27" /> },
      { path: 'approve/:token', element: <ApprovalPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

