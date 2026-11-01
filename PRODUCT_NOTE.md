# Product and engineering note

## Product thinking

**User and problem.** The primary user is a small newsletter editorial team. Their bottleneck is not collecting links; it is deciding what is actually supported, what matters to their audience, and how to say it without flattening nuance.

**Core workflow.** Add three signals → inspect a structured brief → choose an angle → paste a draft → review specific writing notes → accept only useful edits. The brief keeps “verifiable” and “why it matters” visually separate.

**Prioritized.** Source links, a minimum three-source threshold, audience-oriented implications, an explicit analysis label, actionable writing feedback, accept/reject controls, a before/after comparison, and newsletter generation. **Left out.** Accounts, publishing, collaboration, and a full crawler. These are not needed to prove the central editorial loop.

**Success measure.** Time from first link to an editor-approved angle; percentage of source claims with an attached original link; suggestion acceptance rate; and a blind editor rating of whether the revised draft is clearer without losing meaning.

## Engineering

The app uses a static HTML/CSS/JavaScript client and a dependency-free Python `server.py`. The server extracts readable HTML with `HTMLParser`, exposes `/api/research` and `/api/newsletter`, and optionally calls an OpenAI-compatible chat-completions endpoint. DOM rendering and local state live in `app.js`; presentation is in `styles.css`.

With an API key, the model summarizes extracted source text into facts, importance, and an angle while preserving each source URL. Without a key, the server uses extracted sentences and labels the result `EXTRACTION / REVIEW`; it does not pretend the fallback is AI analysis. Newsletter generation likewise uses the model when configured and a clearly constrained fallback otherwise. Writing analysis is deterministic: sentence length, a small jargon lexicon, passive-voice pattern, filler-phrase pattern, and repetition detection.

An inaccessible URL remains a visible original link with an extraction warning; invalid URL schemes are treated as pasted text. Network and API failures are returned as explicit errors. The model is instructed not to invent claims, but an editor must still verify claims against the linked original.

With another day, I would add schema validation for model output, claim-level source spans, persisted projects, retry/backoff policies, and automated browser tests.

## Editorial judgment

Clear writing gives the reader the key change early, supplies enough context to interpret it, and makes the practical consequence concrete. A genuinely useful writing assistant should improve comprehension in a human review, not merely lower a readability score.

The tool should not automatically remove technical terms that carry meaning, rewrite a writer’s point of view, change claims, or optimize every sentence toward the same short rhythm. Accuracy, nuance, and author intent outrank a numerical score.
