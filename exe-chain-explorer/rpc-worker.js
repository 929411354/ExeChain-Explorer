// Exe Chain RPC Worker - Reverse Proxy to Real Geth Node
// Forwards all JSON-RPC requests to the real Geth backend

const GETH_RPC = 'https://rpc-internal.exepc.top';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST for JSON-RPC
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Only POST method allowed' },
        id: null
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // Forward the request to Geth
      const response = await fetch(GETH_RPC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: request.body,
      });

      // Return the response with CORS headers
      const responseData = await response.text();
      return new Response(responseData, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'RPC backend unavailable: ' + err.message },
        id: null
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
