// API-connected store with subscribe pattern.
import { faqs as localFaqs } from "@/data/faqs";

const LS_AUTH = "yaksha.auth.v1";
const LS_TOKEN = "yaksha.token.v1";
const LS_MY_QUERIES = "yaksha.my_query_ids.v1";
const LS_REJECTED_QUERIES = "yaksha.rejected_query_ids.v1";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let state = {
  queries: [],
  threads: [],
  answers: [],
  notifications: [],
  faqs: localFaqs.map((f, i) => ({ id: "faq-" + i, section: f.section || "General", q: f.q, a: f.a })),
};

const listeners = new Set();
const emit = () => {
  listeners.forEach((l) => l(state));
};

// Internal API helpers
export const getAuth = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_AUTH));
  } catch {
    return null;
  }
};

const getAuthHeaders = () => {
  const token = localStorage.getItem(LS_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const loadCommunityQuestions = async () => {
  try {
    const res = await fetch(`${API_URL}/api/questions`);
    if (!res.ok) return [];
    const list = await res.json();
    return list.map((q) => ({
      id: q._id,
      title: q.title,
      body: q.content,
      author: q.author?.name ? `@${q.author.name.toLowerCase().replace(/\s+/g, "")}` : "@anonymous",
      tag: q.type === "personal" ? "Private" : "General",
      upvotes: q.upvotes || 0,
      createdAt: new Date(q.createdAt).getTime(),
      answerCount: q.answerCount || 0,
      latestAnswer: q.latestAnswer
        ? {
            id: q.latestAnswer._id,
            body: q.latestAnswer.content,
            isAccepted: !!q.latestAnswer.isAccepted,
            createdAt: new Date(q.latestAnswer.createdAt).getTime(),
            author: q.latestAnswer.author?.name
              ? `@${q.latestAnswer.author.name.toLowerCase().replace(/\s+/g, "")}`
              : "@mentor",
          }
        : null,
    }));
  } catch (e) {
    console.error("Error loading community questions:", e);
    return [];
  }
};

const loadMyQueries = async () => {
  const token = localStorage.getItem(LS_TOKEN);
  if (!token) return [];

  let localIds = [];
  try {
    const raw = localStorage.getItem(LS_MY_QUERIES);
    if (raw) localIds = JSON.parse(raw);
  } catch {}

  let rejectedIds = [];
  try {
    const raw = localStorage.getItem(LS_REJECTED_QUERIES);
    if (raw) rejectedIds = JSON.parse(raw);
  } catch {}

  const queries = [];
  const promises = localIds.map(async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/questions/${id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        // data contains { question, answers }
        const q = data.question;
        // Prefer accepted answers first; fall back to any answer so admin replies
        // submitted via /api/admin/moderation/personal/:id/review are always shown.
        const acceptedAnswers = (data.answers || []).filter((a) => a.isAccepted);
        const anyAnswer = data.answers && data.answers.length > 0 ? data.answers[0] : null;
        const resolvedAnswer = acceptedAnswers.length > 0
          ? acceptedAnswers[acceptedAnswers.length - 1]
          : anyAnswer;
        const isRejected = rejectedIds.includes(q._id);
        queries.push({
          id: q._id,
          user: getAuth(),
          title: q.title,
          body: q.content,
          route: q.type,
          status: isRejected ? "rejected" : (q.isClosed ? "answered" : q.moderationStatus),
          warnings: 0,
          flagged: q.isModerated || false,
          adminReply: resolvedAnswer ? resolvedAnswer.content : "",
          aiAnswer: resolvedAnswer ? (resolvedAnswer.isAccepted ? resolvedAnswer.content : "") : "",
          adminReviewRequested: q.adminReviewRequested || false,
          adminReviewBetSp: q.adminReviewBetSp || 0,
          createdAt: new Date(q.createdAt).getTime(),
        });
      }
    } catch (e) {
      console.error(`Error loading personal query ${id}:`, e);
    }
  });

  await Promise.allSettled(promises);
  return queries;
};

