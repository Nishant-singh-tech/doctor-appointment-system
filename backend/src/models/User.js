import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide your name'],
            trim: true,
            maxLength: [50, 'Name cannot exceed 50 characters']
        },
        email: {
            type: String,
            required: [true, 'Please provide an email address'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
                'Please provide a valid email address'
            ]
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            minlength: [6, 'Password must be at least 6 characters long'],
            select: false // Exclude password from queries by default
        },
        role: {
            type: String,
            enum: ['patient', 'doctor', 'admin'],
            default: 'patient'
        },
        phone: {
            type: String,
            trim: true,
            default: ''
        },
        isVerified: {
            type: Boolean,
            default: function () {
                // Patients and admins are verified by default; doctors require admin verification in later phases
                return this.role !== 'doctor';
            }
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        // Patient specific fields
        address: {
            type: String,
            trim: true,
            default: ''
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', ''],
            default: ''
        },
        dateOfBirth: {
            type: String,
            default: ''
        },
        bloodGroup: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
            default: ''
        },
        // Doctor specific fields
        specialization: {
            type: String,
            trim: true,
            default: ''
        },
        experience: {
            type: Number,
            default: 0
        },
        fees: {
            type: Number,
            default: 0
        },
        qualifications: {
            type: String,
            trim: true,
            default: ''
        },
        location: {
            type: String,
            trim: true,
            default: ''
        },
        about: {
            type: String,
            trim: true,
            default: ''
        },
        hospital: {
            type: String,
            trim: true,
            default: ''
        },
        // Doctor verification tracking
        verificationStatus: {
            type: String,
            enum: ['unsubmitted', 'pending', 'approved', 'rejected'],
            default: function () {
                return this.role === 'doctor' ? (this.isVerified ? 'approved' : 'pending') : 'approved';
            }
        },
        documents: [
            {
                title: { type: String, required: true, trim: true },
                documentUrl: { type: String, required: true, trim: true },
                documentType: { type: String, trim: true, default: 'Medical License' },
                uploadedAt: { type: Date, default: Date.now }
            }
        ],
        rejectionReason: {
            type: String,
            trim: true,
            default: ''
        },
        // Doctor schedule and availability configuration
        availability: {
            workingDays: {
                type: [String],
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
            },
            workingHours: {
                start: { type: String, default: '09:00' },
                end: { type: String, default: '17:00' }
            },
            slotDuration: {
                type: Number,
                default: 30,
                min: [10, 'Slot duration must be at least 10 minutes'],
                max: [180, 'Slot duration cannot exceed 180 minutes']
            },
            breakTime: {
                start: { type: String, default: '13:00' },
                end: { type: String, default: '14:00' }
            },
            timeZone: {
                type: String,
                default: 'UTC'
            }
        }
    },
    {
        timestamps: true
    }
);

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password with hashed password in database
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
