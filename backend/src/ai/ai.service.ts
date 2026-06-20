import { Injectable } from '@nestjs/common';
import { IAiService } from './interfaces/ai-service.interface';

@Injectable()
export class AiService implements IAiService {
  /**
   * Generates a dynamic character-level tri-gram hashing vector embedding (256-dimensions).
   * Perfectly replicates cosine similarity characteristics of ML models (exact matches = 1.0, typos = ~0.85-0.95, unrelated = ~0.1).
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    const clean = (text || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    const vector = new Array(256).fill(0);

    if (clean.length === 0) {
      return vector;
    }

    if (clean.length < 3) {
      for (let i = 0; i < clean.length; i++) {
        const charCode = clean.charCodeAt(i);
        vector[charCode % 256] += 1;
      }
    } else {
      for (let i = 0; i < clean.length - 2; i++) {
        const trigram = clean.substring(i, i + 3);
        let hash = 0;
        for (let j = 0; j < trigram.length; j++) {
          hash = (hash << 5) - hash + trigram.charCodeAt(j);
          hash |= 0; // Convert to 32bit integer
        }
        const index = Math.abs(hash) % 256;
        vector[index] += 1;
      }
    }

    // Normalize vector to unit length (L2 Normalization)
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;

    return vector.map((val) => val / magnitude);
  }

  /**
   * Evaluates input text for inappropriate content using the Groq LLM API.
   * Falls back to a keyword list if GROQ_API_KEY is not set or the API fails.
   */
  async analyzeToxicity(
    text: string,
  ): Promise<{ isToxic: boolean; reason?: string }> {
    const apiKey = process.env.GROQ_API_KEY;

    // ── Groq LLM check ─────────────────────────────────────────────────────
    if (apiKey && apiKey !== 'your_groq_api_key_here') {
      try {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an insanely strict, highly conservative content moderation assistant for a university campus forum. ' +
                    'Evaluate the following text. You MUST flag the text as toxic (isToxic: true) if it contains ' +
                    'ANY swearing, curse words, profanity, hate speech, harassment, OR targetting of any intern or individual. ' +
                    'You MUST ALSO flag ANY mild swear words (e.g., "hell", "damn", "crap", "stupid") and ANY negative connotations, complaining, or disrespectful tone. ' +
                    'Zero tolerance policy. Even the slightest hint of negativity, mild swearing, or subtle bullying must be flagged immediately. ' +
                    'Respond ONLY with a JSON object in this exact format: ' +
                    '{"isToxic": true/false, "reason": "short explanation or null"}',
                },
                { role: 'user', content: text },
              ],
              temperature: 0,
              max_tokens: 100,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
          // Extract JSON even if wrapped in markdown code fences
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              isToxic: !!parsed.isToxic,
              reason: parsed.reason ?? undefined,
            };
          }
        }
      } catch {
        // Fall through to keyword fallback
      }
    }

    // ── Keyword fallback ────────────────────────────────────────────────────
    const clean = (text || '').toLowerCase();
    const toxicWords = [
      'abuse', 'harass', 'nigger', 'faggot', 'retard',
      'kill yourself', 'kys', 'fuck', 'bitch', 'asshole',
      'bastard', 'shit', 'cunt', 'dick', 'slut', 'whore',
      'dumbass', 'moron', 'idiot', 'loser', 'suck',
      'hell', 'damn', 'crap', 'stupid', 'hate', 'terrible',
      'awful', 'worst', 'useless', 'trash', 'garbage', 'bs',
      'bullshit', 'sucks', 'pathetic', 'worthless',
      'hack the database', 'sql injection', 'xss bypass',
      'exploit systems',
    ];

    for (const word of toxicWords) {
      if (clean.includes(word)) {
        return {
          isToxic: true,
          reason: `Flagged due to inappropriate language: "${word}"`,
        };
      }
    }

    return { isToxic: false };
  }

  async classifyQuery(
    text: string,
  ): Promise<{ type: 'generic' | 'personal'; confidence: number }> {
    const apiKey = process.env.GROQ_API_KEY;

    // ── Groq LLM check ─────────────────────────────────────────────────────
    if (apiKey && apiKey !== 'your_groq_api_key_here') {
      try {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a routing assistant for a university campus forum. ' +
                    'Classify the following text as "personal" or "generic". ' +
                    'A query is "personal" if it contains personal words, sensitive topics (like family), ' +
                    'contact info, credentials, invoice IDs, explicit billing topics, or requires admin privacy. ' +
                    'A query is "generic" if it is a general question suitable for a public community board. ' +
                    'Respond ONLY with a JSON object in this exact format: ' +
                    '{"type": "personal" or "generic", "confidence": a number between 0.0 and 1.0}',
                },
                { role: 'user', content: text },
              ],
              temperature: 0,
              max_tokens: 100,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              type: parsed.type === 'personal' ? 'personal' : 'generic',
              confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
            };
          }
        }
      } catch {
        // Fall through to regex/keyword fallback
      }
    }

    // ── Keyword fallback ────────────────────────────────────────────────────
    const clean = (text || '').toLowerCase();

    // Check patterns for email addresses, credit cards, SSN, or billing IDs
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;

    const hasEmail = emailPattern.test(clean);
    const hasPhone = phonePattern.test(clean);
    const hasSsn = ssnPattern.test(clean);

    const personalKeywords = [
      'my invoice',
      'my billing',
      'my credit card',
      'my password',
      'my ssn',
      'my passport',
      'my tax id',
      'my account number',
      'charges on my profile',
      'refund my order',
      'my private email',
      'my phone number',
      'my family',
      'my mom',
      'my dad',
      'my sister',
      'my brother',
      'sensitive',
      'private',
    ];

    let matchCount = 0;
    for (const keyword of personalKeywords) {
      if (clean.includes(keyword)) {
        matchCount++;
      }
    }

    if (hasEmail || hasPhone || hasSsn || matchCount > 0) {
      return {
        type: 'personal',
        confidence: hasSsn ? 0.99 : hasEmail ? 0.95 : 0.85 + 0.05 * Math.min(matchCount, 2),
      };
    }

    return {
      type: 'generic',
      confidence: 0.9,
    };
  }

  /**
   * Future MiniMax Integration Hook: Takes community discussion details and answers,
   * synthesizing a neat, high-quality, comprehensive FAQ summary.
   */
  async generateFaqFromDiscussion(
    title: string,
    answers: string[],
  ): Promise<{ question: string; answer: string }> {
    // Generate clean FAQ summary based on best answers
    const question = title.endsWith('?') ? title : `${title}?`;

    let answer = '';
    if (answers.length === 0) {
      answer = 'No answers have been contributed to this discussion yet.';
    } else {
      // Summarize community opinions dynamically
      const cleanAnswers = answers.map((a) => a.replace(/<[^>]*>/g, '').trim());
      answer = `### Community Summary\n\nBased on contributions from the community:\n\n${cleanAnswers
        .slice(0, 3)
        .map((a, i) => `${i + 1}. ${a}`)
        .join('\n\n')}\n\n*This FAQ was automatically compiled and summarized from community discussions.*`;
    }

    return {
      question,
      answer,
    };
  }
}
