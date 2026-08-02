'use strict';

const axios = require('axios');
const { buildKnowledgebaseContext } = require('./knowledgebase');

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.example.com/v1';
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '512', 10);
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  'You are a helpful customer support assistant. Be concise, professional, and friendly. ' +
  'Answer based on the provided knowledge base. If you cannot find an answer, politely tell ' +
  'the user to contact a human agent.';

if (!AI_API_KEY) {
  throw new Error('[AI] Missing required env var: AI_API_KEY');
}

const client = axios.create({
  baseURL: AI_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

function buildMessages(userMessage, history = []) {
  const kbContext = buildKnowledgebaseContext(userMessage);

  const systemPrompt = `\n${SYSTEM_PROMPT}\n`;

  const systemContent = kbContext ? `${systemPrompt}\n\n${kbContext}` : systemPrompt;

  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userMessage },
  ];
}

async function generateReply(userMessage, history = []) {
  const messages = buildMessages(userMessage, history);
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.post('/chat/completions', {
        model: AI_MODEL,
        messages,
        max_tokens: AI_MAX_TOKENS,
        temperature: 0.4,
      });

      const reply = response.data?.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error('Empty response from AI API');
      return reply;

    } catch (err) {
      const status = err.response?.status;
      const isRetryable = status === 429 || status === 502 || status === 503;

      if (isRetryable && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`[AI] Attempt ${attempt} failed (status=${status}). Retrying in ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      console.error(`[AI] Fatal error after ${attempt} attempt(s):`, err.response?.data ?? err.message);
      throw err;
    }
  }
}

module.exports = { generateReply };