import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  courseName: { type: String, required: true },
  courseCode: { type: String, required: true },
  ps: { type: String, required: true }, 
  options: [{ type: String, required: true }], 
  correct: [{ type: String, required: true} ], 
  week: { type: Number, required: true, min: 0, max: 12 } 
}, { timestamps: true });

const Nptel = mongoose.model('Nptel', questionSchema);

export default Nptel;