const express = require("express");
const mongoose = require("mongoose");
const { Question, InfoUnit } = require("./models/DataModel");

const app = express();
app.use(express.json());

// ==========================================
// CONNECT TO DATABASE (Crucial to prevent hanging)
// ==========================================
mongoose.connect("mongodb://127.0.0.1:27017/sar_db")
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// ==========================================
// API ENDPOINTS
// ==========================================

// API Endpoint for Question posting
app.post("/api/questions", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Question text is required" });
    }

    const newQuestion = new Question({ text }); 
    await newQuestion.save();

    // INFO : Making internal clustering of the question
    const newInfoUnit = new InfoUnit({
      questionId: newQuestion._id,
    });
    await newInfoUnit.save(); // Fixed typo: changed newInfounit to newInfoUnit

    res.status(201).json({
      message: "Question Posted and clustered into Info-unit",
      question: newQuestion,
      infoUnitId: newInfoUnit._id,
    });
  } catch (err) {
    // Fixed typo: changed error.mesage to err.message to match catch(err)
    res.status(500).json({ error: err.message });
  }
});

// Simple listing questions
app.get("/api/questions", async (req, res) => {
  try {
    const questions = await Question.find().sort({ _id: -1 });
    res.status(200).json({
      count: questions.length,
      questions: questions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

