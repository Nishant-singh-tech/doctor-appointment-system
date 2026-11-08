import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { getProfile, updatePatientProfile } from '../features/auth/authSlice';
import doctorService from '../services/doctorService';
import adminService from '../services/adminService';

const Profile = () => {
    const dispatch = useDispatch();
    const { user, token, isLoading } = useSelector((state) => state.auth);

    // Profile refresh feedback
    const [refreshSuccess, setRefreshSuccess] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });

    // Active tab for doctor/admin dashboards
    const [doctorTab, setDoctorTab] = useState('profile'); // 'profile' | 'verification' | 'availability'

    // Patient edit profile form state
    const [isPatientEditing, setIsPatientEditing] = useState(false);
    const [patientFormData, setPatientFormData] = useState({
        name: '',
        phone: '',
        address: '',
        gender: '',
        dateOfBirth: '',
        bloodGroup: ''
    });

    // Doctor profile form state
    const [doctorFormData, setDoctorFormData] = useState({
        name: '',
        phone: '',
        specialization: '',
        qualifications: '',
        experience: 0,
        fees: 0,
        location: '',
        hospital: '',
        about: ''
    });

    // Doctor verification submission state
    const [docSubmission, setDocSubmission] = useState({
        title: '',
        documentUrl: '',
        documentType: 'Medical License'
    });

    // Doctor availability form state
    const [availabilityData, setAvailabilityData] = useState({
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        workingHours: { start: '09:00', end: '17:00' },
        slotDuration: 30,
        breakTime: { start: '13:00', end: '14:00' },
        timeZone: 'UTC'
    });

    // Admin pending doctors queue state
    const [pendingDoctors, setPendingDoctors] = useState([]);
    const [rejectionInput, setRejectionInput] = useState({});

    // Sync state on user change
    useEffect(() => {
        if (user) {
            if (user.role === 'patient') {
                setPatientFormData({
                    name: user.name || '',
                    phone: user.phone || '',
                    address: user.address || '',
                    gender: user.gender || '',
                    dateOfBirth: user.dateOfBirth || '',
                    bloodGroup: user.bloodGroup || ''
                });
            } else if (user.role === 'doctor') {
                setDoctorFormData({
                    name: user.name || '',
                    phone: user.phone || '',
                    specialization: user.specialization || '',
                    qualifications: user.qualifications || '',
                    experience: user.experience || 0,
                    fees: user.fees || 0,
                    location: user.location || '',
                    hospital: user.hospital || '',
                    about: user.about || ''
                });

                if (user.availability) {
                    setAvailabilityData({
                        workingDays: user.availability.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                        workingHours: user.availability.workingHours || { start: '09:00', end: '17:00' },
                        slotDuration: user.availability.slotDuration || 30,
                        breakTime: user.availability.breakTime || { start: '13:00', end: '14:00' },
                        timeZone: user.availability.timeZone || 'UTC'
                    });
                }
            } else if (user.role === 'admin' && token) {
                // Fetch pending verification requests for admin
                adminService.getPendingDoctors(token)
                    .then((data) => setPendingDoctors(data.doctors || []))
                    .catch((err) => console.error('Failed to load pending doctors:', err));
            }
        }
    }, [user, token]);

    useEffect(() => {
        if (token) {
            dispatch(getProfile());
        }
    }, [dispatch, token]);

    const handleRefresh = async () => {
        const result = await dispatch(getProfile());
        if (!result.error) {
            setRefreshSuccess(true);
            setTimeout(() => setRefreshSuccess(false), 3000);
        }
    };

    // Patient profile submit
    const handlePatientSubmit = async (e) => {
        e.preventDefault();
        setFeedbackMessage({ type: '', text: '' });

        const result = await dispatch(updatePatientProfile(patientFormData));
        if (result.error) {
            setFeedbackMessage({ type: 'error', text: result.payload || 'Failed to update profile.' });
        } else {
            setFeedbackMessage({ type: 'success', text: 'Patient health profile updated successfully!' });
            setIsPatientEditing(false);
            setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 4000);
        }
    };

    // Doctor profile submit
    const handleDoctorProfileSubmit = async (e) => {
        e.preventDefault();
        setFeedbackMessage({ type: '', text: '' });
        try {
            const data = await doctorService.updateMyDoctorProfile(doctorFormData, token);
            dispatch(getProfile());
            setFeedbackMessage({ type: 'success', text: data.message || 'Doctor profile updated successfully!' });
            setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setFeedbackMessage({
                type: 'error',
                text: (err.response && err.response.data && err.response.data.message) || 'Failed to update doctor profile.'
            });
        }
    };

    // Doctor verification submit
    const handleVerificationSubmit = async (e) => {
        e.preventDefault();
        setFeedbackMessage({ type: '', text: '' });
        try {
            const data = await doctorService.submitVerification(docSubmission, token);
            dispatch(getProfile());
            setDocSubmission({ title: '', documentUrl: '', documentType: 'Medical License' });
            setFeedbackMessage({ type: 'success', text: data.message || 'Verification document submitted successfully!' });
            setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setFeedbackMessage({
                type: 'error',
                text: (err.response && err.response.data && err.response.data.message) || 'Failed to submit verification.'
            });
        }
    };

    // Doctor availability submit
    const handleAvailabilitySubmit = async (e) => {
        e.preventDefault();
        setFeedbackMessage({ type: '', text: '' });
        try {
            const data = await doctorService.updateMyAvailability(availabilityData, token);
            dispatch(getProfile());
            setFeedbackMessage({ type: 'success', text: data.message || 'Availability updated successfully!' });
            setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setFeedbackMessage({
                type: 'error',
                text: (err.response && err.response.data && err.response.data.message) || 'Failed to update availability.'
            });
        }
    };

    // Admin approve/reject action
    const handleAdminVerify = async (doctorId, status) => {
        try {
            const reason = rejectionInput[doctorId] || '';
            const data = await adminService.verifyDoctor(doctorId, { status, rejectionReason: reason }, token);
            setFeedbackMessage({ type: 'success', text: data.message || `Doctor ${status} successfully.` });
            // Refresh pending queue
            const updatedQueue = await adminService.getPendingDoctors(token);
            setPendingDoctors(updatedQueue.doctors || []);
            setTimeout(() => setFeedbackMessage({ type: '', text: '' }), 4000);
        } catch (err) {
            setFeedbackMessage({
                type: 'error',
                text: (err.response && err.response.data && err.response.data.message) || 'Failed to update verification.'
            });
        }
    };

    if (!user) {
        return null;
    }

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'doctor':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default:
                return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    const getVerificationBadge = (status) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'rejected':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-amber-100 text-amber-800 border-amber-200';
        }
    };

    const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                            {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border tracking-wider ${getRoleBadge(user.role)}`}>
                                    {user.role}
                                </span>
                                {user.role === 'doctor' && (
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase border tracking-wider ${getVerificationBadge(user.verificationStatus || 'pending')}`}>
                                        Verification: {user.verificationStatus || 'pending'}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {user.role === 'patient' && (
                            <Link
                                to="/doctors"
                                className="text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs"
                            >
                                Find Doctors
                            </Link>
                        )}
                        <button
                            onClick={handleRefresh}
                            disabled={isLoading}
                            className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                        >
                            {isLoading ? 'Verifying...' : 'Re-verify JWT'}
                        </button>
                    </div>
                </div>

                {refreshSuccess && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg">
                        Profile validated and re-synchronized directly via `GET /api/auth/profile`!
                    </div>
                )}
            </div>

            {/* Notification Banner */}
            {feedbackMessage.text && (
                <div
                    className={`p-4 rounded-xl text-sm border ${
                        feedbackMessage.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-green-50 border-green-200 text-green-700'
                    }`}
                >
                    {feedbackMessage.text}
                </div>
            )}

            {/* DOCTOR DASHBOARD TABS (Doctor Role Only) */}
            {user.role === 'doctor' && (
                <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-200 bg-gray-50/60 p-2 gap-2">
                        <button
                            onClick={() => setDoctorTab('profile')}
                            className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition ${
                                doctorTab === 'profile'
                                    ? 'bg-white text-blue-700 shadow-xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            👨‍⚕️ Professional Profile
                        </button>
                        <button
                            onClick={() => setDoctorTab('verification')}
                            className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition ${
                                doctorTab === 'verification'
                                    ? 'bg-white text-blue-700 shadow-xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            📄 Verification Center
                        </button>
                        <button
                            onClick={() => setDoctorTab('availability')}
                            className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition ${
                                doctorTab === 'availability'
                                    ? 'bg-white text-blue-700 shadow-xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            🕒 Availability & Schedule
                        </button>
                    </div>

                    <div className="p-6">
                        {/* TAB 1: DOCTOR PROFESSIONAL PROFILE */}
                        {doctorTab === 'profile' && (
                            <form onSubmit={handleDoctorProfileSubmit} className="space-y-4">
                                <div className="border-b border-gray-100 pb-3">
                                    <h2 className="text-base font-bold text-gray-900">
                                        Edit Professional Credentials
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        Update your public credentials displayed in the doctor directory
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Doctor Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={doctorFormData.name}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, name: e.target.value })}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Specialization *
                                        </label>
                                        <input
                                            type="text"
                                            value={doctorFormData.specialization}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, specialization: e.target.value })}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Qualifications
                                        </label>
                                        <input
                                            type="text"
                                            value={doctorFormData.qualifications}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, qualifications: e.target.value })}
                                            placeholder="e.g. MBBS, MD - Harvard Medical School"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={doctorFormData.phone}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, phone: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                                Experience (Yrs)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={doctorFormData.experience}
                                                onChange={(e) => setDoctorFormData({ ...doctorFormData, experience: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                                Fee (₹)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={doctorFormData.fees}
                                                onChange={(e) => setDoctorFormData({ ...doctorFormData, fees: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Location / City
                                        </label>
                                        <input
                                            type="text"
                                            value={doctorFormData.location}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, location: e.target.value })}
                                            placeholder="e.g. New York, NY"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Hospital / Clinic Affiliation
                                        </label>
                                        <input
                                            type="text"
                                            value={doctorFormData.hospital}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, hospital: e.target.value })}
                                            placeholder="e.g. City General Care Center"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Professional Biography / About
                                        </label>
                                        <textarea
                                            rows="3"
                                            value={doctorFormData.about}
                                            onChange={(e) => setDoctorFormData({ ...doctorFormData, about: e.target.value })}
                                            placeholder="Brief overview of clinical focus and patient philosophy..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="py-2.5 px-6 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition"
                                >
                                    Save Doctor Profile
                                </button>
                            </form>
                        )}

                        {/* TAB 2: DOCTOR VERIFICATION CENTER */}
                        {doctorTab === 'verification' && (
                            <div className="space-y-6">
                                <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-base font-bold text-gray-900">
                                            Medical Credential Verification
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            Submit credentials to qualify for inclusion in the public patient directory
                                        </p>
                                    </div>
                                    <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase border tracking-wider ${getVerificationBadge(user.verificationStatus || 'pending')}`}>
                                        Status: {user.verificationStatus || 'pending'}
                                    </span>
                                </div>

                                {user.verificationStatus === 'rejected' && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs space-y-1">
                                        <strong className="block font-bold">Verification Rejected by Administrator</strong>
                                        <p>{user.rejectionReason || 'Please re-submit updated license documents.'}</p>
                                    </div>
                                )}

                                {user.verificationStatus === 'approved' && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs">
                                        ✓ <strong>Approved & Verified!</strong> Your profile is currently active in the public doctor directory.
                                    </div>
                                )}

                                {/* Document Submission Form */}
                                <form onSubmit={handleVerificationSubmit} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                        Upload / Submit Verification Proof
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Document Title *
                                            </label>
                                            <input
                                                id="doc-title-input"
                                                type="text"
                                                required
                                                placeholder="e.g. State Medical Board License #1234"
                                                value={docSubmission.title}
                                                onChange={(e) => setDocSubmission({ ...docSubmission, title: e.target.value })}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Document Type
                                            </label>
                                            <select
                                                id="doc-type-select"
                                                value={docSubmission.documentType}
                                                onChange={(e) => setDocSubmission({ ...docSubmission, documentType: e.target.value })}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="Medical License">Medical License</option>
                                                <option value="Board Certification">Board Certification</option>
                                                <option value="Hospital ID Proof">Hospital ID Proof</option>
                                                <option value="Other Credential">Other Credential</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                Document Identifier / URL *
                                            </label>
                                            <input
                                                id="doc-url-input"
                                                type="text"
                                                required
                                                placeholder="e.g. https://license.gov/verify/1234"
                                                value={docSubmission.documentUrl}
                                                onChange={(e) => setDocSubmission({ ...docSubmission, documentUrl: e.target.value })}
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        id="submit-verification-btn"
                                        type="submit"
                                        className="py-2 px-4 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition"
                                    >
                                        Submit Document for Verification
                                    </button>
                                </form>

                                {/* Submitted Documents List */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                                        Submitted Verification Documents ({user.documents?.length || 0})
                                    </h3>
                                    {(!user.documents || user.documents.length === 0) ? (
                                        <p className="text-xs text-gray-500">No documents submitted yet.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {user.documents.map((doc, idx) => (
                                                <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs">
                                                    <div>
                                                        <strong className="text-gray-900 block">{doc.title}</strong>
                                                        <span className="text-gray-500">{doc.documentType} • {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <span className="font-mono text-gray-400 text-[11px] max-w-[200px] truncate">
                                                        {doc.documentUrl}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: DOCTOR AVAILABILITY & WORKING HOURS */}
                        {doctorTab === 'availability' && (
                            <form onSubmit={handleAvailabilitySubmit} className="space-y-6">
                                <div className="border-b border-gray-100 pb-3">
                                    <h2 className="text-base font-bold text-gray-900">
                                        Consultation Hours & Schedule Configuration
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        Define your working days, hours, and slot intervals for patient scheduling
                                    </p>
                                </div>

                                {/* Working Days Checkboxes */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                        Working Days (Select all that apply)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {allDays.map((day) => {
                                            const isSelected = availabilityData.workingDays.includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = isSelected
                                                            ? availabilityData.workingDays.filter((d) => d !== day)
                                                            : [...availabilityData.workingDays, day];
                                                        setAvailabilityData({ ...availabilityData, workingDays: updated });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                                                        isSelected
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Working Hours & Slot Duration */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Start Time (HH:mm)
                                        </label>
                                        <input
                                            type="time"
                                            value={availabilityData.workingHours.start}
                                            onChange={(e) =>
                                                setAvailabilityData({
                                                    ...availabilityData,
                                                    workingHours: { ...availabilityData.workingHours, start: e.target.value }
                                                })
                                            }
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            End Time (HH:mm)
                                        </label>
                                        <input
                                            type="time"
                                            value={availabilityData.workingHours.end}
                                            onChange={(e) =>
                                                setAvailabilityData({
                                                    ...availabilityData,
                                                    workingHours: { ...availabilityData.workingHours, end: e.target.value }
                                                })
                                            }
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Slot Duration (Mins)
                                        </label>
                                        <select
                                            value={availabilityData.slotDuration}
                                            onChange={(e) =>
                                                setAvailabilityData({ ...availabilityData, slotDuration: Number(e.target.value) })
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        >
                                            <option value={15}>15 Minutes</option>
                                            <option value={30}>30 Minutes</option>
                                            <option value={45}>45 Minutes</option>
                                            <option value={60}>60 Minutes</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Break Time */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="sm:col-span-2">
                                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                                            Break / Lunch Interval (Optional)
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Break Start Time
                                        </label>
                                        <input
                                            type="time"
                                            value={availabilityData.breakTime.start}
                                            onChange={(e) =>
                                                setAvailabilityData({
                                                    ...availabilityData,
                                                    breakTime: { ...availabilityData.breakTime, start: e.target.value }
                                                })
                                            }
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Break End Time
                                        </label>
                                        <input
                                            type="time"
                                            value={availabilityData.breakTime.end}
                                            onChange={(e) =>
                                                setAvailabilityData({
                                                    ...availabilityData,
                                                    breakTime: { ...availabilityData.breakTime, end: e.target.value }
                                                })
                                            }
                                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="py-2.5 px-6 text-xs font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition"
                                >
                                    Save Availability Schedule
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ADMIN REVIEW QUEUE (Admin Role Only) */}
            {user.role === 'admin' && (
                <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 space-y-4">
                    <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">
                                Doctor Verification Queue ({pendingDoctors.length})
                            </h2>
                            <p className="text-xs text-gray-500">
                                Review submitted credentials and approve or reject doctor platform access
                            </p>
                        </div>
                        <Link
                            to="/admin"
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                        >
                            Open Admin Dashboard (/admin) →
                        </Link>
                    </div>

                    {pendingDoctors.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                            No doctors currently pending verification review.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingDoctors.map((doc) => (
                                <div key={doc._id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900">{doc.name}</h3>
                                            <p className="text-xs text-gray-500">
                                                {doc.email} • {doc.specialization} • {doc.location || 'Location upon request'}
                                            </p>
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 self-start sm:self-auto">
                                            Status: Pending Review
                                        </span>
                                    </div>

                                    {/* Documents */}
                                    <div className="p-3 bg-white rounded-lg border border-gray-200 text-xs space-y-1">
                                        <span className="font-semibold text-gray-700 block">Submitted Credentials:</span>
                                        {(!doc.documents || doc.documents.length === 0) ? (
                                            <span className="text-gray-400">No documents attached</span>
                                        ) : (
                                            doc.documents.map((d, i) => (
                                                <div key={i} className="text-gray-600 flex justify-between">
                                                    <span>📄 {d.title} ({d.documentType})</span>
                                                    <span className="font-mono text-[10px] text-gray-400">{d.documentUrl}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
                                        <input
                                            type="text"
                                            placeholder="Optional rejection reason..."
                                            value={rejectionInput[doc._id] || ''}
                                            onChange={(e) => setRejectionInput({ ...rejectionInput, [doc._id]: e.target.value })}
                                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleAdminVerify(doc._id, 'approved')}
                                                className="px-4 py-1.5 text-xs font-bold rounded-lg text-white bg-green-600 hover:bg-green-700 transition"
                                            >
                                                Approve Doctor
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAdminVerify(doc._id, 'rejected')}
                                                className="px-4 py-1.5 text-xs font-bold rounded-lg text-white bg-red-600 hover:bg-red-700 transition"
                                            >
                                                Reject Doctor
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* PATIENT PROFILE MANAGEMENT (Patient Role Only) */}
            {user.role === 'patient' && (
                <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h2 className="text-base font-bold text-gray-900">
                            Patient Health Profile
                        </h2>
                        <button
                            type="button"
                            onClick={() => setIsPatientEditing(!isPatientEditing)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-md transition"
                        >
                            {isPatientEditing ? 'Cancel' : 'Edit Profile'}
                        </button>
                    </div>

                    {isPatientEditing ? (
                        <form onSubmit={handlePatientSubmit} className="space-y-3 text-sm">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={patientFormData.name}
                                    onChange={(e) => setPatientFormData({ ...patientFormData, name: e.target.value })}
                                    required
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={patientFormData.phone}
                                    onChange={(e) => setPatientFormData({ ...patientFormData, phone: e.target.value })}
                                    placeholder="+1 555-1234"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Address
                                </label>
                                <input
                                    type="text"
                                    value={patientFormData.address}
                                    onChange={(e) => setPatientFormData({ ...patientFormData, address: e.target.value })}
                                    placeholder="City, Street, Apartment"
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Gender
                                    </label>
                                    <select
                                        value={patientFormData.gender}
                                        onChange={(e) => setPatientFormData({ ...patientFormData, gender: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Blood Group
                                    </label>
                                    <select
                                        value={patientFormData.bloodGroup}
                                        onChange={(e) => setPatientFormData({ ...patientFormData, bloodGroup: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select Blood Group</option>
                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                                            <option key={bg} value={bg}>
                                                {bg}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    value={patientFormData.dateOfBirth}
                                    onChange={(e) => setPatientFormData({ ...patientFormData, dateOfBirth: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-3 py-2 px-4 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition"
                            >
                                {isLoading ? 'Saving Changes...' : 'Save Profile Changes'}
                            </button>
                        </form>
                    ) : (
                        <div className="text-sm space-y-3">
                            <div className="flex justify-between py-1 border-b border-gray-50">
                                <span className="text-gray-500">Phone</span>
                                <span className="font-medium text-gray-900">{user.phone || 'Not provided'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-50">
                                <span className="text-gray-500">Address</span>
                                <span className="font-medium text-gray-900">{user.address || 'Not provided'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-50">
                                <span className="text-gray-500">Gender</span>
                                <span className="font-medium text-gray-900 capitalize">{user.gender || 'Not specified'}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-gray-50">
                                <span className="text-gray-500">Date of Birth</span>
                                <span className="font-medium text-gray-900">{user.dateOfBirth || 'Not provided'}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-gray-500">Blood Group</span>
                                <span className="font-bold text-red-600">{user.bloodGroup || 'Not specified'}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;
