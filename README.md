# WeekAI Editorial Workspace

WeekAI is a lightweight, local-first editorial desk for turning AI signals into a useful story. It has two connected workflows:

1. **Research assistant:** enter at least three URLs, tweets, or pasted excerpts. The app creates a source-first brief with a fact/analysis boundary, an audience lens, source links, and a newsletter angle.
2. **Writing assistant:** paste a draft or load the sample. Deterministic checks flag long sentences, jargon, passive voice, filler phrases, and repeated words. Each note includes the passage, rationale, and an actionable suggestion. Suggestions are opt-in.

The dashboard navigation links directly to Research, the generated Brief, and the Newsletter Editor. The dashboard status changes as a brief is generated or a draft enters review.

## Run locally

No frontend build step is required. The local server provides article extraction and a deterministic fallback; an API key enables AI analysis.

```powershell
cd C:\Users\boddu\NxtWave\WeekAi
python server.py
```

Open http://localhost:8000. Do not use `python -m http.server` for the full workflow because it cannot serve the `/api/research` and `/api/newsletter` endpoints.

For AI-powered briefs and newsletters, set an OpenAI-compatible key before starting the server:

```powershell
$env:OPENAI_API_KEY = "your-key"
$env:OPENAI_MODEL = "gpt-4o-mini" # optional
python server.py
```

The key is read only by the local server and must never be committed. Without it, the server still extracts article text and clearly labels the deterministic result for editorial review.

## Product decisions

The primary user is a newsletter editor who needs judgment support, not a generic summarizer. Research is intentionally source-first: the prototype refuses to fabricate article-specific facts and labels the cross-source “angle” as analysis. The writing tool preserves the draft and asks the writer to accept or reject every change.

The prototype uses a small local Python extraction service and an optional OpenAI-compatible LLM. Every generated source card retains its original link. Inaccessible URLs return a visible warning instead of becoming confident prose.

See [PRODUCT_NOTE.md](./PRODUCT_NOTE.md) for the product, engineering, and editorial note, and [SAMPLE_OUTPUT.md](./SAMPLE_OUTPUT.md) for the sample newsletter and before/after edit.

## Testing

The app has no build step. Validate the JavaScript syntax with:

```powershell
node --check C:\Users\boddu\NxtWave\WeekAi\app.js
```

Manual smoke test:

1. Open the dashboard and use each navigation link.
2. Remove a source and confirm the brief blocks fewer than three sources.
3. Generate a brief and confirm original source links are clickable.
4. Load the sample draft, analyze it, accept one suggestion, and reject another.
5. Confirm metrics update and the original can be restored with Ctrl/Cmd+Z.

## Deployment

Because this is a static site, it can be deployed to GitHub Pages, Netlify, Vercel, or any static host. Upload the contents of `WeekAi/`; no environment variables or server runtime are required. For local sharing, use `python -m http.server 8000`.

## Disclosure

I used an AI coding assistant to scaffold and review the implementation. I personally chose the workflow, source-first guardrails, deterministic checks, visual design, sample output, and local validation approach.
