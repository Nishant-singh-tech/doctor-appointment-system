import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const seedAdmin = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.error('Error: MONGO_URI is not defined in environment variables.');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected for admin seeding.');

        // Check if an admin already exists
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log(`Admin account already exists (${existingAdmin.email}). No new admin created.`);
            await mongoose.disconnect();
            process.exit(0);
        }

        const adminName = process.env.ADMIN_NAME || 'System Administrator';
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hospital.com').toLowerCase().trim();
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
        const adminPhone = process.env.ADMIN_PHONE || '9876543210';

        const adminUser = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword, // Password will be hashed by User pre-save hook
            role: 'admin',
            phone: adminPhone,
            isVerified: true,
            isBlocked: false
        });

        console.log(`Admin user created successfully with email: ${adminUser.email}`);
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed admin user:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedAdmin();
