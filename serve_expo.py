#!/usr/bin/env python3
import http.server
import socketserver
import os
import webbrowser
import sys

PORT = 8082
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)
        
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 65)
        print("   G-VAULT 2026 NEWEST REACT NATIVE WEB (LOCALHOST:8082)")
        print("=" * 65)
        print(f"[*] Serving newest build from: {DIST_DIR}")
        print(f"[*] URL: {url}")
        print("=" * 65)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)

if __name__ == "__main__":
    main()
