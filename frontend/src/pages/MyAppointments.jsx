import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import appointmentService from '../services/appointmentService';
import paymentService from '../services/paymentService';
import prescriptionService from '../services/prescriptionService';

const MyAppointments = () => {
    const { user, token } = useSelector((state) => state.auth);

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    // Cancellation modal state
    const [cancelModalAppt, setCancelModalAppt] = useState(null);
    const [cancelReasonText, setCancelReasonText] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);

    // Status update modal state (Doctor marking completed)
    const [completeModalAppt, setCompleteModalAppt] = useState(null);
    const [doctorNotesText, setDoctorNotesText] = useState('');
    const [completeLoading, setCompleteLoading] = useState(false);

    // Phase 7: Online Payment Modal State
    const [paymentModalAppt, setPaymentModalAppt] = useState(null);
    const [paymentOrderData, setPaymentOrderData] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('upi');

    // Phase 8: Prescription Management State
    const [prescriptionModalAppt, setPrescriptionModalAppt] = useState(null);
    const [prescriptionFormData, setPrescriptionFormData] = useState({
        diagnosis: '',
        symptoms: '',
        medicines: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
        advice: '',
        followUpDate: ''
    });
    const [prescriptionSubmitting, setPrescriptionSubmitting] = useState(false);
    const [viewPrescriptionData, setViewPrescriptionData] = useState(null);
    const [viewPrescriptionLoading, setViewPrescriptionLoading] = useState(false);
    const [downloadingRxId, setDownloadingRxId] = useState('');

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchAppointments = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await appointmentService.getMyAppointments(
                { status: statusFilter !== 'all' ? statusFilter : undefined },
                token
            );
            if (data.success) {
                setAppointments(data.appointments || []);
            }
        } catch (err) {
            console.error('Failed to load appointments:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to load appointments');
        } finally {
            setLoading(false);
        }
    }, [token, statusFilter]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    // Handle Appointment Cancellation
    const handleConfirmCancel = async (e) => {
        e.preventDefault();
        if (!cancelModalAppt || !token) return;

        setCancelLoading(true);
        try {
            const res = await appointmentService.cancelAppointment(
                cancelModalAppt._id,
                cancelReasonText.trim(),
                token
            );

            if (res.success) {
                showFeedback('success', res.message || 'Appointment cancelled successfully.');
                setCancelModalAppt(null);
                setCancelReasonText('');
                fetchAppointments();
            }
        } catch (err) {
            console.error('Failed to cancel appointment:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to cancel appointment.');
        } finally {
            setCancelLoading(false);
        }
    };

    // Handle Doctor Completing Appointment
    const handleConfirmComplete = async (e) => {
        e.preventDefault();
        if (!completeModalAppt || !token) return;

        setCompleteLoading(true);
        try {
            const res = await appointmentService.updateAppointmentStatus(
                completeModalAppt._id,
                { status: 'completed', notes: doctorNotesText.trim() },
                token
            );

            if (res.success) {
                showFeedback('success', 'Consultation marked as completed!');
                setCompleteModalAppt(null);
                setDoctorNotesText('');
                fetchAppointments();
            }
        } catch (err) {
            console.error('Failed to complete appointment:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to update appointment status.');
        } finally {
            setCompleteLoading(false);
        }
    };

    // Phase 7: Handle Online Payment Flow
    const handleInitiatePayment = async (appt) => {
        if (!token) return;
        setPaymentLoading(true);
        try {
            const data = await paymentService.createPaymentOrder(appt._id, token);
            if (data.isFree) {
                showFeedback('success', 'Consultation fee is ₹0. Marked as paid.');
                fetchAppointments();
                return;
            }
            if (data.success) {
                setPaymentModalAppt(appt);
                setPaymentOrderData(data);
            }
        } catch (err) {
            console.error('Failed to create payment order:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to initialize payment order.');
        } finally {
            setPaymentLoading(false);
        }
    };

    // Confirm & Verify Simulated Razorpay Payment
    const handleSimulatePaymentSuccess = async () => {
        if (!paymentModalAppt || !paymentOrderData || !token) return;
        setPaymentProcessing(true);
        try {
            const callbackData = await paymentService.simulateGatewayCallback(
                paymentOrderData.orderId,
                token
            );

            const verifyRes = await paymentService.verifyPayment(
                {
                    appointmentId: paymentModalAppt._id,
                    razorpay_order_id: callbackData.razorpay_order_id,
                    razorpay_payment_id: callbackData.razorpay_payment_id,
                    razorpay_signature: callbackData.razorpay_signature
                },
                token
            );

            if (verifyRes.success) {
                showFeedback(
                    'success',
                    `✓ Payment of ₹${paymentModalAppt.fees} verified & captured! Payment ID: ${callbackData.razorpay_payment_id}`
                );
                setPaymentModalAppt(null);
                setPaymentOrderData(null);
                fetchAppointments();
            }
        } catch (err) {
            console.error('Payment verification failed:', err);
            showFeedback('error', err.response?.data?.message || 'Payment verification failed.');
        } finally {
            setPaymentProcessing(false);
        }
    };

    // Handle Payment Failure simulation or dismissal
    const handleSimulatePaymentFailure = async (reason = 'Cancelled by patient in payment modal') => {
        if (!paymentModalAppt || !paymentOrderData || !token) return;
        setPaymentProcessing(true);
        try {
            await paymentService.recordPaymentFailure(
                {
                    appointmentId: paymentModalAppt._id,
                    orderId: paymentOrderData.orderId,
                    failureReason: reason
                },
                token
            );
            showFeedback('error', 'Payment cancelled or failed. You may retry payment anytime.');
            setPaymentModalAppt(null);
            setPaymentOrderData(null);
            fetchAppointments();
        } catch (err) {
            console.error('Error recording failure:', err);
        } finally {
            setPaymentProcessing(false);
        }
    };

    const renderPaymentBadge = (status) => {
        switch (status) {
            case 'paid':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
                        <span>✓</span>
                        <span>Paid</span>
                    </span>
                );
            case 'refunded':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                        <span>↩</span>
                        <span>Refunded</span>
                    </span>
                );
            case 'failed':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>Payment Failed</span>
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                        <span>⏳</span>
                        <span>Payment Pending</span>
                    </span>
                );
        }
    };

    // Phase 8: Prescription Handlers
    const handleOpenPrescriptionCreator = (appt) => {
        setPrescriptionModalAppt(appt);
        setPrescriptionFormData({
            diagnosis: '',
            symptoms: appt.reason && appt.reason !== 'General Consultation' ? appt.reason : '',
            medicines: [
                { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
            ],
            advice: '',
            followUpDate: ''
        });
    };

    const handleAddMedicineRow = () => {
        setPrescriptionFormData((prev) => ({
            ...prev,
            medicines: [
                ...prev.medicines,
                { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
            ]
        }));
    };

    const handleRemoveMedicineRow = (index) => {
        setPrescriptionFormData((prev) => ({
            ...prev,
            medicines: prev.medicines.length > 1 ? prev.medicines.filter((_, i) => i !== index) : prev.medicines
        }));
    };

    const handleMedicineChange = (index, field, value) => {
        setPrescriptionFormData((prev) => {
            const updated = [...prev.medicines];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, medicines: updated };
        });
    };

    const handleSubmitPrescription = async (e) => {
        e.preventDefault();
        if (!prescriptionModalAppt || !token) return;

        if (!prescriptionFormData.diagnosis.trim()) {
            showFeedback('error', 'Please provide a clinical diagnosis.');
            return;
        }

        const validMeds = prescriptionFormData.medicines.filter(
            (m) => m.name.trim() && m.dosage.trim() && m.frequency.trim() && m.duration.trim()
        );

        if (validMeds.length === 0) {
            showFeedback('error', 'Please prescribe at least one complete medicine (Name, Dosage, Frequency, Duration).');
            return;
        }

        setPrescriptionSubmitting(true);
        try {
            const res = await prescriptionService.createPrescription(
                {
                    appointmentId: prescriptionModalAppt._id,
                    diagnosis: prescriptionFormData.diagnosis.trim(),
                    symptoms: prescriptionFormData.symptoms.trim(),
                    medicines: validMeds,
                    advice: prescriptionFormData.advice.trim(),
                    followUpDate: prescriptionFormData.followUpDate.trim()
                },
                token
            );

            if (res.success) {
                showFeedback(
                    'success',
                    `✓ Digital prescription ${res.prescription?.prescriptionNumber} signed & issued successfully!`
                );
                setPrescriptionModalAppt(null);
                fetchAppointments();
            }
        } catch (err) {
            console.error('Failed to issue prescription:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to issue digital prescription.');
        } finally {
            setPrescriptionSubmitting(false);
        }
    };

    const handleOpenPrescriptionViewer = async (appt) => {
        if (appt.prescription && typeof appt.prescription === 'object' && appt.prescription.medicines) {
            setViewPrescriptionData(appt.prescription);
            return;
        }

        setViewPrescriptionLoading(true);
        try {
            const data = await prescriptionService.getPrescriptionByAppointment(appt._id, token);
            if (data.success && data.prescription) {
                setViewPrescriptionData(data.prescription);
            }
        } catch (err) {
            console.error('Error fetching prescription:', err);
            showFeedback('error', err.response?.data?.message || 'Could not load prescription details.');
        } finally {
            setViewPrescriptionLoading(false);
        }
    };

    const handleDownloadPrescriptionPDF = async (rx) => {
        if (!token || !rx) return;
        setDownloadingRxId(rx._id);
        try {
            await prescriptionService.downloadPrescriptionPDF(rx._id, rx.prescriptionNumber, token);
            showFeedback('success', `Prescription ${rx.prescriptionNumber} downloaded successfully.`);
        } catch (err) {
            console.error('PDF Download failed:', err);
            showFeedback('error', 'Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingRxId('');
        }
    };

    const isPatient = user?.role === 'patient';
    const isDoctor = user?.role === 'doctor';

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                <div>
                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                        {isPatient ? 'Patient Portal' : isDoctor ? 'Physician Portal' : 'Admin Portal'}
                    </span>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
                        {isPatient ? 'My Scheduled Consultations' : isDoctor ? 'Patient Consultation Schedule' : 'System Appointments'}
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        {isPatient
                            ? 'Manage your upcoming and past doctor appointments, view timings, and review visit summaries.'
                            : 'Review patient appointments, check consult reasons, and log completion records.'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        to="/prescriptions"
                        className="inline-flex items-center px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition shadow-xs"
                    >
                        💊 View Prescriptions Archive →
                    </Link>

                    {isPatient && (
                        <Link
                            to="/doctors"
                            className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                        >
                            + Book New Consultation
                        </Link>
                    )}
                </div>
            </div>

            {/* Notification Banner */}
            {feedback.text && (
                <div
                    className={`p-4 rounded-xl border flex items-center justify-between text-xs shadow-xs ${
                        feedback.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                >
                    <span>{feedback.text}</span>
                    <button
                        onClick={() => setFeedback({ type: '', text: '' })}
                        className="font-bold ml-2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
                {[
                    { id: 'all', label: 'All Appointments' },
                    { id: 'confirmed', label: 'Confirmed' },
                    { id: 'completed', label: 'Completed' },
                    { id: 'cancelled', label: 'Cancelled' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            statusFilter === tab.id
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Appointments List */}
            {loading ? (
                <div className="p-16 text-center bg-white rounded-2xl border border-gray-200">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                    <p className="text-xs text-gray-500 font-medium">Loading consultation records...</p>
                </div>
            ) : appointments.length === 0 ? (
                <div className="p-16 text-center bg-white rounded-2xl border border-gray-200 space-y-4">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        📅
                    </div>
                    <h3 className="text-base font-bold text-gray-900">No Appointments Found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        {statusFilter === 'all'
                            ? 'You currently have no scheduled appointments. Browse our verified physician directory to book a consultation.'
                            : `No appointments currently marked with status "${statusFilter}".`}
                    </p>
                    {isPatient && (
                        <Link
                            to="/doctors"
                            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                        >
                            Find a Doctor & Book Now →
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {appointments.map((appt) => {
                        const isUpcoming = appt.status === 'confirmed';
                        const isCompleted = appt.status === 'completed';
                        const isCancelled = appt.status === 'cancelled';

                        return (
                            <div
                                key={appt._id}
                                className={`bg-white rounded-2xl border p-6 shadow-xs hover:border-blue-300 transition flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                                    isCancelled ? 'border-gray-200 opacity-80' : 'border-gray-200'
                                }`}
                            >
                                <div className="space-y-3 flex-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                                                isUpcoming
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : isCompleted
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                        >
                                            {appt.status}
                                        </span>

                                        {renderPaymentBadge(appt.paymentStatus)}

                                        {appt.prescription && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
                                                <span>💊</span>
                                                <span>Rx Issued</span>
                                            </span>
                                        )}

                                        <span className="text-xs font-semibold text-gray-500">
                                            ID: #{appt._id.slice(-6).toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Main Party Info */}
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {isPatient
                                                ? `Consultation with ${appt.doctor?.name || 'Physician'}`
                                                : `Patient: ${appt.patient?.name || 'Anonymous Patient'}`}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {isPatient
                                                ? `${appt.doctor?.specialization || 'General Specialist'} • ${appt.doctor?.hospital || appt.doctor?.location || 'Private Clinic'}`
                                                : `Contact: ${appt.patient?.phone || 'No phone'} • Email: ${appt.patient?.email || 'N/A'} • Blood: ${appt.patient?.bloodGroup || 'Not recorded'}`}
                                        </p>
                                    </div>

                                    {/* Consultation Schedule Info */}
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div>
                                            <span className="text-gray-400 block font-medium">Date</span>
                                            <span className="font-bold text-gray-900">📅 {appt.date}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block font-medium">Time Slot</span>
                                            <span className="font-bold text-gray-900">⏰ {appt.timeSlot}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block font-medium">Consultation Fee</span>
                                            <span className="font-bold text-emerald-700">₹{appt.fees || 0}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block font-medium">Reason for Consultation</span>
                                            <span className="font-semibold text-gray-800">
                                                {appt.reason || 'General Consultation'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Notes or Cancellation Reason */}
                                    {isCompleted && appt.notes && (
                                        <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs">
                                            <span className="font-bold text-emerald-900 block mb-0.5">Doctor's Clinical Notes:</span>
                                            <p className="text-emerald-800">{appt.notes}</p>
                                        </div>
                                    )}

                                    {isCancelled && (
                                        <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 text-xs text-red-800">
                                            <span className="font-bold block mb-0.5">
                                                Cancelled By {appt.cancelledBy ? appt.cancelledBy.toUpperCase() : 'USER'}:
                                            </span>
                                            <p>{appt.cancellationReason || 'No reason provided.'}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col sm:flex-row md:flex-col items-stretch gap-2 shrink-0 md:w-44">
                                    {/* Patient Payment Action */}
                                    {isPatient && !isCancelled && (appt.paymentStatus === 'pending' || appt.paymentStatus === 'failed') && (
                                        <button
                                            type="button"
                                            disabled={paymentLoading}
                                            onClick={() => handleInitiatePayment(appt)}
                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                                        >
                                            <span>💳</span>
                                            <span>{appt.paymentStatus === 'failed' ? `Retry Pay ₹${appt.fees}` : `Pay Now ₹${appt.fees}`}</span>
                                        </button>
                                    )}

                                    {/* Paid Indicator */}
                                    {appt.paymentStatus === 'paid' && (
                                        <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-xl border border-emerald-200 text-center font-medium">
                                            <span className="font-bold block">✓ Paid ₹{appt.fees}</span>
                                            {appt.paymentDetails?.razorpayPaymentId && (
                                                <span className="text-[10px] text-gray-500 font-mono block truncate" title={appt.paymentDetails.razorpayPaymentId}>
                                                    ID: {appt.paymentDetails.razorpayPaymentId}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Refunded Indicator */}
                                    {appt.paymentStatus === 'refunded' && (
                                        <div className="text-[11px] text-indigo-800 bg-indigo-50 p-2 rounded-xl border border-indigo-200 text-center font-medium">
                                            <span className="font-bold block">↩ Refunded ₹{appt.fees}</span>
                                            {appt.paymentDetails?.refundId && (
                                                <span className="text-[10px] text-gray-500 font-mono block truncate" title={appt.paymentDetails.refundId}>
                                                    Ref: {appt.paymentDetails.refundId}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Prescription Actions for Doctor */}
                                    {isDoctor && !isCancelled && (
                                        appt.prescription ? (
                                            <div className="flex flex-col gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={viewPrescriptionLoading}
                                                    onClick={() => handleOpenPrescriptionViewer(appt)}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                                                >
                                                    <span>📋</span>
                                                    <span>{viewPrescriptionLoading ? 'Loading...' : 'View Rx'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={downloadingRxId === (appt.prescription?._id || appt.prescription)}
                                                    onClick={() => handleDownloadPrescriptionPDF(appt.prescription)}
                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1"
                                                >
                                                    <span>⬇</span>
                                                    <span>{downloadingRxId === (appt.prescription?._id || appt.prescription) ? 'Downloading...' : 'PDF'}</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenPrescriptionCreator(appt)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                                            >
                                                <span>📝</span>
                                                <span>Write Rx</span>
                                            </button>
                                        )
                                    )}

                                    {/* Prescription Actions for Patient */}
                                    {isPatient && appt.prescription && (
                                        <div className="flex flex-col gap-1.5">
                                            <button
                                                type="button"
                                                disabled={viewPrescriptionLoading}
                                                onClick={() => handleOpenPrescriptionViewer(appt)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center flex items-center justify-center gap-1.5"
                                            >
                                                <span>📋</span>
                                                <span>{viewPrescriptionLoading ? 'Loading...' : 'View Rx'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={downloadingRxId === (appt.prescription?._id || appt.prescription)}
                                                onClick={() => handleDownloadPrescriptionPDF(appt.prescription)}
                                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition cursor-pointer text-center flex items-center justify-center gap-1"
                                            >
                                                <span>⬇</span>
                                                <span>{downloadingRxId === (appt.prescription?._id || appt.prescription) ? 'Downloading...' : 'Download PDF'}</span>
                                            </button>
                                        </div>
                                    )}

                                    {isDoctor && isUpcoming && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCompleteModalAppt(appt);
                                                setDoctorNotesText('');
                                            }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center"
                                        >
                                            ✓ Mark Completed
                                        </button>
                                    )}

                                    {isUpcoming && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCancelModalAppt(appt);
                                                setCancelReasonText('');
                                            }}
                                            className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                                        >
                                            ✕ Cancel Appointment
                                        </button>
                                    )}

                                    {isPatient && (
                                        <Link
                                            to={`/doctors/${appt.doctor?._id}`}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-medium transition text-center"
                                        >
                                            View Doctor Profile
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL 1: CANCELLATION MODAL */}
            {cancelModalAppt && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">Cancel Consultation</h3>
                            <button
                                onClick={() => setCancelModalAppt(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleConfirmCancel} className="mt-4 space-y-4 text-xs">
                            <p className="text-gray-600">
                                Are you sure you want to cancel the appointment on{' '}
                                <strong>{cancelModalAppt.date}</strong> at{' '}
                                <strong>{cancelModalAppt.timeSlot}</strong>? The time slot will immediately become available for other patients.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Reason for Cancellation
                                </label>
                                <textarea
                                    value={cancelReasonText}
                                    onChange={(e) => setCancelReasonText(e.target.value)}
                                    rows="3"
                                    placeholder="Briefly state reason for cancellation..."
                                    className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCancelModalAppt(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Keep Appointment
                                </button>
                                <button
                                    type="submit"
                                    disabled={cancelLoading}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                                >
                                    {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: COMPLETE CONSULTATION MODAL (DOCTOR) */}
            {completeModalAppt && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <h3 className="text-base font-bold text-gray-900">Complete Consultation</h3>
                            <button
                                onClick={() => setCompleteModalAppt(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleConfirmComplete} className="mt-4 space-y-4 text-xs">
                            <p className="text-gray-600">
                                Confirm completion of consultation with{' '}
                                <strong>{completeModalAppt.patient?.name}</strong> on{' '}
                                <strong>{completeModalAppt.date}</strong> ({completeModalAppt.timeSlot}).
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Doctor's Clinical Notes / Recommendations
                                </label>
                                <textarea
                                    value={doctorNotesText}
                                    onChange={(e) => setDoctorNotesText(e.target.value)}
                                    rows="4"
                                    placeholder="Enter clinical advice, diagnosis remarks, or follow-up instructions..."
                                    className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCompleteModalAppt(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={completeLoading}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs"
                                >
                                    {completeLoading ? 'Saving...' : 'Mark as Completed'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* MODAL 3: RAZORPAY PAYMENT GATEWAY MODAL (TEST MODE) */}
            {paymentModalAppt && paymentOrderData && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-200">
                        {/* Razorpay Brand Header */}
                        <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xl shadow-xs">
                                    ₹
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-extrabold text-base tracking-tight">Razorpay Checkout</h3>
                                        <span className="text-[10px] font-bold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            Test Mode
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300">
                                        DocCare Healthcare • Safe & Secure Payment
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSimulatePaymentFailure('User closed Razorpay modal')}
                                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
                                title="Cancel Payment"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Order & Payment Details */}
                        <div className="p-6 space-y-6">
                            {/* Summary Card */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2 text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                    <span className="text-gray-500 font-medium">Doctor Consultation:</span>
                                    <span className="font-bold text-gray-900">Dr. {paymentModalAppt.doctor?.name}</span>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                    <span className="text-gray-500 font-medium">Date & Time Slot:</span>
                                    <span className="font-bold text-gray-900">{paymentModalAppt.date} ({paymentModalAppt.timeSlot})</span>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                    <span className="text-gray-500 font-medium">Razorpay Order ID:</span>
                                    <span className="font-mono text-gray-700 truncate max-w-[220px]" title={paymentOrderData.orderId}>
                                        {paymentOrderData.orderId}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-sm font-extrabold text-gray-900">Total Payable Amount:</span>
                                    <span className="text-2xl font-black text-emerald-600">
                                        ₹{paymentModalAppt.fees}
                                    </span>
                                </div>
                            </div>

                            {/* Payment Method Selector */}
                            <div className="space-y-3">
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                                    Select Payment Method
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'upi', label: 'UPI / QR', icon: '📱' },
                                        { id: 'card', label: 'Debit / Credit', icon: '💳' },
                                        { id: 'netbanking', label: 'Net Banking', icon: '🏦' }
                                    ].map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPaymentMethod(m.id)}
                                            className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                                                paymentMethod === m.id
                                                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span className="text-base">{m.icon}</span>
                                            <span>{m.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600">
                                    {paymentMethod === 'upi' && (
                                        <p>⚡ <strong>UPI Instant:</strong> Google Pay, PhonePe, Paytm, or any UPI VPA (`patient@upi`).</p>
                                    )}
                                    {paymentMethod === 'card' && (
                                        <p>💳 <strong>Card Payment:</strong> Simulated Visa, MasterCard, RuPay cards in test sandbox.</p>
                                    )}
                                    {paymentMethod === 'netbanking' && (
                                        <p>🏦 <strong>Indian Banks:</strong> HDFC, State Bank of India, ICICI, Axis Bank test simulator.</p>
                                    )}
                                </div>
                            </div>

                            {/* Security Note */}
                            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
                                <p className="font-bold flex items-center gap-1">
                                    <span>🔒</span>
                                    <span>Server-Side Cryptographic Verification Enforced</span>
                                </p>
                                <p className="text-blue-700 leading-relaxed">
                                    Payment success is never trusted based on frontend confirmation alone. The server generates and verifies a cryptographic HMAC-SHA256 signature to guarantee payment authenticity.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2 pt-2">
                                <button
                                    type="button"
                                    disabled={paymentProcessing}
                                    onClick={handleSimulatePaymentSuccess}
                                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>{paymentProcessing ? 'Verifying Signature...' : `✓ Pay ₹${paymentModalAppt.fees} via Razorpay`}</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={paymentProcessing}
                                    onClick={() => handleSimulatePaymentFailure('Payment cancelled by patient')}
                                    className="w-full py-2.5 border border-red-200 hover:bg-red-50 text-red-700 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                                >
                                    ✕ Simulate Payment Dismissal / Gateway Failure
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: PRESCRIPTION CREATOR MODAL (DOCTOR) */}
            {prescriptionModalAppt && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-3xl w-full my-8 shadow-2xl border border-gray-200 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white p-6 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl font-bold">
                                    💊
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg">Write Digital Medical Prescription</h3>
                                    <p className="text-xs text-indigo-200">
                                        Patient: <span className="font-semibold text-white">{prescriptionModalAppt.patient?.name}</span> • Date: {prescriptionModalAppt.date} ({prescriptionModalAppt.timeSlot})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPrescriptionModalAppt(null)}
                                className="text-indigo-200 hover:text-white text-xl font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmitPrescription} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            {/* Diagnosis & Symptoms */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                        Clinical Diagnosis <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={prescriptionFormData.diagnosis}
                                        onChange={(e) => setPrescriptionFormData({ ...prescriptionFormData, diagnosis: e.target.value })}
                                        placeholder="e.g. Acute Bronchitis, Hypertension Stage 1"
                                        className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                        Reported Symptoms
                                    </label>
                                    <input
                                        type="text"
                                        value={prescriptionFormData.symptoms}
                                        onChange={(e) => setPrescriptionFormData({ ...prescriptionFormData, symptoms: e.target.value })}
                                        placeholder="e.g. Cough, sore throat, mild fever for 3 days"
                                        className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Medicines Section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                                            Rx — Prescribed Medicines <span className="text-rose-500">*</span>
                                        </h4>
                                        <p className="text-[11px] text-gray-500">
                                            Specify medicine name, dosage, frequency, and instructions.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddMedicineRow}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                    >
                                        <span>+</span>
                                        <span>Add Medicine</span>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {prescriptionFormData.medicines.map((med, index) => (
                                        <div
                                            key={index}
                                            className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 relative group"
                                        >
                                            <div className="flex items-center justify-between pb-2 border-b border-gray-200 text-xs">
                                                <span className="font-bold text-gray-700">Medicine #{index + 1}</span>
                                                {prescriptionFormData.medicines.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMedicineRow(index)}
                                                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                                                    >
                                                        ✕ Remove
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                                        Medicine Name & Strength *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={med.name}
                                                        onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                                                        placeholder="e.g. Amoxicillin 500mg, Paracetamol"
                                                        className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                                        Dosage *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={med.dosage}
                                                        onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                                                        placeholder="e.g. 1 Tablet / 5ml"
                                                        className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                                        Frequency *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={med.frequency}
                                                        onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                                                        placeholder="e.g. 1-0-1 or Twice daily"
                                                        className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                                        Duration *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={med.duration}
                                                        onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                                                        placeholder="e.g. 5 days, 1 week, 30 days"
                                                        className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                                        Special Instructions
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={med.instructions}
                                                        onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                                                        placeholder="e.g. After meals with plenty of water"
                                                        className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Advice & Follow Up */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                        General Advice & Dietary Precautions
                                    </label>
                                    <textarea
                                        rows="3"
                                        value={prescriptionFormData.advice}
                                        onChange={(e) => setPrescriptionFormData({ ...prescriptionFormData, advice: e.target.value })}
                                        placeholder="e.g. Drink plenty of warm fluids, complete the antibiotic course, avoid cold foods."
                                        className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                                        Follow-up Review Date
                                    </label>
                                    <input
                                        type="date"
                                        value={prescriptionFormData.followUpDate}
                                        onChange={(e) => setPrescriptionFormData({ ...prescriptionFormData, followUpDate: e.target.value })}
                                        className="w-full text-xs border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Optional follow-up consultation date.
                                    </p>
                                </div>
                            </div>

                            {/* Note */}
                            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-[11px] text-indigo-900">
                                💡 <strong>Automatic Completion:</strong> Issuing this digital prescription will automatically mark the consultation as <strong>Completed</strong> and make the official PDF available to the patient.
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setPrescriptionModalAppt(null)}
                                    className="px-4 py-2.5 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={prescriptionSubmitting}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
                                >
                                    <span>{prescriptionSubmitting ? 'Signing & Issuing...' : '✓ Sign & Issue Prescription'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: PRESCRIPTION VIEWER MODAL */}
            {viewPrescriptionData && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-2xl w-full my-8 shadow-2xl border border-gray-200 overflow-hidden">
                        {/* Letterhead Header */}
                        <div className="bg-gradient-to-r from-indigo-700 to-indigo-950 text-white p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🏥</span>
                                        <h3 className="font-extrabold text-lg tracking-tight">DocCare Healthcare Clinic</h3>
                                    </div>
                                    <p className="text-xs text-indigo-200 mt-0.5">
                                        Multi-Speciality Healthcare & Telemedicine Services
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setViewPrescriptionData(null)}
                                    className="text-indigo-200 hover:text-white text-xl font-bold p-1 cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="mt-4 pt-3 border-t border-indigo-600/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div>
                                    <span className="text-indigo-300 font-medium">Prescription #: </span>
                                    <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">
                                        {viewPrescriptionData.prescriptionNumber}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-indigo-300 font-medium">Issued: </span>
                                    <span className="font-semibold text-white">
                                        {new Date(viewPrescriptionData.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Letterhead Body */}
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
                            {/* Doctor & Patient Info */}
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                                <div className="space-y-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Prescribing Doctor</span>
                                    <h4 className="font-bold text-sm text-gray-900">Dr. {viewPrescriptionData.doctor?.name}</h4>
                                    <p className="text-gray-600">{viewPrescriptionData.doctor?.speciality || 'General Medicine'}</p>
                                    {viewPrescriptionData.doctor?.qualification && (
                                        <p className="text-gray-500">{viewPrescriptionData.doctor.qualification}</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Patient Details</span>
                                    <h4 className="font-bold text-sm text-gray-900">{viewPrescriptionData.patient?.name}</h4>
                                    <p className="text-gray-600">Email: {viewPrescriptionData.patient?.email}</p>
                                    {viewPrescriptionData.patient?.phone && (
                                        <p className="text-gray-500">Phone: {viewPrescriptionData.patient.phone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Clinical Findings */}
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-2">
                                <div>
                                    <span className="font-bold text-gray-700">Diagnosis: </span>
                                    <span className="font-bold text-indigo-900">{viewPrescriptionData.diagnosis}</span>
                                </div>
                                {viewPrescriptionData.symptoms && (
                                    <div>
                                        <span className="font-bold text-gray-700">Symptoms: </span>
                                        <span className="text-gray-800">{viewPrescriptionData.symptoms}</span>
                                    </div>
                                )}
                            </div>

                            {/* Rx Medicines Table */}
                            <div className="space-y-2">
                                <h4 className="font-extrabold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                    <span className="text-indigo-600 font-serif text-base font-bold">℞</span>
                                    <span>Prescribed Medications</span>
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                                            <tr>
                                                <th className="p-3">#</th>
                                                <th className="p-3">Medicine</th>
                                                <th className="p-3">Dosage</th>
                                                <th className="p-3">Frequency</th>
                                                <th className="p-3">Duration</th>
                                                <th className="p-3">Instructions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {viewPrescriptionData.medicines?.map((med, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                                                    <td className="p-3 font-bold text-gray-900">{med.name}</td>
                                                    <td className="p-3 text-gray-700">{med.dosage}</td>
                                                    <td className="p-3 text-gray-700">{med.frequency}</td>
                                                    <td className="p-3 text-gray-700">{med.duration}</td>
                                                    <td className="p-3 text-gray-500 italic">{med.instructions || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Advice & Follow Up */}
                            {(viewPrescriptionData.advice || viewPrescriptionData.followUpDate) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    {viewPrescriptionData.advice && (
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <span className="font-bold text-gray-800 block mb-1">General Advice & Precautions:</span>
                                            <p className="text-gray-600">{viewPrescriptionData.advice}</p>
                                        </div>
                                    )}
                                    {viewPrescriptionData.followUpDate && (
                                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                                            <span className="font-bold text-amber-900 block mb-1">Recommended Follow-up:</span>
                                            <p className="text-amber-800 font-semibold">{viewPrescriptionData.followUpDate}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Digital Signature Badge */}
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-[11px] text-emerald-800">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">🛡️</span>
                                    <div>
                                        <p className="font-bold">Digitally Signed & Verified</p>
                                        <p className="text-emerald-700 text-[10px]">DocCare Medical Authentication Protocol</p>
                                    </div>
                                </div>
                                <span className="font-mono text-[10px] text-emerald-600">ID: {viewPrescriptionData._id}</span>
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setViewPrescriptionData(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    disabled={downloadingRxId === viewPrescriptionData._id}
                                    onClick={() => handleDownloadPrescriptionPDF(viewPrescriptionData)}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>⬇</span>
                                    <span>{downloadingRxId === viewPrescriptionData._id ? 'Generating PDF...' : 'Download Official PDF'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyAppointments;
