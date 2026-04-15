---
Task ID: 1
Agent: Main Agent
Task: 搭建真实以太坊分叉链 (Exe Chain) 并部署到 Cloudflare

Work Log:
- 安装 Geth v1.13.15 (支持 Clique PoA 共识)
- 创建 Exe Chain genesis.json (Chain ID 8848, EIP-1559, Clique PoA 5s 出块)
- 创建两个钱包账户:
  - Wallet1: 0x66C9C776594Cc852D14909024335787D11B0b56d (signer/miner)
  - Wallet2: 0xed4551a043371C3a6762D532D3802418B8F3c72b
- 两个钱包各预分配 100 EXE
- 启动 Geth 节点并验证挖矿正常 (5秒一个块)
- 通过 Python 脚本执行真实转账测试: 1 EXE W1->W2 成功到账
- 创建 Cloudflare Tunnel 暴露 Geth RPC (rpc-internal.exepc.top)
- 将 RPC Worker 从模拟模式改为反向代理到真实 Geth 节点
- 部署 RPC Worker 到 rpc.exepc.top
- 部署 Explorer 前端到 Cloudflare Pages
- 降低 Cloudflare WAF 安全级别以允许 RPC 访问

Stage Summary:
- 真实 Geth 节点运行中，持续挖矿
- Cloudflare Tunnel 连接正常
- RPC Worker (rpc.exepc.top) 反向代理到真实链
- Explorer 前端已部署
- 双钱包转账已验证通过
- 注意: Geth 进程可能需要手动重启 (运行 chain-manager.py)
