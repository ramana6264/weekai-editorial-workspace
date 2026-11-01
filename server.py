"""Local WeekAI server: source extraction plus optional OpenAI-compatible analysis."""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = []
        self.text = []
        self.skip = 0
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip += 1
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.skip:
            self.skip -= 1
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.skip:
            return
        clean = re.sub(r"\s+", " ", data).strip()
        if not clean:
            return
        if self.in_title:
            self.title.append(clean)
        elif len(clean) > 25:
            self.text.append(clean)


def fetch_source(value):
    value = value.strip()
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        text = re.sub(r"\s+", " ", value)
        return {"input": value, "title": "Pasted source", "text": text[:12000], "warning": ""}
    request = urllib.request.Request(value, headers={"User-Agent": "WeekAI editorial research prototype"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            raw = response.read(1_500_000)
        parser = ArticleParser()
        parser.feed(raw.decode("utf-8", errors="replace"))
        text = " ".join(parser.text)
        if len(text) < 120:
            raise ValueError("The page did not contain enough readable article text.")
        return {"input": value, "title": " ".join(parser.title) or parsed.netloc, "text": text[:12000], "warning": ""}
    except (urllib.error.URLError, TimeoutError, ValueError, UnicodeError) as error:
        return {"input": value, "title": parsed.netloc, "text": "", "warning": f"Could not extract this source: {error}"}


def call_model(instruction, payload):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    body = json.dumps({
        "model": MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps(payload)},
        ],
    }).encode()
    request = urllib.request.Request(
        os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions"),
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode())
        content = result["choices"][0]["message"]["content"]
        return json.loads(content)
    except urllib.error.HTTPError as error:
        if error.code == 429:
            return None
        raise RuntimeError(f"AI request failed: HTTP {error.code}") from error
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, json.JSONDecodeError) as error:
        raise RuntimeError(f"AI request failed: {error}") from error


def fallback_brief(sources):
    cards = []
    for source in sources:
        sentences = re.split(r"(?<=[.!?])\s+", source["text"])
        facts = [sentence for sentence in sentences if len(sentence.split()) > 7][:2]
        cards.append({
            "input": source["input"], "title": source["title"],
            "summary": facts[0] if facts else "No article text was available for this source.",
            "facts": facts or ["No verifiable text was extracted; review the original source manually."],
            "importance": "Assess whether this changes the tools, costs, workflows, or decisions available to founders and builders.",
            "warning": source["warning"],
        })
    return {"mode": "EXTRACTION / REVIEW", "sources": cards, "angle": "Compare the concrete changes across these sources and ask what becomes newly possible for a small team—and what still requires human judgment."}


def research(values):
    if len(values) < 3:
        raise ValueError("At least three sources are required.")
    extracted = [fetch_source(value) for value in values]
    payload = [{"input": item["input"], "title": item["title"], "text": item["text"], "warning": item["warning"]} for item in extracted]
    instruction = """You are an evidence-first newsletter editor. Analyze each source independently and return JSON with exactly:
{"mode":"AI ANALYSIS","sources":[{"input":"","title":"","summary":"","facts":[""],"importance":"","warning":""}],"angle":""}.
Only state a fact when supported by the supplied text. Put interpretation in importance or angle. Keep summaries concise. Preserve every input URL exactly."""
    analyzed = call_model(instruction, payload)
    return analyzed or fallback_brief(extracted)


def newsletter(brief):
    instruction = """Write a 300-500 word newsletter from this evidence-backed brief. Return JSON exactly:
{"headline":"","body":"","word_count":0}.
Include context, what happened, why it matters, and a practical implication. Do not invent claims beyond the brief. The body must be readable prose, not markdown headings."""
    generated = call_model(instruction, brief)
    if generated:
        generated["word_count"] = len(generated.get("body", "").split())
        return generated
    sources = brief.get("sources", [])
    body = ("AI developments are increasingly moving from isolated features to changes in how small teams work. "
            + " ".join(source.get("summary", "") for source in sources[:3]) + " "
            + brief.get("angle", "") + " "
            "The practical question for a founder or builder is not whether to adopt every new tool. "
            "It is which repeatable task can be delegated safely, how much review it needs, and whether the result improves a decision rather than only producing more output. "
            "These signals are worth following because they may change the cost and speed of experimentation, while leaving context, judgment, and accountability with the team. "
            "Start with one low-risk workflow, measure the complete loop, and keep the original sources open while checking every concrete claim. "
            "That last step matters because a fluent system can still misunderstand the goal, miss an edge case, or confidently repeat an unsupported assumption. "
            "A useful adoption process therefore looks less like replacing a person and more like giving a junior collaborator a bounded assignment. "
            "The team defines the outcome, supplies the context, reviews the work, and records where the tool helped or created extra correction. "
            "Over time, those observations reveal which tasks are genuinely repeatable and which depend on product taste, customer knowledge, or operational judgment. "
            "For operators, the opportunity is to make that learning loop explicit before scaling usage across the company. "
            "This is especially important for founders, who often experience the benefit first as time returned to the calendar. "
            "Time is valuable, but it is not the final metric: the returned time should go toward customer conversations, sharper product choices, and decisions the system cannot responsibly make alone. "
            "The best early workflow is visible, reversible, and easy to compare with the old process. "
            "If the experiment produces faster work but weaker understanding, the team has learned something important too.")
    return {"headline": "The next AI advantage is deciding what to delegate", "body": body, "word_count": len(body.split())}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_json(self, status, data):
        raw = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            if self.path == "/api/research":
                self.send_json(200, research(payload.get("sources", [])))
            elif self.path == "/api/newsletter":
                self.send_json(200, newsletter(payload.get("brief", {})))
            else:
                self.send_json(404, {"error": "Unknown API route."})
        except (ValueError, RuntimeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:
            self.send_json(500, {"error": f"Unexpected server error: {error}"})


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"WeekAI running at http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
