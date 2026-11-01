import json
from http.server import BaseHTTPRequestHandler

from server import research


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            result = research(payload.get("sources", []))
            body = json.dumps(result).encode()
            self.send_response(200)
        except (ValueError, RuntimeError) as error:
            body = json.dumps({"error": str(error)}).encode()
            self.send_response(400)
        except Exception as error:
            body = json.dumps({"error": f"Unexpected server error: {error}"}).encode()
            self.send_response(500)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
