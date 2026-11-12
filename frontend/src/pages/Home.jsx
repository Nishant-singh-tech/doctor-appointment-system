import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import API_BASE from '../services/apiConfig';

const Home = () => {
    const [healthStatus, setHealthStatus] = useState('Checking API...');
    const { user } = useSelector((state) => state.auth);

    useEffect(() => {
        axios
            .get(`${API_BASE}/health`)
            .then((response) => setHealthStatus(response.data.message))
            .catch(() => setHealthStatus('API connection offline'));
    }, []);

    return (
        <div className="space-y-12 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto space-y-4">
                <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                    MERN Healthcare Platform
                </span>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
                    Smart, Seamless Doctor Appointments
                </h1>
                <p className="text-lg text-gray-600">
                    Connecting patients with verified medical professionals. Secure authentication, role-based dashboards, and intuitive scheduling.
                </p>

                <div className="pt-4 flex flex-wrap justify-center gap-4">
                    {user ? (
                        <Link
                            to="/profile"
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
                        >
                            Go to Your Profile ({user.name})
                        </Link>
                    ) : (
                        <>
                            <Link
                                to="/register"
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs transition"
                            >
                                Get Started (Register)
                            </Link>
                            <Link
                                to="/login"
                                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-semibold rounded-xl shadow-xs transition"
                            >
                                Sign In
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Architecture / Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg mb-4">
                        P
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Patient Portal</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Patients can register, log in with JWT authentication, manage profile information, and prepare for doctor browsing and appointments.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg mb-4">
                        D
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Doctor Portal</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Doctors register with their medical specialization, consultation fees, and experience. Doctor accounts start in pending verification status.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg mb-4">
                        A
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">Admin Control</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        Seeded administrator account with role-based authorization to govern platform users, verify doctors, and manage access.
                    </p>
                </div>
            </div>

            {/* System Health Status Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${String(healthStatus ?? '').includes('offline') ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
                    <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Backend Status</span>
                        <span className="text-sm font-medium text-gray-900">{healthStatus}</span>
                    </div>
                </div>

                <span className="text-xs font-mono text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    Phase 2: Auth Active
                </span>
            </div>
        </div>
    );
};

export default Home;
