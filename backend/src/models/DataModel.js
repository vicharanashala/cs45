const mongoose = require("mongoose");

// TODO : How to make schema with mongooese

// ==========================================
// 1. SCHEMAS DEFINITION
// ==========================================

// QUESTION SCHEMA
const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
});

// ANSWER SCHEMA
const AnswerSchema = new mongoose.Schema({
  text: { type: String, required: true },
});

// INFO-UNIT SCHEMA (The cluster/link)
const InfoUnitSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question",
    required: true,
  },
  answerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Answer",
    required: false, // Changed to false because answers are posted later
  },
  answered: {
    type: Boolean,
    default: false, // Automatically false when a question is first posted
  },
});

// FAQ PAGE SCHEMA (Groups the units together)
const FaqPageSchema = new mongoose.Schema({
  title: { type: String, required: true },
  infoUnits: [{ type: mongoose.Schema.Types.ObjectId, ref: "InfoUnit" }],
});

// ==========================================
// 2. MODEL REGISTRATION
// ==========================================
const Question = mongoose.model("Question", QuestionSchema);
const Answer = mongoose.model("Answer", AnswerSchema);
const InfoUnit = mongoose.model("InfoUnit", InfoUnitSchema);
const FaqPage = mongoose.model("FaqPage", FaqPageSchema);

// ==========================================
// 3. MIDDLEWARE / HOOKS (Must be after model definition)
// ==========================================
// cascade delete sequence for the delete response
QuestionSchema.pre("findOneAndDelete", async function (next) {
  try {
    const docToQuery = await this.model.findOne(this.getQuery()); // Fixed typo: findOne
    if (docToQuery) {
      const infoUnit = await InfoUnit.findOne({
        questionId: docToQuery._id,
      });
      if (infoUnit) {
        if (infoUnit.answered && infoUnit.answerId) {
          await Answer.findByIdAndDelete(infoUnit.answerId);
        }
        // Delete Info unit itself
        await InfoUnit.findByIdAndDelete(infoUnit._id);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. MODULE EXPORTS
// ==========================================
module.exports = { Question, Answer, InfoUnit, FaqPage };
