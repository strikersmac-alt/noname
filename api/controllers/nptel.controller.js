import Nptel from '../models/nptel.model.js';

export const addMultipleQuestions = async (req, res) => {
  try {
    const questions = req.body;
    if (!Array.isArray(questions)) {
      return res.status(400).json({ message: 'Input must be an array of questions' });
    }

    const requiredFields = ['courseName', 'courseCode', 'ps', 'options', 'correct', 'week'];
    for (const question of questions) {
      for (const field of requiredFields) {
        if (!question[field]) {
          return res.status(400).json({ message: `Missing required field: ${field}` });
        }
      }
      if (!Array.isArray(question.options) || question.options.length === 0) {
        return res.status(400).json({ message: 'Options must be a non-empty array' });
      }
      if (question.week < 0 || question.week > 12) {
        return res.status(400).json({ message: 'Week must be between 0 and 12' });
      }
    }
    const savedQuestions = await Nptel.insertMany(questions);

    res.status(201).json({
      message: 'Questions added successfully',
      count: savedQuestions.length,
      questions: savedQuestions
    });
  } catch (error) {
    console.error('Error adding questions:', error);
    res.status(500).json({ message: 'Server error while adding questions', error: error.message });
  }
};

export const getQuestionsByCourseAndWeeks = async (req, res) => {
  try {
    const { courseCode } = req.params;
    const { weeks } = req.query;

    if (!courseCode) {
      return res.status(400).json({ message: 'Course code is required' });
    }

    let query = { courseCode };

    if (weeks) {
      const weekArray = weeks.split(',').map(w => parseInt(w.trim()));
      const validWeeks = weekArray.filter(w => !isNaN(w) && w >= 0 && w <= 12);
      
      if (validWeeks.length > 0) {
        query.week = { $in: validWeeks };
      }
    }

    const questions = await Nptel.find(query);

    if (questions.length === 0) {
      return res.status(404).json({ 
        message: 'No questions found for the specified course and weeks',
        count: 0,
        questions: []
      });
    }

    res.status(200).json({
      message: 'Questions retrieved successfully',
      count: questions.length,
      questions
    });
  } catch (error) {
    console.error('Error retrieving questions:', error);
    res.status(500).json({ message: 'Server error while retrieving questions', error: error.message });
  }
};