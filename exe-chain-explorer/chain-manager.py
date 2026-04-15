#!/usr/bin/env python3
"""Exe Chain Node Manager - keeps Geth and cloudflared tunnel alive"""
import subprocess, time, os, json, urllib.request

LOGDIR = "/home/z/my-project/exe-chain-explorer/geth-data"
TUNNEL_TOKEN = "eyJhIjoiMTZkMTgwYjgxNzliMGVkMTRmMTFkZTIxMmM1YjlmNzEiLCJ0IjoiZjdmYTdlYmQtZDgxZi00ODQwLWI4ODItZWRlZDI5NjIyMjUwIiwicyI6ImF1dG8ifQ=="

def log(msg):
    with open(os.path.join(LOGDIR, "manager.log"), "a") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def start_tunnel():
    log("Starting tunnel...")
    with open(os.path.join(LOGDIR, "tunnel.log"), "a") as f:
        p = subprocess.Popen([
            "/usr/local/bin/cloudflared", "tunnel", "--no-autoupdate", "run",
            "--token", TUNNEL_TOKEN
        ], stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, preexec_fn=os.setpgrp)
    return p

def start_geth():
    log("Starting geth...")
    with open(os.path.join(LOGDIR, "geth.log"), "a") as f:
        p = subprocess.Popen([
            "/usr/local/bin/geth",
            "--datadir", LOGDIR,
            "--networkid", "8848", "--syncmode", "full", "--snapshot=false",
            "--http", "--http.addr", "0.0.0.0", "--http.port", "8545",
            "--http.api", "eth,net,web3,clique,txpool",
            "--http.corsdomain", "*", "--http.vhosts", "*",
            "--mine", "--miner.etherbase", "0x66C9C776594Cc852D14909024335787D11B0b56d",
            "--unlock", "0x66C9C776594Cc852D14909024335787D11B0b56d",
            "--password", "/home/z/my-project/exe-chain-explorer/password.txt",
            "--allow-insecure-unlock", "--cache", "64", "--verbosity", "2", "--nodiscover",
        ], stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, preexec_fn=os.setpgrp)
    return p

# Kill existing
for name in ["cloudflared", "geth"]:
    try:
        subprocess.run(["pkill", "-f", name], capture_output=True, timeout=5)
    except:
        pass
time.sleep(2)

# Start tunnel
tunnel = start_tunnel()
log(f"Tunnel PID: {tunnel.pid}")

# Start geth with auto-restart
while True:
    geth = start_geth()
    log(f"Geth PID: {geth.pid}")
    
    # Wait for geth with timeout to check periodically
    while True:
        try:
            geth.wait(timeout=10)
            break
        except subprocess.TimeoutExpired:
            pass
    
    log(f"Geth exited (code={geth.returncode}), restarting in 5s...")
    time.sleep(5)
