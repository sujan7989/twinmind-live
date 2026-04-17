# TwinMind Live — AI Meeting Copilot

A real-time AI meeting copilot that listens to your microphone, transcribes speech in 30-second chunks, and continuously surfaces 3 contextual suggestions to help you navigate the conversation. Click any suggestion for a detailed answer, or ask follow-up questions in the chat panel.

**Live demo**: https://twinmind-live-phi.vercel.app  
**Stack**: Next.js 16 · React 19 · Tailwind CSS 4 · Groq SDK · TypeScript

---

## Setup

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com/keys) (free tier works)

### Local development

```bash
git clone <repo-url>
cd twinmind-live
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Settings**, paste your Groq API key, and click **Start Recording**.

### Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

No environment variables needed — the API key is entered by the user in the UI and sent with each request. It is stored only in the browser's `localStorage`.

---

## Architecture

```
app/
├── page.tsx                  # Main layout: 3-column grid + state wiring
├── layout.tsx                # Root HTML shell
├── globals.css               # Tailwind + custom animations
├── types.ts                  # Shared TypeScript interfaces
│
├── hooks/
│   ├── useAudioRecorder.ts   # MediaRecorder with 30s chunk flushing
│   └── useSession.ts         # All session state + API call orchestration
│
├── components/
│   ├── TranscriptPanel.tsx   # Left column: mic control + transcript
│   ├── SuggestionsPanel.tsx  # Middle column: suggestion batches
│   ├── ChatPanel.tsx         # Right column: streaming chat
│   ├── DetailModal.tsx       # Overlay: expanded suggestion detail
│   └── SettingsModal.tsx     # Overlay: API key + prompt editing
│
├── api/
│   ├── transcribe/route.ts   # POST → Groq Whisper Large V3
│   ├── suggestions/route.ts  # POST → Llama 4 Maverick (JSON mode)
│   ├── detail/route.ts       # POST → Llama 4 Maverick (markdown)
│   └── chat/route.ts         # POST → Llama 4 Maverick (SSE stream)
│
└── lib/
    ├── defaults.ts           # Default prompts + settings
    ├── export.ts             # JSON/text session export
    └── utils.ts              # Formatting + transcript helpers
```

### Data flow

1. `useAudioRecorder` captures mic audio and emits a `Blob` every 30 seconds
2. `useSession.transcribeAudio` sends the blob to `/api/transcribe` → Whisper → appends a `TranscriptChunk`
3. A `setInterval` (default 30s) calls `useSession.generateSuggestions` → `/api/suggestions` → prepends a new `SuggestionBatch`
4. Clicking a suggestion card calls `useSession.fetchSuggestionDetail` → `/api/detail` → populates `suggestion.detail`
5. Clicking "Open in Chat" or typing in the chat box calls `useSession.sendChatMessage` → `/api/chat` → streams tokens back via SSE

---

## Models

| Task | Model | Why |
|------|-------|-----|
| Transcription | `whisper-large-v3` | Best open-source ASR; handles accents, technical terms, and noisy audio well |
| Suggestions | `openai/gpt-oss-120b` | The exact model specified in the assignment; 120B parameters, 128k context, fast on Groq |
| Detail answers | `openai/gpt-oss-120b` | Same model; structured markdown output; excellent instruction following |
| Chat | `openai/gpt-oss-120b` | SSE streaming; handles long transcript context; >500 tokens/sec on Groq |

---

## Prompt strategy

### Suggestion prompt

The core challenge is surfacing the *right type* of suggestion at the right moment — not just any 3 suggestions. The prompt uses a **decision tree** for type selection:

- If a question was just asked → prioritize `answer` (give the answer in the preview)
- If a specific claim/statistic was made → consider `fact_check`
- If the conversation is exploring a topic → mix `question` + `talking_point`
- If jargon or acronyms appeared → use `clarification`

**Preview quality rules** are explicit: the preview must be useful on its own. For `answer` type, the preview *is* the answer. For `question` type, the preview *is* the question. This means users get value without ever clicking.

**Anti-patterns** are listed explicitly to prevent the model from generating generic filler like "You could ask a follow-up question about this topic."

**Context window**: 3,000 characters (~5-6 minutes of speech). This is intentionally smaller than the maximum — we want suggestions grounded in *recent* context, not the entire meeting. Older context adds noise.

**Deduplication**: The last 9 suggestions (3 batches) are passed as "previous suggestions to avoid" so each refresh produces genuinely new ideas.

### Detail prompt

Type-specific response structures:
- `answer` → direct answer + supporting context + caveats
- `fact_check` → claim → verdict → accurate info → confidence
- `question` → the question verbatim + why it matters + what a good answer looks like
- `talking_point` → the point itself + evidence + how to connect it + objections
- `clarification` → definition + why it matters + misconceptions

This structure means the detail panel is immediately actionable — you can read the "question" verbatim and ask it, or read the "talking_point" and raise it.

### Chat prompt

The full transcript is passed as ground truth. The model is instructed to quote/paraphrase the transcript when answering questions about the meeting — this prevents hallucination and makes answers feel trustworthy. The tone is "knowledgeable colleague whispering in your ear."

---

## Settings (all editable in-app)

| Setting | Default | Notes |
|---------|---------|-------|
| Refresh interval | 30s | How often suggestions auto-refresh while recording |
| Suggestion context window | 3,000 chars | Recent transcript chars sent to suggestion API |
| Detail context window | 10,000 chars | Transcript chars sent when expanding a suggestion |
| Suggestion prompt | See defaults.ts | Full prompt with type decision tree |
| Detail prompt | See defaults.ts | Type-specific response structures |
| Chat prompt | See defaults.ts | Meeting copilot persona + grounding instructions |

---

## Export

Click **Export** in the top bar to download the full session as:
- **JSON**: Machine-readable, includes all timestamps and metadata
- **Text**: Human-readable, formatted for easy review

Both formats include: full transcript with timestamps, all suggestion batches with types and previews (and detail if expanded), and full chat history.

---

## Tradeoffs & decisions

**No server-side storage**: The API key is stored in `localStorage` and sent with each request. This means zero backend infrastructure and no privacy concerns — but sessions are lost on page refresh. For a production product you'd want IndexedDB persistence or a backend session store.

**30-second chunks**: This is the sweet spot between latency (shorter = more API calls, higher cost) and context (longer = suggestions lag behind the conversation). The auto-refresh timer is aligned with the chunk interval so suggestions update as soon as new transcript arrives.

**3,000 char suggestion context vs 10,000 char detail context**: Suggestions need to be grounded in *recent* conversation — passing the full transcript would dilute the signal. Detail answers benefit from more context since the user is asking a specific question about something that may have been mentioned earlier.

**JSON mode for suggestions**: Using `response_format: { type: "json_object" }` eliminates markdown-wrapped JSON and parse failures. The model is still instructed to return a specific schema, but JSON mode enforces valid JSON at the API level.

**SSE streaming for chat**: First token appears in ~300ms on Groq. Streaming makes the chat feel responsive even for longer answers. The client reads the SSE stream and appends deltas to the message in real time.

**No retry logic**: Kept simple intentionally. If a suggestion request fails, the user can click Refresh. If a transcription fails, the audio chunk is lost but recording continues. Production would want exponential backoff.
