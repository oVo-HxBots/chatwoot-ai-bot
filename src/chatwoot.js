'use strict';

const axios = require('axios');

const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL; // e.g. https://chat.example.com
const CHATWOOT_API_TOKEN = process.env.CHATWOOT_API_TOKEN; // Agent Bot API Token
const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;

if (!CHATWOOT_BASE_URL || !CHATWOOT_API_TOKEN || !CHATWOOT_ACCOUNT_ID) {
  throw new Error('[Chatwoot] Missing required env vars: CHATWOOT_BASE_URL, CHATWOOT_API_TOKEN, CHATWOOT_ACCOUNT_ID');
}

const client = axios.create({
  baseURL: `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}`,
  headers: {
    'api_access_token': CHATWOOT_API_TOKEN,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Sends a message reply to a Chatwoot conversation.
 * @param {number|string} conversationId
 * @param {string} content
 * @returns {Promise<void>}
 */
async function sendReply(conversationId, content) {
  try {
    await client.post(`/conversations/${conversationId}/messages`, {
      content,
      message_type: 'outgoing',
      private: false,
    });
    console.log(`[Chatwoot] Replied to conversation ${conversationId}`);
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error(`[Chatwoot] Failed to send reply (status=${status}):`, data ?? err.message);
    throw err;
  }
}

** (truncated due to message length) **