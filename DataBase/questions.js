const express = require("express");
const router = express.Router();
const Question = require("./Question");
const Answer = require("./Answer");
const User = require("./User");

// ─── POST /questions ─────────────────────────────────────────────────────────
// Raise a new query (only if similarity_confidence < 0.80 from Yaksha)
router.post("/", async (req, res) => {
  try {
    const { question_text, author_id, similarity_confidence } = req.body;

    // Check if user is blocked
    const user = await User.findById(author_id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.is_blocked)
      return res.status(403).json({ error: "User is blocked from posting questions" });

    const question = new Question({
      question_text,
      author_id,
      similarity_confidence: similarity_confidence ?? null,
      // classification + moderation_status set later by AI routes
    });

    await question.save();

    // Award SP for asking a question
    await User.findByIdAndUpdate(author_id, { $inc: { sp_points: 2 } });

    res.status(201).json({ success: true, question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /questions ───────────────────────────────────────────────────────────
// Community board — generic, safe questions only
// Query params: ?sort=recent|popular|unanswered&tag=xyz&page=1&limit=10
router.get("/", async (req, res) => {
  try {
    const { sort = "recent", tag, page = 1, limit = 10 } = req.query;

    const filter = {
      classification: "generic",
      moderation_status: "safe",
      routing: "community",
    };

    if (tag) filter.tags = tag;

    // Unanswered filter
    if (sort === "unanswered") filter.is_answered = false;

    // Sort logic
    let sortObj = {};
    if (sort === "popular") sortObj = { bookmark_count: -1, createdAt: -1 };
    else sortObj = { createdAt: -1 }; // recent (default)

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author_id", "name sp_points role");

    const total = await Question.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      questions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /questions/:id ───────────────────────────────────────────────────────
// Get single question + all its answers sorted by upvotes
router.get("/:id", async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).populate(
      "author_id",
      "name sp_points role"
    );

    if (!question) return res.status(404).json({ error: "Question not found" });

    const answers = await Answer.find({
      question_id: req.params.id,
      moderation_status: "safe",
    })
      .sort({ upvotes: -1, createdAt: -1 }) // highest upvotes first
      .populate("author_id", "name sp_points role");

    res.json({ success: true, question, answers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /questions/:id ─────────────────────────────────────────────────────
// Update classification/moderation/routing after AI processing
router.patch("/:id", async (req, res) => {
  try {
    const allowed = [
      "classification",
      "moderation_status",
      "routing",
      "tags",
      "is_answered",
      "admin_response",
      "admin_reviewed",
    ];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const question = await Question.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    if (!question) return res.status(404).json({ error: "Question not found" });

    res.json({ success: true, question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /questions/:id ────────────────────────────────────────────────────
// Admin only — delete a question and all its answers
router.delete("/:id", async (req, res) => {
  try {
    await Answer.deleteMany({ question_id: req.params.id });
    const question = await Question.findByIdAndDelete(req.params.id);

    if (!question) return res.status(404).json({ error: "Question not found" });

    res.json({ success: true, message: "Question and all answers deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /questions/:id/bookmark ─────────────────────────────────────────────
// Bookmark a question (toggle)
router.post("/:id/bookmark", async (req, res) => {
  try {
    const { user_id } = req.body;
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ error: "Question not found" });

    const alreadyBookmarked = question.bookmarked_by.includes(user_id);

    if (alreadyBookmarked) {
      question.bookmarked_by.pull(user_id);
      question.bookmark_count = Math.max(0, question.bookmark_count - 1);
    } else {
      question.bookmarked_by.push(user_id);
      question.bookmark_count += 1;
      // SP reward for saving a question
      await User.findByIdAndUpdate(user_id, { $inc: { sp_points: 1 } });
    }

    await question.save();

    res.json({
      success: true,
      bookmarked: !alreadyBookmarked,
      bookmark_count: question.bookmark_count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
