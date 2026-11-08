import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import adminService from '../../services/adminService';
import appointmentService from '../../services/appointmentService';
import paymentService from '../../services/paymentService';

const AdminDashboard = () => {
    const { token, user: currentAdmin } = useSelector((state) => state.auth);

    // Active tab: 'overview' | 'users' | 'doctors' | 'verifications' | 'appointments'
    const [activeTab, setActiveTab] = useState('overview');

    // Loading & feedback state
    const [loading, setLoading] = useState(false);
    const [statsLoading, setStatsLoading] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    // 1. Stats State (Only genuine data from database)
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalPatients: 0,
        totalDoctors: 0,
        verifiedDoctors: 0,
        pendingVerifications: 0,
        rejectedDoctors: 0,
        blockedUsers: 0,
        activeUsers: 0,
        totalAppointments: 0,
        confirmedAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        totalRevenue: 0,
        paidAppointments: 0,
        pendingPayments: 0,
        refundedPayments: 0
    });

    // 2. Appointments Management State
    const [adminAppointments, setAdminAppointments] = useState([]);
    const [apptStatusFilter, setApptStatusFilter] = useState('all');
    const [apptPage, setApptPage] = useState(1);
    const [apptTotalPages, setApptTotalPages] = useState(1);
    const [apptTotalCount, setApptTotalCount] = useState(0);
    const [adminCancelModalAppt, setAdminCancelModalAppt] = useState(null);
    const [adminCancelReason, setAdminCancelReason] = useState('');
    const [adminRefundModalAppt, setAdminRefundModalAppt] = useState(null);
    const [adminRefundReason, setAdminRefundReason] = useState('');
    const [adminRefundLoading, setAdminRefundLoading] = useState(false);

    // 2. Users Management State
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('all');
    const [userStatusFilter, setUserStatusFilter] = useState('all');
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [userTotalCount, setUserTotalCount] = useState(0);

    // 3. Doctors Management State
    const [doctors, setDoctors] = useState([]);
    const [doctorSearch, setDoctorSearch] = useState('');
    const [docVerificationFilter, setDocVerificationFilter] = useState('all');
    const [docStatusFilter, setDocStatusFilter] = useState('all');
    const [docPage, setDocPage] = useState(1);
    const [docTotalPages, setDocTotalPages] = useState(1);
    const [docTotalCount, setDocTotalCount] = useState(0);

    // 4. Pending Doctor Verifications State (Phase 4 reused)
    const [pendingDoctors, setPendingDoctors] = useState([]);
    const [rejectModalDoc, setRejectModalDoc] = useState(null);
    const [rejectionReasonText, setRejectionReasonText] = useState('');
    const [selectedDocDetails, setSelectedDocDetails] = useState(null);

    // Helper to flash feedback notification
    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    };

    // Load Real Stats
    const fetchStats = useCallback(async () => {
        if (!token) return;
        setStatsLoading(true);
        try {
            const data = await adminService.getAdminStats(token);
            if (data.success && data.stats) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, [token]);

    // Load Users
    const fetchUsers = useCallback(async (page = 1) => {
        if (!token) return;
        setLoading(true);
        try {
            const params = {
                page,
                limit: 8,
                search: userSearch.trim(),
                role: userRoleFilter,
                status: userStatusFilter
            };
            const data = await adminService.getUsers(params, token);
            if (data.success) {
                setUsers(data.users || []);
                setUserPage(data.page || 1);
                setUserTotalPages(data.pages || 1);
                setUserTotalCount(data.totalUsers || 0);
            }
        } catch (err) {
            console.error('Failed to load users:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [token, userSearch, userRoleFilter, userStatusFilter]);

    // Load Doctors
    const fetchDoctors = useCallback(async (page = 1) => {
        if (!token) return;
        setLoading(true);
        try {
            const params = {
                page,
                limit: 8,
                search: doctorSearch.trim(),
                verificationStatus: docVerificationFilter,
                status: docStatusFilter
            };
            const data = await adminService.getDoctors(params, token);
            if (data.success) {
                setDoctors(data.doctors || []);
                setDocPage(data.page || 1);
                setDocTotalPages(data.pages || 1);
                setDocTotalCount(data.totalDoctors || 0);
            }
        } catch (err) {
            console.error('Failed to load doctors:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    }, [token, doctorSearch, docVerificationFilter, docStatusFilter]);

    // Load Pending Verifications (Reusing Phase 4 API)
    const fetchPendingVerifications = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await adminService.getPendingDoctors(token);
            if (data.success) {
                setPendingDoctors(data.doctors || []);
            }
        } catch (err) {
            console.error('Failed to load pending verifications:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to load pending verifications');
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Load Admin Appointments
    const fetchAdminAppointments = useCallback(async (page = 1) => {
        if (!token) return;
        setLoading(true);
        try {
            const params = {
                page,
                limit: 8,
                status: apptStatusFilter !== 'all' ? apptStatusFilter : undefined
            };
            const data = await appointmentService.getAdminAppointments(params, token);
            if (data.success) {
                setAdminAppointments(data.appointments || []);
                setApptPage(data.page || 1);
                setApptTotalPages(data.pages || 1);
                setApptTotalCount(data.totalAppointments || 0);
            }
        } catch (err) {
            console.error('Failed to load admin appointments:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to load appointments');
        } finally {
            setLoading(false);
        }
    }, [token, apptStatusFilter]);

    // Initial load
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Trigger tab-specific fetches
    useEffect(() => {
        if (activeTab === 'overview') {
            fetchStats();
            fetchPendingVerifications();
        } else if (activeTab === 'users') {
            fetchUsers(1);
        } else if (activeTab === 'doctors') {
            fetchDoctors(1);
        } else if (activeTab === 'verifications') {
            fetchPendingVerifications();
        } else if (activeTab === 'appointments') {
            fetchAdminAppointments(1);
        }
    }, [activeTab, fetchStats, fetchUsers, fetchDoctors, fetchPendingVerifications, fetchAdminAppointments]);

    // Handle User Block / Unblock Toggle
    const handleToggleBlock = async (targetUser) => {
        if (!token) return;
        if (targetUser._id === currentAdmin?._id) {
            showFeedback('error', 'You cannot block your own admin account.');
            return;
        }

        const newBlockedState = !targetUser.isBlocked;
        const confirmMsg = newBlockedState
            ? `Are you sure you want to BLOCK ${targetUser.name} (${targetUser.email})? They will immediately lose system access.`
            : `Are you sure you want to UNBLOCK ${targetUser.name} (${targetUser.email})?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await adminService.toggleUserBlock(targetUser._id, newBlockedState, token);
            if (res.success) {
                showFeedback('success', res.message);
                // Update local state smoothly
                setUsers((prev) =>
                    prev.map((u) => (u._id === targetUser._id ? { ...u, isBlocked: newBlockedState } : u))
                );
                setDoctors((prev) =>
                    prev.map((d) => (d._id === targetUser._id ? { ...d, isBlocked: newBlockedState } : d))
                );
                fetchStats();
            }
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to update account status.');
        }
    };

    // Handle Doctor Verification Approval (Reusing Phase 4 API)
    const handleApproveDoctor = async (doctorId, doctorName) => {
        if (!token) return;
        if (!window.confirm(`Approve credentials and verify ${doctorName}?`)) return;

        try {
            const res = await adminService.verifyDoctor(doctorId, { status: 'approved' }, token);
            if (res.success) {
                showFeedback('success', `Dr. ${doctorName} has been approved and verified!`);
                setPendingDoctors((prev) => prev.filter((d) => d._id !== doctorId));
                fetchStats();
                if (activeTab === 'doctors') fetchDoctors(docPage);
            }
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to approve doctor verification.');
        }
    };

    // Handle Doctor Verification Rejection (Reusing Phase 4 API)
    const handleRejectDoctorSubmit = async (e) => {
        e.preventDefault();
        if (!rejectModalDoc || !token) return;

        try {
            const res = await adminService.verifyDoctor(
                rejectModalDoc._id,
                {
                    status: 'rejected',
                    rejectionReason: rejectionReasonText.trim()
                },
                token
            );
            if (res.success) {
                showFeedback('success', `Verification for Dr. ${rejectModalDoc.name} marked as rejected.`);
                setPendingDoctors((prev) => prev.filter((d) => d._id !== rejectModalDoc._id));
                setRejectModalDoc(null);
                setRejectionReasonText('');
                fetchStats();
                if (activeTab === 'doctors') fetchDoctors(docPage);
            }
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to reject doctor verification.');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-6 border-b border-gray-200">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 rounded-md border border-purple-200">
                            Superadmin Access
                        </span>
                        <span className="text-xs text-gray-500 font-medium">DocCare System Control Center</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
                        Administration Dashboard
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage platform users, verify physician credentials, enforce platform policies, and monitor system metrics.
                    </p>
                </div>

                <div className="mt-4 md:mt-0 flex items-center gap-3">
                    <button
                        onClick={() => {
                            fetchStats();
                            if (activeTab === 'users') fetchUsers(userPage);
                            if (activeTab === 'doctors') fetchDoctors(docPage);
                            if (activeTab === 'verifications' || activeTab === 'overview') fetchPendingVerifications();
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-xs text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition cursor-pointer"
                    >
                        <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Notification Feedback Banner */}
            {feedback.message && (
                <div
                    className={`mb-6 p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all ${
                        feedback.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? (
                            <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        )}
                        <span className="text-sm font-medium">{feedback.message}</span>
                    </div>
                    <button
                        onClick={() => setFeedback({ type: '', message: '' })}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
                        activeTab === 'overview'
                            ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    System Overview & Metrics
                </button>

                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
                        activeTab === 'users'
                            ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    User Management
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                        {stats.totalUsers}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('doctors')}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
                        activeTab === 'doctors'
                            ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Physicians Directory
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                        {stats.totalDoctors}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('verifications')}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
                        activeTab === 'verifications'
                            ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Verification Queue
                    {stats.pendingVerifications > 0 && (
                        <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                            {stats.pendingVerifications} Pending
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('appointments')}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
                        activeTab === 'appointments'
                            ? 'border-blue-600 text-blue-600 bg-white shadow-xs'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Appointments Management
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                        {stats.totalAppointments || 0}
                    </span>
                </button>
            </div>

            {/* TAB 1: OVERVIEW & REAL STATISTICS */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Real Data Statistics Cards */}
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <span>System Metrics & Data Insights</span>
                            <span className="text-xs font-normal text-gray-500">
                                (Derived strictly from verified database records)
                            </span>
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {/* Total Registered Accounts */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total Users
                                    </span>
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                        👥
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline">
                                    <span className="text-3xl font-extrabold text-gray-900">
                                        {statsLoading ? '...' : stats.totalUsers}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Registered across patient, doctor, and administrator roles
                                </p>
                            </div>

                            {/* Registered Patients */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Active Patients
                                    </span>
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                        🩺
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline">
                                    <span className="text-3xl font-extrabold text-indigo-700">
                                        {statsLoading ? '...' : stats.totalPatients}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Individuals eligible to browse directories & book appointments
                                </p>
                            </div>

                            {/* Verified Doctors */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Verified Doctors
                                    </span>
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                        ✓
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline">
                                    <span className="text-3xl font-extrabold text-emerald-700">
                                        {statsLoading ? '...' : stats.verifiedDoctors}
                                    </span>
                                    <span className="ml-2 text-xs text-gray-400">
                                        of {stats.totalDoctors} total
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Publicly searchable with approved credentials
                                </p>
                            </div>

                            {/* Pending Verifications */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-amber-300 transition">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Awaiting Approval
                                    </span>
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                                        ⏳
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline">
                                    <span className="text-3xl font-extrabold text-amber-600">
                                        {statsLoading ? '...' : stats.pendingVerifications}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Physicians waiting for medical license verification
                                </p>
                            </div>
                        </div>

                        {/* Secondary Status Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-5">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">Active Accounts</p>
                                    <p className="text-xl font-bold text-gray-900 mt-0.5">{stats.activeUsers}</p>
                                </div>
                                <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"></span>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">Blocked Accounts</p>
                                    <p className="text-xl font-bold text-red-600 mt-0.5">{stats.blockedUsers}</p>
                                </div>
                                <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium uppercase">Rejected Applications</p>
                                    <p className="text-xl font-bold text-gray-700 mt-0.5">{stats.rejectedDoctors}</p>
                                </div>
                                <span className="inline-block w-3 h-3 rounded-full bg-gray-400"></span>
                            </div>
                        </div>

                        {/* Phase 6 Appointment Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Total Bookings</span>
                                <span className="text-2xl font-black text-gray-900">{stats.totalAppointments || 0}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">Confirmed / Active</span>
                                <span className="text-2xl font-black text-blue-700">{stats.confirmedAppointments || 0}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Completed Visits</span>
                                <span className="text-2xl font-black text-emerald-700">{stats.completedAppointments || 0}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">Cancelled</span>
                                <span className="text-2xl font-black text-rose-700">{stats.cancelledAppointments || 0}</span>
                            </div>
                        </div>

                        {/* Phase 7: Online Payment & Platform Revenue Metrics Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Platform Revenue</span>
                                <span className="text-2xl font-black text-emerald-700">₹{stats.totalRevenue || 0}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Paid Consultations</span>
                                <span className="text-2xl font-black text-gray-900">{stats.paidAppointments || 0}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Pending Payments</span>
                                <span className="text-2xl font-black text-amber-700">{stats.pendingPayments || 0}</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">Refunded Fees</span>
                                <span className="text-2xl font-black text-indigo-700">{stats.refundedPayments || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action: Pending Queue Preview */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">
                                    Priority: Pending Doctor Credential Reviews
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Physicians requiring administrative verification before appearing in search
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveTab('verifications')}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                            >
                                View All ({pendingDoctors.length}) →
                            </button>
                        </div>

                        {pendingDoctors.length === 0 ? (
                            <div className="p-8 text-center">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                                    ✓
                                </div>
                                <h4 className="text-sm font-bold text-gray-900">No Pending Verifications</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    All submitted physician credentials have been reviewed.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {pendingDoctors.slice(0, 3).map((doc) => (
                                    <div key={doc._id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-900">{doc.name}</h4>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium border border-amber-200">
                                                    Pending Review
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {doc.email} • {doc.specialization || 'General Practice'} • {doc.hospital || 'Private Practice'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleApproveDoctor(doc._id, doc.name)}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRejectModalDoc(doc);
                                                    setRejectionReasonText('');
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition cursor-pointer"
                                            >
                                                Reject...
                                            </button>
                                            <button
                                                onClick={() => setSelectedDocDetails(doc)}
                                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                                            >
                                                Inspect
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: USER MANAGEMENT (SEARCH, FILTER, PAGINATION, BLOCK/UNBLOCK) */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Search Input */}
                        <div className="relative flex-grow max-w-md">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                🔍
                            </span>
                            <input
                                type="text"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                                placeholder="Search by name, email, or phone..."
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            />
                        </div>

                        {/* Filters and Actions */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <select
                                    value={userRoleFilter}
                                    onChange={(e) => setUserRoleFilter(e.target.value)}
                                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="all">All Roles</option>
                                    <option value="patient">Patients</option>
                                    <option value="doctor">Doctors</option>
                                    <option value="admin">Admins</option>
                                </select>
                            </div>

                            <div>
                                <select
                                    value={userStatusFilter}
                                    onChange={(e) => setUserStatusFilter(e.target.value)}
                                    className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active Only</option>
                                    <option value="blocked">Blocked Only</option>
                                </select>
                            </div>

                            <button
                                onClick={() => fetchUsers(1)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                                Apply Filter
                            </button>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">User</th>
                                        <th scope="col" className="px-6 py-3">Role</th>
                                        <th scope="col" className="px-6 py-3">Contact</th>
                                        <th scope="col" className="px-6 py-3">Account Status</th>
                                        <th scope="col" className="px-6 py-3">Joined</th>
                                        <th scope="col" className="px-6 py-3 text-right">Administrative Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-12 text-gray-400">
                                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                                <p className="text-xs">Loading user accounts...</p>
                                            </td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-12 text-gray-500">
                                                No users found matching current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((u) => {
                                            const isSelf = u._id === currentAdmin?._id;
                                            return (
                                                <tr key={u._id} className="hover:bg-gray-50 transition">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-semibold text-gray-900">{u.name}</div>
                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize border ${
                                                                u.role === 'admin'
                                                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                                                    : u.role === 'doctor'
                                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                                            }`}
                                                        >
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                                                        {u.phone || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {u.isBlocked ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                                                Blocked
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                Active
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                        {isSelf ? (
                                                            <span className="text-xs text-gray-400 italic font-normal">
                                                                Current Session
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleToggleBlock(u)}
                                                                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer border ${
                                                                    u.isBlocked
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                                        : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                                                                }`}
                                                            >
                                                                {u.isBlocked ? 'Unblock User' : 'Block User'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs text-gray-600">
                                Showing Page <span className="font-bold text-gray-900">{userPage}</span> of{' '}
                                <span className="font-bold text-gray-900">{userTotalPages}</span> ({userTotalCount} total users)
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchUsers(userPage - 1)}
                                    disabled={userPage <= 1 || loading}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                    ← Previous
                                </button>
                                <button
                                    onClick={() => fetchUsers(userPage + 1)}
                                    disabled={userPage >= userTotalPages || loading}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: PHYSICIANS DIRECTORY (SEARCH, VERIFICATION STATUS, BLOCKING) */}
            {activeTab === 'doctors' && (
                <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-grow max-w-md">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                🔍
                            </span>
                            <input
                                type="text"
                                value={doctorSearch}
                                onChange={(e) => setDoctorSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchDoctors(1)}
                                placeholder="Search physician name, specialty, hospital..."
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={docVerificationFilter}
                                onChange={(e) => setDocVerificationFilter(e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">All Verification Statuses</option>
                                <option value="approved">Approved & Verified</option>
                                <option value="pending">Pending Review</option>
                                <option value="rejected">Rejected</option>
                                <option value="unsubmitted">Unsubmitted</option>
                            </select>

                            <select
                                value={docStatusFilter}
                                onChange={(e) => setDocStatusFilter(e.target.value)}
                                className="text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="all">All Account States</option>
                                <option value="active">Active Only</option>
                                <option value="blocked">Blocked Only</option>
                            </select>

                            <button
                                onClick={() => fetchDoctors(1)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                                Filter Doctors
                            </button>
                        </div>
                    </div>

                    {/* Doctors Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Physician</th>
                                        <th scope="col" className="px-6 py-3">Specialty & Exp</th>
                                        <th scope="col" className="px-6 py-3">Fee / Location</th>
                                        <th scope="col" className="px-6 py-3">Verification</th>
                                        <th scope="col" className="px-6 py-3">State</th>
                                        <th scope="col" className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-12 text-gray-400">
                                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                                <p className="text-xs">Loading doctors list...</p>
                                            </td>
                                        </tr>
                                    ) : doctors.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="text-center py-12 text-gray-500">
                                                No doctors found matching filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        doctors.map((d) => (
                                            <tr key={d._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-900">{d.name}</div>
                                                    <div className="text-xs text-gray-500">{d.email}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-medium text-gray-900">{d.specialization || 'General'}</div>
                                                    <div className="text-xs text-gray-500">{d.experience || 0} years experience</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-semibold text-emerald-700">₹{d.fees || 0}</div>
                                                    <div className="text-xs text-gray-500">{d.location || 'Not specified'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {d.verificationStatus === 'approved' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            ✓ Approved
                                                        </span>
                                                    ) : d.verificationStatus === 'pending' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                                                            ⏳ Pending
                                                        </span>
                                                    ) : d.verificationStatus === 'rejected' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                                            ✕ Rejected
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                            Unsubmitted
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {d.isBlocked ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                                            Blocked
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Active
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setSelectedDocDetails(d)}
                                                            className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                                                        >
                                                            Inspect
                                                        </button>
                                                        <button
                                                            onClick={() => handleToggleBlock(d)}
                                                            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer border ${
                                                                d.isBlocked
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                                    : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                                                            }`}
                                                        >
                                                            {d.isBlocked ? 'Unblock' : 'Block'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs text-gray-600">
                                Showing Page <span className="font-bold text-gray-900">{docPage}</span> of{' '}
                                <span className="font-bold text-gray-900">{docTotalPages}</span> ({docTotalCount} total doctors)
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchDoctors(docPage - 1)}
                                    disabled={docPage <= 1 || loading}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                    ← Previous
                                </button>
                                <button
                                    onClick={() => fetchDoctors(docPage + 1)}
                                    disabled={docPage >= docTotalPages || loading}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: VERIFICATION QUEUE (REUSING PHASE 4 APIS) */}
            {activeTab === 'verifications' && (
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                            ℹ
                        </div>
                        <div className="text-xs text-blue-900 leading-relaxed">
                            <span className="font-bold">Credential Verification Protocol: </span>
                            Physicians must have their credentials validated by an administrator before appearing in public patient searches.
                            Approving a doctor toggles <code className="bg-blue-100 px-1 py-0.5 rounded">isVerified: true</code>.
                            Rejecting records the audit reason and prevents the doctor from appearing in the directory.
                        </div>
                    </div>

                    {pendingDoctors.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-xs">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                                ✓
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Verification Queue is Clear</h3>
                            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                                There are no physician applications currently waiting for review. You can inspect all doctors under the Physicians Directory tab.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {pendingDoctors.map((doc) => (
                                <div key={doc._id} className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 hover:border-blue-300 transition">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-bold text-gray-900">{doc.name}</h3>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                                    Pending Review
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {doc.email} • {doc.phone || 'No phone provided'} • Registered {new Date(doc.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleApproveDoctor(doc._id, doc.name)}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                                            >
                                                ✓ Approve Doctor
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRejectModalDoc(doc);
                                                    setRejectionReasonText('');
                                                }}
                                                className="px-4 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                                            >
                                                ✕ Reject...
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                        <div>
                                            <span className="text-gray-400 block uppercase font-medium">Specialization</span>
                                            <span className="font-semibold text-gray-900">{doc.specialization || 'Not specified'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-medium">Qualifications</span>
                                            <span className="font-semibold text-gray-900">{doc.qualifications || 'Pending entry'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-medium">Experience & Fees</span>
                                            <span className="font-semibold text-gray-900">{doc.experience || 0} yrs • ₹{doc.fees || 0}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block uppercase font-medium">Affiliation</span>
                                            <span className="font-semibold text-gray-900">{doc.hospital || doc.location || 'Private Practice'}</span>
                                        </div>
                                    </div>

                                    {/* Submitted Documents Section */}
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                            Submitted License & Certification Documents ({doc.documents?.length || 0})
                                        </h4>
                                        {doc.documents && doc.documents.length > 0 ? (
                                            <div className="space-y-2">
                                                {doc.documents.map((d, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span>📄</span>
                                                            <span className="font-semibold text-gray-800">{d.title}</span>
                                                            <span className="text-gray-400">({d.documentType})</span>
                                                        </div>
                                                        <a
                                                            href={d.documentUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-800 font-semibold underline text-xs"
                                                        >
                                                            Inspect Credential ↗
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-amber-700 italic bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                                Notice: No verification documents uploaded yet. You may reject or approve per clinical protocol.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: APPOINTMENTS MANAGEMENT (PHASE 6) */}
            {activeTab === 'appointments' && (
                <div className="space-y-6">
                    {/* Controls Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { id: 'all', label: 'All Statuses' },
                                { id: 'confirmed', label: 'Confirmed / Active' },
                                { id: 'completed', label: 'Completed Visits' },
                                { id: 'cancelled', label: 'Cancelled' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setApptStatusFilter(tab.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                        apptStatusFilter === tab.id
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchAdminAppointments(apptPage)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer shrink-0"
                        >
                            Refresh Appointments
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Booking ID</th>
                                        <th scope="col" className="px-6 py-3">Patient</th>
                                        <th scope="col" className="px-6 py-3">Physician</th>
                                        <th scope="col" className="px-6 py-3">Date & Slot</th>
                                        <th scope="col" className="px-6 py-3">Fee</th>
                                        <th scope="col" className="px-6 py-3">Status</th>
                                        <th scope="col" className="px-6 py-3">Payment</th>
                                        <th scope="col" className="px-6 py-3 text-right">Administrative Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-12 text-gray-400">
                                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                                <p className="text-xs">Loading consultation bookings...</p>
                                            </td>
                                        </tr>
                                    ) : adminAppointments.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-12 text-gray-500 text-xs">
                                                No appointments found matching current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        adminAppointments.map((appt) => (
                                            <tr key={appt._id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                                                    #{appt._id.slice(-6).toUpperCase()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-900">{appt.patient?.name || 'Unknown Patient'}</div>
                                                    <div className="text-xs text-gray-500">{appt.patient?.email || '—'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-900">{appt.doctor?.name || 'Physician'}</div>
                                                    <div className="text-xs text-emerald-700">{appt.doctor?.specialization || 'General'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-gray-900 text-xs">📅 {appt.date}</div>
                                                    <div className="text-xs text-gray-500">⏰ {appt.timeSlot}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-emerald-700">
                                                    ₹{appt.fees || 0}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                                                            appt.status === 'confirmed'
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : appt.status === 'completed'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}
                                                    >
                                                        {appt.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                                                            appt.paymentStatus === 'paid'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : appt.paymentStatus === 'refunded'
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                : appt.paymentStatus === 'failed'
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}
                                                    >
                                                        {appt.paymentStatus || 'pending'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs space-x-2">
                                                    {appt.status === 'confirmed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAdminCancelModalAppt(appt);
                                                                setAdminCancelReason('');
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-semibold transition cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                    {appt.paymentStatus === 'paid' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAdminRefundModalAppt(appt);
                                                                setAdminRefundReason('');
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-semibold transition cursor-pointer"
                                                        >
                                                            Refund
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <span className="text-xs text-gray-600">
                                Showing Page <span className="font-bold text-gray-900">{apptPage}</span> of{' '}
                                <span className="font-bold text-gray-900">{apptTotalPages}</span> ({apptTotalCount} total appointments)
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fetchAdminAppointments(apptPage - 1)}
                                    disabled={apptPage <= 1 || loading}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                    ← Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchAdminAppointments(apptPage + 1)}
                                    disabled={apptPage >= apptTotalPages || loading}
                                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 0: ADMIN CANCEL APPOINTMENT MODAL */}
            {adminCancelModalAppt && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">Administrative Cancellation</h3>
                            <button
                                onClick={() => setAdminCancelModalAppt(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                try {
                                    const res = await appointmentService.cancelAppointment(
                                        adminCancelModalAppt._id,
                                        adminCancelReason.trim() || 'Cancelled by administrative staff',
                                        token
                                    );
                                    if (res.success) {
                                        showFeedback('success', 'Appointment cancelled successfully.');
                                        setAdminCancelModalAppt(null);
                                        fetchAdminAppointments(apptPage);
                                        fetchStats();
                                    }
                                } catch (err) {
                                    showFeedback('error', err.response?.data?.message || 'Failed to cancel appointment');
                                }
                            }}
                            className="mt-4 space-y-4"
                        >
                            <p className="text-gray-600">
                                Cancel appointment for <strong>{adminCancelModalAppt.patient?.name}</strong> with{' '}
                                <strong>{adminCancelModalAppt.doctor?.name}</strong> on {adminCancelModalAppt.date} ({adminCancelModalAppt.timeSlot})?
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Administrative Cancellation Reason
                                </label>
                                <textarea
                                    value={adminCancelReason}
                                    onChange={(e) => setAdminCancelReason(e.target.value)}
                                    rows="3"
                                    placeholder="Enter administrative cancellation notes..."
                                    className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setAdminCancelModalAppt(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Dismiss
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                                >
                                    Confirm Admin Cancellation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 0.5: ADMIN REFUND PAYMENT MODAL */}
            {adminRefundModalAppt && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">Issue Payment Refund</h3>
                            <button
                                onClick={() => setAdminRefundModalAppt(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                setAdminRefundLoading(true);
                                try {
                                    const res = await paymentService.refundPayment(
                                        adminRefundModalAppt._id,
                                        adminRefundReason.trim() || 'Refund issued by administrator',
                                        token
                                    );
                                    if (res.success) {
                                        showFeedback('success', `Refund of ₹${adminRefundModalAppt.fees} processed successfully.`);
                                        setAdminRefundModalAppt(null);
                                        fetchAdminAppointments(apptPage);
                                        fetchStats();
                                    }
                                } catch (err) {
                                    showFeedback('error', err.response?.data?.message || 'Failed to process refund');
                                } finally {
                                    setAdminRefundLoading(false);
                                }
                            }}
                            className="mt-4 space-y-4"
                        >
                            <p className="text-gray-600">
                                Issue full refund of <strong>₹{adminRefundModalAppt.fees}</strong> to{' '}
                                <strong>{adminRefundModalAppt.patient?.name}</strong> for consultation with{' '}
                                <strong>{adminRefundModalAppt.doctor?.name}</strong>?
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Reason for Refund
                                </label>
                                <textarea
                                    value={adminRefundReason}
                                    onChange={(e) => setAdminRefundReason(e.target.value)}
                                    rows="3"
                                    placeholder="Enter administrative refund reason / patient request notes..."
                                    className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setAdminRefundModalAppt(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Dismiss
                                </button>
                                <button
                                    type="submit"
                                    disabled={adminRefundLoading}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                                >
                                    {adminRefundLoading ? 'Processing...' : `Confirm Refund (₹${adminRefundModalAppt.fees})`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 1: REJECTION REASON MODAL (REUSING PHASE 4 REJECTION API) */}
            {rejectModalDoc && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">
                                Reject Doctor Application: {rejectModalDoc.name}
                            </h3>
                            <button
                                onClick={() => setRejectModalDoc(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleRejectDoctorSubmit} className="mt-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                    Reason for Credential Rejection <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectionReasonText}
                                    onChange={(e) => setRejectionReasonText(e.target.value)}
                                    rows="4"
                                    required
                                    placeholder="Explain why this physician credential cannot be approved (e.g., license expired, invalid medical council registration, illegible document)..."
                                    className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This reason will be recorded and displayed to the physician on their profile so they may re-submit valid credentials.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRejectModalDoc(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!rejectionReasonText.trim()}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                                >
                                    Confirm Rejection
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: INSPECT DOCTOR / USER DETAILS */}
            {selectedDocDetails && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{selectedDocDetails.name}</h3>
                                <p className="text-xs text-gray-500">{selectedDocDetails.email}</p>
                            </div>
                            <button
                                onClick={() => setSelectedDocDetails(null)}
                                className="text-gray-400 hover:text-gray-600 text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-4 space-y-4 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <div>
                                    <span className="text-gray-400 block font-medium">Role</span>
                                    <span className="font-bold uppercase text-gray-800">{selectedDocDetails.role}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Account Status</span>
                                    <span className={`font-bold ${selectedDocDetails.isBlocked ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {selectedDocDetails.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Verification</span>
                                    <span className="font-bold capitalize text-gray-800">{selectedDocDetails.verificationStatus || 'unsubmitted'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Specialization</span>
                                    <span className="font-semibold text-gray-800">{selectedDocDetails.specialization || 'General'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Experience</span>
                                    <span className="font-semibold text-gray-800">{selectedDocDetails.experience || 0} years</span>
                                </div>
                                <div>
                                    <span className="text-gray-400 block font-medium">Consultation Fee</span>
                                    <span className="font-semibold text-emerald-700">₹{selectedDocDetails.fees || 0}</span>
                                </div>
                            </div>

                            {selectedDocDetails.qualifications && (
                                <div>
                                    <span className="text-gray-500 font-bold block mb-1">Qualifications</span>
                                    <p className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-800">
                                        {selectedDocDetails.qualifications}
                                    </p>
                                </div>
                            )}

                            {selectedDocDetails.about && (
                                <div>
                                    <span className="text-gray-500 font-bold block mb-1">Professional Bio</span>
                                    <p className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-800 leading-relaxed">
                                        {selectedDocDetails.about}
                                    </p>
                                </div>
                            )}

                            {selectedDocDetails.rejectionReason && (
                                <div>
                                    <span className="text-red-600 font-bold block mb-1">Previous Rejection Reason</span>
                                    <p className="bg-red-50 p-3 rounded-lg border border-red-200 text-red-800">
                                        {selectedDocDetails.rejectionReason}
                                    </p>
                                </div>
                            )}

                            <div>
                                <span className="text-gray-500 font-bold block mb-2">
                                    Uploaded Documents ({selectedDocDetails.documents?.length || 0})
                                </span>
                                {selectedDocDetails.documents && selectedDocDetails.documents.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedDocDetails.documents.map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                                                <div>
                                                    <span className="font-semibold text-gray-800">{doc.title}</span>
                                                    <span className="text-gray-400 ml-2">({doc.documentType})</span>
                                                </div>
                                                <a
                                                    href={doc.documentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 font-semibold underline"
                                                >
                                                    View Link ↗
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic">No documents attached.</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setSelectedDocDetails(null)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
