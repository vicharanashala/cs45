require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");

// ── Route imports ─────────────────────────────────────────────────────────────
const userRoutes     = require("./users");
const questionRoutes = require("./questions");
const answerRoutes   = require("./answers");
const faqRoutes      = require("./faqs");
const feedbackRoutes = require("./feedback");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── DB Connection ─────────────────────────────────────────────────────────────
connectDB();

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/users",     userRoutes);
app.use("/questions", questionRoutes);
app.use("/answers",   answerRoutes);
app.use("/faqs",      faqRoutes);
app.use("/feedback",  feedbackRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    project: "Samagama FAQ System",
    version: "1.0.0",
    routes: [
      "POST   /users/register",
      "POST   /users/login",
      "GET    /users/:id",
      "PATCH  /users/:id/block",
      "GET    /users/leaderboard/top",
      "─────────────────────────────",
      "POST   /questions",
      "GET    /questions",
      "GET    /questions/:id",
      "PATCH  /questions/:id",
      "DELETE /questions/:id",
      "POST   /questions/:id/bookmark",
      "─────────────────────────────",
      "POST   /answers",
      "GET    /answers/question/:question_id",
      "POST   /answers/:id/upvote",
      "PATCH  /answers/:id",
      "DELETE /answers/:id",
      "─────────────────────────────",
      "POST   /faqs",
      "GET    /faqs",
      "GET    /faqs/:id",
      "PATCH  /faqs/:id",
      "DELETE /faqs/:id",
      "GET    /faqs/tags/all",
      "─────────────────────────────",
      "POST   /feedback",
      "GET    /feedback/faq/:faq_id",
    ],
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("💥 Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

module.exports = app;
