import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // user가 persist에서 복원되었으면 인증된 것으로 판단
  if (!isAuthenticated && !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
