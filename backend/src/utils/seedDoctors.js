import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const sampleDoctors = [
    {
        name: 'Dr. Sarah Jenkins',
        email: 'sarah.jenkins@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0101',
        specialization: 'Cardiology',
        experience: 14,
        fees: 800,
        qualifications: 'MD, FACC - Harvard Medical School',
        location: 'New York, NY',
        hospital: 'Manhattan Heart Institute',
        about: 'Dr. Sarah Jenkins is a board-certified cardiologist with over 14 years of clinical experience specializing in preventive cardiology and cardiovascular diagnostics.',
        isVerified: true,
        isBlocked: false
    },
    {
        name: 'Dr. Marcus Vance',
        email: 'marcus.vance@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0102',
        specialization: 'Dermatology',
        experience: 9,
        fees: 600,
        qualifications: 'MD, FAAD - Johns Hopkins University',
        location: 'Los Angeles, CA',
        hospital: 'Sunset Dermatology Clinic',
        about: 'Specialist in clinical dermatology, skin cancer screenings, and advanced laser treatments with a patient-first methodology.',
        isVerified: true,
        isBlocked: false
    },
    {
        name: 'Dr. Priya Patel',
        email: 'priya.patel@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+91 98200-11223',
        specialization: 'Pediatrics',
        experience: 11,
        fees: 500,
        qualifications: 'MBBS, DCH, DNB (Pediatrics) - AIIMS',
        location: 'Mumbai, MH',
        hospital: 'Little Stars Children Hospital',
        about: 'Dedicated pediatrician providing comprehensive infant, child, and adolescent primary care with an empathetic approach.',
        isVerified: true,
        isBlocked: false
    },
    {
        name: 'Dr. Alan Rivera',
        email: 'alan.rivera@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0104',
        specialization: 'Neurology',
        experience: 18,
        fees: 950,
        qualifications: 'MD, PhD (Neuroscience) - Stanford University',
        location: 'San Francisco, CA',
        hospital: 'Bay Area Neuro Care',
        about: 'Expert neurologist specializing in migraines, neuromuscular disorders, and comprehensive neurological health assessments.',
        isVerified: true,
        isBlocked: false
    },
    {
        name: 'Dr. Aisha Khan',
        email: 'aisha.khan@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+91 98111-44556',
        specialization: 'General Medicine',
        experience: 7,
        fees: 400,
        qualifications: 'MBBS, MD (Internal Medicine)',
        location: 'Delhi, DL',
        hospital: 'Apollo Life Clinic',
        about: 'General physician focusing on lifestyle disease management, preventive health screenings, and adult outpatient care.',
        isVerified: true,
        isBlocked: false
    },
    {
        name: 'Dr. David Chen',
        email: 'david.chen@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0106',
        specialization: 'Orthopedics',
        experience: 12,
        fees: 750,
        qualifications: 'MS (Ortho), Fellowship in Joint Replacement',
        location: 'Chicago, IL',
        hospital: 'Midwest Orthopedic Center',
        about: 'Renowned orthopedic surgeon specializing in sports medicine, joint replacements, and modern rehabilitation programs.',
        isVerified: true,
        isBlocked: false
    },
    {
        name: 'Dr. Emily Watson',
        email: 'emily.watson@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0107',
        specialization: 'Cardiology',
        experience: 6,
        fees: 650,
        qualifications: 'MD (Cardiology) - Columbia University',
        location: 'New York, NY',
        hospital: 'Empire State Clinic',
        about: 'Interventional cardiology fellow focusing on hypertension management, echocardiography, and vascular health.',
        isVerified: true,
        isBlocked: false
    },
    // Unverified Doctor (MUST NOT appear in public directory)
    {
        name: 'Dr. Unverified Doe',
        email: 'unverified.doctor@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0999',
        specialization: 'Cardiology',
        experience: 3,
        fees: 300,
        qualifications: 'MBBS',
        location: 'New York, NY',
        hospital: 'Pending Clinic',
        about: 'New doctor awaiting admin verification.',
        isVerified: false,
        isBlocked: false
    },
    // Blocked Doctor (MUST NOT appear in public directory)
    {
        name: 'Dr. Blocked BadActor',
        email: 'blocked.doctor@hospital.com',
        password: 'DoctorPassword123',
        role: 'doctor',
        phone: '+1 555-0888',
        specialization: 'Dermatology',
        experience: 10,
        fees: 700,
        qualifications: 'MD',
        location: 'Los Angeles, CA',
        hospital: 'Suspended Clinic',
        about: 'Suspended doctor.',
        isVerified: true,
        isBlocked: true
    }
];

const seedDoctors = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        console.log('Connected to MongoDB for doctor seeding.');

        for (const doc of sampleDoctors) {
            const exists = await User.findOne({ email: doc.email });
            if (!exists) {
                await User.create(doc);
                console.log(`Created doctor: ${doc.name} (${doc.specialization}, ${doc.location}) - Verified: ${doc.isVerified}`);
            } else {
                // Update doctor details in case they already existed from previous runs
                await User.updateOne({ email: doc.email }, {
                    $set: {
                        qualifications: doc.qualifications,
                        location: doc.location,
                        hospital: doc.hospital,
                        about: doc.about,
                        specialization: doc.specialization,
                        experience: doc.experience,
                        fees: doc.fees,
                        isVerified: doc.isVerified,
                        isBlocked: doc.isBlocked
                    }
                });
                console.log(`Updated existing doctor: ${doc.name}`);
            }
        }

        console.log('Doctor seeding completed successfully.');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding doctors:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedDoctors();
