import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/auth.store';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  // Wait for the Supabase session check instead of trusting stored state.
  if (!isInitialized) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
