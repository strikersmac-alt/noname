// import jwt from 'jsonwebtoken';
// import Contest from '../models/contest.model.js'; 
// import User from '../models/user.model.js';

// const initSockets = (io) => {
//     io.use((socket, next) => {
//         const token = socket.handshake.auth.token;
//         if (!token) {
//             return next(new Error('Authentication error: No token provided'));
//         }
//         jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//             if (err) {
//                 return next(new Error('Authentication error: Invalid token'));
//             }
//             socket.user = user; 
//             next();
//         });
//     });

//     io.on('connection', (socket) => {
//         console.log(`User connected: ${socket.user._id}`);

//         socket.on('joinContest', async (contestId, callback) => {
//             try {
//                 const contest = await Contest.findById(contestId).populate('users');
//                 if (!contest) {
//                     return callback({ success: false, message: 'Contest not found' });
//                 }
//                 const isUserInContest = contest.users.some(u => u._id.toString() === socket.user._id);
//                 if (!isUserInContest) {
//                     return callback({ success: false, message: 'You are not part of this contest' });
//                 }
//                 socket.join(contestId);
//                 callback({ success: true, message: 'Joined contest room' });

//                 // Optionally send current standings on join
//                 const standings = await computeStandings(contestId);
//                 socket.emit('updateStandings', standings);
//             } catch (error) {
//                 callback({ success: false, message: 'Error joining contest' });
//             }
//         });

//         socket.on('startContest', async (contestId, callback) => {
//             try {
//                 const contest = await Contest.findById(contestId);
//                 if (!contest) {
//                     return callback({ success: false, message: 'Contest not found' });
//                 }
//                 if (contest.admin.toString() !== socket.user._id) {
//                     return callback({ success: false, message: 'Only admin can start the contest' });
//                 }
//                 if (contest.isLive) {
//                     return callback({ success: false, message: 'Contest already live' });
//                 }

//                 const startTime = Date.now();
//                 contest.isLive = true;
//                 contest.startTime = startTime;
//                 await contest.save();

//                 io.to(contestId).emit('contestStarted', {
//                     startTime: startTime,
//                     duration: contest.duration,
//                     timeZone: contest.timeZone
//                 });
//                 callback({ success: true, message: 'Contest started' });

//                 // Start timer to end contest after duration
//                 setTimeout(async () => {
//                     contest.isLive = false;
//                     await contest.save();
//                     io.to(contestId).emit('contestEnded', { message: 'Contest duration ended' });
//                 }, contest.duration * 60 * 1000); // duration in minutes
//             } catch (error) {
//                 callback({ success: false, message: 'Error starting contest' });
//             }
//         });

//         socket.on('submitAnswer', async ({ contestId, questionId, answer }, callback) => {
//             try {
//                 const contest = await Contest.findById(contestId);
//                 if (!contest || !contest.isLive) {
//                     return callback({ success: false, message: 'Contest not found or not live' });
//                 }
//                 const question = contest.questions.find(q => q._id.toString() === questionId);
//                 if (!question) {
//                     return callback({ success: false, message: 'Question not found' });
//                 }

//                 const isCorrect = question.correctAnswer === answer;
//                 const score = isCorrect ? 1 : 0;

//                 // Update or create result in standing
//                 let result = contest.standing.find(s => 
//                     s.user.toString() === socket.user._id && s.question.toString() === questionId
//                 );
//                 if (!result) {
//                     result = { user: socket.user._id, question: questionId, result: score };
//                     contest.standing.push(result);
//                 } else {
//                     result.result = score; // Allow resubmission? Or lock it? For now, allow update.
//                 }
//                 await contest.save();

//                 // Send immediate feedback to user
//                 callback({ success: true, isCorrect, message: isCorrect ? 'Correct!' : 'Wrong!' });

//                 // Compute and broadcast new standings to room
//                 const standings = await computeStandings(contestId);
//                 io.to(contestId).emit('updateStandings', standings);
//             } catch (error) {
//                 callback({ success: false, message: 'Error submitting answer' });
//             }
//         });

//         socket.on('disconnect', () => {
//             console.log(`User disconnected: ${socket.user._id}`);
//             // Optionally handle leaving rooms, but Socket.IO handles it automatically
//         });
//     });
// };

// // Helper to compute standings: Aggregate scores per user
// async function computeStandings(contestId) {
//     const contest = await Contest.findById(contestId).populate('users', 'name profilePicture');
//     const scores = {};