export const refreshData = async () => {
  try {
    const token = localStorage.getItem(LS_TOKEN);
    const user = getAuth();

    const [faqsData, threads, notificationsData, meData] = await Promise.all([
      fetch(`${API_URL}/api/faqs`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      loadCommunityQuestions(),
      token
        ? fetch(`${API_URL}/api/users/notifications`, { headers: getAuthHeaders() })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        : Promise.resolve([]),
      token
        ? fetch(`${API_URL}/api/auth/me`, { headers: getAuthHeaders() })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    if (meData && user) {
      const updatedUser = {
        ...user,
        sp: meData.reputationPoints ?? user.sp,
        role: meData.role ?? user.role,
      };
      localStorage.setItem(LS_AUTH, JSON.stringify(updatedUser));
      emitAuth(); // update UI components with latest user data (like SP in Navbar)
    }

    const mappedFaqs = faqsData.length > 0
      ? faqsData.map((f) => ({
          id: f._id,
          section: f.category || "General",
          q: f.question,
          a: f.answer,
        }))
      : state.faqs;

    let myQueries = [];
    if (user?.role === "admin") {
      const res = await fetch(`${API_URL}/api/admin/moderation/personal`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const list = await res.json();
        let rejectedIds = [];
        try {
          const raw = localStorage.getItem(LS_REJECTED_QUERIES);
          if (raw) rejectedIds = JSON.parse(raw);
        } catch {}

        myQueries = list.map((q) => {
          const isRejected = rejectedIds.includes(q._id);
          return {
            id: q._id,
            user: {
              name: q.author?.name || "Student",
              handle: q.author?.name ? "@" + q.author.name.toLowerCase().replace(/\s+/g, "") : "@student",
              avatar: q.author?.name ? q.author.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase() : "ST",
            },
            title: q.title,
            body: q.content,
            route: q.type,
            status: isRejected ? "rejected" : (q.isClosed ? "answered" : q.moderationStatus),
            warnings: 0,
            flagged: q.isModerated || false,
            adminReply: q.latestAnswer ? q.latestAnswer.content : "",
            aiAnswer: "",
            createdAt: new Date(q.createdAt).getTime(),
          };
        });
      }
    } else {
      myQueries = await loadMyQueries();
    }

    // Map community queries authored by the user into the list if they are not already there
    const communityQueriesWrittenByMe = threads
      .filter((t) => user && t.author === user.handle)
      .map((t) => ({
        id: t.id,
        user,
        title: t.title,
        body: t.body,
        route: "community",
        status: "approved",
        warnings: 0,
        flagged: false,
        adminReply: "",
        aiAnswer: "",
        createdAt: t.createdAt,
      }));

    // Deduplicate and combine
    const allUserQueries = [...myQueries];
    for (const cq of communityQueriesWrittenByMe) {
      if (!allUserQueries.some((uq) => uq.id === cq.id)) {
        allUserQueries.push(cq);
      }
    }

    state.queries = allUserQueries;
    state.threads = threads;
    state.faqs = mappedFaqs;
    state.notifications = notificationsData;
    emit();
  } catch (e) {
    console.error("Error refreshing data:", e);
  }
};

// Fetch all questions and details on import
refreshData();

export const store = {
  get: () => state,
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset: async () => {
    localStorage.removeItem(LS_MY_QUERIES);
    await refreshData();
  },
};

// Queries
export const addQuery = async (q) => {
  const token = localStorage.getItem(LS_TOKEN);
  const res = await fetch(`${API_URL}/api/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: q.title,
      content: q.body,
      adminReviewRequested: q.requestAdminReview || false,
      adminReviewBetSp: q.betSp || 0
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to post query");
  }
  const data = await res.json();
  const savedQuestion = data.question;

  // Save the ID in local storage
  let localIds = [];
  try {
    const raw = localStorage.getItem(LS_MY_QUERIES);
    if (raw) localIds = JSON.parse(raw);
  } catch {}
  localIds.push(savedQuestion._id);
  localStorage.setItem(LS_MY_QUERIES, JSON.stringify(localIds));

  // Refresh data asynchronously
  refreshData();

  return {
    id: savedQuestion._id,
    route: savedQuestion.type,
    status: savedQuestion.moderationStatus,
    title: savedQuestion.title,
    body: savedQuestion.content,
  };
};

export const deleteQuery = async (id) => {
  const token = localStorage.getItem(LS_TOKEN);
  const res = await fetch(`${API_URL}/api/questions/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to delete query");
  }

  // Remove from local storage arrays if present
  try {
    let myQueries = JSON.parse(localStorage.getItem(LS_MY_QUERIES) || "[]");
    localStorage.setItem(LS_MY_QUERIES, JSON.stringify(myQueries.filter(qId => qId !== id)));
    
    let rejected = JSON.parse(localStorage.getItem(LS_REJECTED_QUERIES) || "[]");
    localStorage.setItem(LS_REJECTED_QUERIES, JSON.stringify(rejected.filter(qId => qId !== id)));
  } catch {}

  // Update local state immediately
  state.queries = state.queries.filter((q) => q.id !== id);
  emit();
  
  // Refresh backend state
  refreshData();
};

export const updateQuery = async (id, patch) => {
  const token = localStorage.getItem(LS_TOKEN);

  if (patch.adminReply) {
    const res = await fetch(`${API_URL}/api/admin/moderation/personal/${id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answerContent: patch.adminReply }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to submit admin reply");
    }
  }

  // Handle direct approvals & rejections
  if (patch.status === "approved" || patch.status === "rejected") {
    const curQuery = state.queries.find((q) => q.id === id);
    if (curQuery && curQuery.route === "personal" && curQuery.status === "pending") {
      let answerContent = patch.adminReply || curQuery.adminFeedback || (patch.status === "approved" ? "Query approved by administrator." : "Query rejected by administrator.");
      const res = await fetch(`${API_URL}/api/admin/moderation/personal/${id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          answerContent, 
          isValid: patch.isValid !== undefined ? patch.isValid : (patch.status === "approved") 
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Failed to ${patch.status} query`);
      }
    }

    if (patch.status === "rejected") {
      let rejectedIds = [];
      try {
        const raw = localStorage.getItem(LS_REJECTED_QUERIES);
        if (raw) rejectedIds = JSON.parse(raw);
      } catch {}
      if (!rejectedIds.includes(id)) {
        rejectedIds.push(id);
        localStorage.setItem(LS_REJECTED_QUERIES, JSON.stringify(rejectedIds));
      }
    }
  }

  // Update locally to keep UI responsive
  state.queries = state.queries.map((q) => (q.id === id ? { ...q, ...patch } : q));
  emit();
  
  // Refresh backend state
  refreshData();
};

export const decideAnswer = (id, status) => {
  state.answers = state.answers.map((a) => (a.id === id ? { ...a, status } : a));
  emit();
};

export const addAnswer = async (threadId, body, author = "@you") => {
  const token = localStorage.getItem(LS_TOKEN);
  const res = await fetch(`${API_URL}/api/questions/${threadId}/answers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content: body }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to submit answer");
  }
  const savedAnswer = await res.json();

  // Fetch thread details to refresh answers list
  await fetchQuestionDetails(threadId);
  await refreshData();
  return savedAnswer;
};

// Fetch thread details + answers dynamically
export const fetchQuestionDetails = async (questionId) => {
  const token = localStorage.getItem(LS_TOKEN);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    const res = await fetch(`${API_URL}/api/questions/${questionId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();

    const questionAnswers = data.answers.map((a) => ({
      id: a._id,
      threadId: questionId,
      body: a.content,
      status: a.isAccepted ? "approved" : "pending",
      author: a.author?.name ? `@${a.author.name.toLowerCase().replace(/\s+/g, "")}` : "@mentor",
      createdAt: new Date(a.createdAt).getTime(),
    }));

    state.answers = [
      ...state.answers.filter((a) => a.threadId !== questionId),
      ...questionAnswers,
    ];
    emit();
  } catch (e) {
    console.error("Error fetching question details:", e);
  }
};

// AI answer generator (mocked locally)
const SAMPLE_ANSWERS = [
  "Thanks for reaching out. Per current campus policy, you can resolve this by contacting the relevant office (Admin Block, Room 12) between 10am–4pm with your ID card.",
  "This is handled by the academic office. Submit a written request via your dashboard and you'll get a confirmation within 48 hours.",
  "Please log a ticket from your dashboard with screenshots; our team typically responds within 2 working days.",
  "Yes, this is permitted. Carry a copy of your ID and the approval email from your HOD when you visit the office.",
  "No, this is not allowed under current rules. Please refer to section 4 of the student handbook for the alternative process.",
];

export const generateAIAnswer = (query) => {
  const i = Math.abs(hash(query.title)) % SAMPLE_ANSWERS.length;
  return `Hi ${query.user.name.split(" ")[0]} — ${SAMPLE_ANSWERS[i]}`;
};

const hash = (s) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
};

// Cosine Similarity FAQ Search from backend
let lastQuery = "";
let lastMatches = [];
let searchTimeout = null;

export const searchFaqs = (query) => {
  if (!query || !query.trim()) return [];

  if (query !== lastQuery) {
    lastQuery = query;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/faqs/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (res.ok) {
          const data = await res.json();
          lastMatches = (data.suggestions || []).map((s) => ({
            id: s.faqId,
            q: s.question,
            a: s.answer,
            match: Math.round(s.score * 100),
            section: "Search Match",
          }));
          emit();
        }
      } catch (e) {
        console.error("Error searching FAQs:", e);
      }
    }, 300);
  }

  return lastMatches;
};

/**
 * Checks whether a given query text semantically matches any existing FAQ.
 * Returns { isDuplicate, isNearMatch, score, matchedFaq } where:
 *   isDuplicate  = score >= 80 → hard block (question already answered)
 *   isNearMatch  = score >= 50 → soft warn (similar but let user decide)
 */
export const checkFaqSimilarity = async (query) => {
  if (!query || !query.trim()) return { isDuplicate: false, isNearMatch: false, score: 0, matchedFaq: null };
  try {
    const res = await fetch(`${API_URL}/api/faqs/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { isDuplicate: false, isNearMatch: false, score: 0, matchedFaq: null };
    const data = await res.json();
    const best = data.suggestions && data.suggestions[0];
    if (!best) return { isDuplicate: false, isNearMatch: false, score: 0, matchedFaq: null };
    const score = Math.round(best.score * 100);
    return {
      isDuplicate: score >= 80,
      isNearMatch: score >= 50 && score < 80,
      score,
      matchedFaq: { id: best.faqId, q: best.question, a: best.answer, match: score },
    };
  } catch (e) {
    console.error("Error checking FAQ similarity:", e);
    return { isDuplicate: false, isNearMatch: false, score: 0, matchedFaq: null };
  }
};

/**
 * Checks text for toxicity via the backend AI screening.
 * Returns { isToxic: boolean, reason: string | null }
 */
export const checkToxicity = async (text) => {
  if (!text || !text.trim()) return { isToxic: false };
  try {
    const res = await fetch(`${API_URL}/api/questions/analyze-toxicity`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return { isToxic: false };
    const data = await res.json();
    return {
      isToxic: !!data.isToxic,
      reason: data.reason || "Content flagged by moderation filters.",
    };
  } catch (e) {
    console.error("Error checking toxicity:", e);
    return { isToxic: false };
  }
};

// Auth

const authListeners = new Set();
export const onAuthChange = (fn) => {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
};
const emitAuth = () => authListeners.forEach((l) => l(getAuth()));

export const signIn = async ({ email, password, isAdmin = false }) => {
  if (!email || !password) throw new Error("Email and password required");

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwordHash: password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Invalid credentials");
  }

  const data = await res.json();
  localStorage.setItem(LS_TOKEN, data.access_token);

  const user = {
    ...data.user,
    handle: "@" + data.user.name.toLowerCase().replace(/\s+/g, ""),
    avatar: data.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    sp: data.user.reputationPoints || 10,
  };

  localStorage.setItem(LS_AUTH, JSON.stringify(user));
  emitAuth();
  await refreshData();
  return user;
};

export const signUp = async ({ email, password, name }) => {
  if (!email || !password || !name) throw new Error("All fields are required");

  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, passwordHash: password, name }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Registration failed");
  }

  const data = await res.json();
  localStorage.setItem(LS_TOKEN, data.access_token);

  const user = {
    ...data.user,
    handle: "@" + data.user.name.toLowerCase().replace(/\s+/g, ""),
    avatar: data.user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
    sp: data.user.reputationPoints || 10,
  };

  localStorage.setItem(LS_AUTH, JSON.stringify(user));
  emitAuth();
  await refreshData();
  return user;
};

export const signOut = () => {
  localStorage.removeItem(LS_AUTH);
  localStorage.removeItem(LS_TOKEN);
  emitAuth();
  refreshData();
};

export const voteQuestion = async (questionId, value) => {
  const token = localStorage.getItem(LS_TOKEN);
  const res = await fetch(`${API_URL}/api/questions/${questionId}/vote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to vote");
  }
  await refreshData();
};

export const markNotificationRead = async (id) => {
  const token = localStorage.getItem(LS_TOKEN);
  const res = await fetch(`${API_URL}/api/users/notifications/${id}/read`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.ok) {
    state.notifications = state.notifications.map((n) =>
      n._id === id ? { ...n, isRead: true } : n
    );
    emit();
  }
};

// Bookmarks logic (LocalStorage Mock)
const LS_BOOKMARKS = "yaksha.bookmarks.v1";

export const getBookmarks = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_BOOKMARKS) || "[]");
  } catch {
    return [];
  }
};

export const hasBookmark = (id) => {
  return getBookmarks().some((b) => b.id === id);
};

export const toggleBookmark = (item) => {
  let bookmarks = getBookmarks();
  if (bookmarks.some((b) => b.id === item.id)) {
    bookmarks = bookmarks.filter((b) => b.id !== item.id);
  } else {
    // Save minimal representation of the thread/query
    bookmarks.push({
      id: item.id || item._id,
      title: item.title || item.q || item.content,
      type: item.route || "community",
    });
  }
  localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarks));
  // Emit state so Profile re-renders if we add listeners, but for now Profile fetches on mount
  return hasBookmark(item.id);
};
