const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn('🔓 Auth Error: Access token is missing in request headers', {
            headers: req.headers,
            path: req.path,
            method: req.method
        });
        return res.status(401).json({
            success: false,
            message: 'Access token is missing',
        });
    }

    console.log(`📡 Auth Attempt: ${req.method} ${req.path} token present: ${token.substring(0, 10)}...`);

    try {
        const secret = process.env.JWT_SECRET;
        
        if (!secret) {
            console.error('❌ CRITICAL ERROR: JWT_SECRET is not defined in environment variables!');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error',
            });
        }

        // Standardize token handling
        const cleanToken = token.trim();
        const decoded = jwt.verify(cleanToken, secret);
        
        await require('../config/database')(); // ✅ Ensure DB is connected
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            console.warn(`🔓 Auth Error: User ${decoded.userId} not found or inactive`);
            return res.status(401).json({
                success: false,
                message: 'User session invalid or account inactive',
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('🔓 Auth Verify Failed:', {
            path: req.path,
            method: req.method,
            error: error.message,
            stack: error.stack
        });
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token',
            reason: error.message,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access',
            });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    authorize,
};
