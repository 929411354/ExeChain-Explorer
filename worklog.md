
---
Task ID: 1
Agent: main
Task: 修复不能转账，修复点交易哈希不能到交易界面

Work Log:
- 分析发现 RPC Worker 核心bug: handleRPC 返回 null(交易未找到) 被当作 undefined(方法不存在) 处理，导致返回 "Method not found" 错误
- RPC Worker 不支持 eth_sendTransaction 方法
- 前端使用 navigate() 但无 URL hash 路由支持
- 重写 RPC Worker：区分 null(有效结果) vs undefined(方法不存在)，添加 eth_sendTransaction 支持，扩展支持更多方法
- 修复前端：navigate→navigateTo + URL hash路由 + parseHashRoute + sendTransaction用eth_sendTransaction + showLocalTxDetail避免isolate问题
- 部署 RPC Worker 到 rpc.exepc.top (Version: b96f7d5c)
- 部署前端到 explorer.exepc.top / scan.exepc.top

Stage Summary:
- rpc.exepc.top: 转账功能正常，已有交易查询正常，错误处理正确
- explorer/scan.exepc.top: 交易哈希点击跳转正常，转账后自动跳转交易详情页，URL hash路由支持分享链接
