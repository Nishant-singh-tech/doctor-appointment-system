import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

/**
 * @desc    Register a new patient or doctor
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
    try {
        const { name, email, password, role, phone, specialization, experience, fees } = req.body;

        // Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: name, email, and password.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        // Security check: Never allow admin creation via public registration endpoint
        if (role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Admin accounts cannot be registered publicly.'
            });
        }

        // Only allow 'patient' or 'doctor' roles
        const userRole = role === 'doctor' ? 'doctor' : 'patient';

        // Check if user already exists
        const userExists = await User.findOne({ email: email.toLowerCase().trim() });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email address already exists.'
            });
        }

        // Create new user (password is automatically hashed via Mongoose pre-save hook)
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: userRole,
            phone: phone || '',
            specialization: userRole === 'doctor' ? specialization || '' : '',
            experience: userRole === 'doctor' ? Number(experience) || 0 : 0,
            fees: userRole === 'doctor' ? Number(fees) || 0 : 0
        });

        // Generate JWT token
        const token = generateToken(user._id, user.role);

        return res.status(201).json({
            success: true,
            message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} registered successfully.`,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                isVerified: user.isVerified,
                isBlocked: user.isBlocked,
                specialization: user.specialization,
                experience: user.experience,
                fees: user.fees
            }
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error during registration.',
            error: error.message
        });
    }
};

/**
 * @desc    Authenticate user (patient, doctor, admin) and get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate presence of email and password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password.'
            });
        }

        // Check for user and explicitly select password (which is excluded by default)
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Check if account is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been blocked. Please contact support.'
            });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        // Generate JWT token
        const token = generateToken(user._id, user.role);

        return res.status(200).json({
            success: true,
            message: 'Logged in successfully.',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                isVerified: user.isVerified,
                isBlocked: user.isBlocked,
                specialization: user.specialization,
                experience: user.experience,
                fees: user.fees
            }
        });
    } catch (error) {
        console.error('Login error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error during login.',
            error: error.message
        });
    }
};

/**
 * @desc    Get currently authenticated user's profile
 * @route   GET /api/auth/profile
 * @access  Private (Requires valid JWT)
 */
export const getProfile = async (req, res) => {
    try {
        // req.user is set by the protect middleware
        return res.status(200).json({
            success: true,
            user: {
                _id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                phone: req.user.phone,
                isVerified: req.user.isVerified,
                isBlocked: req.user.isBlocked,
                specialization: req.user.specialization,
                experience: req.user.experience,
                fees: req.user.fees,
                createdAt: req.user.createdAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving profile.',
            error: error.message
        });
    }
};
