import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import prescriptionService from '../services/prescriptionService';

const Prescriptions = () => {
    const { user, token } = useSelector((state) => state.auth);

    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    // Viewer modal state
    const [selectedPrescription, setSelectedPrescription] = useState(null);
    const [downloadingId, setDownloadingId] = useState('');

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    };

    const fetchPrescriptions = useCallback(async (pageNumber = 1) => {
        if (!token) return;
        setLoading(true);
        try {
            const data = await prescriptionService.getMyPrescriptions(
                { search, page: pageNumber, limit: 6 },
                token
            );
            if (data.success) {
                setPrescriptions(data.prescriptions || []);
                setPage(data.page || 1);
                setTotalPages(data.pages || 1);
                setTotalCount(data.totalPrescriptions || 0);
            }
        } catch (err) {
            console.error('Failed to load prescriptions:', err);
            showFeedback('error', err.response?.data?.message || 'Failed to load medical prescriptions.');
        } finally {
            setLoading(false);
        }
    }, [token, search]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPrescriptions(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchPrescriptions]);

    const handleDownloadPDF = async (rx) => {
        if (!token) return;
        setDownloadingId(rx._id);
        try {
            await prescriptionService.downloadPrescriptionPDF(
                rx._id,
                rx.prescriptionNumber,
                token
            );
            showFeedback('success', `Prescription ${rx.prescriptionNumber} downloaded successfully.`);
        } catch (err) {
            console.error('Download PDF error:', err);
            showFeedback('error', 'Failed to generate PDF. Please try again.');
        } finally {
            setDownloadingId('');
        }
    };

    const isDoctor = user?.role === 'doctor';

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                <div>
                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                        {isDoctor ? 'Physician Records' : 'Patient Health Record'}
                    </span>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
                        {isDoctor ? 'Issued Digital Prescriptions' : 'My Medical Prescriptions'}
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        {isDoctor
                            ? 'Review and manage verified medical prescriptions and patient drug regimens issued by your practice.'
                            : 'Access clinical diagnoses, prescribed medications, dosage schedules, and download official medical PDFs.'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to="/appointments"
                        className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                    >
                        ← Back to Appointments
                    </Link>
                </div>
            </div>

            {/* Notification Banner */}
            {feedback.message && (
                <div
                    className={`p-4 rounded-xl border flex items-center justify-between text-xs shadow-xs ${
                        feedback.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                >
                    <span>{feedback.message}</span>
                    <button
                        onClick={() => setFeedback({ type: '', message: '' })}
                        className="font-bold ml-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                        🔍
                    </span>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by diagnosis, clinical condition, or illness..."
                        className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                    />
                </div>
                <div className="text-xs text-gray-500 shrink-0 font-medium">
                    Total: <strong className="text-gray-900">{totalCount}</strong> prescriptions recorded
                </div>
            </div>

            {/* Prescription Cards Grid */}
            {loading ? (
                <div className="p-16 text-center bg-white rounded-2xl border border-gray-200">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
                    <p className="text-xs text-gray-500 font-medium">Loading medical prescriptions...</p>
                </div>
            ) : prescriptions.length === 0 ? (
                <div className="p-16 text-center bg-white rounded-2xl border border-gray-200 space-y-4">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        💊
                    </div>
                    <h3 className="text-base font-bold text-gray-900">No Prescriptions Found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        {search
                            ? `No records found matching diagnosis "${search}".`
                            : isDoctor
                            ? 'You have not issued any prescriptions yet. You can write prescriptions from your Consultation Schedule.'
                            : 'You do not have any digital prescriptions on record yet.'}
                    </p>
                    <Link
                        to="/appointments"
                        className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                        Go to Appointments →
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {prescriptions.map((rx) => (
                        <div
                            key={rx._id}
                            className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-blue-300 transition p-6 flex flex-col justify-between space-y-4"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                        {rx.prescriptionNumber}
                                    </span>
                                    <span className="text-[11px] text-gray-500">
                                        {new Date(rx.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                {/* Main Party Info */}
                                <div>
                                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block">
                                        {isDoctor ? 'Patient' : 'Prescribed By'}
                                    </span>
                                    <h3 className="font-extrabold text-base text-gray-900">
                                        {isDoctor ? rx.patient?.name : rx.doctor?.name}
                                    </h3>
                                    <p className="text-xs text-emerald-700 font-medium">
                                        {isDoctor
                                            ? `Contact: ${rx.patient?.phone || 'N/A'} • Blood: ${rx.patient?.bloodGroup || '—'}`
                                            : `${rx.doctor?.specialization || 'Specialist'} • ${rx.doctor?.hospital || 'Private Clinic'}`}
                                    </p>
                                </div>

                                {/* Diagnosis */}
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                                        Diagnosis
                                    </span>
                                    <p className="text-xs font-bold text-gray-900">
                                        {rx.diagnosis}
                                    </p>
                                    {rx.symptoms && (
                                        <p className="text-[11px] text-gray-500">
                                            Symptoms: {rx.symptoms}
                                        </p>
                                    )}
                                </div>

                                {/* Medicines Summary */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                                        Prescribed Medicines ({rx.medicines?.length || 0})
                                    </span>
                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                        {(rx.medicines || []).map((med, idx) => (
                                            <div key={idx} className="text-xs flex items-center justify-between text-gray-700 bg-gray-50/70 px-2 py-1 rounded">
                                                <span className="font-medium truncate max-w-[150px]">💊 {med.name}</span>
                                                <span className="text-[11px] text-gray-500">{med.dosage} ({med.frequency})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {rx.followUpDate && (
                                    <div className="text-[11px] text-blue-700 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                        📅 Follow-up: <strong>{rx.followUpDate}</strong>
                                    </div>
                                )}
                            </div>

                            {/* Card Footer Actions */}
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPrescription(rx)}
                                    className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
                                >
                                    📋 View Details
                                </button>
                                <button
                                    type="button"
                                    disabled={downloadingId === rx._id}
                                    onClick={() => handleDownloadPDF(rx)}
                                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer text-center flex items-center justify-center gap-1"
                                >
                                    <span>⬇</span>
                                    <span>{downloadingId === rx._id ? 'Generating...' : 'PDF'}</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <span className="text-xs text-gray-500">
                        Page <strong className="text-gray-900">{page}</strong> of <strong className="text-gray-900">{totalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page <= 1 || loading}
                            onClick={() => fetchPrescriptions(page - 1)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer"
                        >
                            ← Previous
                        </button>
                        <button
                            type="button"
                            disabled={page >= totalPages || loading}
                            onClick={() => fetchPrescriptions(page + 1)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {/* VIEW PRESCRIPTION MODAL */}
            {selectedPrescription && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
                        {/* Header */}
                        <div className="bg-slate-900 text-white p-6 rounded-t-3xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xl">
                                    Rx
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-lg">Digital Medical Prescription</h3>
                                    <p className="text-xs text-slate-300">
                                        Official Medical Record • DocCare Healthcare System
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedPrescription(null)}
                                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Letterhead Body */}
                        <div className="p-6 space-y-6 text-xs text-gray-700">
                            {/* Doctor & Patient Info Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-200">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                                        Prescribing Physician
                                    </span>
                                    <p className="text-sm font-extrabold text-gray-900">{selectedPrescription.doctor?.name}</p>
                                    <p className="text-emerald-700 font-semibold">{selectedPrescription.doctor?.specialization}</p>
                                    <p className="text-gray-500">🎓 {selectedPrescription.doctor?.qualifications || 'Certified Specialist'}</p>
                                    <p className="text-gray-500">🏥 {selectedPrescription.doctor?.hospital || selectedPrescription.doctor?.location || 'DocCare Health Center'}</p>
                                </div>

                                <div className="space-y-1 sm:text-right">
                                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                                        Patient Details
                                    </span>
                                    <p className="text-sm font-extrabold text-gray-900">{selectedPrescription.patient?.name}</p>
                                    <p className="text-gray-600">
                                        {selectedPrescription.patient?.gender ? `Gender: ${selectedPrescription.patient.gender.toUpperCase()} • ` : ''}
                                        {selectedPrescription.patient?.bloodGroup ? `Blood: ${selectedPrescription.patient.bloodGroup}` : ''}
                                    </p>
                                    <p className="text-gray-500">Prescription No: <strong className="text-gray-800 font-mono">{selectedPrescription.prescriptionNumber}</strong></p>
                                    <p className="text-gray-500">Date: {new Date(selectedPrescription.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* Diagnosis Block */}
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-1">
                                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                                    Clinical Diagnosis
                                </span>
                                <p className="text-sm font-extrabold text-gray-900">{selectedPrescription.diagnosis}</p>
                                {selectedPrescription.symptoms && (
                                    <p className="text-xs text-gray-600">Symptoms: {selectedPrescription.symptoms}</p>
                                )}
                            </div>

                            {/* Rx Table */}
                            <div className="space-y-2">
                                <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                    <span className="text-blue-700 font-black text-lg">℞</span>
                                    <span>Prescribed Medications</span>
                                </span>

                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                                        <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[10px]">
                                            <tr>
                                                <th className="px-3 py-2">#</th>
                                                <th className="px-3 py-2">Drug Name</th>
                                                <th className="px-3 py-2">Dosage</th>
                                                <th className="px-3 py-2">Frequency</th>
                                                <th className="px-3 py-2">Duration</th>
                                                <th className="px-3 py-2">Instructions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {(selectedPrescription.medicines || []).map((med, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50">
                                                    <td className="px-3 py-2 font-bold text-gray-400">{idx + 1}</td>
                                                    <td className="px-3 py-2 font-bold text-gray-900">{med.name}</td>
                                                    <td className="px-3 py-2 font-semibold text-blue-700">{med.dosage}</td>
                                                    <td className="px-3 py-2 text-gray-700">{med.frequency}</td>
                                                    <td className="px-3 py-2 text-gray-700">{med.duration}</td>
                                                    <td className="px-3 py-2 text-gray-500 italic">{med.instructions || 'As advised'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Advice Block */}
                            {selectedPrescription.advice && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-1">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider block">
                                        General Advice & Guidance
                                    </span>
                                    <p className="text-xs text-gray-700 leading-relaxed">{selectedPrescription.advice}</p>
                                </div>
                            )}

                            {/* Follow up */}
                            {selectedPrescription.followUpDate && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-medium">
                                    📅 <strong>Follow-up Recommendation:</strong> {selectedPrescription.followUpDate}
                                </div>
                            )}

                            {/* Digital signature note */}
                            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400 gap-2">
                                <span>Certified Digital Prescription • DocCare Healthcare</span>
                                <span className="font-bold text-gray-700">Dr. {selectedPrescription.doctor?.name} (Verified)</span>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-gray-50 rounded-b-3xl border-t border-gray-200 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedPrescription(null)}
                                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-white transition cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                disabled={downloadingId === selectedPrescription._id}
                                onClick={() => handleDownloadPDF(selectedPrescription)}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                                <span>⬇</span>
                                <span>{downloadingId === selectedPrescription._id ? 'Generating PDF...' : 'Download Official PDF'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Prescriptions;

