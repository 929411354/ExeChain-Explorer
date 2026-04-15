#!/bin/bash
# Check if Geth and tunnel are running, restart if needed
LOGDIR="/home/z/my-project/exe-chain-explorer/geth-data"

# Check geth
if ! pgrep -f "geth.*datadir" > /dev/null 2>&1; then
  echo "$(date): Geth not running, restarting..." >> "$LOGDIR/daemon.log"
  setsid nohup bash /home/z/my-project/exe-chain-explorer/start-chain.sh > /dev/null 2>&1 &
  disown
  exit 0
fi

# Check tunnel
if ! pgrep -f cloudflared > /dev/null 2>&1; then
  echo "$(date): Tunnel not running, restarting..." >> "$LOGDIR/daemon.log"
  /usr/local/bin/cloudflared tunnel --no-autoupdate run \
    --token "eyJhIjoiMTZkMTgwYjgxNzliMGVkMTRmMTFkZTIxMmM1YjlmNzEiLCJ0IjoiZjdmYTdlYmQtZDgxZi00ODQwLWI4ODItZWRlZDI5NjIyMjUwIiwicyI6ImF1dG8ifQ==" \
    >> "$LOGDIR/tunnel.log" 2>&1 &
  disown
fi

echo "$(date): OK" >> "$LOGDIR/daemon.log"