//     contest.standing.forEach(s => {
//         const userId = s.user.toString();
//         if (!scores[userId]) scores[userId] = 0;
//         scores[userId] += s.result;
//     });

//     // Sort by score descending
//     const standings = Object.entries(scores)
//         .map(([userId, score]) => {
//             const user = contest.users.find(u => u._id.toString() === userId);
//             return { userId, name: user?.name, score };
//         })
//         .sort((a, b) => b.score - a.score);

//     return standings;
// }

// export default initSockets;
import jwt from 'jsonwebtoken';
import Contest from '../models/contest.model.js';
import User from '../models/user.model.js';
import { getContestEntry, normalize, normalizeAnswerArray } from '../controllers/contest.controller.js';
import {Mutex} from 'async-mutex';
import mongoose from 'mongoose';
const contestMutexes = new Map();
const initSockets = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.headers.cookie
            ?.split('; ')
            .find(row => row.startsWith('authToken='))
            ?.split('=')[1];

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                console.error('JWT verification failed:', err.message);
                return next(new Error('Authentication error: Invalid token'));
            }

            // Set user with _id from the decoded token
            socket.user = {
                _id: decoded.userId,  // The JWT contains userId, not _id
                email: decoded.email
            };

            next();
        });
    });

    io.on('connection', (socket) => {
        socket.on('joinContest', async (contestId, callback) => {
            // Validate contestId format
            if (!mongoose.Types.ObjectId.isValid(contestId)) {
                console.warn(`Invalid contest ID: ${contestId}`);
                return callback({ success: false, message: 'Invalid contest ID' });
            }

            // Get or create mutex for this contest
            let mutex = contestMutexes.get(contestId);
            if (!mutex) {
                mutex = new Mutex();
                contestMutexes.set(contestId, mutex);
            }

            const release = await mutex.acquire();
            try {
                // console.log(`Lock acquired for contest ${contestId} by user ${socket.user._id}`);

                // Fetch contest with populated users
                const contest = await Contest.findById(contestId).populate('users', 'name profilePicture email');
                if (!contest) {
                    console.warn(`Contest not found: ${contestId}`);
                    return callback({ success: false, message: 'Contest not found' });
                }

                // Validate capacity
                if (contest.capacity !== null && contest.capacity <= 0) {
                    console.warn(`Invalid capacity for contest ${contestId}: ${contest.capacity}`);
                    return callback({ success: false, message: 'Invalid contest capacity' });
                }

                // Check if contest is live
                if (contest.isLive) {
                    const isUserInContest = contest.users.some(u => u._id.toString() === socket.user._id);
                    if (isUserInContest) {
                        socket.join(contestId);
                        console.log(`User ${socket.user._id} joined live contest ${contestId} room`);
                        return callback({ success: true, message: 'Joined contest room' });
                    }
                    return callback({ success: false, message: 'Contest is already running. You cannot join now.' });
                }

                // Check if user is already in contest
                const isUserInContest = contest.users.some(u => u._id.toString() === socket.user._id);
                if (isUserInContest) {
                    socket.join(contestId);
                    console.log(`User ${socket.user._id} already in contest ${contestId}, joined room`);
                    return callback({ success: true, message: 'Already in contest, joined room' });
                }

                // Double-check capacity before attempting update
                if (contest.capacity && contest.users.length >= contest.capacity) {
                    console.warn(`Capacity exceeded for contest ${contestId}: ${contest.users.length}/${contest.capacity}`);
                    return callback({ success: false, message: 'Contest has reached maximum capacity' });
                }

                // Atomic update with strict capacity check
                const updateQuery = {
                    _id: contestId,
                    isLive: false,
                    users: { $ne: socket.user._id },
                };
                if (contest.capacity) {
                    updateQuery[`users.${contest.capacity}`] = { $exists: false };
                }

                const updatedContest = await Contest.findOneAndUpdate(
                    updateQuery,
                    { $push: { users: socket.user._id } },
                    { new: true, populate: { path: 'users', select: 'name profilePicture email' } }
                );

                if (!updatedContest) {
                    // Re-fetch contest to determine why update failed
                    const freshContest = await Contest.findById(contestId);
                    if (!freshContest) {
                        console.error(`Contest ${contestId} no longer exists`);
                        return callback({ success: false, message: 'Contest no longer exists' });
                    }
                    if (freshContest.isLive) {
                        console.warn(`Contest ${contestId} started during join attempt`);
                        return callback({ success: false, message: 'Contest has started' });
                    }
                    if (freshContest.capacity && freshContest.users.length >= freshContest.capacity) {
                        console.warn(`Capacity exceeded for contest ${contestId}: ${freshContest.users.length}/${freshContest.capacity}`);
                        return callback({ success: false, message: 'Contest has reached maximum capacity' });
                    }
                    console.error(`Unknown failure joining contest ${contestId} for user ${socket.user._id}`);
                    return callback({ success: false, message: 'Unable to join contest due to an unexpected error' });
                }

                // Double-check capacity after update
                if (updatedContest.capacity && updatedContest.users.length > updatedContest.capacity) {
                    console.error(`Over-capacity detected for contest ${contestId}: ${updatedContest.users.length}/${updatedContest.capacity}`);
                    await Contest.findByIdAndUpdate(contestId, {
                        $pull: { users: socket.user._id },
                    });
                    return callback({ success: false, message: 'Contest has reached maximum capacity' });
                }

                // Update user document
                await User.findByIdAndUpdate(socket.user._id, {
                    $addToSet: { contests: contestId },
                });
                console.log(`User ${socket.user._id} added to contest ${contestId}`);

                // Join Socket.IO room
                socket.join(contestId);
                callback({ success: true, message: 'Joined contest room' });

                // Send updated standings
                const standings = await computeStandings(contestId);
                socket.emit('updateStandings', standings);

                // Emit updated participants
                io.to(contestId).emit('updateParticipants', updatedContest.users.map(u => ({
                    userId: u._id,
                    name: u.name,
                    profilePicture: u.profilePicture,
                })));
            } catch (error) {
                console.error(`Error in joinContest for contest ${contestId}:`, error);
                callback({ success: false, message: `Error joining contest: ${error.message}` });
            } finally {
                // Release the lock
                release();
                console.log(`Lock released for contest ${contestId}`);
                // Clean up mutex if no longer needed (optional, to manage memory)
                if (!mutex.isLocked()) {
                    contestMutexes.delete(contestId);
                }
            }
        });

        socket.on('startContest', async (contestId, callback) => {
            try {
                const contest = await Contest.findById(contestId);
                if (!contest) {
                    return callback({ success: false, message: 'Contest not found' });
                }
                if (contest.admin.toString() !== socket.user._id) {
                    return callback({ success: false, message: 'Only admin can start the contest' });
                }
                if (contest.isLive) {
                    return callback({ success: false, message: 'Contest already live' });
                }

                const startTime = Date.now();
                contest.isLive = true;
                contest.startTime = startTime;
                await contest.save();

                io.to(contestId).emit('contestStarted', {
                    startTime: startTime,
                    duration: contest.duration,
                    timeZone: contest.timeZone,
                });
                callback({ success: true, message: 'Contest started' });

                // Start timer to end contest after duration
                setTimeout(async () => {
                    contest.isLive = false;
                    await contest.save();
                    io.to(contestId).emit('contestEnded', { message: 'Contest duration ended' });
                }, contest.duration * 60 * 1000); // duration in minutes
            } catch (error) {
                console.error('Error in startContest:', error);
                callback({ success: false, message: 'Error starting contest' });
            }
        });

        socket.on('submitAnswer', async ({ contestId, questionId, answer }, callback) => {
            try {
                // Use optimized in-memory cache for fast validation
                const contestEntry = await getContestEntry(contestId);
                if (!contestEntry) {
                    return callback({ success: false, message: 'Contest not found' });
                }

                // Check if user is enrolled
                const userId = String(socket.user._id);
                const isEnrolled = contestEntry.adminId === userId || contestEntry.userIds.has(userId);
                if (!isEnrolled) {
                    return callback({ success: false, message: 'User not enrolled in contest' });
                }

                // Get correct answer from cache (O(1) lookup) - now an array
                const correctAnswerArray = contestEntry.answerKey.get(String(questionId));
                if (!correctAnswerArray) {
                    return callback({ success: false, message: 'Question not found' });
                }

                // Validate answer - support both single answer and array of answers
                const userAnswerArray = normalizeAnswerArray(answer);
                const isCorrect = JSON.stringify(userAnswerArray) === JSON.stringify(correctAnswerArray);
                const score = isCorrect ? 1 : 0;

                // Now update the DB for standings (only one DB write)
                const contest = await Contest.findById(contestId);
                if (!contest || !contest.isLive) {
                    return callback({ success: false, message: 'Contest not live' });
                }

                // Update or create result in standing
                let result = contest.standing.find(s =>
                    s.user.toString() === socket.user._id && s.question.toString() === questionId
                );
                if (!result) {
                    result = { user: socket.user._id, question: questionId, result: score, answer: answer };
                    contest.standing.push(result);
                } else {
                    result.result = score; // Allow resubmission
                    result.answer = answer; // Store the user's answer
                }
                await contest.save();

                // Send immediate feedback to user
                callback({ success: true, isCorrect, message: isCorrect ? 'Correct!' : 'Wrong!' });

                // Compute and broadcast new standings to room
                const standings = await computeStandings(contestId);
                io.to(contestId).emit('updateStandings', standings);

                // Check if all participants have completed all questions
                const totalQuestions = contest.questions.length;
                const totalParticipants = contest.users.length;
                const completedParticipants = new Set();

                contest.standing.forEach(s => {
                    const userId = s.user.toString();
                    if (!completedParticipants.has(userId)) {
                        const userAnswers = contest.standing.filter(st => st.user.toString() === userId).length;
                        if (userAnswers >= totalQuestions) {
                            completedParticipants.add(userId);
                        }
                    }
                });

                // If all participants completed, mark contest as not live
                if (completedParticipants.size >= totalParticipants && contest.isLive) {
                    contest.isLive = false;
                    await contest.save();
                    io.to(contestId).emit('contestEnded', { message: 'All participants completed' });
                }
            } catch (error) {
                console.error('Error in submitAnswer:', error);
                callback({ success: false, message: 'Error submitting answer' });
            }
        });

        socket.on('disconnect', () => {
            // Socket.IO handles room cleanup automatically
        });
    });
};

