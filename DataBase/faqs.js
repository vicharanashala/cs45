const express = require("express");
const router = express.Router();
const FaqElement = require("./FaqElement");
const User = require("./User");

// ─── POST /faqs ───────────────────────────────────────────────────────────────
// Create a new FAQ entry (called by /ai/generate-faq internally)
router.post("/", async (req, res) => {
  try {
    const {
      question_id,
      answer_id,
      ai_faq_question,
      ai_faq_answer,
      tags,
      quality_score,
      approved_by,
    } = req.body;

    const faq = new FaqElement({
      question_id,
      answer_id: answer_id || null,
      ai_faq_question,
      ai_faq_answer,
      tags: tags || [],
      quality_score: quality_score || null,
      approved_by: approved_by || null,
      status: "not-resolved",
      is_published: false,
    });

    await faq.save();
    res.status(201).json({ success: true, faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /faqs ────────────────────────────────────────────────────────────────
// Public FAQ page — published FAQs only, sorted by quality
// Query: ?tag=xyz&search=keyword&page=1&limit=20
router.get("/", async (req, res) => {
  try {
    const { tag, page = 1, limit = 20 } = req.query;

    const filter = { is_published: true, status: "resolved" };
    if (tag) filter.tags = tag;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const faqs = await FaqElement.find(filter)
      .select("-embedding") // never send embedding to frontend
      .sort({ quality_score: -1, view_count: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("question_id", "question_text tags")
      .populate("answer_id", "answer_text upvotes");

    const total = await FaqElement.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      faqs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /faqs/:id ────────────────────────────────────────────────────────────
// Get single FAQ and increment view count
router.get("/:id", async (req, res) => {
  try {
    const faq = await FaqElement.findByIdAndUpdate(
      req.params.id,
      { $inc: { view_count: 1 } },
      { new: true }
    )
      .select("-embedding")
      .populate("question_id", "question_text tags author_id")
      .populate("answer_id", "answer_text upvotes author_id");

    if (!faq) return res.status(404).json({ error: "FAQ not found" });

    res.json({ success: true, faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /faqs/:id ──────────────────────────────────────────────────────────
// Update FAQ — used by AI routes to store embeddings, quality scores, tags
router.patch("/:id", async (req, res) => {
  try {
    const allowed = [
      "ai_faq_question",
      "ai_faq_answer",
      "tags",
      "quality_score",
      "status",
      "is_published",
      "embedding",
      "approved_by",
      "helpful_count",
      "not_helpful_count",
    ];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    const faq = await FaqElement.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).select("-embedding");

    if (!faq) return res.status(404).json({ error: "FAQ not found" });

    res.json({ success: true, faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /faqs/:id ─────────────────────────────────────────────────────────
// Admin only
router.delete("/:id", async (req, res) => {
  try {
    const faq = await FaqElement.findByIdAndDelete(req.params.id);
    if (!faq) return res.status(404).json({ error: "FAQ not found" });

    res.json({ success: true, message: "FAQ deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /faqs/tags/all ───────────────────────────────────────────────────────
// Get all unique tags across published FAQs (for filter UI)
router.get("/tags/all", async (req, res) => {
  try {
    const tags = await FaqElement.distinct("tags", { is_published: true });
    res.json({ success: true, tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
