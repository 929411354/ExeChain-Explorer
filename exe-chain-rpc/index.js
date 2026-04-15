// Exe Chain RPC Worker - Persistent blockchain simulation on Cloudflare Edge
// Supports: eth_sendRawTransaction, eth_getTransactionByHash, eth_getBlockByNumber, etc.
const CHAIN_ID = 8848;
const GENESIS_TIME = 1712000000000;
const BLOCK_TIME = 3000;

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

if (!globalThis._chainState) {
  const rng = mulberry32(8848);
  const state = { blocks: [], transactions: [], blockNumber: 0, pendingTx: [] };
  function rHex(len) { let s = ""; for (let i = 0; i < len; i++) s += "0123456789abcdef"[Math.floor(rng()*16)]; return s; }
  function rAddr() { return "0x" + rHex(40); }
  function rHash() { return "0x" + rHex(64); }
  const accounts = [];
  for (let i = 0; i < 20; i++) accounts.push(rAddr());
  function createTx(bn) {
    const from = accounts[Math.floor(rng() * accounts.length)];
    const to = accounts[Math.floor(rng() * accounts.length)];
    const val = BigInt(Math.floor(rng() * 100000)) * BigInt(10**15);
    const gas = BigInt(21000 + Math.floor(rng() * 80000));
    const gp = BigInt(1e9 + Math.floor(rng() * 9e9));
    const hash = rHash();
    return { hash, nonce: "0x" + Math.floor(rng()*100).toString(16), blockHash: null, blockNumber: "0x" + bn.toString(16), transactionIndex: "0x" + Math.floor(rng()*10).toString(16), from, to, value: "0x" + val.toString(16), gas: "0x" + gas.toString(16), gasPrice: "0x" + gp.toString(16), input: rng() > 0.7 ? "0x" + rHash(64) : "0x" };
  }
  function createBlock(n, parentHash) {
    const txCount = 1 + Math.floor(rng() * 6);
    const txs = [];
    for (let i = 0; i < txCount; i++) txs.push(createTx(n));
    const hash = rHash();
    const ts = GENESIS_TIME + n * BLOCK_TIME;
    const gasUsed = BigInt(Math.floor(rng() * parseInt("0x1c9c380", 16)));
    const miner = accounts[Math.floor(rng() * accounts.length)];
    const block = { number: "0x" + n.toString(16), hash, parentHash, nonce: "0x0000000000000000", sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347", logsBloom: "0x" + "0".repeat(512), transactionsRoot: "0x" + rHash(64), stateRoot: "0x" + rHash(64), receiptsRoot: "0x" + rHash(64), miner, difficulty: "0x0", totalDifficulty: "0x" + (n+1).toString(16), extraData: "0x457865436861696e", size: "0x" + (500 + Math.floor(rng() * 500)).toString(16), gasLimit: "0x1c9c380", gasUsed: "0x" + gasUsed.toString(16), timestamp: "0x" + ts.toString(16), transactions: txs.map(t => t.hash), uncles: [] };
    txs.forEach(t => t.blockHash = hash);
    state.transactions.push(...txs);
    return block;
  }
  let prevHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (let i = 0; i <= 500; i++) {
    const block = createBlock(i, prevHash);
    state.blocks.push(block);
    prevHash = block.hash;
  }
  state.blockNumber = 500;
  // Build hash index for fast lookup (use plain object, not Map - Map doesn't survive serialization)
  state.txHashMap = {};
  for (const tx of state.transactions) state.txHashMap[tx.hash] = tx;
  globalThis._chainState = state;
}

function rHex(len) { let s = ""; for (let i = 0; i < len; i++) s += "0123456789abcdef"[Math.floor(Math.random()*16)]; return s; }
function rHash() { return "0x" + rHex(64); }

function mineBlockWithPending() {
  const s = globalThis._chainState;
  const n = s.blockNumber + 1;
  // Add pending txs
  const pendingToMine = [...s.pendingTx];
  s.pendingTx = [];
  const txs = [];
  for (const tx of pendingToMine) {
    tx.blockNumber = "0x" + n.toString(16);
    tx.transactionIndex = "0x" + txs.length.toString(16);
    txs.push(tx);
  }
  // Also generate some random txs
  const rng = mulberry32(n + Date.now());
  for (let i = 0; i < 2; i++) {
    const from = s.blocks[0] ? s.blocks[0].miner : rAddr();
    const to = "0x" + (function(){let s="";for(let j=0;j<40;j++)s+="0123456789abcdef"[Math.floor(rng()*16)];return s})();
    const val = BigInt(Math.floor(rng() * 100000)) * BigInt(10**15);
    const gas = BigInt(21000 + Math.floor(rng() * 80000));
    const gp = BigInt(1e9 + Math.floor(rng() * 9e9));
    const hash = rHash();
    txs.push({ hash, nonce: "0x"+Math.floor(rng()*100).toString(16), blockHash: null, blockNumber: "0x"+n.toString(16), transactionIndex: "0x"+txs.length.toString(16), from, to, value: "0x"+val.toString(16), gas: "0x"+gas.toString(16), gasPrice: "0x"+gp.toString(16), input: "0x" });
  }
  const hash = rHash();
  const ts = GENESIS_TIME + n * BLOCK_TIME;
  const gasUsed = txs.reduce((sum, t) => sum + BigInt(t.gas), BigInt(0));
  const miner = s.blocks[0] ? s.blocks[Math.floor(Math.random() * s.blocks.length)].miner : rAddr();
  const block = { number:"0x"+n.toString(16), hash, parentHash:s.blocks[s.blockNumber].hash, nonce:"0x0000000000000000", sha3Uncles:"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347", logsBloom:"0x"+"0".repeat(512), transactionsRoot:"0x"+rHash(64), stateRoot:"0x"+rHash(64), receiptsRoot:"0x"+rHash(64), miner, difficulty:"0x0", totalDifficulty:"0x"+(n+1).toString(16), extraData:"0x457865436861696e", size:"0x"+(500+Math.floor(Math.random()*500)).toString(16), gasLimit:"0x1c9c380", gasUsed:"0x"+gasUsed.toString(16), timestamp:"0x"+ts.toString(16), transactions:txs.map(t=>t.hash), uncles:[] };
  txs.forEach(t => t.blockHash = hash);
  for (const tx of txs) { s.transactions.push(tx); if(!s.txHashMap) s.txHashMap={}; s.txHashMap[tx.hash] = tx; }
  s.blocks.push(block);
  s.blockNumber = n;
}

function handleRPC(method, params) {
  const s = globalThis._chainState;
  switch(method) {
    case "eth_blockNumber": return "0x" + s.blockNumber.toString(16);
    case "eth_chainId": return "0x" + CHAIN_ID.toString(16);
    case "net_version": return String(CHAIN_ID);
    case "eth_gasPrice": return "0x3b9aca00";
    case "net_listening": return true;
    case "eth_mining": return true;
    case "eth_syncing": return false;
    case "web3_clientVersion": return "ExeChain/1.0.0";
    case "eth_getBalance": return "0x56bc75e2d63100000";
    case "eth_getTransactionCount": {
      // Count pending + confirmed txs for this address
      const addr = (params[0] || "").toLowerCase();
      let count = s.pendingTx.filter(t => t.from && t.from.toLowerCase() === addr).length;
      for (const tx of s.transactions) { if (tx.from && tx.from.toLowerCase() === addr) count++; }
      return "0x" + count.toString(16);
    }
    case "eth_estimateGas": return "0x5208";
    case "eth_getCode": return "0x";
    case "eth_call": return "0x";
    case "eth_getLogs": return [];
    case "eth_sendTransaction":
    case "eth_sendRawTransaction": {
      // Accept raw tx hex string, parsed params object, or eth_sendTransaction format
      const input = params[0] || "";
      let from, to, value, gas, gasPrice, txData;
      if (typeof input === 'object' && (input.from || input.to)) {
        from = input.from || "0x" + rHex(40);
        to = input.to || null;
        value = input.value || "0x0";
        gas = input.gas || input.gasLimit || "0x5208";
        gasPrice = input.gasPrice || "0x3b9aca00";
        txData = input.data || input.input || "0x";
      } else if (typeof input === 'string') {
        try {
          const parsed = input.startsWith('{') ? JSON.parse(input) : null;
          if (parsed) { from = parsed.from; to = parsed.to || null; value = parsed.value || "0x0"; gas = parsed.gas || "0x5208"; gasPrice = parsed.gasPrice || "0x3b9aca00"; txData = parsed.data || "0x"; }
          else { from = "0x" + rHex(40); to = "0x" + rHex(40); value = "0x0"; gas = "0x5208"; gasPrice = "0x3b9aca00"; txData = "0x"; }
        } catch(e) { from = "0x" + rHex(40); to = "0x" + rHex(40); value = "0x0"; gas = "0x5208"; gasPrice = "0x3b9aca00"; txData = "0x"; }
      } else {
        from = "0x" + rHex(40); to = "0x" + rHex(40); value = "0x0"; gas = "0x5208"; gasPrice = "0x3b9aca00"; txData = "0x";
      }
      if (!from) from = "0x" + rHex(40);
      const hash = rHash();
      const pendingTx = { hash, nonce: "0x0", blockHash: null, blockNumber: null, transactionIndex: null, from, to, value: value.toString(), gas: gas.toString(), gasPrice: gasPrice.toString(), input: txData || "0x" };
      s.pendingTx.push(pendingTx);
      if(!s.txHashMap) s.txHashMap={}; s.txHashMap[hash] = pendingTx;
      // Immediately mine a block with this tx
      mineBlockWithPending();
      return hash;
    }
    case "eth_getBlockByNumber": {
      const p = params[0];
      let n = p === "latest" || p === "pending" ? s.blockNumber : p === "earliest" ? 0 : typeof p === "string" ? parseInt(p,16)||0 : 0;
      if (n < 0 || n > s.blockNumber) return null;
      const b = {...s.blocks[n]};
      if (params[1]) b.transactions = s.transactions.filter(t => parseInt(t.blockNumber,16) === n);
      return b;
    }
    case "eth_getBlockByHash": {
      const b = s.blocks.find(bl => bl.hash === params[0]);
      if (!b) return null;
      const r = {...b};
      if (params[1]) r.transactions = s.transactions.filter(t => t.blockHash === b.hash);
      return r;
    }
    case "eth_getTransactionByHash": {
      const tx = (s.txHashMap && s.txHashMap[params[0]]) || s.transactions.find(t => t.hash === params[0]);
      if (!tx) return null;
      return {...tx};
    }
    case "eth_getTransactionReceipt": {
      const tx = (s.txHashMap && s.txHashMap[params[0]]) || s.transactions.find(t => t.hash === params[0]);
      if (!tx || !tx.blockHash) return null;
      return {...tx, contractAddress:null, cumulativeGasUsed:tx.gas, effectiveGasPrice:tx.gasPrice, logs:[], logsBloom:"0x"+"0".repeat(512), status:"0x1", type:"0x0"};
    }
    case "eth_accounts": return [];
    case "eth_getBlockTransactionCountByNumber": {
      const p = params[0];
      let n = p === "latest" ? s.blockNumber : typeof p === "string" ? parseInt(p,16)||0 : 0;
      if (n < 0 || n > s.blockNumber) return "0x0";
      const b = s.blocks[n];
      return b ? "0x" + (Array.isArray(b.transactions) ? b.transactions.length : 0).toString(16) : "0x0";
    }
    default: return null;
  }
}

export default {
  async fetch(request) {
    const H = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,GET,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
    if (request.method === "OPTIONS") return new Response(null, {headers: H});
    if (request.method === "GET") return new Response(JSON.stringify({service:"Exe Chain RPC",chainId:CHAIN_ID,chainName:"Exe Chain",nativeToken:"EXE",blockNumber:globalThis._chainState.blockNumber,network:"mainnet",consensus:"Clique PoA"}), {headers:{...H,"Content-Type":"application/json"}});
    try {
      const body = await request.text();
      const rpc = JSON.parse(body);
      if (Math.random() < 0.15) mineBlockWithPending();
      const result = handleRPC(rpc.method, rpc.params || []);
      if (result === null || result === undefined) return new Response(JSON.stringify({jsonrpc:"2.0",error:{code:-32601,message:"Method not found: "+rpc.method},id:rpc.id||null}),{headers:{...H,"Content-Type":"application/json"}});
      return new Response(JSON.stringify({jsonrpc:"2.0",result,id:rpc.id||null}),{headers:{...H,"Content-Type":"application/json"}});
    } catch(e) {
      return new Response(JSON.stringify({jsonrpc:"2.0",error:{code:-32700,message:e.message},id:null}),{status:400,headers:{...H,"Content-Type":"application/json"}});
    }
  }
};
