#!/bin/bash
set -e
echo "=========================================="
echo "  Exe Chain Node Deployment Script"
echo "  Chain ID: 8848 | Token: EXE"
echo "=========================================="

# 1. Download and install Geth v1.13.15
echo "[1/6] Installing Geth..."
apt-get update -qq
apt-get install -y -qq wget curl 2>/dev/null
cd /tmp
wget -q https://gethstore.blob.core.windows.net/builds/geth-linux-amd64-1.13.15-c5ba367e.tar.gz
tar xzf geth-linux-amd64-1.13.15-c5ba367e.tar.gz
cp geth-linux-amd64-*/geth /usr/local/bin/geth
chmod +x /usr/local/bin/geth
geth version

# 2. Create data directory and accounts
echo "[2/6] Initializing chain data..."
mkdir -p /opt/exe-chain
cd /opt/exe-chain

# 3. Create genesis.json
cat > genesis.json << 'GENESIS'
{
  "config": {
    "chainId": 8848,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "muirGlacierBlock": 0,
    "berlinBlock": 0,
    "londonBlock": 0,
    "arrowGlacierBlock": 0,
    "grayGlacierBlock": 0,
    "shanghaiBlock": 0,
    "cancunBlock": 0,
    "clique": { "period": 5, "epoch": 30000 }
  },
  "difficulty": "0x1",
  "gasLimit": "0x1C9C380",
  "extradata": "0x000000000000000000000000000000000000000000000000000000000000000066c9c776594cc852d14909024335787d11b0b56d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "alloc": {
    "0x66C9C776594Cc852D14909024335787D11B0b56d": { "balance": "0x56BC75E2D63100000" },
    "0xed4551a043371C3a6762D532D3802418B8F3c72b": { "balance": "0x56BC75E2D63100000" }
  }
}
GENESIS

# 4. Import accounts
echo "[3/6] Importing wallet accounts..."
echo "exechain2024" > password.txt

geth --datadir /opt/exe-chain account import --password /opt/exe-chain/password.txt << 'PRIVKEY1'
-----BEGIN PRIVATE KEY-----
placeholder
-----END PRIVATE KEY-----
PRIVKEY1

# 5. Initialize and create systemd service
echo "[4/6] Initializing genesis block..."
geth --datadir /opt/exe-chain init /opt/exe-chain/genesis.json

echo "[5/6] Creating systemd service..."
cat > /etc/systemd/system/exe-chain.service << 'SERVICE'
[Unit]
Description=Exe Chain Geth Node
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/geth \
  --datadir /opt/exe-chain \
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
  --password /opt/exe-chain/password.txt \
  --allow-insecure-unlock \
  --cache 256 \
  --verbosity 3 \
  --nodiscover
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable exe-chain
systemctl start exe-chain
sleep 5

# 6. Install cloudflared tunnel
echo "[6/6] Installing Cloudflare Tunnel..."
curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo "Geth RPC: http://$(hostname -I | awk '{print $1}'):8545"
systemctl status exe-chain --no-pager | head -5
curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
echo ""
echo "Next: Run cloudflared tunnel to connect to rpc.exepc.top"