// Helper to compute standings: Aggregate scores per user
async function computeStandings(contestId) {
    const contest = await Contest.findById(contestId).populate('users', 'name profilePicture');
    const scores = {};

    contest.standing.forEach(s => {
        const userId = s.user.toString();
        if (!scores[userId]) scores[userId] = 0;
        scores[userId] += s.result;
    });

    // Sort by score descending
    const standings = Object.entries(scores)
        .map(([userId, score]) => {
            const user = contest.users.find(u => u._id.toString() === userId);
            return { userId, name: user?.name || 'Unknown', score };
        })
        .sort((a, b) => b.score - a.score);

    return standings;
}

export default initSockets;

/*clent integration*/

// Inside useEffect where socket is initialized
// useEffect(() => {
//     if (response?.success && response.id) {
//         const token = Cookies.get('authToken');
//         if (!token) {
//             setSocketStatus({ connected: false, message: 'No JWT token found' });
//             return;
//         }

//         const socketInstance = io('http://localhost:10000', {
//             auth: { token },
//         });

//         setSocket(socketInstance);

//         socketInstance.on('connect', () => {
//             setSocketStatus({ connected: true, message: 'Connected to server' });
//         });

//         socketInstance.on('connect_error', (error) => {
//             setSocketStatus({ connected: false, message: `Connection error: ${error.message}` });
//         });

//         socketInstance.on('contestStarted', (data) => {
//             setContestStarted(true);
//             setSocketStatus({ connected: true, message: `Contest started: ${JSON.stringify(data)}` });
//         });

//         socketInstance.on('updateStandings', (standings: Standing[]) => {
//             setStandings(standings);
//             setSocketStatus({ connected: true, message: 'Standings updated' });
//         });

//         socketInstance.on('updateParticipants', (participants: { userId: string; name: string; profilePicture: string }[]) => {
//             setSocketStatus({ connected: true, message: `Participants updated: ${participants.length} users` });
//             // Optionally store participants in state to display in UI
//             console.log('Participants:', participants);
//         });

//         socketInstance.on('contestEnded', (data) => {
//             setContestStarted(false);
//             setSocketStatus({ connected: true, message: `Contest ended: ${data.message}` });
//         });

//         return () => {
//             socketInstance.disconnect();
//             setSocketStatus({ connected: false, message: 'Disconnected from server' });
//         };
//     }
// }, [response]);