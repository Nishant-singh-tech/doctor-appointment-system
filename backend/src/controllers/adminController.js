import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';

/**
 * @desc    Get system statistics for Admin Dashboard (only where real data exists)
 * @route   GET /api/admin/stats
 * @access  Private (Admin only)
 */
export const getAdminStats = async (req, res) => {
    try {
        const [
            totalUsers,
            totalPatients,
            totalDoctors,
            verifiedDoctors,
            pendingVerifications,
            rejectedDoctors,
            blockedUsers,
            activeUsers,
            totalAppointments,
            confirmedAppointments,
            completedAppointments,
            cancelledAppointments,
            paidAppointments,
            pendingPayments,
            refundedPayments,
            revenueData
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'patient' }),
            User.countDocuments({ role: 'doctor' }),
            User.countDocuments({ role: 'doctor', isVerified: true }),
            User.countDocuments({ role: 'doctor', verificationStatus: 'pending' }),
            User.countDocuments({ role: 'doctor', verificationStatus: 'rejected' }),
            User.countDocuments({ isBlocked: true }),
            User.countDocuments({ isBlocked: false }),
            Appointment.countDocuments(),
            Appointment.countDocuments({ status: 'confirmed' }),
            Appointment.countDocuments({ status: 'completed' }),
            Appointment.countDocuments({ status: 'cancelled' }),
            Appointment.countDocuments({ paymentStatus: 'paid' }),
            Appointment.countDocuments({ paymentStatus: 'pending' }),
            Appointment.countDocuments({ paymentStatus: 'refunded' }),
            Appointment.aggregate([
                { $match: { paymentStatus: 'paid' } },
                { $group: { _id: null, total: { $sum: '$fees' } } }
            ])
        ]);

        const totalRevenue = (revenueData && revenueData[0] && revenueData[0].total) || 0;

        return res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                totalPatients,
                totalDoctors,
                verifiedDoctors,
                pendingVerifications,
                rejectedDoctors,
                blockedUsers,
                activeUsers,
                totalAppointments,
                confirmedAppointments,
                completedAppointments,
                cancelledAppointments,
                paidAppointments,
                pendingPayments,
                refundedPayments,
                totalRevenue
            }
        });
    } catch (error) {
        console.error('Error in getAdminStats:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving admin statistics.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all users with search, role filter, status filter, and pagination
 * @route   GET /api/admin/users
 * @access  Private (Admin only)
 */
export const getUsers = async (req, res) => {
    try {
        const { search, role, status, page = 1, limit = 10, sortBy = 'createdAt' } = req.query;

        const query = {};

        // Filter by role
        if (role && role.trim() !== '' && role.toLowerCase() !== 'all') {
            query.role = role.toLowerCase().trim();
        }

        // Filter by blocked status
        if (status === 'blocked') {
            query.isBlocked = true;
        } else if (status === 'active') {
            query.isBlocked = false;
        }

        // Search by name, email, or phone
        if (search && search.trim() !== '') {
            const regex = { $regex: search.trim(), $options: 'i' };
            query.$or = [
                { name: regex },
                { email: regex },
                { phone: regex }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * pageSize;

        const totalUsers = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ [sortBy]: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            success: true,
            count: users.length,
            totalUsers,
            page: pageNum,
            pages: Math.ceil(totalUsers / pageSize) || 1,
            users
        });
    } catch (error) {
        console.error('Error in getUsers:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving users.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all doctors with verification status filter, search, and pagination
 * @route   GET /api/admin/doctors
 * @access  Private (Admin only)
 */
export const getDoctors = async (req, res) => {
    try {
        const { search, verificationStatus, status, page = 1, limit = 10 } = req.query;

        const query = { role: 'doctor' };

        // Filter by verification status
        if (verificationStatus && verificationStatus.trim() !== '' && verificationStatus.toLowerCase() !== 'all') {
            query.verificationStatus = verificationStatus.toLowerCase().trim();
        }

        // Filter by blocked status
        if (status === 'blocked') {
            query.isBlocked = true;
        } else if (status === 'active') {
            query.isBlocked = false;
        }

        // Search by name, email, specialization, or hospital
        if (search && search.trim() !== '') {
            const regex = { $regex: search.trim(), $options: 'i' };
            query.$or = [
                { name: regex },
                { email: regex },
                { specialization: regex },
                { hospital: regex }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * pageSize;

        const totalDoctors = await User.countDocuments(query);
        const doctors = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            success: true,
            count: doctors.length,
            totalDoctors,
            page: pageNum,
            pages: Math.ceil(totalDoctors / pageSize) || 1,
            doctors
        });
    } catch (error) {
        console.error('Error in getDoctors (admin):', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctors list.',
            error: error.message
        });
    }
};

/**
 * @desc    Admin block/unblock a user account
 * @route   PUT /api/admin/users/:id/block
 * @access  Private (Admin only)
 */
export const toggleUserBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const { isBlocked } = req.body;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User account not found.'
            });
        }

        // Safety check: Admin cannot block their own account
        if (req.user._id.toString() === user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Admin cannot block their own account.'
            });
        }

        // Set isBlocked according to payload or toggle current value
        const newBlockedStatus = isBlocked !== undefined ? Boolean(isBlocked) : !user.isBlocked;
        user.isBlocked = newBlockedStatus;

        await user.save();

        const actionText = newBlockedStatus ? 'blocked' : 'unblocked';

        return res.status(200).json({
            success: true,
            message: `User ${user.name} (${user.email}) has been successfully ${actionText}.`,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isBlocked: user.isBlocked,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Error in toggleUserBlock:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'User not found with specified ID.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error updating user block status.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all doctors awaiting verification (or all doctors for verification overview)
 * @route   GET /api/admin/doctors/pending
 * @access  Private (Admin only)
 */
export const getPendingDoctors = async (req, res) => {
    try {
        const doctors = await User.find({
            role: 'doctor',
            verificationStatus: 'pending'
        })
            .select('-password')
            .sort({ updatedAt: -1 });

        return res.status(200).json({
            success: true,
            count: doctors.length,
            doctors
        });
    } catch (error) {
        console.error('Error in getPendingDoctors:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving pending doctors.',
            error: error.message
        });
    }
};

/**
 * @desc    Admin approves or rejects doctor verification
 * @route   PUT /api/admin/doctors/:id/verify
 * @access  Private (Admin only)
 */
export const verifyDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        if (!status || !['approved', 'rejected'].includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification status. Must be either "approved" or "rejected".'
            });
        }

        const doctor = await User.findById(id);

        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor account not found.'
            });
        }

        const normalizedStatus = status.toLowerCase();

        if (normalizedStatus === 'approved') {
            doctor.verificationStatus = 'approved';
            doctor.isVerified = true;
            doctor.rejectionReason = '';
        } else {
            doctor.verificationStatus = 'rejected';
            doctor.isVerified = false;
            doctor.rejectionReason = (rejectionReason && rejectionReason.trim()) || 'Credentials did not satisfy medical board verification requirements.';
        }

        await doctor.save();

        return res.status(200).json({
            success: true,
            message: `Doctor verification status updated to "${normalizedStatus}".`,
            doctor: {
                _id: doctor._id,
                name: doctor.name,
                email: doctor.email,
                role: doctor.role,
                isVerified: doctor.isVerified,
                verificationStatus: doctor.verificationStatus,
                rejectionReason: doctor.rejectionReason
            }
        });
    } catch (error) {
        console.error('Error in verifyDoctor:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found with specified ID.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error updating doctor verification.',
            error: error.message
        });
    }
};
