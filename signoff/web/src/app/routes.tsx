import type { RouteObject } from 'react-router';
import { Layout } from './Layout';
import { MarketingLayout } from './MarketingLayout';
import { HomePage, NotFoundPage } from './pages';
import { DisputeListPage, DisputeDetailPage } from '../features/disputes';
import { ApprovalPage } from '../features/approval';
import { CharterPage } from '../features/charter';
import { DemoPanel, JudgePoolPage } from '../features/demo';
import { DashboardPage } from '../features/dashboard';
import { GuidePage } from '../features/site';
import { SettingsPage } from '../features/settings/SettingsPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RequireMerchant } from '../features/auth/RequireMerchant';
import { ShipmentsPage } from '../features/fulfillment/ShipmentsPage';

export const routes: RouteObject[] = [
  { path: 'login', element: <LoginPage /> },
  // Standalone public marketing layout (no sidebar, no demo banners)
  {
    element: <MarketingLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'guide', element: <GuidePage /> },
    ],
  },
  // Authenticated merchant console layout (pinned fixed sidebar, independent scroll)
  {
    path: 'app',
    element: <RequireMerchant><Layout /></RequireMerchant>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'disputes', element: <DisputeListPage /> },
      { path: 'disputes/:id', element: <DisputeDetailPage /> },
      { path: 'policy', element: <CharterPage /> },
      { path: 'shipments', element: <ShipmentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      // Compatibility aliases
      { path: 'charter', element: <CharterPage /> },
      { path: 'demo', element: <DemoPanel /> },
      { path: 'pool', element: <JudgePoolPage /> },
    ],
  },
  { path: 'approve/:token', element: <RequireMerchant><ApprovalPage /></RequireMerchant> },
  { path: '*', element: <NotFoundPage /> },
];
