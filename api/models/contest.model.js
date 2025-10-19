import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  statement: {
    type: String,
    required: true,
  },
  options: {
    type: [String], 
    required: true,
  },
  correctAnswer: {
    type: [String], // Changed to array to support multiple correct answers
    required: true,
  },
  topic: {
    type: String,
    required: false, // Optional - AI-generated questions may not have a topic
  },
  week: {
    type: Number, // For NPTEL questions
  }
});

const resultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  result: {
    type: Number,
    default: 0,
  },
  answer: {
    type: mongoose.Schema.Types.Mixed, // Can be string or array of strings
  },
});

const contestSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mode: {
      type: String,
      enum: ["duel", "practice", "multiplayer"],
      required: true,
    },
    contestType: {
      type: String,
      enum: ["normal", "nptel"],
      default: "normal",
    },
    questions: [questionSchema], 
    standing: [resultSchema], 
    isLive: {
      type: Boolean,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      default: 10
    }, 
    startTime: {
      type: String, // unix timestamp
    },
    timeZone: {
      type: String
    },
    capacity: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['waiting', 'live', 'end'],
      default: 'waiting'
    }
  },
  { timestamps: true } 
);

// Add index for better query performance when sorting by createdAt
contestSchema.index({ createdAt: -1 });

const Contest = mongoose.model("Contest", contestSchema);
export default Contest;