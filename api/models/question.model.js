import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    statement: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
      required: true,
    },
    correctAnswer: {
      type: [String],
      required: true,
    },
    topic: {
      type: String,
      required: true,
      index: true, // Index for faster topic-based queries
    },
    topicKeywords: {
      type: [String], // Extracted keywords for better matching
      index: true,
    },
    relatedTopics: {
      type: [String], // AI-generated related/generalized topics (e.g., "DSA" → ["data structures", "algorithms", "programming"])
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
    },
    source: {
      type: String,
      enum: ["ai", "manual"],
      default: "ai",
    },
    usageCount: {
      type: Number,
      default: 1, // Track how many times this question has been used
    },
  },
  { timestamps: true }
);

// Compound index for efficient topic + difficulty queries
questionSchema.index({ topic: 1, difficulty: 1, createdAt: -1 });
questionSchema.index({ topicKeywords: 1, createdAt: -1 });
questionSchema.index({ relatedTopics: 1, createdAt: -1 });

// Text index for full-text search on statement and topic
questionSchema.index({ statement: "text", topic: "text" });

const Question = mongoose.model("Question", questionSchema);
export default Question;
