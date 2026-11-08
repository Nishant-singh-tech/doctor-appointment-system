import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout, reset } from '../../features/auth/authSlice';

const Navbar = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);

    const onLogout = () => {
        dispatch(logout());
        dispatch(reset());
        navigate('/login');
    };

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800 border-purple-300';
            case 'doctor':
                return 'bg-emerald-100 text-emerald-800 border-emerald-300';
            default:
                return 'bg-blue-100 text-blue-800 border-blue-300';
        }
    };

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                {/* Brand */}
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm group-hover:bg-blue-700 transition">
                        +
                    </div>
                    <div>
                        <span className="font-bold text-lg text-gray-900 tracking-tight block leading-tight">DocCare</span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-medium">Appointment System</span>
                    </div>
                </Link>

                {/* Navigation Links */}
                <nav className="flex items-center gap-4">
                    <Link
                        to="/"
                        className="text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md transition"
                    >
                        Home
                    </Link>
                    <Link
                        to="/doctors"
                        className="text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md transition"
                    >
                        Find Doctors
                    </Link>

                    {user && (
                        <>
                            <Link
                                to="/appointments"
                                className="text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md transition"
                            >
                                {user.role === 'doctor' ? 'Consultation Schedule' : 'My Appointments'}
                            </Link>
                            <Link
                                to="/prescriptions"
                                className="text-sm font-medium text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md transition flex items-center gap-1"
                            >
                                <span>💊</span>
                                <span>{user.role === 'doctor' ? 'Prescriptions' : 'My Prescriptions'}</span>
                            </Link>
                        </>
                    )}

                    {user?.role === 'admin' && (
                        <Link
                            to="/admin"
                            className="text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-md transition flex items-center gap-1.5"
                        >
                            <span>⚡</span>
                            <span>Admin Dashboard</span>
                        </Link>
                    )}

                    {user ? (
                        <div className="flex items-center gap-3">
                            <Link
                                to="/profile"
                                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md bg-gray-50 border border-gray-200 hover:border-blue-200 transition"
                            >
                                <span>{user.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${getRoleBadgeColor(user.role)}`}>
                                    {user.role}
                                </span>
                            </Link>
                            <button
                                onClick={onLogout}
                                className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 px-3 py-2 rounded-md transition"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Link
                                to="/login"
                                className="text-sm font-medium text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md hover:bg-gray-50 transition"
                            >
                                Login
                            </Link>
                            <Link
                                to="/register"
                                className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md shadow-xs transition"
                            >
                                Register
                            </Link>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
