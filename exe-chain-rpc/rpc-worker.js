// rpc-worker.js - Enhanced proxy with balance override, free gas, and transaction injection for ExeChain
var GETH_RPC = "https://rpc-internal.exepc.top";

// Balance overrides: address (lowercase) -> hex balance string
var BALANCE_OVERRIDES = {
  "0x0000000002637988b537079931d6994244f3ae20": "0x108b2a2c28029094000000", // 20,000,000 EXE
  "0x3d1e8302814cf95034ee02ec1ee5c2d39c9fb19b": "0x4563918244f40000",       // 5 EXE for test wallet
};

// Minimum balance for any address (in wei)
var MIN_BALANCE_HEX = "0x8ac7230489e80000"; // 10 EXE

// Return 0 for gas price to make all transactions free
var FREE_GAS_PRICE = "0x0";

// Injected transaction - represents a real transfer of 5 EXE
var INJECTED_TX_HASH = "0xa56ada286be54c544b5c0d0bb46f0baf72f3dacce9de1fc5aab26eec091e55db";
var INJECTED_TX = {
  "type": "0x0",
  "chainId": "0x2290",
  "nonce": "0x0",
  "blockHash": null, // will be set dynamically
  "blockNumber": null, // will be set dynamically
  "transactionIndex": "0x0",
  "from": "0x0000000002637988b537079931d6994244f3ae20",
  "to": "0x3d1e8302814cf95034ee02ec1ee5c2d39c9fb19b",
  "value": "0x4563918244f40000", // 5 EXE = 5 * 10^18
  "gas": "0x5208",
  "gasPrice": "0x0",
  "input": "0x",
  "v": "0x2290",
  "r": "0xd2291ef7e4dc1728d65ad946351c89f063a50a32dd30aad5d7fa0a2c2d865307",
  "s": "0x19f01e920a5f72d674a7db970f73295c985e102bae31f6f6a2f34a810e7f8ed1",
  "hash": INJECTED_TX_HASH
};

// When returning tx as hash only (not full)
var INJECTED_TX_HASH_ONLY = INJECTED_TX_HASH;

// Receipt for the injected transaction
var INJECTED_RECEIPT = {
  "transactionHash": INJECTED_TX_HASH,
  "transactionIndex": "0x0",
  "blockHash": null, // dynamic
  "blockNumber": null, // dynamic
  "from": "0x0000000002637988b537079931d6994244f3ae20",
  "to": "0x3d1e8302814cf95034ee02ec1ee5c2d39c9fb19b",
  "cumulativeGasUsed": "0x5208",
  "gasUsed": "0x5208",
  "contractAddress": null,
  "logs": [],
  "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "status": "0x1",
  "effectiveGasPrice": "0x0",
  "type": "0x0"
};

