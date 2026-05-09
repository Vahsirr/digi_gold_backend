// triggering backend restart after code updates - 2026-03-12 15:50
require('dotenv').config();
const JWT_FALLBACK_SECRET = 'srivishva_permanent_fallback_2026';
const JWT_REFRESH_FALLBACK = 'srivishva_refresh_permanent_fallback_2026';
process.env.JWT_SECRET = process.env.JWT_SECRET || JWT_FALLBACK_SECRET;
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_REFRESH_FALLBACK;
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const kycRoutes = require('./routes/kyc');
const adminRoutes = require('./routes/admin');
const goldRoutes = require('./routes/gold');
const silverRoutes = require('./routes/silver');
const referralRoutes = require('./routes/referral');

// Initialize app
const app = express();
const httpServer = createServer(app);
// CORS Configuration
const allowedOrigins = [
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:19000',
    'http://localhost:19006',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://digigold-alagutech-client.vercel.app',
    'https://digigold-backend.vercel.app',
    'https://digigold-production-07e1.up.railway.app',
    'https://digigold-production-804b.up.railway.app',
    'https://considerate-elegance-production-7693.up.railway.app',
    'https://digigold-admin-dashboard.vercel.app',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
];

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true
    },
});

// Middleware
const os = require('os');
const isVercel = process.env.VERCEL === '1';
const staticUploadsDir = isVercel 
    ? path.join(os.tmpdir(), 'uploads')
    : path.join(__dirname, '../uploads');

app.use('/uploads', express.static(staticUploadsDir));

// Trust proxy for Vercel/Render deployments
app.set('trust proxy', 1);

app.use(helmet({
    crossOriginResourcePolicy: false, // Allow images to be loaded cross-origin
}));

const corsOptions = {
    origin: (origin, callback) => {
        // Allow mobile apps (no origin), development mode, or if wildcard '*' is in allowedOrigins
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isAllowedWildcard = allowedOrigins.includes('*');
        const isAllowedDomain = allowedOrigins.includes(origin);

        if (!origin || isAllowedWildcard || isAllowedDomain || isDevelopment) {
            callback(null, true);
        } else {
            // Return false instead of throwing — avoids error-handler responses that strip CORS headers.
            console.log('Blocked by CORS:', origin);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(compression());

// Webhook route needs raw body before JSON parsing
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Ensure services (DB + engines) are initialized before any /api route handler runs.
// Must be registered BEFORE routes so it intercepts API requests.
app.use('/api', async (req, res, next) => {
    try {
        await initializeServices();
        next();
    } catch (err) {
        next(err);
    }
});

// Root route for initial verification
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Sri vishva jewellers Backend API is running',
        version: '1.0.0',
        docs: '/api-docs',
        health: '/health'
    });
});

// Health check
app.get('/health', async (req, res) => {
    let dbStatus = 'OK';
    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            dbStatus = 'Error';
        }
    } catch (error) {
        dbStatus = 'Error';
    }

    res.json({
        status: dbStatus === 'OK' ? 'OK' : 'DEGRADED',
        database: dbStatus,
        readyState: require('mongoose').connection.readyState,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'production'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gold', goldRoutes);
app.use('/api/silver', silverRoutes);
app.use('/api/referral', referralRoutes);

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('subscribe:goldPrice', () => {
        socket.join('goldPrice');
        logger.info(`Client ${socket.id} subscribed to gold price updates`);
    });

    socket.on('subscribe:silverPrice', () => {
        socket.join('silverPrice');
        logger.info(`Client ${socket.id} subscribed to silver price updates`);
    });

    socket.on('subscribe:bookings', (userId) => {
        socket.join(`bookings:${userId}`);
        logger.info(`Client ${socket.id} subscribed to bookings for user ${userId}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Make io accessible to routes
app.set('io', io);
app.set('etag', false);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Initialize logic
const GoldEngine = require('./services/GoldEngine');
const SilverEngine = require('./services/SilverEngine');
const CronScheduler = require('./utils/cronScheduler');

// Helper to initialize background services (only if not on Vercel or if it's the first run)
let isInitialized = false;
let initializationPromise = null;

const initializeServices = async () => {
    if (isInitialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            await connectDB();
            
            // Only poll if needed (GoldEngine internal check handles caching)
            // await GoldEngine.pollLivePrice();
            // await SilverEngine.pollLivePrice();
            
            // Cron and Intervals only for persistent servers
            // if (!process.env.VERCEL) {
            //     CronScheduler.init();
                
            //     const GOLD_POLL_INTERVAL = parseInt(process.env.GOLD_PRICE_POLL_INTERVAL_MS) || 30 * 1000;
            //     setInterval(async () => {
            //         const price = await GoldEngine.pollLivePrice();
            //         io.to('goldPrice').emit('goldPriceUpdate', { price, timestamp: new Date() });
            //     }, GOLD_POLL_INTERVAL);

            //     setInterval(async () => {
            //         const price = await SilverEngine.pollLivePrice();
            //         io.to('silverPrice').emit('silverPriceUpdate', { price, timestamp: new Date() });
            //     }, GOLD_POLL_INTERVAL);
                
            //     logger.info('🚀 Persistent services (Cron/Intervals) initialized');
            // }
            
            isInitialized = true;
            logger.info('✅ Services initialized successfully');
        } catch (error) {
            logger.error('❌ Service initialization failed:', error.message);
            if (process.env.VERCEL) {
                throw error;
            }
        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
};

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
    if (!process.env.VERCEL) {
        setTimeout(() => process.exit(1), 1000);
    }
});

// Start server (only if not on Vercel)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3001;
    // Connect to MongoDB before accepting traffic so queries don't buffer until timeout.
    initializeServices()
        .catch((err) => logger.error('Startup initialization failed (server will still listen):', err.message))
        .finally(() => {
            httpServer.listen(PORT, "0.0.0.0", () => {
                logger.info(`🚀 Sri vishva jewellers Backend Server running on port ${PORT}`);
                logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
                logger.info(`🔐 CORS enabled for: ${process.env.ALLOWED_ORIGINS || '*'}`);
            });
        });
}

// Graceful shutdown
const shutdown = () => {
    logger.info('Shutting down server...');
    httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
};

if (!process.env.VERCEL) {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

module.exports = app;
