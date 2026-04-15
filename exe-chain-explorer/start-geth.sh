#!/bin/bash
while true; do
  geth \
    --datadir /home/z/my-project/exe-chain-explorer/geth-data \
    --networkid 8848 \
    --syncmode full \
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
    --nousb \
    2>&1 | tee -a /home/z/my-project/exe-chain-explorer/geth-data/geth.log
  echo "Geth exited, restarting in 2s..."
  sleep 2
done
