#!/bin/bash
# Exe Chain - Start Geth node + Cloudflare Tunnel

LOGDIR="/home/z/my-project/exe-chain-explorer/geth-data"
PIDFILE="$LOGDIR/chain.pid"

# Start tunnel in background  
/usr/local/bin/cloudflared tunnel --no-autoupdate run \
  --token "eyJhIjoiMTZkMTgwYjgxNzliMGVkMTRmMTFkZTIxMmM1YjlmNzEiLCJ0IjoiZjdmYTdlYmQtZDgxZi00ODQwLWI4ODItZWRlZDI5NjIyMjUwIiwicyI6ImF1dG8ifQ==" \
  >> "$LOGDIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!

# Wait a moment
sleep 2

# Start geth (foreground) - blocks forever
exec /usr/local/bin/geth \
  --datadir "$LOGDIR" \
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
  >> "$LOGDIR/geth.log" 2>&1
