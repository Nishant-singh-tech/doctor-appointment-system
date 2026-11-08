import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import doctorService from '../../services/doctorService';

const DoctorDirectory = () => {
    const [doctors, setDoctors] = useState([]);
    const [specializations, setSpecializations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter and search states
    const [search, setSearch] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');
    const [location, setLocation] = useState('');

    // Pagination states
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalDoctors, setTotalDoctors] = useState(0);

    // Fetch unique specializations once on mount
    useEffect(() => {
        doctorService
            .getSpecializations()
            .then((data) => {
                if (data.specializations && data.specializations.length > 0) {
                    setSpecializations(data.specializations);
                }
            })
            .catch(() => {
                // Fallback default list if empty
                setSpecializations([
                    'Cardiology',
                    'Dermatology',
                    'Pediatrics',
                    'Neurology',
                    'Orthopedics',
                    'General Medicine'
                ]);
            });
    }, []);

    // Fetch doctors whenever search, filters, or page changes
    useEffect(() => {
        const fetchDoctors = async () => {
            setIsLoading(true);
            setError('');
            try {
                const params = {
                    search,
                    specialization: selectedSpec,
                    location,
                    page,
                    limit: 6
                };
                const data = await doctorService.getDoctors(params);
                setDoctors(data.doctors || []);
                setTotalPages(data.pages || 1);
                setTotalDoctors(data.totalDoctors || 0);
            } catch (err) {
                console.error('Error fetching doctors:', err);
                setError('Failed to load doctors. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            fetchDoctors();
        }, 250);

        return () => clearTimeout(debounceTimer);
    }, [search, selectedSpec, location, page]);

    const handleClearFilters = () => {
        setSearch('');
        setSelectedSpec('');
        setLocation('');
        setPage(1);
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Page Header */}
            <div className="text-center max-w-3xl mx-auto space-y-2">
                <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
                    Directory
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                    Find Verified Medical Specialists
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                    Connect with credentialed and verified doctors. Filter by specialty, location, and experience.
                </p>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search by Name */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Search Doctor Name
                        </label>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="e.g. Dr. Sarah..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Filter by Specialization */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Specialization
                        </label>
                        <select
                            value={selectedSpec}
                            onChange={(e) => {
                                setSelectedSpec(e.target.value);
                                setPage(1);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Specializations</option>
                            {specializations.map((spec) => (
                                <option key={spec} value={spec}>
                                    {spec}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter by Location */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Location / City
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => {
                                setLocation(e.target.value);
                                setPage(1);
                            }}
                            placeholder="e.g. New York, Mumbai..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Clear Button */}
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="w-full py-2 px-4 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>

                {/* Filter Summary */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap justify-between items-center text-xs text-gray-500 gap-2">
                    <span>
                        Found <strong className="text-gray-900">{totalDoctors}</strong> verified doctors
                    </span>
                    {(search || selectedSpec || location) && (
                        <span className="text-blue-600 font-medium">
                            Filters active: {[search && `Name: "${search}"`, selectedSpec && `Specialty: "${selectedSpec}"`, location && `Location: "${location}"`].filter(Boolean).join(' • ')}
                        </span>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                    {error}
                </div>
            )}

            {/* Doctors Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div key={n} className="bg-white p-6 rounded-2xl border border-gray-200 animate-pulse space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gray-200 rounded-full" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                </div>
                            </div>
                            <div className="h-3 bg-gray-200 rounded w-full" />
                            <div className="h-3 bg-gray-200 rounded w-5/6" />
                            <div className="h-9 bg-gray-200 rounded-lg" />
                        </div>
                    ))}
                </div>
            ) : doctors.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center font-bold text-xl">
                        🔍
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No Doctors Found</h3>
                    <p className="text-xs text-gray-500">
                        We could not find any verified doctors matching your current filters. Try searching for a different specialty or location.
                    </p>
                    <button
                        onClick={handleClearFilters}
                        className="mt-2 text-xs font-semibold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Reset All Filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {doctors.map((doctor) => (
                        <div
                            key={doctor._id}
                            className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between space-y-4"
                        >
                            {/* Card Header */}
                            <div className="space-y-3">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs shrink-0">
                                        {doctor.name.replace('Dr. ', '').charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h3 className="text-base font-bold text-gray-900 truncate">
                                                {doctor.name}
                                            </h3>
                                            <span className="text-blue-500 text-xs" title="Verified Specialist">
                                                ✓
                                            </span>
                                        </div>
                                        <span className="inline-block mt-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                            {doctor.specialization || 'General Specialist'}
                                        </span>
                                    </div>
                                </div>

                                {/* Qualifications & Hospital */}
                                <div className="text-xs text-gray-600 space-y-1 pt-1">
                                    {doctor.qualifications && (
                                        <p className="text-gray-700 font-medium truncate">
                                            🎓 {doctor.qualifications}
                                        </p>
                                    )}
                                    {doctor.hospital && (
                                        <p className="text-gray-500 truncate">
                                            🏥 {doctor.hospital}
                                        </p>
                                    )}
                                    {doctor.location && (
                                        <p className="text-gray-500 truncate">
                                            📍 {doctor.location}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Card Footer: Experience, Fees, View Profile Button */}
                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                <div>
                                    <span className="block text-[11px] text-gray-500 uppercase font-medium">Consultation Fee</span>
                                    <span className="text-base font-extrabold text-gray-900">₹{doctor.fees || 0}</span>
                                    <span className="text-[10px] text-gray-400 block">{doctor.experience || 0} yrs exp</span>
                                </div>

                                <Link
                                    to={`/doctors/${doctor._id}`}
                                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
                                >
                                    View Profile
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                        Previous
                    </button>
                    <span className="text-xs font-medium text-gray-600">
                        Page <strong className="text-gray-900">{page}</strong> of <strong className="text-gray-900">{totalPages}</strong>
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default DoctorDirectory;
