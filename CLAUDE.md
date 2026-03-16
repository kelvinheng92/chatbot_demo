# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run development server (requires .env.local with ANTHROPIC_API_KEY)
npm run dev

# Build for production
npm run build

# Deploy to Vercel (one-time setup: npx vercel link)
npx vercel --prod
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```

For Vercel deployment, add `ANTHROPIC_API_KEY` via the Vercel dashboard → Project Settings → Environment Variables.

## Architecture

This is a **Next.js 15 + TypeScript** app that renders three chatbots side-by-side in phone mockups, demonstrating different AI approaches for retirement planning at OCBC Bank.

### Three Chatbot Engines

| Engine | Route | Model | Approach |
|--------|-------|-------|----------|
| NLU-Based | `/api/chat` (type=`nlu`) | None (pure JS) | TF-IDF cosine similarity against 5 fixed retirement intents |
| Hybrid Gen-AI | `/api/chat` (type=`hybrid`) | `claude-haiku-4-5` | LLM classifies intent → returns hardcoded template + buttons |
| RAG Knowledge | `/api/chat` (type=`rag`) | `claude-opus-4-6` | Streaming LLM response grounded in Singapore retirement knowledge base |

### Data Flow

1. User types in the shared input → `page.tsx` fires 3 independent `fetch` calls simultaneously
2. NLU resolves first (synchronous JS, ~5ms), Hybrid second (~800ms), RAG last (~2-4s via streaming)
3. The latency difference is intentional and is a key demo talking point
4. RAG uses **SSE streaming** — the API route returns `text/event-stream`, the frontend appends tokens in real-time

### Key Files

- `src/lib/intents.ts` — The 5 retirement intent definitions (used by all three engines)
- `src/lib/nlu-engine.ts` — TF-IDF vocabulary building + cosine similarity classification
- `src/lib/knowledge-base.ts` — Singapore retirement knowledge base (CPF, SRS, OCBC products) + LLM system prompts
- `src/app/api/chat/route.ts` — Single API endpoint; branches on `type` field
- `src/app/page.tsx` — Main page with state management for all three chat histories
- `src/components/PhoneMockup.tsx` — Phone frame UI + scroll management
- `src/components/ChatBubble.tsx` — Message bubbles (red pills for user, white cards for bot)
- `src/components/EngineInfo.tsx` — Static engine description cards shown below each phone

### NLU Engine Behaviour

The NLU engine intentionally demonstrates its weakness: for out-of-scope queries (e.g. "What are fixed deposit rates?"), it picks the nearest retirement intent by cosine similarity and shows those buttons — a **false positive**. The Hybrid and RAG engines correctly decline. This contrast is the core demo message for senior leadership.

Thresholds in `nlu-engine.ts`:
- `< 0.04`: "I don't understand" (very low overlap)
- `0.04–0.14`: "Do you mean...?" + wrong intent buttons (demonstrates misclassification)
- `≥ 0.14`: Correct classification + relevant buttons

### Adding / Modifying Intents

Edit `src/lib/intents.ts` to add keywords and training examples. The NLU vocabulary is rebuilt at module load time. The Hybrid classifier prompt in `src/lib/knowledge-base.ts` (`HYBRID_CLASSIFIER_PROMPT`) must also be updated to list the new intent ID.

### Extending the Knowledge Base

Edit the `RETIREMENT_KNOWLEDGE_BASE` string in `src/lib/knowledge-base.ts`. For large additions, consider splitting into separate topic files and concatenating them in `RAG_SYSTEM_PROMPT`.
