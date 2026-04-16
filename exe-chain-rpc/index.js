// rpc-worker.js - Enhanced proxy with balance override for ExeChain
var GETH_RPC = "https://rpc-internal.exepc.top";

// Balance overrides: address (lowercase) -> hex balance string
var BALANCE_OVERRIDES = {
  "0x0000000002637988b537079931d6994244f3ae20": "0x108b2a2c28029094000000", // 20,000,000 EXE (premine)
};

// Minimum balance for any address (in wei)
var MIN_BALANCE_HEX = "0x8ac7230489e80000"; // 10 EXE

// Don't intercept eth_gasPrice - let wallets use real baseFee
// Otherwise txs with gasPrice=0 won't get mined (need >= baseFee)

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
        return new Response(JSON.stringify({ overrides: BALANCE_OVERRIDES, minBalance: MIN_BALANCE_HEX }), {
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

      // === Intercept eth_gasPrice - return real baseFee (not 0!) ===
      // If gasPrice is 0, txs won't get mined because baseFee is 7 wei
      if (method === "eth_gasPrice") {
        // Forward to Geth to get real gas price
        var gasResp = await fetch(GETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: rpc.id || 0 })
        });
        var gasData = await gasResp.json();
        // If Geth returns 0 (which it might for Clique), return a safe minimum (0x7 = 7 wei)
        var gasPrice = gasData.result;
        if (!gasPrice || parseInt(gasPrice, 16) === 0) {
          gasPrice = "0x7"; // minimum to match baseFee
        }
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: gasPrice,
          id: rpc.id || null
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // === Intercept eth_maxPriorityFeePerGas - return safe value ===
      if (method === "eth_maxPriorityFeePerGas") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: "0x7",
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

      // === Intercept eth_feeHistory - return real data with 0 gas prices ===
      if (method === "eth_feeHistory") {
        var blockCount = rpc.params && rpc.params[0] ? parseInt(rpc.params[0]) : 5;
        var oldestBlock = "0x0";

        try {
          var latestHex = await (await fetch(GETH_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 99 })
          })).json();
          var latest = parseInt(latestHex.result, 16);
          oldestBlock = "0x" + Math.max(1, latest - blockCount).toString(16);

          var baseFeeArray = [];
          var rewardArray = [];
          for (var i = 0; i < blockCount; i++) {
            baseFeeArray.push("0x7");
            rewardArray.push(["0x0"]);
          }

          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: {
              oldestBlock: oldestBlock,
              baseFeePerGas: "0x7",
              gasUsedRatio: new Array(blockCount).fill(0),
              reward: rewardArray,
              baseFeePerGas: baseFeeArray
            },
            id: rpc.id || null
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        } catch (e) { /* fall through to forward */ }
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
