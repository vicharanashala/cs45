const express = require("express");
const router = express.Router();
const Answer = require("./Answer");
const Question = require("./Question");
const User = require("./User");

// ─── POST /answers ────────────────────────────────────────────────────────────
// Submit an answer to a community question
router.post("/", async (req, res) => {
  try {
    const { answer_text, question_id, author_id } = req.body;

    // Check user is not blocked
    const user = await User.findById(author_id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.is_blocked)
      return res.status(403).json({ error: "User is blocked from answering" });

    // Check question exists and is open for answers
    const question = await Question.findById(question_id);
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.moderation_status !== "safe")
      return res.status(403).json({ error: "Question is not open for answers" });

    const answer = new Answer({
      answer_text,
      question_id,
      author_id,
      // moderation_status set to "pending" by default — AI checks it
    });

    await answer.save();

    // Mark question as answered if this is the first answer
    if (!question.is_answered) {
      await Question.findByIdAndUpdate(question_id, { is_answered: true });
    }

    // SP reward for contributing an answer
    await User.findByIdAndUpdate(author_id, { $inc: { sp_points: 5 } });

    res.status(201).json({ success: true, answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /answers/question/:question_id ───────────────────────────────────────
// Get all safe answers for a question, sorted by upvotes
router.get("/question/:question_id", async (req, res) => {
  try {
    const answers = await Answer.find({
      question_id: req.params.question_id,
      moderation_status: "safe",
    })
      .sort({ upvotes: -1, createdAt: -1 })
      .populate("author_id", "name sp_points role");

    res.json({ success: true, count: answers.length, answers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /answers/:id/upvote ─────────────────────────────────────────────────
// Upvote an answer — prevents duplicate upvotes per user
router.post("/:id/upvote", async (req, res) => {
  try {
    const { user_id } = req.body;
    const answer = await Answer.findById(req.params.id);
    if (!answer) return res.status(404).json({ error: "Answer not found" });

    // Prevent self-upvoting
    if (answer.author_id.toString() === user_id) {
      return res.status(400).json({ error: "You cannot upvote your own answer" });
    }

    const alreadyUpvoted = answer.upvoted_by.includes(user_id);

    if (alreadyUpvoted) {
      // Toggle off
      answer.upvoted_by.pull(user_id);
      answer.upvotes = Math.max(0, answer.upvotes - 1);
    } else {
      // Upvote
      answer.upvoted_by.push(user_id);
      answer.upvotes += 1;
      // Give SP to answer author
      await User.findByIdAndUpdate(answer.author_id, { $inc: { sp_points: 3 } });
    }

    await answer.save();

    res.json({
      success: true,
      upvoted: !alreadyUpvoted,
      upvotes: answer.upvotes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /answers/:id ───────────────────────────────────────────────────────
// Update moderation status after AI check (called internally by /ai/moderate)
router.patch("/:id", async (req, res) => {
  try {
    const allowed = ["moderation_status", "is_accepted", "sp_rewarded"];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const answer = await Answer.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    if (!answer) return res.status(404).json({ error: "Answer not found" });

    res.json({ success: true, answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /answers/:id ──────────────────────────────────────────────────────
// Admin/Moderator only
router.delete("/:id", async (req, res) => {
  try {
    const answer = await Answer.findByIdAndDelete(req.params.id);
    if (!answer) return res.status(404).json({ error: "Answer not found" });

    res.json({ success: true, message: "Answer deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
