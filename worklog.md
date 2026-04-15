---
Task ID: 1
Agent: Main Agent
Task: 修复 MetaMask 钱包转账功能

Work Log:
- 读取当前 RPC Worker 和前端代码，了解最新状态
- 验证 keccak256 实现正确性（通过标准测试向量验证，包括空输入、'abc'、实际交易数据）
- 用 ethers.js 完整模拟 MetaMask 转账流程（eth_chainId → eth_getBalance → eth_feeHistory → eth_estimateGas → eth_sendRawTransaction → eth_getTransactionReceipt）
- **定位根本原因**：Receipt 中的 `from` 地址与发送者不匹配。原实现用 `keccak256(r+s)` 推导 from 地址，这是完全错误的。
- 需要实现 ECDSA secp256k1 公钥恢复
- 首次尝试使用 `elliptic` npm 库，部署后发现 Cloudflare Workers 中的 `Buffer` 兼容性问题导致恢复结果不正确
- **最终方案**：用纯 BigInt 实现完整的 secp256k1 椭圆曲线运算，包括：
  - modPow、modInv（费马小定理）
  - 椭圆曲线点加法、点倍乘
  - ECDSA 公钥恢复：Q = r^(-1)(sR - eG)
  - 从公钥推导以太坊地址：keccak256(x||y)[-20:]
- 部署到 Cloudflare Workers（移除 nodejs_compat 依赖）
- 端到端测试通过：from 地址正确匹配，nonce 正确递增

Stage Summary:
- 根本原因：`eth_sendRawTransaction` 返回的 receipt 中 `from` 地址是错误的（用 keccak256(r+s) 推导而非 ECDSA 恢复）
- 修复方案：纯 BigInt secp256k1 ECDSA 公钥恢复
- 部署状态：已部署到 rpc.exepc.top
- 测试结果：MetaMask 转账 from 地址正确匹配，交易成功确认
- 文件变更：`/home/z/my-project/exe-chain-rpc/index.js`（新增 ~80 行 BigInt EC 代码，替换 elliptic 导入）
