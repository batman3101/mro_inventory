import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

const router = createBrowserRouter([
  {
    path: '/login',
    lazy: () => import('@/pages/Login').then((m) => ({ Component: m.default })),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        lazy: () => import('@/pages/Dashboard').then((m) => ({ Component: m.default })),
      },
      {
        path: 'items',
        lazy: () => import('@/pages/Items').then((m) => ({ Component: m.default })),
      },
      {
        path: 'inventory',
        lazy: () => import('@/pages/Inventory').then((m) => ({ Component: m.default })),
      },
      {
        path: 'inbound',
        lazy: () => import('@/pages/Inbound').then((m) => ({ Component: m.default })),
      },
      {
        path: 'outbound',
        lazy: () => import('@/pages/Outbound').then((m) => ({ Component: m.default })),
      },
      {
        path: 'suppliers',
        lazy: () => import('@/pages/Suppliers').then((m) => ({ Component: m.default })),
      },
      {
        path: 'departments',
        lazy: () => import('@/pages/Departments').then((m) => ({ Component: m.default })),
      },
      {
        path: 'analytics',
        lazy: () => import('@/pages/Analytics').then((m) => ({ Component: m.default })),
      },
      {
        path: 'users',
        lazy: () => import('@/pages/Users').then((m) => ({ Component: m.default })),
      },
    ],
  },
]);

export default router;
