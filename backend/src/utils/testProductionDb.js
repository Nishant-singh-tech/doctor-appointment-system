import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load from backend/.env or root .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function verifyDatabaseConnection() {
    console.log('====================================================');
    console.log('   MONGODB DATABASE CONNECTION & INTEGRITY CHECK    ');
    console.log('====================================================\n');

    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error('[FAIL] MONGO_URI environment variable is not defined.');
        process.exit(1);
    }

    // Mask sensitive credentials for security logging
    const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log(`Connecting to: ${maskedUri}`);

    try {
        const conn = await mongoose.connect(uri);
        console.log(`[PASS] Successfully connected to MongoDB!`);
        console.log(`       Host: ${conn.connection.host}`);
        console.log(`       Database Name: ${conn.connection.name}`);
        console.log(`       ReadyState: ${conn.connection.readyState} (Connected)`);

        // Perform lightweight admin ping
        const adminDb = conn.connection.db.admin();
        const pingResult = await adminDb.ping();
        console.log(`[PASS] MongoDB Database Ping: ok = ${pingResult.ok}`);

        // List existing collections
        const collections = await conn.connection.db.listCollections().toArray();
        console.log(`[PASS] Found ${collections.length} active collection(s): ${collections.map(c => c.name).join(', ') || 'None (New DB)'}`);

        await mongoose.disconnect();
        console.log('\n[PASS] Database verification completed successfully.\n');
        process.exit(0);
    } catch (error) {
        console.error(`[FAIL] MongoDB connection failed: ${error.message}`);
        process.exit(1);
    }
}

verifyDatabaseConnection();
