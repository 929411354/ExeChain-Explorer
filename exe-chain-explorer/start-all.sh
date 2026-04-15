#!/bin/bash
# Exe Chain Master Startup Script
# Starts both Geth and Cloudflare Tunnel

GETH_DIR="/home/z/my-project/exe-chain-explorer/geth-data"
GETH_LOG="$GETH_DIR/geth.log"
TUNNEL_LOG="$GETH_DIR/tunnel.log"
TUNNEL_TOKEN="eyJhIjoiMTZkMTgwYjgxNzliMGVkMTRmMTFkZTIxMmM1YjlmNzEiLCJ0IjoiZjdmYTdlYmQtZDgxZi00ODQwLWI4ODItZWRlZDI5NjIyMjUwIiwicyI6ImF1dG8ifQ=="

start_geth() {
  echo "$(date): Starting Geth..." >> "$GETH_LOG"
  /usr/local/bin/geth \
    --datadir "$GETH_DIR" \
    --networkid 8848 \
    --syncmode full \
    --snapshot=false \
    --http \
    --http.addr 0.0.0.0 \
    --http.port 8545 \
    --http.api eth,net,web3,clique,txpool \
    --http.corsdomain "*" \
    --http.vhosts "*" \
    --mine \
    --miner.etherbase 0x66C9C776594Cc852D14909024335787D11B0b56d \
    --unlock "0x66C9C776594Cc852D14909024335787D11B0b56d" \
    --password /home/z/my-project/exe-chain-explorer/password.txt \
    --allow-insecure-unlock \
    --cache 64 \
    --verbosity 2 \
    --nodiscover \
    >> "$GETH_LOG" 2>&1
  echo "$(date): Geth exited" >> "$GETH_LOG"
}

start_tunnel() {
  echo "$(date): Starting tunnel..." >> "$TUNNEL_LOG"
  /usr/local/bin/cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" \
    >> "$TUNNEL_LOG" 2>&1
  echo "$(date): Tunnel exited" >> "$TUNNEL_LOG"
}

# Start both
start_tunnel &
TUNNEL_PID=$!

# Wait for Geth, restart if needed
while true; do
  start_geth
  echo "$(date): Geth died, restarting in 3s..." >> "$GETH_LOG"
  sleep 3
done &

wait
