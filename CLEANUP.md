Sanitization & Cleanup Summary

This repository was sanitized to remove personal URLs, tokens, and credentials before publishing.

Summary of changes:
- Removed or replaced personal hostnames and tokens with placeholders (see .env.example).
- Added .env.example with descriptions for all known environment variables; .env is gitignored.
- Consolidated AI client into src/ai.js which uses Authorization: Bearer ${AI_API_KEY} and contains retry/backoff logic.
- Removed temporary duplicate AI client files (src/ai_safe.js, src/ai_canonical.js) and finalized canonical client: src/ai.js.
- Sanitized knowledgebase JSON files (knowledgebase/*.json) to remove personal domains/emails and replace with example.com placeholders.
- Added a cleaned README.md suitable for publishing.
