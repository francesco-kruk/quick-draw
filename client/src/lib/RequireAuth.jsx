import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const RequireAuth = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    // Redirect to sign-in, preserving the intended destination
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return children;
};

export default RequireAuth;
