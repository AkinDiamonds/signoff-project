import type { RouteObject } from 'react-router';
import { Layout } from './Layout';
import { HomePage, NotFoundPage, PlaceholderPage } from './pages';
import { DisputeListPage, DisputeDetailPage } from '../features/disputes';
import { ApprovalPage } from '../features/approval';
import { CharterPage } from '../features/charter';
import { DemoPanel } from '../features/demo';
import { DashboardPage } from '../features/dashboard';
import { GuidePage } from '../features/site';

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'guide', element: <GuidePage /> },
      { path: 'app', element: <DashboardPage /> },
      { path: 'app/disputes', element: <DisputeListPage /> },
      { path: 'app/disputes/:id', element: <DisputeDetailPage /> },
      { path: 'app/charter', element: <CharterPage /> },
      { path: 'app/demo', element: <DemoPanel /> },
      { path: 'approve/:token', element: <ApprovalPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

