import axios from 'axios';
import Contest from '../models/contest.model.js'
import User from '../models/user.model.js'
import Nptel from '../models/nptel.model.js'
import Question from '../models/question.model.js'
import mongoose from 'mongoose';
import fs from 'fs';

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

// Helper function to extract keywords from topic
const extractKeywords = (topic) => {
    const stopWords = ['and', 'or', 'the', 'in', 'on', 'at', 'to', 'a', 'an', 'of', 'for', 'with', 'is', 'are'];
    return topic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ') // Remove special chars
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word));
};

// Calculate similarity score between two keyword arrays using Jaccard similarity
const calculateTopicSimilarity = (keywords1, keywords2) => {
    if (!keywords1.length || !keywords2.length) return 0;
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    // Intersection
    const intersection = [...set1].filter(x => set2.has(x)).length;
    // Union
    const union = new Set([...set1, ...set2]).size;
    
    // Jaccard similarity: intersection / union
    return intersection / union;
};


const generateQuestions = async (topic, difficulty, numQuestions, previousQuestions = null , pdf = null) => {
    // const apiKey = process.env.GEMINI_API_KEY;
    const apiKeys = getGeminiApiKeys();
    // if (!apiKey) {
    //     throw new Error('GEMINI_API_KEY is not set in the environment variables.');
    // }
    if (apiKeys.length === 0) {
        throw new Error("No GEMINI_API_KEY* found in environment variables.");
    }

    // const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Build context section if we have previous questions to avoid
    let contextSection = '';
    if (previousQuestions && Array.isArray(previousQuestions) && previousQuestions.length > 0) {
        const questionList = previousQuestions
            .slice(0, 50) // Limit to 50 questions to avoid token limits
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n');
        
        contextSection = `\n\n--- PREVIOUSLY ASKED QUESTIONS (DO NOT REPEAT) ---\n${questionList}\n\nIMPORTANT: Generate completely NEW questions. Do NOT create similar or rephrased versions of the above questions. Cover different aspects of "${topic}".\n---`;
    }
    console.log(contextSection);
    // This is the "system prompt" that instructs the AI.
    const prompt = `
        You are a helpful assistant designed to create quiz questions.
        Generate exactly ${numQuestions} quiz questions about "${topic}" with a difficulty level of "${difficulty}".
        For each question, provide multiple-choice options and indicate the correct answer.
        Make Sure the quiz is well balanced with the difficulties and possibly google search for the details around the topic . 
        You are essentially based in India so try to make questions relevant to Indian context wherever possible. This is not a must but a preference.
        If You are provided a pdf document, make sure to use that document as reference to create questions.
        
        QUESTION FORMATTING RULES:
        - Each question statement should be CLEAR, CONCISE and DIRECT
        - Keep questions under 150 characters when possible (max 200 characters)
        - Avoid unnecessary context or overly verbose phrasing
        - Get straight to the point
        
        OPTION FORMATTING RULES (CRITICAL):
        - ALL options must be similar in length - avoid making one option significantly longer than others
        - Distribute correct answers across different option positions (A, B, C, D) equally
        - DELIBERATELY make the correct answer SHORT or MEDIUM length in at least 60% of questions
        - The longest option should be the WRONG answer in most cases
        - Keep all options concise (ideally under 80 characters each)
        - Make distractors plausible and challenging
        
        Make sure the questions are challenging as most of the users will be from college going age group.
        If you're provided a topic, return that topic in the json otherwise mark the questions as the topic according to you.
        Format the output as a valid JSON array of objects, where each object has "statement", "options", "correctAnswer" (as an array with single correct answer), "topic", and "relatedTopics" keys.
        
        IMPORTANT: correctAnswer must be an array containing the correct option(s), even if there's only one correct answer.
        IMPORTANT: relatedTopics must be an array of 3 related/generalized topics that this question belongs to. For example:
        - If topic is "Arrays", relatedTopics could be ["data structures", "dsa", "programming"]
        - If topic is "React Hooks", relatedTopics could be ["react", "web development", "frontend"]
        - If topic is "Binary Search", relatedTopics could be ["algorithms", "searching", "dsa"]
        This helps categorize questions for better topic matching.
        Make Sure not to categorize or narrow down the topic given by the user, but try to follow a standard from the existing topics which are given to you.
        
        Keep the quiz fun and exciting! You may use Internet searching for the latest news or context around the topic.
        Do not include any text or markdown formatting outside of the JSON array itself.${contextSection}
    `;
    for (const apiKey of apiKeys) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        try {
          
            const contents = [
            {
                role: "user",
                parts: [{ text: prompt }],
            },
            ];

            if (pdf && pdf.path) {
            const fileBytes = fs.readFileSync(pdf.path);
            const base64Data = fileBytes.toString("base64");

            contents.push({
                role: "user",
                parts: [
                {
                    inlineData: {
                    mimeType: "application/pdf",
                    data: base64Data,
                    },
                },
                ],
            });
            }
            // console.log(base64Data);
            const response = await axios.post(
                url,
                {
                    contents: contents
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

const fetchPreviousQuestions = async (topic, limit = 50) => {
    try {
        // Extract keywords from input topic
        const inputKeywords = extractKeywords(topic);
        
        if (inputKeywords.length === 0) {
            return []; // No valid keywords
        }
        
        // Find questions with matching keywords using text search or keyword array
        // Note: This only searches AI-generated and manual questions
        // NPTEL questions are stored in a separate Nptel collection
        const questions = await Question.find({
            $or: [
                { topicKeywords: { $in: inputKeywords } }, // Match any keyword
                { topic: { $regex: new RegExp(inputKeywords.join('|'), 'i') } }, // Regex fallback on topic
                { relatedTopics: { $in: inputKeywords } }, // Match AI-generated related topics
                { relatedTopics: { $regex: new RegExp(inputKeywords.join('|'), 'i') } } // Regex on related topics
            ]
        }).select('statement topic topicKeywords relatedTopics').limit(200); // Get more for filtering
        
        // Calculate similarity scores and filter
        const scoredQuestions = questions
            .map(q => {
                // Calculate keyword similarity
                const keywordSimilarity = calculateTopicSimilarity(inputKeywords, q.topicKeywords || extractKeywords(q.topic));
                
                // Calculate relatedTopics similarity (if AI provided related topics)
                let relatedSimilarity = 0;
                if (q.relatedTopics && q.relatedTopics.length > 0) {
                    const relatedKeywords = q.relatedTopics.flatMap(rt => extractKeywords(rt));
                    relatedSimilarity = calculateTopicSimilarity(inputKeywords, relatedKeywords);
                }
                
                // Take the maximum similarity (either from keywords or related topics)
                const similarity = Math.max(keywordSimilarity, relatedSimilarity);
                
                return {
                    statement: q.statement,
                    similarity
                };
            })
            .filter(q => q.similarity > 0.2) // Keep questions with >20% similarity
            .sort((a, b) => b.similarity - a.similarity) // Sort by similarity score (descending)
            .slice(0, limit) // Take top N
            .map(q => q.statement); // Extract just the statements
        
        console.log(`Found ${scoredQuestions.length} similar questions for topic: "${topic}"`);
        return scoredQuestions;
    } catch (error) {
        console.error('Error fetching previous questions:', error);
        return []; // Return empty array on error to not block contest creation
    }
};

const createQuiz = async (topic, difficulty, numQuestions, previousQuestions = null , pdf = null) => {
    if (!topic || !difficulty || !numQuestions) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: topic, difficulty, and numQuestions are required.'
        });
    }

    try {
        const questions = await generateQuestions(topic, difficulty, parseInt(numQuestions, 10), previousQuestions, pdf);
        if (!questions || questions.length === 0) {
            return res.status(500).json({ success: false, message: 'The AI failed to generate questions for the given topic. Please try another topic.' });
        }
        return questions;

    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
    }
};

const createContest = async (topic, difficulty, numQuestions, contestDetails, previousQuestions = null , pdf = null) => {
    try {
        const questions = await createQuiz(topic, difficulty, numQuestions, previousQuestions , pdf);
        
        // Save questions to Question collection for future reference
        const keywords = extractKeywords(topic);
        const questionDocs = questions.map(q => ({
            statement: q.statement,
            options: q.options,
            correctAnswer: q.correctAnswer,
            topic: q.topic || topic,
            topicKeywords: keywords,
            relatedTopics: q.relatedTopics || [], // AI-generated related topics
            difficulty: difficulty,
            source: 'ai'
        }));
        
        // Bulk insert questions (ignore duplicates)
        console.log(questionDocs);
        await Question.insertMany(questionDocs, { ordered: false }).catch(err => {
            // Ignore duplicate key errors, log others
            if (err.code !== 11000) {
                console.error('Error saving questions:', err);
            }
        });
        
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
        // console.log("saved contest")
        return savedContest;
    } catch (error) {
        throw new Error(`Failed to create contest: ${error.message}`);
    }
};

export const createContestController = async (req, res) => {
    console.log("Reached controller");
    
    const { topic, difficulty, numQuestions, mode, duration, startTime, timeZone} = req.body;
    
    const adminId = req.user?.userId || req.user?._id;

    if (!topic || !difficulty || !numQuestions || !adminId) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields: topic, difficulty, numQuestions, and admin ID are required.",
        });
    }

    try {
        // Fetch previous questions for this topic to avoid repetition (top 50 similar)
        const previousQuestions = await fetchPreviousQuestions(topic, 50);
        
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

        const newContest = await createContest(topic, difficulty, numQuestions, contestDetails, previousQuestions , req.file);
        await User.findByIdAndUpdate(adminId, { $push: { contests: newContest._id } });
        
        // delete
        if(req.file && req.file.path){
            const filePath = req.file.path; // Replace with the actual file path

            fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                return;
            }
            console.log('File deleted successfully!');
            });

        }
        

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