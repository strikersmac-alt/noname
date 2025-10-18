
import Course from '../models/courses.model.js';

export const addCourse = async (req, res) => {
  try {
    const { name, durationInWeeks, code } = req.body;

    if (!name || !durationInWeeks || !code) {
      return res.status(400).json({ message: 'Missing required fields: name, durationInWeeks, or code' });
    }

    if (!Number.isInteger(durationInWeeks) || durationInWeeks < 0) {
      return res.status(400).json({ message: 'durationInWeeks must be a positive integer' });
    }

    const existingCourse = await Course.findOne({ code });
    if (existingCourse) {
      return res.status(400).json({ message: 'Course code already exists' });
    }

    const newCourse = new Course({ name, durationInWeeks, code });
    const savedCourse = await newCourse.save();

    res.status(201).json({
      message: 'Course added successfully',
      course: savedCourse
    });
  } catch (error) {
    console.error('Error adding course:', error);
    res.status(500).json({ message: 'Server error while adding course', error: error.message });
  }
};

export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json({
      message: 'Courses retrieved successfully',
      count: courses.length,
      courses
    });
  } catch (error) {
    console.error('Error retrieving courses:', error);
    res.status(500).json({ message: 'Server error while retrieving courses', error: error.message });
  }
};