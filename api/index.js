import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http'; 
import { Server as SocketIO } from 'socket.io'; 
import connectDB from './config/connectDB.js';
import firebaseInit from './config/firebaseInit.js';

import authRoutes from './routes/auth.route.js';
import quizRoutes from './routes/quiz.route.js';
import contestRoutes from './routes/contest.route.js';
import nptelRouter from './routes/nptel.route.js';
import profileRoutes from './routes/profile.route.js';
import courseRoutes from './routes/courses.router.js';
import initSockets from './socket/socket.js';
import initContestExpiryCron from './cron/contestExpiry.js';

dotenv.config();
connectDB();
firebaseInit();
initContestExpiryCron(); // Initialize cron job for contest expiry

const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.CORS_ORIGIN || 'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://localhost:10000',
            'http://localhost:4173',
            'https://08a00fe8454c.ngrok-free.app'
        ];
        
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        // Check if the origin is in the allowed list or matches a pattern
        if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('netlify.app') || origin.includes('vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
    res.json({ "hello": "world" });
});

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/contest', contestRoutes);
app.use('/api/nptel', nptelRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/course', courseRoutes);

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error:
            process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message,
    });
});

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const server = http.createServer(app);
const io = new SocketIO(server, {
    cors: {
        origin: corsOptions.origin,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// const PORT = process.env.PORT || 10000;
// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
// });

initSockets(io);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});