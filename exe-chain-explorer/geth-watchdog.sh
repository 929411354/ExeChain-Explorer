#!/bin/bash
while true; do
  if ! pgrep -f "geth.*datadir.*exe-chain" > /dev/null 2>&1; then
    echo "$(date): Geth not running, starting..." >> /home/z/my-project/exe-chain-explorer/geth-data/daemon.log
    setsid /usr/local/bin/geth \
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
      </dev/null >> /home/z/my-project/exe-chain-explorer/geth-data/geth.log 2>&1 &
    disown
    sleep 8
  fi
  sleep 5
done
