const sampleDraft = `AI agents are becoming increasingly prevalent in the modern software development ecosystem, and this is a development that founders should be paying attention to.

The new generation of coding tools can autonomously execute multi-step tasks, which means that developers are able to delegate work that was previously performed manually. This is a significant development because it could potentially enable small teams to achieve more.

However, it is important to note that these tools are not a replacement for human judgment. The opportunity is not just about making code faster, but about changing how teams decide what is worth building.`;

const sources = [
  { value: "https://www.anthropic.com/news/claude-3-7-sonnet", placeholder: "Paste a source URL or article text..." },
  { value: "https://github.blog/news-insights/product-news/github-copilot-agent-mode/", placeholder: "Paste a source URL or article text..." },
  { value: "https://openai.com/index/introducing-o3-mini/", placeholder: "Paste a source URL or article text..." }
];
const sourceList = document.querySelector("#sourceList");
const briefOutput = document.querySelector("#brief");
const draftInput = document.querySelector("#draftInput");
const feedbackList = document.querySelector("#feedbackList");
const revisionBar = document.querySelector("#revisionBar");
const dashboardStatus = document.querySelector("#dashboardStatus");
const newsletterOutput = document.querySelector("#newsletterOutput");
const comparison = document.querySelector("#comparison");
let originalDraft = "";
let latestBrief = null;

