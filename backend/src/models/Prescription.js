import mongoose from 'mongoose';

const medicineItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Medicine name is required'],
            trim: true
        },
        dosage: {
            type: String,
            required: [true, 'Dosage is required (e.g. 500mg, 1 tablet, 10ml)'],
            trim: true
        },
        frequency: {
            type: String,
            required: [true, 'Frequency is required (e.g. 1-0-1, Once daily after meals, Twice a day)'],
            trim: true
        },
        duration: {
            type: String,
            required: [true, 'Duration is required (e.g. 5 days, 1 week, 1 month)'],
            trim: true
        },
        instructions: {
            type: String,
            trim: true,
            default: 'Take as directed'
        }
    },
    { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
    {
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: [true, 'Appointment reference is required'],
            unique: true
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Doctor reference is required']
        },
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Patient reference is required']
        },
        prescriptionNumber: {
            type: String,
            required: [true, 'Prescription number is required'],
            unique: true,
            trim: true
        },
        diagnosis: {
            type: String,
            required: [true, 'Clinical diagnosis is required'],
            trim: true
        },
        symptoms: {
            type: String,
            trim: true,
            default: ''
        },
        medicines: {
            type: [medicineItemSchema],
            validate: {
                validator: function (v) {
                    return Array.isArray(v) && v.length > 0;
                },
                message: 'Prescription must contain at least one prescribed medicine.'
            }
        },
        advice: {
            type: String,
            trim: true,
            default: 'Adequate rest, hydration, and follow medication regimen as prescribed.'
        },
        followUpDate: {
            type: String,
            trim: true,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

prescriptionSchema.index({ doctor: 1 });
prescriptionSchema.index({ patient: 1 });

const Prescription = mongoose.model('Prescription', prescriptionSchema);
export default Prescription;

