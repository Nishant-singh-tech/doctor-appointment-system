import jwt from 'jsonwebtoken';

/**
 * Generates a signed JWT token containing the user's ID and role
 * @param {string} userId - MongoDB _id of user
 * @param {string} role - User role (patient, doctor, admin)
 * @returns {string} - Signed JWT
 */
export const generateToken = (userId, role) => {
    return jwt.sign(
        { id: userId, role },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
    );
};