function renderSources() {
  sourceList.innerHTML = sources.map((source, index) => `
    <div class="source-row">
      <span class="source-number">${String(index + 1).padStart(2, "0")}</span>
      <input data-source="${index}" value="${escapeHtml(source.value)}" placeholder="${source.placeholder}" aria-label="Source ${index + 1}">
      ${index > 2 ? `<button class="remove-source" data-remove="${index}" aria-label="Remove source">×</button>` : ""}
    </div>`).join("");
  sourceList.querySelectorAll("input").forEach(input => input.addEventListener("input", event => {
    sources[Number(event.target.dataset.source)].value = event.target.value;
  }));
  sourceList.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
    sources.splice(Number(button.dataset.remove), 1); renderSources();
  }));
}
function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]); }
function sourceName(value) {
  try { return new URL(value).hostname.replace("www.", ""); } catch { return "pasted source"; }
}
async function generateBrief() {
  const active = sources.filter(source => source.value.trim());
  if (active.length < 3) { alert("Add at least three sources before generating a brief."); return; }
  dashboardStatus.textContent = "Researching…";
  const button = document.querySelector("#generateBtn");
  button.disabled = true;
  button.firstChild.textContent = "Extracting sources… ";
  try {
    const response = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sources: active.map(source => source.value) }) });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`The deployment returned HTTP ${response.status} instead of JSON. Check that the latest api files were pushed to Vercel.`); }
    if (!response.ok) throw new Error(data.error || "Research request failed.");
    latestBrief = data;
    renderBrief(data);
    dashboardStatus.textContent = "Brief ready";
  } catch (error) {
    dashboardStatus.textContent = "Research failed";
    alert(`${error.message} Start the app with server.py, or check the URL and try again.`);
  } finally {
    button.disabled = false;
    button.firstChild.textContent = "Generate research brief ";
  }
}
function renderBrief(data) {
  briefOutput.classList.remove("hidden");
  briefOutput.innerHTML = `<div class="brief-header"><h3>Research brief</h3><span class="fact-label">${escapeHtml(data.mode || "SOURCE-FIRST")} / ${data.sources.length} SIGNALS</span></div>
    <div class="brief-grid">${data.sources.map((source, index) => `<article class="brief-card"><h4>Signal ${String(index + 1).padStart(2, "0")} · ${escapeHtml(source.title || sourceName(source.input))}</h4><p><strong>What happened:</strong> ${escapeHtml(source.summary)}</p><p><strong>Verifiable facts:</strong> ${escapeHtml(source.facts.join(" "))}</p><p><strong>Why it matters:</strong> ${escapeHtml(source.importance)}</p>${source.warning ? `<p class="source-warning"><strong>Review:</strong> ${escapeHtml(source.warning)}</p>` : ""}<a class="source-link" href="${safeUrl(source.input)}" target="_blank" rel="noreferrer">${escapeHtml(source.input)}</a></article>`).join("")}
      <article class="brief-card angle-card"><h4>Potential newsletter angle</h4><p><strong>${escapeHtml(data.angle)}</strong></p><p><strong>Editorial check:</strong> Facts come from the extracted source cards. The angle and implications are analysis; verify each concrete claim against the original link before publishing.</p><button class="secondary-button" id="newsletterBtn">Generate newsletter draft <span>→</span></button></article></div>`;
  document.querySelector("#newsletterBtn").addEventListener("click", generateNewsletter);
  briefOutput.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
async function generateNewsletter() {
  if (!latestBrief) return;
  const button = document.querySelector("#newsletterBtn");
  button.disabled = true; button.firstChild.textContent = "Writing… ";
  try {
    const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: latestBrief }) });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error(`The deployment returned HTTP ${response.status} instead of JSON. Check that the latest api files were pushed to Vercel.`); }
    if (!response.ok) throw new Error(data.error || "Newsletter request failed.");
    newsletterOutput.classList.remove("hidden");
    newsletterOutput.innerHTML = `<div class="brief-header"><h3>${escapeHtml(data.headline)}</h3><span class="fact-label">${data.word_count} WORDS</span></div><p class="newsletter-copy">${escapeHtml(data.body).replace(/\n\n/g, "</p><p>")}</p><div class="source-links"><strong>Sources:</strong> ${latestBrief.sources.map(source => `<a class="source-link" href="${safeUrl(source.input)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || sourceName(source.input))}</a>`).join(" · ")}</div><button class="secondary-button" id="useNewsletterBtn">Open in newsletter editor <span>→</span></button>`;
    document.querySelector("#useNewsletterBtn").addEventListener("click", () => { draftInput.value = `${data.headline}\n\n${data.body}`; analyzeDraft(); document.querySelector("#editor").scrollIntoView({ behavior: "smooth" }); });
  } catch (error) { alert(error.message); } finally { button.disabled = false; button.firstChild.textContent = "Generate newsletter draft "; }
}
function safeUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : "#"; } catch { return "#"; } }
function getMetrics(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const average = sentences.length ? Math.round(words / sentences.length) : 0;
  const syllables = Math.max(words * 1.45, 1);
  const grade = sentences.length && words ? Math.max(1, Math.round(0.39 * (words / sentences.length) + 11.8 * (syllables / words) - 15.59)) : 0;
  return { words, sentences, average, grade, time: Math.max(1, Math.ceil(words / 220)) };
}
function analyzeDraft() {
  const text = draftInput.value.trim();
  if (!text) { alert("Paste or write a draft first."); return; }
  originalDraft = text;
  const metrics = getMetrics(text);
  dashboardStatus.textContent = "Draft in review";
  document.querySelector("#metrics").innerHTML = `<div><strong>${metrics.words}</strong><span>WORDS</span></div><div><strong>${metrics.time}m</strong><span>READING TIME</span></div><div><strong>${metrics.average}</strong><span>AVG SENTENCE</span></div><div><strong>${metrics.grade}</strong><span>GRADE LEVEL</span></div>`;
  const issues = [];
  metrics.sentences.forEach(sentence => {
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount > 25) issues.push({ type: "Long sentence", quote: sentence, explanation: `At ${wordCount} words, this sentence asks the reader to hold too many ideas at once. Consider splitting it at the turn in thought.`, suggestion: sentence.replace(/\s+(and|which|because|but)\s+/i, ". $1 ").replace(/^./, c => c.toUpperCase()) });
  });
  const jargon = ["ecosystem", "autonomously", "prevalent", "leverage", "utilize", "paradigm"];
  jargon.forEach(word => { const match = text.match(new RegExp(`\\b[^.!?]*\\b${word}\\b[^.!?]*`, "i")); if (match) issues.push({ type: "Jargon check", quote: match[0].trim(), explanation: `“${word}” may be familiar to specialists but vague to a broader operator audience. Prefer a concrete description or define it once.`, suggestion: `Try replacing “${word}” with a specific example of what changes.` }); });
  const passive = text.match(/\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b/i);
  if (passive) issues.push({ type: "Active voice", quote: passive[0], explanation: "This construction hides who is doing the work. Naming the actor usually makes the claim more direct.", suggestion: "Name the team, tool, or person taking the action." });
  const filler = text.match(/\b(it is important to note that|in order to|very|really|currently)\b[^.!?]*/i);
  if (filler) issues.push({ type: "Filler phrase", quote: filler[0].trim(), explanation: "This phrase delays the idea without adding evidence or meaning.", suggestion: "Start with the claim itself, then support it." });
  const words = text.toLowerCase().match(/\b[a-z]{5,}\b/g) || [];
  const counts = words.reduce((result, word) => { result[word] = (result[word] || 0) + 1; return result; }, {});
  Object.entries(counts).filter(([, count]) => count >= 3).slice(0, 3).forEach(([word, count]) => issues.push({ type: "Repetition", quote: `“${word}” appears ${count} times`, explanation: `Repeated use of “${word}” may make the draft feel circular. Keep it where it carries meaning and vary or remove the rest.`, suggestion: `Review the ${count} uses of “${word}” and keep only the strongest.` }));
  if (!issues.length) issues.push({ type: "Editorial pass", quote: "No rule-based issues found.", explanation: "The draft is clear against the checks in this prototype. Keep reviewing for accuracy, voice, and whether every claim earns its place.", suggestion: "No automatic rewrite recommended." });
  feedbackList.innerHTML = issues.map((issue, index) => `<article class="feedback-card" data-issue="${index}"><div class="feedback-top"><span class="feedback-type">${issue.type}</span><span class="feedback-type">${index + 1}/${issues.length}</span></div><p class="quote">“${escapeHtml(issue.quote)}”</p><p>${escapeHtml(issue.explanation)}</p><p class="suggestion"><strong>Suggestion:</strong> ${escapeHtml(issue.suggestion)}</p><div class="feedback-actions"><button data-accept="${index}">Accept suggestion</button><button class="dismiss" data-dismiss="${index}">Keep original</button></div></article>`).join("");
  feedbackList.querySelectorAll("[data-accept]").forEach(button => button.addEventListener("click", () => {
    const card = button.closest(".feedback-card"); const suggestion = card.querySelector(".suggestion").textContent.replace("Suggestion: ", "").trim();
    if (!suggestion.startsWith("No automatic") && !suggestion.startsWith("Review the")) { draftInput.value = draftInput.value.replace(card.querySelector(".quote").textContent.slice(1, -1), suggestion); }
    card.remove(); revisionBar.classList.remove("hidden"); revisionBar.textContent = "Suggestion accepted. The original remains preserved below.";
    comparison.classList.remove("hidden");
    comparison.innerHTML = `<div class="comparison-heading"><strong>Before and after</strong><button id="resetDraft" class="sample-button">Restore original</button></div><div class="comparison-grid"><div><span>ORIGINAL</span><p>${escapeHtml(originalDraft)}</p></div><div><span>REVISED</span><p>${escapeHtml(draftInput.value)}</p></div></div>`;
    document.querySelector("#resetDraft").addEventListener("click", () => { draftInput.value = originalDraft; comparison.classList.add("hidden"); });
  }));
  feedbackList.querySelectorAll("[data-dismiss]").forEach(button => button.addEventListener("click", () => { button.closest(".feedback-card").remove(); }));
}
document.querySelector("#addSourceBtn").addEventListener("click", () => { sources.push({ value: "", placeholder: "Paste a source URL or article text..." }); renderSources(); sourceList.lastElementChild.querySelector("input").focus(); });
document.querySelector("#generateBtn").addEventListener("click", generateBrief);
document.querySelector("#sampleBtn").addEventListener("click", () => { draftInput.value = sampleDraft; analyzeDraft(); });
document.querySelector("#analyzeBtn").addEventListener("click", analyzeDraft);
renderSources();
