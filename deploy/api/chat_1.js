// api/chat.js
// Secure Anthropic API proxy — your API key is stored safely as an
// environment variable in Vercel and is NEVER exposed to students.

// ─── Rate Limiting (in-memory, resets on cold start) ────────────────────────
// Limits each IP to 20 requests per hour and 5 requests per minute
const rateLimitStore = new Map();

const LIMITS = {
  perMinute: 5,    // max requests per IP per minute
  perHour: 20,     // max requests per IP per hour
};

function getRateLimitEntry(ip) {
  const now = Date.now();
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { minute: [], hour: [] });
  }
  const entry = rateLimitStore.get(ip);
  // Clean up old timestamps
  entry.minute = entry.minute.filter(t => now - t < 60_000);
  entry.hour   = entry.hour.filter(t => now - t < 3_600_000);
  return entry;
}

function isRateLimited(ip) {
  const entry = getRateLimitEntry(ip);
  if (entry.minute.length >= LIMITS.perMinute) return { limited: true, reason: 'Too many requests. Please wait a minute and try again.' };
  if (entry.hour.length   >= LIMITS.perHour)   return { limited: true, reason: 'Hourly limit reached. Please try again later.' };
  return { limited: false };
}

function recordRequest(ip) {
  const entry = getRateLimitEntry(ip);
  const now = Date.now();
  entry.minute.push(now);
  entry.hour.push(now);
}

// ─── Input limits ────────────────────────────────────────────────────────────
const MAX_CONTENT_CHARS = 3000;  // ~500 words
const MAX_JOBTITLE_CHARS = 100;
const MAX_QUESTION_CHARS = 500;

// ─── Allowed types (whitelist) ───────────────────────────────────────────────
const ALLOWED_TYPES = new Set(['resume', 'cover', 'interview', 'report']);

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit check ──────────────────────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const { limited, reason } = isRateLimited(ip);
  if (limited) {
    return res.status(429).json({ error: reason });
  }

  const { type, content, jobTitle, question } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!type || !content) {
    return res.status(400).json({ error: 'Missing required fields: type and content' });
  }

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid type. Use: resume, cover, interview, or report' });
  }

  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Content must be a non-empty string.' });
  }

  if (content.length > MAX_CONTENT_CHARS) {
    return res.status(400).json({ error: `Content is too long. Please keep it under ${MAX_CONTENT_CHARS} characters (~500 words).` });
  }

  if (jobTitle && jobTitle.length > MAX_JOBTITLE_CHARS) {
    return res.status(400).json({ error: 'Job title is too long.' });
  }

  if (question && question.length > MAX_QUESTION_CHARS) {
    return res.status(400).json({ error: 'Interview question is too long.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured. Please add ANTHROPIC_API_KEY in Vercel environment variables.' });
  }

  // Record this request only after all validation passes
  recordRequest(ip);

  // ── Sanitize inputs before injecting into prompts ─────────────────────────
  const safeContent  = content.replace(/[<>]/g, '').trim();
  const safeTitle    = (jobTitle  || 'General').replace(/[<>]/g, '').trim().slice(0, MAX_JOBTITLE_CHARS);
  const safeQuestion = (question  || '').replace(/[<>]/g, '').trim().slice(0, MAX_QUESTION_CHARS);

  // Build prompt based on feedback type
  let prompt = '';

  if (type === 'resume') {
    prompt = `You are Dr. Maya, a warm and encouraging career coach helping adults with developmental disabilities practice job applications.

A student applying for a "${safeTitle}" position has uploaded their resume:

${safeContent}

Give friendly, simple, encouraging feedback at a 3rd grade reading level. Use short sentences. Cover:
1. One or two specific strengths you noticed
2. One or two simple, actionable improvements
3. An encouraging closing sentence

Keep your response under 120 words. Write in short paragraphs. Do NOT use bullet points.`;

  } else if (type === 'cover') {
    prompt = `You are Dr. Maya, a warm and encouraging career coach helping adults with developmental disabilities practice job applications.

A student applying for a "${safeTitle}" position has submitted their cover letter:

${safeContent}

Give friendly, simple feedback at a 3rd grade reading level. Use short sentences. Cover:
1. What they did well
2. One simple improvement suggestion
3. A warm, motivating closing

Keep your response under 120 words. Write in short paragraphs. Do NOT use bullet points.`;

  } else if (type === 'interview') {
    prompt = `You are Dr. Maya, a warm career coach helping adults with developmental disabilities practice job interviews.

The student was asked this interview question for a "${safeTitle}" job:
"${safeQuestion}"

Here is what they said:
"${safeContent}"

Give simple, encouraging feedback at a 3rd grade reading level:
1. One thing they did really well
2. One specific tip to improve their answer next time

Keep it under 80 words. Be warm and supportive. Do NOT use bullet points.`;

  } else if (type === 'report') {
    prompt = `You are Dr. Maya, a warm career coach helping adults with developmental disabilities practice job applications.

A student just completed a full mock job application practice for a "${safeTitle}" position.

Their interview answers:
${safeContent}

Write a short encouraging overall summary at a 3rd grade reading level:
1. Their biggest strength across all answers
2. The #1 thing to practice before a real interview
3. A motivating closing message

Keep it under 150 words. Be warm, specific, and encouraging.`;

  } else {
    return res.status(400).json({ error: 'Invalid type. Use: resume, cover, interview, or report' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', errorData);
      return res.status(502).json({
        error: 'Error from Anthropic API',
        details: errorData
      });
    }

    const data = await response.json();
    const feedback = data?.content?.[0]?.text || 'No feedback generated.';
    return res.status(200).json({ feedback });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
};
