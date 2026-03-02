// api/chat.js
// Secure Anthropic API proxy — your API key is stored safely as an
// environment variable in Vercel and is NEVER exposed to students.

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

  const { type, content, jobTitle, question } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: 'Missing required fields: type and content' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured. Please add ANTHROPIC_API_KEY in Vercel environment variables.' });
  }

  // Build prompt based on feedback type
  let prompt = '';

  if (type === 'resume') {
    prompt = `You are Dr. Maya, a warm and encouraging career coach helping adults with developmental disabilities practice job applications.

A student applying for a "${jobTitle}" position has uploaded their resume:

${content}

Give friendly, simple, encouraging feedback at a 3rd grade reading level. Use short sentences. Cover:
1. One or two specific strengths you noticed
2. One or two simple, actionable improvements
3. An encouraging closing sentence

Keep your response under 120 words. Write in short paragraphs. Do NOT use bullet points.`;

  } else if (type === 'cover') {
    prompt = `You are Dr. Maya, a warm and encouraging career coach helping adults with developmental disabilities practice job applications.

A student applying for a "${jobTitle}" position has submitted their cover letter:

${content}

Give friendly, simple feedback at a 3rd grade reading level. Use short sentences. Cover:
1. What they did well
2. One simple improvement suggestion
3. A warm, motivating closing

Keep your response under 120 words. Write in short paragraphs. Do NOT use bullet points.`;

  } else if (type === 'interview') {
    prompt = `You are Dr. Maya, a warm career coach helping adults with developmental disabilities practice job interviews.

The student was asked this interview question for a "${jobTitle}" job:
"${question}"

Here is what they said:
"${content}"

Give simple, encouraging feedback at a 3rd grade reading level:
1. One thing they did really well
2. One specific tip to improve their answer next time

Keep it under 80 words. Be warm and supportive. Do NOT use bullet points.`;

  } else if (type === 'report') {
    prompt = `You are Dr. Maya, a warm career coach helping adults with developmental disabilities practice job applications.

A student just completed a full mock job application practice for a "${jobTitle}" position.

Their interview answers:
${content}

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
