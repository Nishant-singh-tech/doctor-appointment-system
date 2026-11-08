import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import doctorService from '../../services/doctorService';
import appointmentService from '../../services/appointmentService';

const DoctorDetails = () => {
    const { id } = useParams();
    const { user, token } = useSelector((state) => state.auth);

    const [doctor, setDoctor] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Booking Widget State
    const getTomorrowDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    };

    const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
    const [slotsData, setSlotsData] = useState({
        dayOfWeek: '',
        isWorkingDay: true,
        message: '',
        slots: []
    });
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [reason, setReason] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(null);
    const [bookingError, setBookingError] = useState('');

    // Fetch Doctor Details
    useEffect(() => {
        setIsLoading(true);
        doctorService
            .getDoctorById(id)
            .then((data) => {
                setDoctor(data.doctor);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error('Error fetching doctor details:', err);
                setError(
                    (err.response && err.response.data && err.response.data.message) ||
                    'Doctor profile is unavailable.'
                );
                setIsLoading(false);
            });
    }, [id]);

    // Fetch Available Slots for selected date
    const fetchSlots = useCallback(async () => {
        if (!id || !selectedDate) return;
        setLoadingSlots(true);
        setBookingError('');
        setSelectedSlot('');
        try {
            const data = await appointmentService.getAvailableSlots(id, selectedDate);
            if (data.success) {
                setSlotsData({
                    dayOfWeek: data.dayOfWeek || '',
                    isWorkingDay: data.isWorkingDay !== false,
                    message: data.message || '',
                    slots: data.slots || []
                });
            }
        } catch (err) {
            console.error('Error fetching slots:', err);
            setSlotsData({
                dayOfWeek: '',
                isWorkingDay: false,
                message: err.response?.data?.message || 'Could not load availability slots for this date.',
                slots: []
            });
        } finally {
            setLoadingSlots(false);
        }
    }, [id, selectedDate]);

    useEffect(() => {
        if (doctor) {
            fetchSlots();
        }
    }, [doctor, fetchSlots]);

    // Handle Appointment Booking Submission
    const handleBookAppointment = async (e) => {
        e.preventDefault();
        if (!token) return;
        if (!selectedSlot) {
            setBookingError('Please choose an available consultation time slot.');
            return;
        }

        setBookingLoading(true);
        setBookingError('');
        try {
            const res = await appointmentService.bookAppointment(
                {
                    doctorId: doctor._id,
                    date: selectedDate,
                    timeSlot: selectedSlot,
                    reason: reason.trim() || 'General Consultation'
                },
                token
            );

            if (res.success) {
                setBookingSuccess(res.appointment);
                // Refresh slots so the newly booked slot shows as occupied
                fetchSlots();
            }
        } catch (err) {
            console.error('Booking failed:', err);
            const msg = err.response?.data?.message || 'Failed to book appointment. Please try again.';
            setBookingError(msg);
            // If conflict (slot taken), refresh slots immediately
            if (err.response?.status === 409) {
                fetchSlots();
            }
        } finally {
            setBookingLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="bg-white p-8 rounded-2xl border border-gray-200 animate-pulse space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 bg-gray-200 rounded-full" />
                        <div className="space-y-3 flex-1">
                            <div className="h-6 bg-gray-200 rounded w-1/3" />
                            <div className="h-4 bg-gray-200 rounded w-1/4" />
                        </div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-5/6" />
                </div>
            </div>
        );
    }

    if (error || !doctor) {
        return (
            <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
                <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-700">
                    <h2 className="text-xl font-bold mb-2">Doctor Profile Unavailable</h2>
                    <p className="text-sm">{error || 'Could not find the requested doctor profile.'}</p>
                </div>
                <Link
                    to="/doctors"
                    className="inline-block px-5 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                    ← Back to Doctor Directory
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Back link */}
            <Link
                to="/doctors"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 transition"
            >
                <span>←</span>
                <span>Back to Doctor Directory</span>
            </Link>

            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-3xl shadow-sm shrink-0">
                            {doctor.name.replace('Dr. ', '').charAt(0)}
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                                    {doctor.name}
                                </h1>
                                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                    ✓ Verified Specialist
                                </span>
                            </div>
                            <p className="text-sm font-semibold text-emerald-700">
                                {doctor.specialization}
                            </p>
                            <p className="text-xs text-gray-500">
                                📍 {doctor.location || 'Location upon inquiry'} {doctor.hospital && `• 🏥 ${doctor.hospital}`}
                            </p>
                        </div>
                    </div>

                    {/* Consultation Fee Badge */}
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center sm:text-right shrink-0">
                        <span className="block text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                            Consultation Fee
                        </span>
                        <span className="text-2xl font-black text-gray-900">
                            ₹{doctor.fees || 0}
                        </span>
                        <span className="block text-[10px] text-gray-500">per consultation session</span>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-6 border-b border-gray-100 text-center">
                    <div className="p-3 bg-gray-50 rounded-xl">
                        <span className="block text-[11px] text-gray-500 uppercase font-semibold">Experience</span>
                        <span className="text-lg font-bold text-gray-900">{doctor.experience || 0} Years</span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                        <span className="block text-[11px] text-gray-500 uppercase font-semibold">Status</span>
                        <span className="text-lg font-bold text-emerald-600">Available</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-3 bg-gray-50 rounded-xl">
                        <span className="block text-[11px] text-gray-500 uppercase font-semibold">Hospital</span>
                        <span className="text-sm font-bold text-gray-900 truncate block">
                            {doctor.hospital || 'Private Clinic'}
                        </span>
                    </div>
                </div>

                {/* Detailed Information */}
                <div className="pt-6 space-y-6">
                    {/* Qualifications */}
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
                            Qualifications & Credentials
                        </h2>
                        <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 font-medium">
                            🎓 {doctor.qualifications || 'Certified Medical Practitioner'}
                        </div>
                    </div>

                    {/* About Doctor */}
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
                            About Specialist
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {doctor.about || 'Dr. ' + doctor.name + ' is a certified medical specialist committed to providing evidence-based healthcare and personalized patient treatment plans.'}
                        </p>
                    </div>

                    {/* Working Schedule Summary */}
                    {doctor.availability && (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                            <span className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                                Consultation Schedule
                            </span>
                            <p className="text-gray-600">
                                📅 <strong>Working Days:</strong> {(doctor.availability.workingDays || []).join(', ')} • ⏰ <strong>Hours:</strong> {doctor.availability.workingHours?.start} - {doctor.availability.workingHours?.end} • ⏱️ <strong>Slot:</strong> {doctor.availability.slotDuration || 30} mins
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* PHASE 6: APPOINTMENT BOOKING SECTION */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 sm:p-8 space-y-6">
                <div>
                    <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                        Schedule Consultation
                    </span>
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight mt-2">
                        Book an Appointment with {doctor.name}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1">
                        Select an upcoming date and pick an available consultation time slot.
                    </p>
                </div>

                {/* Success Banner */}
                {bookingSuccess ? (
                    <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                                ✓
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-emerald-900">
                                    Appointment Confirmed!
                                </h3>
                                <p className="text-xs text-emerald-700">
                                    Your consultation with {doctor.name} has been successfully scheduled.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-emerald-100 text-xs text-gray-700 space-y-1.5">
                            <p>📅 <strong>Date:</strong> {bookingSuccess.date}</p>
                            <p>⏰ <strong>Time Slot:</strong> {bookingSuccess.timeSlot}</p>
                            <p>🩺 <strong>Specialist:</strong> {doctor.name} ({doctor.specialization})</p>
                            <p>💵 <strong>Consultation Fee:</strong> ₹{bookingSuccess.fees}</p>
                            <p>💳 <strong>Payment Status:</strong> <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Payment Pending (Razorpay)</span></p>
                            <p>📋 <strong>Reason:</strong> {bookingSuccess.reason}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <Link
                                to="/appointments"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                            >
                                <span>💳</span>
                                <span>Pay Consultation Fee & View Appointments →</span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    setBookingSuccess(null);
                                    setSelectedSlot('');
                                    setReason('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                            >
                                Book Another Slot
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleBookAppointment} className="space-y-6">
                        {/* Error Alert */}
                        {bookingError && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
                                <span>⚠️ {bookingError}</span>
                                <button
                                    type="button"
                                    onClick={() => setBookingError('')}
                                    className="text-red-500 font-bold ml-2"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Step 1: Date Picker */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                1. Select Consultation Date
                            </label>
                            <div className="flex flex-wrap items-center gap-3">
                                <input
                                    type="date"
                                    value={selectedDate}
                                    min={new Date().toISOString().split('T')[0]}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    required
                                    className="px-4 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                />
                                {slotsData.dayOfWeek && (
                                    <span className="text-xs text-gray-500 font-medium">
                                        Day: <span className="font-bold text-gray-900">{slotsData.dayOfWeek}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Time Slots Grid */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                    2. Available Consultation Slots
                                </label>
                                {slotsData.isWorkingDay && (
                                    <span className="text-xs text-gray-500">
                                        {slotsData.slots.filter((s) => !s.isBooked).length} open slots
                                    </span>
                                )}
                            </div>

                            {loadingSlots ? (
                                <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                                    <p className="text-xs text-gray-500">Loading physician slots...</p>
                                </div>
                            ) : !slotsData.isWorkingDay ? (
                                <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                    <p className="text-xs font-semibold text-amber-800">
                                        ⚠️ {slotsData.message || `Dr. ${doctor.name} is not available on this day.`}
                                    </p>
                                    <p className="text-[11px] text-amber-600 mt-1">
                                        Please choose another date that falls on the physician's working days.
                                    </p>
                                </div>
                            ) : slotsData.slots.length === 0 ? (
                                <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500">
                                    No slots configured for this date.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {slotsData.slots.map((slot) => {
                                        const isSelected = selectedSlot === slot.timeSlot;
                                        return (
                                            <button
                                                key={slot.timeSlot}
                                                type="button"
                                                disabled={slot.isBooked}
                                                onClick={() => setSelectedSlot(slot.timeSlot)}
                                                className={`p-3 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1 border cursor-pointer ${
                                                    slot.isBooked
                                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                                                        : isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300'
                                                        : 'bg-white text-gray-800 border-gray-200 hover:border-blue-500 hover:bg-blue-50/50'
                                                }`}
                                            >
                                                <span>{slot.timeSlot}</span>
                                                <span className={`text-[10px] font-medium ${
                                                    slot.isBooked
                                                        ? 'text-gray-400'
                                                        : isSelected
                                                        ? 'text-blue-100'
                                                        : 'text-emerald-600'
                                                }`}>
                                                    {slot.isBooked ? 'Booked' : isSelected ? '✓ Selected' : 'Available'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Step 3: Consultation Reason */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                3. Reason for Visit / Symptoms
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows="3"
                                placeholder="Describe your symptoms, medical concerns, or consultation reason..."
                                className="w-full text-sm border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                            />
                        </div>

                        {/* Booking Action Footer */}
                        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <span className="text-xs text-gray-500 block">Total Consultation Fee</span>
                                <span className="text-2xl font-black text-gray-900">₹{doctor.fees || 0}</span>
                            </div>

                            {!token ? (
                                <Link
                                    to="/login"
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition text-center"
                                >
                                    Log In as Patient to Book
                                </Link>
                            ) : user?.role === 'doctor' && user?._id === doctor._id ? (
                                <span className="text-xs text-gray-500 italic">
                                    You cannot book an appointment with your own account.
                                </span>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!selectedSlot || bookingLoading || !slotsData.isWorkingDay}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                                >
                                    {bookingLoading ? 'Processing Booking...' : `Confirm & Book Appointment (${selectedSlot || 'Select a Slot'})`}
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default DoctorDetails;
