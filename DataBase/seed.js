/**
 * seed.js — Run with: node seeds/seed.js
 * Populates the DB with sample users, questions, answers, FAQs, and feedback.
 * Wipes existing data first — DO NOT run in production.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("./db");

const User = require("./User");
const Question = require("./Question");
const Answer = require("./Answer");
const FaqElement = require("./FaqElement");
const Feedback = require("./Feedback");

const seed = async () => {
  await connectDB();

  // ── Wipe all collections ──────────────────────────────────────────────────
  console.log("🧹 Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    Question.deleteMany({}),
    Answer.deleteMany({}),
    FaqElement.deleteMany({}),
    Feedback.deleteMany({}),
  ]);

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log("👤 Seeding users...");
  const salt = await bcrypt.genSalt(10);
  const hash = (pw) => bcrypt.hash(pw, salt);

  const [admin, mod, student1, student2, student3] = await User.insertMany([
    {
      name: "Admin User",
      email: "admin@samagama.in",
      password_hash: await hash("admin123"),
      role: "admin",
      sp_points: 999,
    },
    {
      name: "Moderator User",
      email: "mod@samagama.in",
      password_hash: await hash("mod123"),
      role: "moderator",
      sp_points: 200,
    },
    {
      name: "Gurnoor Singh",
      email: "er.gurnoorsingh@gmail.com",
      password_hash: await hash("student123"),
      role: "student",
      sp_points: 45,
    },
    {
      name: "Negha R",
      email: "neghar1811@gmail.com",
      password_hash: await hash("student123"),
      role: "student",
      sp_points: 30,
    },
    {
      name: "Samarpit Gujral",
      email: "er.samarpitgujral@gmail.com",
      password_hash: await hash("student123"),
      role: "student",
      sp_points: 60,
    },
  ]);

  // ── Questions ─────────────────────────────────────────────────────────────
  console.log("❓ Seeding questions...");
  const [q1, q2, q3, q4] = await Question.insertMany([
    {
      question_text: "How do I reset my password on samagama.in?",
      author_id: student1._id,
      classification: "generic",
      moderation_status: "safe",
      routing: "community",
      similarity_confidence: 0.55,
      is_answered: true,
      tags: ["password", "account", "login"],
    },
    {
      question_text: "What is the difference between VINS and VISE internship?",
      author_id: student2._id,
      classification: "generic",
      moderation_status: "safe",
      routing: "community",
      similarity_confidence: 0.62,
      is_answered: true,
      tags: ["internship", "vins", "vise"],
    },
    {
      question_text: "When will the offer letter be issued after NOC upload?",
      author_id: student3._id,
      classification: "generic",
      moderation_status: "safe",
      routing: "community",
      similarity_confidence: 0.70,
      is_answered: false,
      tags: ["noc", "offer-letter", "timeline"],
    },
    {
      // Personal query — goes to admin
      question_text: "My interview result is missing from my dashboard personally.",
      author_id: student1._id,
      classification: "personal",
      moderation_status: "safe",
      routing: "admin",
      similarity_confidence: 0.40,
      is_answered: false,
      tags: [],
    },
  ]);

  // ── Answers ───────────────────────────────────────────────────────────────
  console.log("💬 Seeding answers...");
  const [a1, a2, a3] = await Answer.insertMany([
    {
      answer_text:
        "Go to samagama.in, click 'Forgot Password' on the login page, and follow the reset link sent to your registered email.",
      question_id: q1._id,
      author_id: student2._id,
      moderation_status: "safe",
      upvotes: 12,
      upvoted_by: [student3._id, admin._id],
      is_accepted: true,
    },
    {
      answer_text:
        "You can also contact Yaksha on the dashboard chat and type #escalate to get help with account issues.",
      question_id: q1._id,
      author_id: student3._id,
      moderation_status: "safe",
      upvotes: 5,
      upvoted_by: [student2._id],
    },
    {
      answer_text:
        "VINS is the online (remote) track — no stipend, no campus stay. VISE is the offline (on-campus at IIT Ropar) track with a fellowship. Both tracks give the same certificate and mentor access.",
      question_id: q2._id,
      author_id: student3._id,
      moderation_status: "safe",
      upvotes: 20,
      upvoted_by: [student1._id, student2._id, mod._id],
      is_accepted: true,
    },
  ]);

  // ── FAQ Elements ──────────────────────────────────────────────────────────
  console.log("📚 Seeding FAQ elements...");
  const [faq1, faq2] = await FaqElement.insertMany([
    {
      question_id: q1._id,
      answer_id: a1._id,
      status: "resolved",
      ai_faq_question: "How do I reset my password on samagama.in?",
      ai_faq_answer:
        "Visit samagama.in and click 'Forgot Password' on the login page. A reset link will be sent to your registered email address. If the issue persists, use the Yaksha chat and type #escalate.",
      tags: ["password", "account", "login"],
      quality_score: 0.91,
      approved_by: admin._id,
      is_published: true,
      helpful_count: 18,
      not_helpful_count: 2,
      view_count: 124,
    },
    {
      question_id: q2._id,
      answer_id: a3._id,
      status: "resolved",
      ai_faq_question: "What is the difference between VINS and VISE?",
      ai_faq_answer:
        "VINS (online) and VISE (offline/on-campus) are two tracks of the same Vicharanashala internship. VISE includes an on-campus stay at IIT Ropar and a fellowship; VINS is fully remote without a stipend. Both tracks offer the same project, mentor, and certificate.",
      tags: ["internship", "vins", "vise", "certificate"],
      quality_score: 0.95,
      approved_by: admin._id,
      is_published: true,
      helpful_count: 35,
      not_helpful_count: 1,
      view_count: 289,
    },
  ]);

  // ── Feedback ──────────────────────────────────────────────────────────────
  console.log("⭐ Seeding feedback...");
  await Feedback.insertMany([
    {
      user_id: student1._id,
      faq_id: faq1._id,
      rating: "helpful",
      confidence_at_time: 0.88,
      original_query: "forgot password samagama",
    },
    {
      user_id: student2._id,
      faq_id: faq2._id,
      rating: "helpful",
      confidence_at_time: 0.92,
      original_query: "difference vins vise internship",
    },
    {
      user_id: student3._id,
      faq_id: faq1._id,
      rating: "not_helpful",
      dissimilarity_note: "The answer doesn't mention what to do if the email doesn't arrive.",
      confidence_at_time: 0.75,
      original_query: "reset password email not received",
    },
  ]);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("\n✅ Database seeded successfully!");
  console.log(`   Users:       5`);
  console.log(`   Questions:   4 (3 community, 1 personal → admin)`);
  console.log(`   Answers:     3`);
  console.log(`   FAQ Items:   2 (published)`);
  console.log(`   Feedback:    3`);
  console.log("\n🔑 Test credentials:");
  console.log("   Admin    → admin@samagama.in    / admin123");
  console.log("   Mod      → mod@samagama.in      / mod123");
  console.log("   Student  → er.gurnoorsingh@gmail.com / student123");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
