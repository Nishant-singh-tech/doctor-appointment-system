import User from '../models/User.js';

/**
 * @desc    Get public list of verified & active doctors with search, filter, and pagination
 * @route   GET /api/doctors
 * @access  Public
 */


export const getDoctors = async (req, res) => {
    try {
        const { search, specialization, location, page = 1, limit = 6 } = req.query;

        // Show all registered doctors except blocked doctors
        const query = {
            role: 'doctor',
            isBlocked: { $ne: true }
        };

        // Search by doctor name
        if (search && search.trim() !== '') {
            query.name = { $regex: search.trim(), $options: 'i' };
        }

        // Filter by specialization
        if (specialization && specialization.trim() !== '' && specialization.toLowerCase() !== 'all') {
            query.specialization = { $regex: specialization.trim(), $options: 'i' };
        }

        // Filter by location
        if (location && location.trim() !== '') {
            query.location = { $regex: location.trim(), $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 6);
        const skip = (pageNum - 1) * pageSize;

        const totalDoctors = await User.countDocuments(query);

        const doctors = await User.find(query)
            .select('-password')
            .sort({ experience: -1, createdAt: -1 })
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
        console.error('Error in getDoctors:', error.message);

        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctors.',
            error: error.message
        });
    }
};



/**
 * @desc    Get detailed public profile of a single doctor
 * @route   GET /api/doctors/:id
 * @access  Public
 */
export const getDoctorById = async (req, res) => {
    try {
        const { id } = req.params;

        const doctor = await User.findById(id).select('-password');

        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found.'
            });
        }

        // Ensure only verified and unblocked doctor profiles are publicly accessible
        if (!doctor.isVerified || doctor.isBlocked) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile is currently unavailable.'
            });
        }

        return res.status(200).json({
            success: true,
            doctor
        });
    } catch (error) {
        console.error('Error in getDoctorById:', error.message);
        // Handle malformed ObjectId cleanly
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found with specified ID.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctor profile.',
            error: error.message
        });
    }
};

/**
 * @desc    Get list of unique specializations from verified active doctors
 * @route   GET /api/doctors/specializations/list
 * @access  Public
 */
export const getSpecializations = async (req, res) => {
    try {
        const specializations = await User.find({
            role: 'doctor',
            isVerified: true,
            isBlocked: false,
            specialization: { $ne: '' }
        }).distinct('specialization');

        return res.status(200).json({
            success: true,
            specializations
        });
    } catch (error) {
        console.error('Error in getSpecializations:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving specializations.',
            error: error.message
        });
    }
};

/**
 * @desc    Get authenticated doctor's own profile
 * @route   GET /api/doctors/profile/me
 * @access  Private (Doctor only)
 */
export const getDoctorProfile = async (req, res) => {
    try {
        const doctor = await User.findById(req.user._id).select('-password');
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found.'
            });
        }

        return res.status(200).json({
            success: true,
            doctor
        });
    } catch (error) {
        console.error('Error in getDoctorProfile:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctor profile.',
            error: error.message
        });
    }
};

/**
 * @desc    Update authenticated doctor's own profile
 * @route   PUT /api/doctors/profile/me
 * @access  Private (Doctor only)
 */
export const updateDoctorProfile = async (req, res) => {
    try {
        const doctor = await User.findById(req.user._id);
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found.'
            });
        }

        const {
            name,
            phone,
            specialization,
            qualifications,
            experience,
            fees,
            location,
            hospital,
            about
        } = req.body;

        // Validation
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Doctor name cannot be empty.'
                });
            }
            doctor.name = name.trim();
        }

        if (phone !== undefined) doctor.phone = phone.trim();
        if (specialization !== undefined) {
            if (!specialization.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Specialization cannot be empty.'
                });
            }
            doctor.specialization = specialization.trim();
        }

        if (qualifications !== undefined) doctor.qualifications = qualifications.trim();

        if (experience !== undefined) {
            const expNum = Number(experience);
            if (isNaN(expNum) || expNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Experience must be a non-negative number.'
                });
            }
            doctor.experience = expNum;
        }

        if (fees !== undefined) {
            const feeNum = Number(fees);
            if (isNaN(feeNum) || feeNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Consultation fee must be a non-negative number.'
                });
            }
            doctor.fees = feeNum;
        }

        if (location !== undefined) doctor.location = location.trim();
        if (hospital !== undefined) doctor.hospital = hospital.trim();
        if (about !== undefined) doctor.about = about.trim();

        const updatedDoctor = await doctor.save();

        return res.status(200).json({
            success: true,
            message: 'Doctor professional profile updated successfully.',
            doctor: {
                _id: updatedDoctor._id,
                name: updatedDoctor.name,
                email: updatedDoctor.email,
                phone: updatedDoctor.phone,
                role: updatedDoctor.role,
                specialization: updatedDoctor.specialization,
                qualifications: updatedDoctor.qualifications,
                experience: updatedDoctor.experience,
                fees: updatedDoctor.fees,
                location: updatedDoctor.location,
                hospital: updatedDoctor.hospital,
                about: updatedDoctor.about,
                isVerified: updatedDoctor.isVerified,
                verificationStatus: updatedDoctor.verificationStatus,
                isBlocked: updatedDoctor.isBlocked
            }
        });
    } catch (error) {
        console.error('Error in updateDoctorProfile:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error updating doctor profile.',
            error: error.message
        });
    }
};

/**
 * @desc    Doctor submits professional verification document
 * @route   POST /api/doctors/verification/submit
 * @access  Private (Doctor only)
 */
