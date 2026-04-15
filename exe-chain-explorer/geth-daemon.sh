#!/bin/bash
# Geth auto-restart daemon
cd /home/z/my-project/exe-chain-explorer
while true; do
  echo "$(date): Starting Geth..." >> geth-data/daemon.log
  /usr/local/bin/geth \
    --datadir /home/z/my-project/exe-chain-explorer/geth-data \
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
    >> geth-data/geth.log 2>&1
  echo "$(date): Geth exited with code $?, restarting in 3s..." >> geth-data/daemon.log
  sleep 3
done
