import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * ProtectedRoute component: Ensures only authenticated users
 * with appropriate roles can access nested routes.
 */
const ProtectedRoute = ({ allowedRoles }) => {
    const { user, token } = useSelector((state) => state.auth);

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (
        Array.isArray(allowedRoles) &&
        !allowedRoles.includes(user?.role)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl max-w-md shadow-sm">
                    <h3 className="text-xl font-bold mb-2">Access Denied</h3>
                    <p className="text-sm mb-4">
                        You do not have permission to access this area. Your current role is{' '}
                        <span className="font-semibold uppercase">{user.role}</span>.
                    </p>
                </div>
            </div>
        );
    }

    return <Outlet />;
};

export default ProtectedRoute;
