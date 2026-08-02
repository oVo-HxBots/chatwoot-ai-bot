# Chatwoot AI Bot

A self-hosted chatbot that integrates with Chatwoot to answer user messages using a local knowledgebase and an OpenAI-compatible AI model.

Key goals:
- Fast, webhook-driven replies to incoming Chatwoot messages
- Knowledgebase Retrieval (RAG-style injection of top matches into system prompt)
- Safe, configurable environment via .env (no secrets committed)

Contents
- src/ — application source
- knowledgebase/ — JSON KB files (merged with remote sync)
- .env.example — example environment variables (safe for publishing)
- Dockerfile, docker-compose.yml — production deployment

Quick start
1. Install dependencies

```bash
cd chatwoot-bot
npm install
```

2. Create environment file

```bash
cp .env.example .env
# edit .env and fill in real values (do NOT commit .env)
```

3. Run (development)

```bash
npm run dev
```

Docker (production)

```bash
docker compose up -d --build
```

Environment variables
See `.env.example` for a full list. Important ones:
- CHATWOOT_BASE_URL — URL of your Chatwoot instance (e.g. https://chat.example.com)
- CHATWOOT_API_TOKEN — Agent Bot API token (from Chatwoot Integrations)
- CHATWOOT_ACCOUNT_ID — Account ID (from Chatwoot URL)
- CHATWOOT_WEBHOOK_SECRET — HMAC secret for webhook verification
- AI_BASE_URL / AI_API_KEY — OpenAI-compatible API endpoint and key

How it works (high level)
- Chatwoot sends webhooks to `/webhook` on new messages
- The app validates HMAC signature (CHATWOOT_WEBHOOK_SECRET)
- If the event is an incoming message, the bot runs RAG retrieval against knowledgebase/, builds messages, and calls the AI API
- The reply is posted to Chatwoot via its REST API

Knowledgebase sync
- On startup the app can crawl a WHMCS knowledgebase (configurable with WHMCS_BASE_URL) and merge results into knowledgebase/*.json
- Manual re-sync via POST /kb/sync (protected by KB_SYNC_TOKEN if set)

Security notes
- Never commit real API keys or webhook secrets to the repo. Use `.env` and add it to `.gitignore`.
- Rotate any secrets that may have been previously committed.

Contributing
- Open issues / PRs. Keep secrets out of diffs and test data.

License
- MIT (or choose a license you prefer)
