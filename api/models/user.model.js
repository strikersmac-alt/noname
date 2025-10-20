import mongoose from "mongoose";

const userAnalyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  contestTypes: {
    normal: {
      duel: { type: Number, default: 0 },
      practice: { type: Number, default: 0 },
      multiplayer: { type: Number, default: 0 }
    },
    nptel: {
      duel: { type: Number, default: 0 },
      practice: { type: Number, default: 0 },
      multiplayer: { type: Number, default: 0 }
    }
  },
  nptelPracticeStarted: {
    type: Number,
    default: 0
  },
  nptelPracticeCompleted: {
    type: Number,
    default: 0
  },
});


const dailyUserAnalyticsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true 
  },
  contestsParticipated: {
    normal: {
      duel: { type: Number, default: 0 },
      practice: { type: Number, default: 0 },
      multiplayer: { type: Number, default: 0 }
    },
    nptel: {
      duel: { type: Number, default: 0 },
      practice: { type: Number, default: 0 },
      multiplayer: { type: Number, default: 0 }
    }
  },
  nptelPracticeStarted: {
    type: Number,
    default: 0 
  },
  nptelPracticeCompleted: {
    type: Number,
    default: 0 
  },
}, { 
  timestamps: true,
});

const contestAnalyticsSchema = new mongoose.Schema({
  contest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contest",
    required: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  topic: {
    type: String,
    required: false
  },
}, { timestamps: true });

const nptelPracticeAnalyticsSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  count: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    profilePicture: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png",
    },
    contests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contest", 
      },
    ],
    analytics: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserAnalytics"
    },
    dailyAnalytics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DailyUserAnalytics",
      },
    ],

  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const UserAnalytics = mongoose.model("UserAnalytics", userAnalyticsSchema);
const ContestAnalytics = mongoose.model("ContestAnalytics", contestAnalyticsSchema);

const DailyUserAnalytics = mongoose.model("DailyUserAnalytics", dailyUserAnalyticsSchema);
const NptelPracticeAnalytics = mongoose.model("NptelPracticeAnalytics", nptelPracticeAnalyticsSchema);

dailyUserAnalyticsSchema.index({ user: 1, date: 1 }, { unique: true });
nptelPracticeAnalyticsSchema.index({ subject: 1, date: 1 }, { unique: true });


export default User;
export { UserAnalytics, ContestAnalytics, DailyUserAnalytics, NptelPracticeAnalytics};