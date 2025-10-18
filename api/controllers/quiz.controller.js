import axios from 'axios';
import Contest from '../models/contest.model.js'
import User from '../models/user.model.js'
import Nptel from '../models/nptel.model.js'
import mongoose from 'mongoose';

const generateUniqueCode = async () => {
    let code;
    let isUnique = false;
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const existingContest = await Contest.findOne({ code, isLive: true });
        if (!existingContest) {
            isUnique = true;
            break;
        }
    }

    if (!isUnique) {
        throw new Error("Unable to generate a unique contest code after multiple attempts.");
    }

    return code;
};

const getGeminiApiKeys = () => {
    return Object.entries(process.env)
        .filter(([key]) => key.startsWith("GEMINI_API_KEY"))
        .map(([_, value]) => value)
        .filter(Boolean);
};


const generateQuestions = async (topic, difficulty, numQuestions) => {
    // const apiKey = process.env.GEMINI_API_KEY;
    const apiKeys = getGeminiApiKeys();
    // if (!apiKey) {
    //     throw new Error('GEMINI_API_KEY is not set in the environment variables.');
    // }
    if (apiKeys.length === 0) {
        throw new Error("No GEMINI_API_KEY* found in environment variables.");
    }

    // const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // This is the "system prompt" that instructs the AI.
    const prompt = `
        You are a helpful assistant designed to create quiz questions.
        Generate exactly ${numQuestions} quiz questions about "${topic}" with a difficulty level of "${difficulty}".
        For each question, provide multiple-choice options and indicate the correct answer.
        Make Sure the quiz is well balanced with the difficulties and possibly google search for the details around the topic . 
        U are essentialy based in India so try to make questions relevant to Indian context wherever possible. This is not a must but a preference.
        Each question statement should be clear and consise
        Make sure the questions are bit challenging as most of the users will be from college going age group.
        If you're provided a topic , return that topic in the json otherwise mark the questions as the topic according to you .
        Format the output as a valid JSON array of objects, where each object has "statement", "options", "correctAnswer" (as an array with single correct answer) and "topic" keys.
        IMPORTANT: correctAnswer must be an array containing the correct option(s), even if there's only one correct answer.
        Do not include any text or markdown formatting outside of the JSON array itself.
    `;
    for (const apiKey of apiKeys) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        try {
            const response = await axios.post(
                url,
                {
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            const rawContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            // console.log(response);
            if (!rawContent) throw new Error("Empty AI response.");

            const jsonContent = rawContent
                .replace(/^```json\s*/, "")
                .replace(/\s*```$/, "");

            const questions = JSON.parse(jsonContent);
            return questions;

        } catch (error) {
            const errorMsg = error.response?.data?.error?.message.toLowerCase() || error.message.toLowerCase();
            
            console.error(`Error with key ${apiKey}:`, errorMsg);
            if (
                errorMsg.includes("quota") ||
                errorMsg.includes("exceeded") ||
                errorMsg.includes("429") ||
                errorMsg.includes("rate limit") ||
                errorMsg.includes("overloaded")
            ) {
                console.warn(`⚠️ Key ${apiKey} might be exhausted. Trying next one...`);
                continue; 
            }
            throw error;
        }
    }
    throw new Error("All Gemini API keys have reached their limit or failed.");

    // try {
    //     const response = await axios.post(url, {
    //         contents: [{
    //             parts: [{
    //                 text: prompt
    //             }]
    //         }]
    //     }, {
    //         headers: {
    //             'Content-Type': 'application/json'
    //         }
    //     });

    //     // Extract the raw text content from the Gemini API response
    //     const rawContent = response.data.candidates[0].content.parts[0].text;

    //     // Clean the response to ensure it is valid JSON.
    //     // The AI might sometimes wrap the JSON in markdown backticks (```json ... ```).
    //     const jsonContent = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');

    //     try {
    //         // Parse the cleaned string into a JavaScript array of objects
    //         const questions = JSON.parse(jsonContent);
    //         return questions;
    //     } catch (parseError) {
    //         console.error("Failed to parse AI response as JSON:", jsonContent);
    //         // If parsing fails, throw an error to be caught by the calling function
    //         throw new Error('The AI did not return valid JSON. Please try again.');
    //     }

    // } catch (error) {
    //     // Log detailed error information from the API call
    //     console.error('Error generating questions from Gemini API:', error.response ? error.response.data : error.message);
    //     throw new Error('Failed to generate questions from the AI service.');
    // }
};

const createQuiz = async (topic, difficulty, numQuestions) => {
    if (!topic || !difficulty || !numQuestions) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: topic, difficulty, and numQuestions are required.'
        });
    }

    try {
        const questions = await generateQuestions(topic, difficulty, parseInt(numQuestions, 10));
        if (!questions || questions.length === 0) {
            return res.status(500).json({ success: false, message: 'The AI failed to generate questions for the given topic. Please try another topic.' });
        }
        return questions;

    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
    }
};

