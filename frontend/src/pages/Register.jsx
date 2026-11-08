import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { register, reset } from '../features/auth/authSlice';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        role: 'patient',
        specialization: '',
        experience: '',
        fees: ''
    });

    const [formError, setFormError] = useState('');

    const { name, email, password, confirmPassword, phone, role, specialization, experience, fees } = formData;

    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { user, isLoading, isError, isSuccess, message } = useSelector(
        (state) => state.auth
    );

    useEffect(() => {
        if (isError) {
            setFormError(message);
        }

        if (isSuccess || user) {
            navigate('/profile');
        }

        return () => {
            dispatch(reset());
        };
    }, [user, isError, isSuccess, message, navigate, dispatch]);

    const onChange = (e) => {
        setFormData((prevState) => ({
            ...prevState,
            [e.target.name]: e.target.value
        }));
        setFormError('');
    };

    const onSubmit = (e) => {
        e.preventDefault();

        if (!name || !email || !password) {
            setFormError('Please fill in all required fields (Name, Email, Password).');
            return;
        }

        if (password.length < 6) {
            setFormError('Password must be at least 6 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setFormError('Passwords do not match.');
            return;
        }

        if (role === 'doctor' && !specialization) {
            setFormError('Please provide your medical specialization.');
            return;
        }

        const userData = {
            name,
            email,
            password,
            phone,
            role,
            specialization: role === 'doctor' ? specialization : '',
            experience: role === 'doctor' ? Number(experience) || 0 : 0,
            fees: role === 'doctor' ? Number(fees) || 0 : 0
        };

        dispatch(register(userData));
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Create an Account
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Join our healthcare platform as a patient or medical specialist
                    </p>
                </div>

                {/* Role Switcher Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'patient' })}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                            role === 'patient'
                                ? 'bg-white text-blue-600 shadow-xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Patient
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'doctor' })}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                            role === 'doctor'
                                ? 'bg-white text-emerald-600 shadow-xs'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Doctor
                    </button>
                </div>

                {/* Error Banner */}
                {formError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md text-sm text-red-700">
                        {formError}
                    </div>
                )}

                <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Full Name *
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={name}
                            onChange={onChange}
                            placeholder="John Doe"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Email Address *
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={email}
                            onChange={onChange}
                            placeholder="user@example.com"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={phone}
                            onChange={onChange}
                            placeholder="+1 234 567 890"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Doctor-Specific Fields */}
                    {role === 'doctor' && (
                        <div className="space-y-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                                Doctor Professional Details
                            </span>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                    Specialization *
                                </label>
                                <input
                                    type="text"
                                    name="specialization"
                                    value={specialization}
                                    onChange={onChange}
                                    placeholder="e.g. Cardiologist, Dermatologist"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Experience (Yrs)
                                    </label>
                                    <input
                                        type="number"
                                        name="experience"
                                        min="0"
                                        value={experience}
                                        onChange={onChange}
                                        placeholder="5"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                        Fee (₹)
                                    </label>
                                    <input
                                        type="number"
                                        name="fees"
                                        min="0"
                                        value={fees}
                                        onChange={onChange}
                                        placeholder="500"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                Password *
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={password}
                                onChange={onChange}
                                placeholder="Min 6 characters"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                Confirm *
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={confirmPassword}
                                onChange={onChange}
                                placeholder="Re-enter password"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-white shadow-sm transition mt-6 ${
                            role === 'doctor'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                        } disabled:opacity-50`}
                    >
                        {isLoading ? 'Creating Account...' : `Register as ${role === 'doctor' ? 'Doctor' : 'Patient'}`}
                    </button>
                </form>

                <div className="text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                        Sign In here
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
