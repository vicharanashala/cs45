const express = require("express");
const router = express.Router();
const User = require("./User");
const bcrypt = require("bcryptjs");

// ─── POST /users/register ─────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email: email.toLowerCase(),
      password_hash,
      role: role || "student",
    });

    await user.save();

    // Don't send password_hash back
    const { password_hash: _, ...userObj } = user.toObject();
    res.status(201).json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /users/login ────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.is_blocked) return res.status(403).json({ error: "Account is blocked" });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { password_hash: _, ...userObj } = user.toObject();
    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password_hash");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /users/:id/block ───────────────────────────────────────────────────
// Admin: block or unblock a user
router.patch("/:id/block", async (req, res) => {
  try {
    const { is_blocked } = req.body; // true or false

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { is_blocked },
      { new: true }
    ).select("-password_hash");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      success: true,
      message: is_blocked ? "User blocked" : "User unblocked",
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /users/leaderboard/top ───────────────────────────────────────────────
// SP leaderboard — top contributors
router.get("/leaderboard/top", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaders = await User.find({ is_blocked: false, role: "student" })
      .select("name email sp_points")
      .sort({ sp_points: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, leaders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
