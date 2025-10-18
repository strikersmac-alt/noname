import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  durationInWeeks: { type: Number, required: true, min: 1 },
  code: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });

const Course = mongoose.model('Course', courseSchema);

export default Course;