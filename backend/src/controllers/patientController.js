import User from '../models/User.js';

/**
 * @desc    Get current patient's profile
 * @route   GET /api/patients/profile
 * @access  Private (Patient, Admin)
 */
export const getPatientProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Patient profile not found.'
            });
        }

        return res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error in getPatientProfile:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving patient profile.',
            error: error.message
        });
    }
};

/**
 * @desc    Update current patient's profile
 * @route   PUT /api/patients/profile
 * @access  Private (Patient only)
 */
export const updatePatientProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Patient profile not found.'
            });
        }

        const { name, phone, address, gender, dateOfBirth, bloodGroup } = req.body;

        // Validation
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Name cannot be empty.'
                });
            }
            user.name = name.trim();
        }

        if (phone !== undefined) {
            user.phone = phone.trim();
        }

        if (address !== undefined) {
            user.address = address.trim();
        }

        if (gender !== undefined) {
            const validGenders = ['male', 'female', 'other', ''];
            if (!validGenders.includes(gender.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid gender specified.'
                });
            }
            user.gender = gender.toLowerCase();
        }

        if (dateOfBirth !== undefined) {
            user.dateOfBirth = dateOfBirth.trim();
        }

        if (bloodGroup !== undefined) {
            const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''];
            if (bloodGroup && !validBloodGroups.includes(bloodGroup.toUpperCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid blood group specified. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-.'
                });
            }
            user.bloodGroup = bloodGroup.toUpperCase();
        }

        const updatedUser = await user.save();

        return res.status(200).json({
            success: true,
            message: 'Patient profile updated successfully.',
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                phone: updatedUser.phone,
                address: updatedUser.address,
                gender: updatedUser.gender,
                dateOfBirth: updatedUser.dateOfBirth,
                bloodGroup: updatedUser.bloodGroup,
                isVerified: updatedUser.isVerified,
                isBlocked: updatedUser.isBlocked
            }
        });
    } catch (error) {
        console.error('Error in updatePatientProfile:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error updating patient profile.',
            error: error.message
        });
    }
};
