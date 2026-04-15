#!/usr/bin/env python3
"""Exe Chain Node Manager - keeps Geth and cloudflared tunnel alive"""
import subprocess, time, os, signal, sys

GETH_CMD = [
    "/usr/local/bin/geth",
    "--datadir", "/home/z/my-project/exe-chain-explorer/geth-data",
    "--networkid", "8848",
    "--syncmode", "full",
    "--snapshot=false",
    "--http", "--http.addr", "0.0.0.0", "--http.port", "8545",
    "--http.api", "eth,net,web3,clique,txpool",
    "--http.corsdomain", "*", "--http.vhosts", "*",
    "--mine",
    "--miner.etherbase", "0x66C9C776594Cc852D14909024335787D11B0b56d",
    "--unlock", "0x66C9C776594Cc852D14909024335787D11B0b56d",
    "--password", "/home/z/my-project/exe-chain-explorer/password.txt",
    "--allow-insecure-unlock",
    "--cache", "64",
    "--verbosity", "2",
    "--nodiscover",
]

TUNNEL_CMD = [
    "/usr/local/bin/cloudflared",
    "tunnel", "--no-autoupdate", "run",
    "--token", "eyJhIjoiMTZkMTgwYjgxNzliMGVkMTRmMTFkZTIxMmM1YjlmNzEiLCJ0IjoiZjdmYTdlYmQtZDgxZi00ODQwLWI4ODItZWRlZDI5NjIyMjUwIiwicyI6ImF1dG8ifQ==",
]

LOG_DIR = "/home/z/my-project/exe-chain-explorer/geth-data"

def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def start_process(name, cmd, log_file):
    log(f"Starting {name}...")
    with open(os.path.join(LOG_DIR, log_file), "a") as f:
        return subprocess.Popen(cmd, stdout=f, stderr=subprocess.STDOUT, 
                                stdin=subprocess.DEVNULL, preexec_fn=os.setpgrp)

def main():
    # Start tunnel
    tunnel = start_process("tunnel", TUNNEL_CMD, "tunnel.log")
    log(f"Tunnel PID: {tunnel.pid}")

    # Start geth with auto-restart
    while True:
        geth = start_process("geth", GETH_CMD, "geth.log")
        log(f"Geth PID: {geth.pid}")
        
        # Wait for geth to exit
        geth.wait()
        log(f"Geth exited with code {geth.returncode}, restarting in 5s...")
        time.sleep(5)

if __name__ == "__main__":
    main()
