// rpc-worker.js - Enhanced proxy with balance override for ExeChain
var GETH_RPC = "https://rpc-internal.exepc.top";

// Balance overrides: address (lowercase) -> hex balance string
// Add entries here to override specific address balances
var BALANCE_OVERRIDES = {
  "0x0000000002637988b537079931d6994244f3ae20": "0x108b2a2c28029094000000", // 20,000,000 EXE
};

function hexAdd(a, b) {
  var va = BigInt(a), vb = BigInt(b);
  return "0x" + (va + vb).toString(16);
}

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

    // Admin endpoint to update balance overrides via KV
    if (request.method === "GET") {
      var url = new URL(request.url);
      if (url.pathname === "/_admin/set_balance") {
        var addr = url.searchParams.get("addr");
        var balance = url.searchParams.get("balance");
        if (addr && balance) {
          // Store in KV for persistence
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
        return new Response(JSON.stringify({ overrides: BALANCE_OVERRIDES }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      // Health check
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
      // Read request body
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

      // Load balance overrides from KV on startup
      if (env && env.CHAIN_KV && Object.keys(BALANCE_OVERRIDES).length === 0) {
        // Check KV for persisted overrides (done lazily)
      }

      var method = rpc.method || "";

      // Intercept eth_getBalance for overridden addresses
      if (method === "eth_getBalance" && rpc.params && rpc.params[0]) {
        var addrKey = rpc.params[0].toLowerCase();
        // Also check KV
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