export const submitVerification = async (req, res) => {
    try {
        const { title, documentUrl, documentType } = req.body;

        if (!title || !title.trim() || !documentUrl || !documentUrl.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both document title and document URL / license identifier.'
            });
        }

        const doctor = await User.findById(req.user._id);
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found.'
            });
        }

        // Add document to list
        doctor.documents.push({
            title: title.trim(),
            documentUrl: documentUrl.trim(),
            documentType: (documentType && documentType.trim()) || 'Medical License',
            uploadedAt: new Date()
        });

        // Set status to pending review
        doctor.verificationStatus = 'pending';
        doctor.rejectionReason = '';

        await doctor.save();

        return res.status(200).json({
            success: true,
            message: 'Verification document submitted successfully. Under review by administration.',
            verificationStatus: doctor.verificationStatus,
            documents: doctor.documents
        });
    } catch (error) {
        console.error('Error in submitVerification:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error submitting verification document.',
            error: error.message
        });
    }
};

/**
 * @desc    Get authenticated doctor's schedule / availability
 * @route   GET /api/doctors/availability/me
 * @access  Private (Doctor only)
 */
export const getDoctorAvailability = async (req, res) => {
    try {
        const doctor = await User.findById(req.user._id);
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found.'
            });
        }

        return res.status(200).json({
            success: true,
            availability: doctor.availability
        });
    } catch (error) {
        console.error('Error in getDoctorAvailability:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctor availability.',
            error: error.message
        });
    }
};

/**
 * @desc    Configure authenticated doctor's schedule / availability
 * @route   PUT /api/doctors/availability/me
 * @access  Private (Doctor only)
 */
export const updateDoctorAvailability = async (req, res) => {
    try {
        const { workingDays, workingHours, slotDuration, breakTime, timeZone } = req.body;

        const doctor = await User.findById(req.user._id);
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found.'
            });
        }

        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const isValidTime = (timeStr) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
        const timeToMinutes = (timeStr) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        // Validate working days
        if (workingDays !== undefined) {
            if (!Array.isArray(workingDays) || workingDays.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please specify at least one working day.'
                });
            }
            const allDaysValid = workingDays.every((day) => validDays.includes(day));
            if (!allDaysValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid day in working days list.'
                });
            }
            doctor.availability.workingDays = workingDays;
        }

        // Validate working hours
        if (workingHours) {
            const { start, end } = workingHours;
            if (!start || !end || !isValidTime(start) || !isValidTime(end)) {
                return res.status(400).json({
                    success: false,
                    message: 'Working hours must be specified in valid HH:mm 24-hour format.'
                });
            }
            if (timeToMinutes(start) >= timeToMinutes(end)) {
                return res.status(400).json({
                    success: false,
                    message: 'Working hours start time must be before end time.'
                });
            }
            doctor.availability.workingHours = { start, end };
        }

        // Validate slot duration
        if (slotDuration !== undefined) {
            const duration = Number(slotDuration);
            if (isNaN(duration) || duration < 10 || duration > 180) {
                return res.status(400).json({
                    success: false,
                    message: 'Slot duration must be between 10 and 180 minutes.'
                });
            }
            doctor.availability.slotDuration = duration;
        }

        // Validate break time (optional)
        if (breakTime) {
            const { start, end } = breakTime;
            if (start && end) {
                if (!isValidTime(start) || !isValidTime(end)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Break times must be specified in valid HH:mm 24-hour format.'
                    });
                }
                if (timeToMinutes(start) >= timeToMinutes(end)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Break start time must be before break end time.'
                    });
                }

                // Check that break time is within working hours
                const workStartMin = timeToMinutes(doctor.availability.workingHours.start);
                const workEndMin = timeToMinutes(doctor.availability.workingHours.end);
                const breakStartMin = timeToMinutes(start);
                const breakEndMin = timeToMinutes(end);

                if (breakStartMin < workStartMin || breakEndMin > workEndMin) {
                    return res.status(400).json({
                        success: false,
                        message: 'Break time must fall completely within working hours.'
                    });
                }
                doctor.availability.breakTime = { start, end };
            }
        }

        if (timeZone) {
            doctor.availability.timeZone = timeZone.trim();
        }

        // Overlap and schedule viability check
        const totalWorkMin =
            timeToMinutes(doctor.availability.workingHours.end) -
            timeToMinutes(doctor.availability.workingHours.start);

        let breakDuration = 0;
        if (doctor.availability.breakTime?.start && doctor.availability.breakTime?.end) {
            breakDuration =
                timeToMinutes(doctor.availability.breakTime.end) -
                timeToMinutes(doctor.availability.breakTime.start);
        }

        const netWorkingMin = totalWorkMin - breakDuration;
        if (netWorkingMin < doctor.availability.slotDuration) {
            return res.status(400).json({
                success: false,
                message: 'Available working time after break must accommodate at least one consultation slot.'
            });
        }

        await doctor.save();

        return res.status(200).json({
            success: true,
            message: 'Availability schedule updated successfully.',
            availability: doctor.availability
        });
    } catch (error) {
        console.error('Error in updateDoctorAvailability:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error updating doctor availability.',
            error: error.message
        });
    }
};

/**
 * @desc    Get public doctor availability preview (for patient appointment preview in later phases)
 * @route   GET /api/doctors/:id/availability
 * @access  Public
 */
export const getPublicDoctorAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const doctor = await User.findById(id).select('name specialization availability isVerified isBlocked');

        if (!doctor || !doctor.isVerified || doctor.isBlocked) {
            return res.status(404).json({
                success: false,
                message: 'Doctor schedule unavailable.'
            });
        }

        return res.status(200).json({
            success: true,
            doctorName: doctor.name,
            specialization: doctor.specialization,
            availability: doctor.availability
        });
    } catch (error) {
        console.error('Error in getPublicDoctorAvailability:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctor schedule.',
            error: error.message
        });
    }
};

