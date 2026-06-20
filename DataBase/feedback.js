const express = require("express");
const router = express.Router();
const Feedback = require("./Feedback");
const FaqElement = require("./FaqElement");
const User = require("./User");

// ─── POST /feedback ───────────────────────────────────────────────────────────
// Store helpful / not_helpful signal from a user for a FAQ (Riddhima's endpoint)
router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      faq_id,
      rating,             // "helpful" | "not_helpful"
      dissimilarity_note, // optional — filled when not_helpful
      confidence_at_time,
      original_query,
    } = req.body;

    if (!["helpful", "not_helpful"].includes(rating)) {
      return res.status(400).json({ error: "rating must be 'helpful' or 'not_helpful'" });
    }

    // Upsert: if user already gave feedback on this FAQ, update it
    const feedback = await Feedback.findOneAndUpdate(
      { user_id, faq_id },
      {
        rating,
        dissimilarity_note: dissimilarity_note || null,
        confidence_at_time: confidence_at_time || null,
        original_query: original_query || null,
      },
      { upsert: true, new: true }
    );

    // Update helpful/not_helpful counters on the FaqElement
    const faqUpdate =
      rating === "helpful"
        ? { $inc: { helpful_count: 1 } }
        : { $inc: { not_helpful_count: 1 } };

    await FaqElement.findByIdAndUpdate(faq_id, faqUpdate);

    // Small SP reward for giving feedback
    await User.findByIdAndUpdate(user_id, { $inc: { sp_points: 1 } });

    res.status(201).json({ success: true, feedback });
  } catch (err) {
    // Handle duplicate key (user already voted — shouldn't happen with upsert but safety net)
    if (err.code === 11000) {
      return res.status(409).json({ error: "Feedback already submitted for this FAQ" });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /feedback/faq/:faq_id ────────────────────────────────────────────────
// Get all feedback for one FAQ (admin/moderator view for quality review)
router.get("/faq/:faq_id", async (req, res) => {
  try {
    const feedback = await Feedback.find({ faq_id: req.params.faq_id })
      .sort({ createdAt: -1 })
      .populate("user_id", "name email");

    const helpful = feedback.filter((f) => f.rating === "helpful").length;
    const not_helpful = feedback.filter((f) => f.rating === "not_helpful").length;

    res.json({
      success: true,
      summary: { helpful, not_helpful, total: feedback.length },
      feedback,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