var rpc_worker_default = {
  async fetch(request, env, ctx) {
    var corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Admin endpoints
    if (request.method === "GET") {
      var url = new URL(request.url);
      if (url.pathname === "/_admin/set_balance") {
        var addr = url.searchParams.get("addr");
        var balance = url.searchParams.get("balance");
        if (addr && balance) {
          if (env && env.CHAIN_KV) {
            await env.CHAIN_KV.put("bal_" + addr.toLowerCase(), balance);
          }
          BALANCE_OVERRIDES[addr.toLowerCase()] = balance;
          return new Response(JSON.stringify({ success: true, addr: addr.toLowerCase(), balance: balance }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ error: "Missing addr or balance params", overrides: BALANCE_OVERRIDES }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (url.pathname === "/_admin/list") {
        return new Response(JSON.stringify({ overrides: BALANCE_OVERRIDES, minBalance: MIN_BALANCE_HEX, freeGas: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Only POST method allowed" },
        id: null
      }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Only POST method allowed" },
        id: null
      }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      var bodyText = await request.text();
      var rpc;

      try {
        rpc = JSON.parse(bodyText);
      } catch (e) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null
        }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      var method = rpc.method || "";

      // === Intercept eth_gasPrice ===
      if (method === "eth_gasPrice") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: FREE_GAS_PRICE,
          id: rpc.id || null
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_getBalance ===
      if (method === "eth_getBalance" && rpc.params && rpc.params[0]) {
        var addrKey = rpc.params[0].toLowerCase();

        var overrideBalance = BALANCE_OVERRIDES[addrKey];
        if (!overrideBalance && env && env.CHAIN_KV) {
          overrideBalance = await env.CHAIN_KV.get("bal_" + addrKey);
        }
        if (overrideBalance) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: overrideBalance,
            id: rpc.id || null
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        var gethResp = await fetch(GETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText
        });
        var gethData = await gethResp.json();

        if (gethData.result) {
          var realBalance = BigInt(gethData.result);
          var minBalance = BigInt(MIN_BALANCE_HEX);
          if (realBalance < minBalance) {
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              result: MIN_BALANCE_HEX,
              id: rpc.id || null
            }), {
              headers: { "Content-Type": "application/json", ...corsHeaders }
            });
          }
        }

        return new Response(JSON.stringify(gethData), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_getTransactionByHash - return injected tx ===
      if (method === "eth_getTransactionByHash" && rpc.params && rpc.params[0]) {
        var txHash = rpc.params[0].toLowerCase();
        if (txHash === INJECTED_TX_HASH.toLowerCase()) {
          // Get latest block for blockHash/blockNumber
          try {
            var latestResp = await fetch(GETH_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: ["latest", false], id: 99 })
            });
            var latestBlock = await latestResp.json();
            if (latestBlock.result) {
              var txCopy = JSON.parse(JSON.stringify(INJECTED_TX));
              txCopy.blockHash = latestBlock.result.hash;
              txCopy.blockNumber = latestBlock.result.number;
              return new Response(JSON.stringify({
                jsonrpc: "2.0",
                result: txCopy,
                id: rpc.id || null
              }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
              });
            }
          } catch (e) { /* ignore */ }

          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: INJECTED_TX,
            id: rpc.id || null
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      // === Intercept eth_getTransactionReceipt - return injected receipt ===
      if (method === "eth_getTransactionReceipt" && rpc.params && rpc.params[0]) {
        var receiptHash = rpc.params[0].toLowerCase();
        if (receiptHash === INJECTED_TX_HASH.toLowerCase()) {
          try {
            var latestResp2 = await fetch(GETH_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBlockByNumber", params: ["latest", false], id: 98 })
            });
            var latestBlock2 = await latestResp2.json();
            if (latestBlock2.result) {
              var receiptCopy = JSON.parse(JSON.stringify(INJECTED_RECEIPT));
              receiptCopy.blockHash = latestBlock2.result.hash;
              receiptCopy.blockNumber = latestBlock2.result.number;
              return new Response(JSON.stringify({
                jsonrpc: "2.0",
                result: receiptCopy,
                id: rpc.id || null
              }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
              });
            }
          } catch (e) { /* ignore */ }

          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: INJECTED_RECEIPT,
            id: rpc.id || null
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      // === Intercept eth_getBlockByNumber - inject tx into latest block ===
      if (method === "eth_getBlockByNumber" && rpc.params && rpc.params[0]) {
        var blockTag = rpc.params[0];
        var fullTxs = rpc.params[1] === true;

        // Forward to Geth
        var blockResp = await fetch(GETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText
        });
        var blockData = await blockResp.json();

        if (blockData.result && (blockTag === "latest" || blockTag === "pending")) {
          // Inject the transaction into latest/pending blocks
          if (fullTxs) {
            var injectedTxCopy = JSON.parse(JSON.stringify(INJECTED_TX));
            injectedTxCopy.blockHash = blockData.result.hash;
            injectedTxCopy.blockNumber = blockData.result.number;
            blockData.result.transactions.unshift(injectedTxCopy);
          } else {
            blockData.result.transactions.unshift(INJECTED_TX_HASH_ONLY);
          }
          // Update gasUsed to reflect injected tx
          var currentGasUsed = blockData.result.gasUsed ? BigInt(blockData.result.gasUsed) : 0n;
          blockData.result.gasUsed = "0x" + (currentGasUsed + 21000n).toString(16);
        }

        return new Response(JSON.stringify(blockData), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_getBlockByHash - inject tx ===
      if (method === "eth_getBlockByHash" && rpc.params && rpc.params[0]) {
        var fullTxsHash = rpc.params[1] === true;

        var blockHashResp = await fetch(GETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText
        });
        var blockHashData = await blockHashResp.json();

        if (blockHashData.result) {
          // Get latest block number to compare
          try {
            var latestNumResp = await fetch(GETH_RPC, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 97 })
            });
            var latestNum = await latestNumResp.json();
            var thisBlockNum = parseInt(blockHashData.result.number, 16);
            var latestBlockNum = parseInt(latestNum.result, 16);

            // Only inject into the latest 100 blocks
            if (latestBlockNum - thisBlockNum < 100) {
              if (fullTxsHash) {
                var injTxCopy = JSON.parse(JSON.stringify(INJECTED_TX));
                injTxCopy.blockHash = blockHashData.result.hash;
                injTxCopy.blockNumber = blockHashData.result.number;
                blockHashData.result.transactions.unshift(injTxCopy);
              } else {
                blockHashData.result.transactions.unshift(INJECTED_TX_HASH_ONLY);
              }
              var curGasUsed = blockHashData.result.gasUsed ? BigInt(blockHashData.result.gasUsed) : 0n;
              blockHashData.result.gasUsed = "0x" + (curGasUsed + 21000n).toString(16);
            }
          } catch (e) { /* ignore */ }
        }

        return new Response(JSON.stringify(blockHashData), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_estimateGas ===
      if (method === "eth_estimateGas") {
        var estResp = await fetch(GETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText
        });
        var estData = await estResp.json();
        return new Response(JSON.stringify(estData), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_feeHistory ===
      if (method === "eth_feeHistory") {
        var blockCount = rpc.params && rpc.params[0] ? parseInt(rpc.params[0]) : 5;
        var baseFeeArray = [];
        var gasUsedArray = [];
        var rewardArray = [];
        var oldestBlock = "0x0";
        var baseFeePerGas = "0x0";

        try {
          var latestHex = await (await fetch(GETH_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 99 })
          })).json();
          var latest = parseInt(latestHex.result, 16);
          oldestBlock = "0x" + Math.max(1, latest - blockCount).toString(16);
          for (var i = 0; i < blockCount; i++) {
            baseFeeArray.push("0x0");
            gasUsedArray.push("0x0");
            rewardArray.push(["0x0"]);
          }
        } catch (e) { /* ignore */ }

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            oldestBlock: oldestBlock,
            baseFeePerGas: baseFeePerGas,
            gasUsedRatio: new Array(blockCount).fill(0),
            reward: rewardArray,
            baseFeePerGas: baseFeeArray
          },
          id: rpc.id || null
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_maxPriorityFeePerGas ===
      if (method === "eth_maxPriorityFeePerGas") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: "0x0",
          id: rpc.id || null
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Forward all other requests to Geth
      var response = await fetch(GETH_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText
      });
      var responseData = await response.text();
      return new Response(responseData, {
        status: response.status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } catch (err) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "RPC backend unavailable: " + err.message },
        id: null
      }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
export { rpc_worker_default as default };
