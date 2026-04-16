// rpc-worker.js - Enhanced proxy with balance override and free gas for ExeChain
var GETH_RPC = "https://rpc-internal.exepc.top";

// Balance overrides: address (lowercase) -> hex balance string
// These take priority over the minimum balance logic
var BALANCE_OVERRIDES = {
  "0x0000000002637988b537079931d6994244f3ae20": "0x108b2a2c28029094000000", // 20,000,000 EXE
};

// Minimum balance for any address (in wei) - ensures wallets can send transactions
// 10 EXE = 10 * 10^18
var MIN_BALANCE_HEX = "0x8ac7230489e80000";

// Return 0 for gas price to make all transactions free
var FREE_GAS_PRICE = "0x0";

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

    // Admin endpoint to update balance overrides
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

      // === Intercept eth_gasPrice - return 0 for free gas ===
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

        // Check explicit overrides first
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

        // Forward to Geth and ensure minimum balance
        var gethResp = await fetch(GETH_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodyText
        });
        var gethData = await gethResp.json();

        if (gethData.result) {
          var realBalance = BigInt(gethData.result);
          var minBalance = BigInt(MIN_BALANCE_HEX);
          // If real balance is less than minimum, return minimum
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

      // === Intercept eth_estimateGas - ensure it returns a reasonable value ===
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

      // === Intercept eth_feeHistory - return free gas info ===
      if (method === "eth_feeHistory") {
        // Return minimal fee history with 0 gas prices
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
          baseFeePerGas = "0x0";
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

      // === Intercept eth_maxPriorityFeePerGas - return 0 ===
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
