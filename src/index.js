'use strict';

require('dotenv').config();

const express = require('express');
const { validateSignature, parseWebhookEvent } = require('./webhook');
const { generateReply } = require('./ai');
const { sendReply } = require('./chatwoot');
const { syncKnowledgebase, getSyncMeta } = require('./kb-sync');

const PORT = process.env.PORT || 3000;
const app = express();

// Capture raw body for HMAC validation BEFORE JSON parsing
app.use((req, res, next) => {
  let data = Buffer.alloc(0);
  req.on('data', chunk => { data = Buffer.concat([data, chunk]); });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data.toString('utf8'));
    } catch {
      req.body = {};
    }
    next();
  });
});

// In-memory conversation history store (keyed by conversationId)
// For production: replace with Redis HSET with TTL
const conversationHistory = new Map();

const MAX_HISTORY_TURNS = parseInt(process.env.MAX_HISTORY_TURNS || '10', 10);

function getHistory(conversationId) {
  return conversationHistory.get(String(conversationId)) || [];
}

function appendHistory(conversationId, userMessage, assistantReply) {
  const key = String(conversationId);
  const history = conversationHistory.get(key) || [];
  history.push({ role: 'user', content: userMessage });
  history.push({ role: 'assistant', content: assistantReply });

  // Trim to last N turns (each turn = 2 entries)
  const trimmed = history.slice(-(MAX_HISTORY_TURNS * 2));
  conversationHistory.set(key, trimmed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Health check — includes last KB sync metadata
app.get('/health', (req, res) => {
  const syncMeta = getSyncMeta();
  res.json({
    status: 'ok',
    knowledgebase: syncMeta
      ? {
          lastSync: syncMeta.lastSync,
          source: syncMeta.source,
          fetched: syncMeta.fetched,
          added: syncMeta.added,
          updated: syncMeta.updated,
        }
      : { lastSync: null, note: 'No sync has run yet' },
  });
});

// Manual KB re-sync trigger (protected by a simple token)
app.post('/kb/sync', async (req, res) => {
  const token = req.headers['x-sync-token'];
  if (process.env.KB_SYNC_TOKEN && token !== process.env.KB_SYNC_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Fire async — respond immediately
  res.json({ triggered: true });
  try {
    const result = await syncKnowledgebase();
    console.log('[Bot] Manual KB sync result:', result);
  } catch (err) {
    console.error('[Bot] Manual KB sync error:', err.message);
  }
});

// Chatwoot webhook endpoint
app.post('/webhook', async (req, res) => {
  // 1. Validate HMAC signature
  const signature  = req.headers['x-chatwoot-signature']  || '';
  const timestamp  = req.headers['x-chatwoot-timestamp']  || '';
  if (!validateSignature(req.rawBody, signature, timestamp)) {
    console.warn('[Webhook] Invalid signature — request rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Parse event
  const { shouldRespond, conversationId, messageText } = parseWebhookEvent(req.body);
  if (!shouldRespond) {
      // Debug: log why the event was skipped
      const evt = req.body?.event;
      const mt = req.body?.message_type;
      const st = req.body?.conversation?.status;
      const sender = req.body?.sender?.type;
      console.log(`[Webhook] Skipped event=${evt} message_type=${mt} conv_status=${st} sender_type=${sender}`);
    return res.status(200).json({ skipped: true });
  }

  // 3. Acknowledge immediately (Chatwoot expects fast response)
  res.status(200).json({ received: true });

  // 4. Generate AI reply asynchronously
  setImmediate(async () => {
    try {
      console.log(`[Bot] Incoming message (conv=${conversationId}): ${messageText.substring(0, 80)}`);

      const history = getHistory(conversationId);
      const reply = await generateReply(messageText, history);

      await sendReply(conversationId, reply);
      appendHistory(conversationId, messageText, reply);

      console.log(`[Bot] Replied to conv=${conversationId}`);
    } catch (err) {
      console.error(`[Bot] Failed to process message for conv=${conversationId}:`, err.message);

      // Fallback message on unrecoverable error
      try {
        await sendReply(
          conversationId,
          "I'm sorry, I'm having trouble processing your request right now. Please try again shortly or contact our support team."
        );
      } catch (fallbackErr) {
        console.error('[Bot] Fallback reply also failed:', fallbackErr.message);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup: sync KB first, then start listening
// ─────────────────────────────────────────────────────────────────────────────

async function start() {
  console.log('[Bot] Starting Chatwoot AI Bot...');
  console.log(`[Bot] AI model: ${process.env.AI_MODEL || 'gpt-4o-mini'}`);
  console.log(`[Bot] WHMCS source: ${process.env.WHMCS_BASE_URL || 'https://example.com'}`);

  // Sync KB on every startup (non-blocking on failure — bot still starts)
  console.log('[Bot] Running knowledgebase sync...');
  try {
    const syncResult = await syncKnowledgebase();
    if (syncResult.skipped) {
      console.log('[Bot] KB sync skipped (disabled or locked)');
    } else {
      console.log(`[Bot] KB sync complete — added: ${syncResult.added}, updated: ${syncResult.updated}, total: ${syncResult.total}`);
    }
  } catch (err) {
    console.error('[Bot] KB sync error (continuing with cached KB):', err.message);
  }

  // Start HTTP server only after sync attempt
  app.listen(PORT, () => {
    console.log(`[Bot] Listening on port ${PORT}`);
    console.log(`[Bot] Health: http://localhost:${PORT}/health`);
  });
}

start();