const createContest = async (topic, difficulty, numQuestions, contestDetails) => {
    try {
        const questions = await createQuiz(topic, difficulty, numQuestions);
        const newContest = new Contest({
            code: contestDetails.code,
            admin: contestDetails.adminId,
            mode: contestDetails.mode || "contest",
            questions: questions,
            users: contestDetails.userIds || [],
            isLive: false,
            duration: contestDetails.duration || 10,
            startTime: contestDetails.startTime || Math.floor(Date.now() / 1000).toString(),
            timeZone: contestDetails.timeZone || "UTC",
            standing: [],
        });

        const savedContest = await newContest.save();
        console.log("saved contest")
        return savedContest;
    } catch (error) {
        throw new Error(`Failed to create contest: ${error.message}`);
    }
};

export const createContestController = async (req, res) => {
    const { topic, difficulty, numQuestions, mode, duration, startTime, timeZone } = req.body;
    const adminId = req.user?.userId || req.user?._id;

    if (!topic || !difficulty || !numQuestions || !adminId) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: topic, difficulty, numQuestions, and admin ID are required.",
        });
    }

    try {
        const code = await generateUniqueCode();

        const contestDetails = {
            adminId,
            code,
            mode: mode || "multiplayer",
            userIds: [new mongoose.Types.ObjectId(adminId)],
            isLive: false,
            duration: duration || 10,
            startTime: startTime || Math.floor(Date.now() / 1000).toString(),
            timeZone: timeZone || "UTC",
            capacity: mode === "duel" ? 2 : 8,
        };

        const newContest = await createContest(topic, difficulty, numQuestions, contestDetails);
        await User.findByIdAndUpdate(adminId, { $push: { contests: newContest._id } });
        return res.status(201).json({
            success: true,
            message: "Contest created successfully.",
            code: newContest.code
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "An internal server error occurred while creating the contest.",
        });
    }
};

export const createNptelContestController = async (req, res) => {
    const { courseCode, weeks, numQuestions, mode, duration, startTime, timeZone } = req.body;
    const adminId = req.user?.userId || req.user?._id;

    if (!courseCode || !weeks || !Array.isArray(weeks) || weeks.length === 0 || !adminId) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: courseCode, weeks (array), and admin ID are required.",
        });
    }

    try {
        // Fetch NPTEL questions from database
        let query = { courseCode };

        if (weeks.length > 0 && !weeks.includes(-1)) {
            // -1 means random from all weeks
            query.week = { $in: weeks };
        }

        let nptelQuestions = await Nptel.find(query);

        if (!nptelQuestions || nptelQuestions.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No questions found for the selected course and weeks.",
            });
        }

        // Shuffle and limit questions
        nptelQuestions = nptelQuestions.sort(() => Math.random() - 0.5);
        const limit = numQuestions || nptelQuestions.length;
        nptelQuestions = nptelQuestions.slice(0, Math.min(limit, nptelQuestions.length));

        // Transform NPTEL questions to contest format
        const questions = nptelQuestions.map(q => ({
            statement: q.ps,
            options: q.options,
            correctAnswer: q.correct, // Already an array
            topic: q.courseName,
            week: q.week
        }));

        const code = await generateUniqueCode();

        const newContest = new Contest({
            code,
            admin: new mongoose.Types.ObjectId(adminId),
            mode: mode || "multiplayer",
            contestType: "nptel",
            questions,
            users: [new mongoose.Types.ObjectId(adminId)],
            isLive: false,
            duration: duration || 10,
            startTime: startTime || Math.floor(Date.now() / 1000).toString(),
            timeZone: timeZone || "UTC",
            capacity: mode === "duel" ? 2 : 8,
            standing: [],
        });

        const savedContest = await newContest.save();
        await User.findByIdAndUpdate(adminId, { $push: { contests: savedContest._id } });

        return res.status(201).json({
            success: true,
            message: "NPTEL contest created successfully.",
            code: savedContest.code
        });
    } catch (error) {
        console.error("Error creating NPTEL contest:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "An internal server error occurred while creating the NPTEL contest.",
        });
    }
};