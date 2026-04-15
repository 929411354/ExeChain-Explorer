// Exe Chain RPC Worker - Deterministic blockchain simulation on Cloudflare Edge
const CHAIN_ID = 8848;
const GENESIS_TIME = 1712000000000;
const BLOCK_TIME = 3000;
const SUPPORTED_METHODS = new Set([
  'eth_blockNumber','eth_chainId','net_version','eth_gasPrice',
  'net_listening','eth_mining','eth_syncing','web3_clientVersion',
  'eth_getBalance','eth_getTransactionCount','eth_estimateGas',
  'eth_getCode','eth_call','eth_getLogs',
  'eth_sendTransaction','eth_sendRawTransaction',
  'eth_getBlockByNumber','eth_getBlockByHash',
  'eth_getTransactionByHash','eth_getTransactionReceipt',
  'eth_accounts','eth_getBlockTransactionCountByNumber',
  'eth_getBlockTransactionCountByHash',
  'eth_newBlockFilter','eth_newPendingTransactionFilter','eth_newFilter',
  'eth_uninstallFilter','eth_getFilterChanges','eth_getFilterLogs',
  'eth_protocolVersion','eth_coinbase','eth_hashrate','eth_getStorageAt',
  'eth_getProof','eth_pendingTransactions',
]);

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Deterministic random for consistent data across isolates
function seededRng(seed) {
  const rng = mulberry32(seed);
  return {
    hex(len) { let s=""; for(let i=0;i<len;i++) s+="0123456789abcdef"[Math.floor(rng()*16)]; return s; },
    addr() { return "0x" + this.hex(40); },
    hash() { return "0x" + this.hex(64); },
    int(min,max) { return min + Math.floor(rng()*(max-min+1)); },
    pick(arr) { return arr[Math.floor(rng()*arr.length)]; },
  };
}

function rHex(len) { let s=""; for(let i=0;i<len;i++) s+="0123456789abcdef"[Math.floor(Math.random()*16)]; return s; }
function rHash() { return "0x" + rHex(64); }

// Build the full chain state deterministically
if (!globalThis._chainState) {
  const rng = seededRng(8848);
  const state = { blocks: [], transactions: [], blockNumber: 0, pendingTx: [], txHashMap: {}, accounts: [] };

  // Create known accounts
  for (let i = 0; i < 25; i++) state.accounts.push(rng.addr());

  function createTx(bn, idx) {
    const from = rng.pick(state.accounts);
    const to = rng.pick(state.accounts);
    const val = BigInt(rng.int(1,200000)) * BigInt(10**15);
    const gas = BigInt(rng.int(21000,100000));
    const gp = BigInt(rng.int(1,10) * 1e9);
    const hash = rng.hash();
    return {
      hash, nonce: "0x" + rng.int(0,200).toString(16),
      blockHash: null, blockNumber: "0x" + bn.toString(16),
      transactionIndex: "0x" + idx.toString(16),
      from, to, value: "0x" + val.toString(16),
      gas: "0x" + gas.toString(16), gasPrice: "0x" + gp.toString(16),
      input: rng.int(1,10) > 7 ? "0x" + rng.hex(64) : "0x"
    };
  }

  function createBlock(n, parentHash) {
    const txCount = rng.int(1,8);
    const txs = [];
    for (let i = 0; i < txCount; i++) txs.push(createTx(n, i));
    const hash = rng.hash();
    const ts = GENESIS_TIME + n * BLOCK_TIME;
    const gasUsed = BigInt(rng.int(500000, parseInt("0x1c9c380", 16)));
    const miner = rng.pick(state.accounts);
    const block = {
      number: "0x" + n.toString(16), hash, parentHash,
      nonce: "0x0000000000000000",
      sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
      logsBloom: "0x" + "0".repeat(512),
      transactionsRoot: "0x" + rng.hash(64),
      stateRoot: "0x" + rng.hash(64),
      receiptsRoot: "0x" + rng.hash(64),
      miner, difficulty: "0x0",
      totalDifficulty: "0x" + (n+1).toString(16),
      extraData: "0x457865436861696e",
      size: "0x" + rng.int(400,1000).toString(16),
      gasLimit: "0x1c9c380",
      gasUsed: "0x" + gasUsed.toString(16),
      baseFeePerGas: "0x3b9aca00",
      timestamp: "0x" + ts.toString(16),
      transactions: txs.map(t => t.hash),
      uncles: [],
      mixHash: "0x" + rng.hash(64)
    };
    txs.forEach(t => { t.blockHash = hash; state.transactions.push(t); state.txHashMap[t.hash] = t; });
    state.blocks.push(block);
    return block;
  }

  let prevHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (let i = 0; i <= 500; i++) {
    prevHash = createBlock(i, prevHash).hash;
  }
  state.blockNumber = 500;
  globalThis._chainState = state;
}

function mineNewBlock() {
  const s = globalThis._chainState;
  const n = s.blockNumber + 1;
  const pending = [...s.pendingTx];
  s.pendingTx = [];
  const txs = [];
  pending.forEach((tx, i) => {
    tx.blockNumber = "0x" + n.toString(16);
    tx.transactionIndex = "0x" + txs.length.toString(16);
    txs.push(tx);
  });
  // Random filler txs
  const acc = s.accounts.length > 0 ? s.accounts : ["0x"+"0".repeat(40)];
  for (let i = 0; i < (1+Math.floor(Math.random()*3)); i++) {
    const from = acc[Math.floor(Math.random()*acc.length)];
    const to = acc[Math.floor(Math.random()*acc.length)];
    const val = BigInt(Math.floor(Math.random()*100000))*BigInt(10**15);
    const gas = BigInt(21000+Math.floor(Math.random()*80000));
    const gp = BigInt(1e9+Math.floor(Math.random()*9e9));
    const hash = rHash();
    txs.push({ hash, nonce:"0x"+Math.floor(Math.random()*100).toString(16), blockHash:null, blockNumber:"0x"+n.toString(16), transactionIndex:"0x"+txs.length.toString(16), from, to, value:"0x"+val.toString(16), gas:"0x"+gas.toString(16), gasPrice:"0x"+gp.toString(16), input:"0x" });
  }
  const hash = rHash();
  const ts = GENESIS_TIME + n * BLOCK_TIME;
  const gasUsed = txs.reduce((sum,t) => sum + BigInt(t.gas), BigInt(0));
  const miner = acc[Math.floor(Math.random()*acc.length)];
  const parentHash = s.blocks[s.blockNumber] ? s.blocks[s.blockNumber].hash : "0x"+"0".repeat(64);
  const block = {
    number:"0x"+n.toString(16), hash, parentHash,
    nonce:"0x0000000000000000",
    sha3Uncles:"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    logsBloom:"0x"+"0".repeat(512),
    transactionsRoot:"0x"+rHash(64), stateRoot:"0x"+rHash(64), receiptsRoot:"0x"+rHash(64),
    miner, difficulty:"0x0", totalDifficulty:"0x"+(n+1).toString(16),
    extraData:"0x457865436861696e",
    size:"0x"+(500+Math.floor(Math.random()*500)).toString(16),
    gasLimit:"0x1c9c380", gasUsed:"0x"+gasUsed.toString(16),
    baseFeePerGas:"0x3b9aca00",
    timestamp:"0x"+ts.toString(16), transactions:txs.map(t=>t.hash), uncles:[],
    mixHash:"0x"+rHash(64)
  };
  txs.forEach(t => {
    t.blockHash = hash;
    s.transactions.push(t);
    s.txHashMap[t.hash] = t;
  });
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
    case "eth_protocolVersion": return "0x41";
    case "eth_coinbase": return s.accounts[0] || "0x" + "0".repeat(40);
    case "eth_hashrate": return "0x0";
    case "eth_accounts": return [];
    case "eth_getBalance": return "0x84595161401484a000000"; // 10,000,000 EXE
    case "eth_getCode": return "0x";
    case "eth_call": return "0x";
    case "eth_getStorageAt": return "0x" + "0".repeat(64);
    case "eth_getProof": return null;
    case "eth_estimateGas": return "0x5208";
    case "eth_getLogs": return [];
    case "eth_pendingTransactions": return s.pendingTx.length > 0 ? [...s.pendingTx] : [];

    case "eth_getTransactionCount": {
      const addr = (params[0] || "").toLowerCase();
      let count = s.pendingTx.filter(t => t.from && t.from.toLowerCase() === addr).length;
      for (const tx of s.transactions) {
        if (tx.from && tx.from.toLowerCase() === addr) count++;
      }
      return "0x" + count.toString(16);
    }

    case "eth_sendTransaction":
    case "eth_sendRawTransaction": {
      const input = params[0] || "";
      let from, to, value, gas, gasPrice, txData;
      if (typeof input === 'object' && (input.from || input.to)) {
        from = input.from || rAddr();
        to = input.to || null;
        value = input.value || "0x0";
        gas = input.gas || input.gasLimit || "0x5208";
        gasPrice = input.gasPrice || "0x3b9aca00";
        txData = input.data || input.input || "0x";
      } else if (typeof input === 'string') {
        try {
          const parsed = input.startsWith('{') ? JSON.parse(input) : null;
          if (parsed && (parsed.from || parsed.to)) {
            from = parsed.from; to = parsed.to || null; value = parsed.value || "0x0";
            gas = parsed.gas || "0x5208"; gasPrice = parsed.gasPrice || "0x3b9aca00"; txData = parsed.data || "0x";
          } else { from = rAddr(); to = rAddr(); value = "0x0"; gas = "0x5208"; gasPrice = "0x3b9aca00"; txData = "0x"; }
        } catch(e) { from = rAddr(); to = rAddr(); value = "0x0"; gas = "0x5208"; gasPrice = "0x3b9aca00"; txData = "0x"; }
      } else {
        from = rAddr(); to = rAddr(); value = "0x0"; gas = "0x5208"; gasPrice = "0x3b9aca00"; txData = "0x";
      }
      const hash = rHash();
      const tx = {
        hash, nonce: "0x0", blockHash: null, blockNumber: null, transactionIndex: null,
        from, to, value: String(value), gas: String(gas), gasPrice: String(gasPrice),
        input: txData || "0x"
      };
      s.pendingTx.push(tx);
      s.txHashMap[hash] = tx;
      // Immediately mine so the tx is in a block
      mineNewBlock();
      return hash;
    }

    case "eth_getBlockByNumber": {
      const p = params[0];
      let n = (p === "latest" || p === "pending" || p === "safe" || p === "finalized") ? s.blockNumber : p === "earliest" ? 0 : typeof p === "string" ? parseInt(p,16)||0 : 0;
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

    case "eth_getBlockTransactionCountByNumber": {
      const p = params[0];
      let n = (p === "latest" || p === "safe" || p === "finalized") ? s.blockNumber : typeof p === "string" ? parseInt(p,16)||0 : 0;
      if (n < 0 || n > s.blockNumber) return "0x0";
      const b = s.blocks[n];
      return b ? "0x" + (Array.isArray(b.transactions) ? b.transactions.length : 0).toString(16) : "0x0";
    }

    case "eth_getBlockTransactionCountByHash": {
      const b = s.blocks.find(bl => bl.hash === params[0]);
      if (!b) return "0x0";
      return "0x" + (Array.isArray(b.transactions) ? b.transactions.length : 0).toString(16);
    }

    case "eth_getTransactionByHash": {
      const tx = s.txHashMap[params[0]] || s.transactions.find(t => t.hash === params[0]);
      if (!tx) return null;
      return {...tx};
    }

    case "eth_getTransactionReceipt": {
      const tx = s.txHashMap[params[0]] || s.transactions.find(t => t.hash === params[0]);
      if (!tx || !tx.blockHash) return null;
      return {...tx, contractAddress:null, cumulativeGasUsed:tx.gas, effectiveGasPrice:tx.gasPrice, logs:[], logsBloom:"0x"+"0".repeat(512), status:"0x1", type:tx.type||"0x0"};
    }

    case "eth_newBlockFilter": case "eth_newPendingTransactionFilter": case "eth_newFilter":
      return "0x" + rHash(16);
    case "eth_uninstallFilter": return true;
    case "eth_getFilterChanges":
      // For block filters, return latest block hashes
      if (s.blocks.length > 0) return [s.blocks[s.blockNumber].hash];
      return [];
    case "eth_getFilterLogs": return [];

    // EIP-1559 methods (needed by MetaMask)
    case "eth_feeHistory": {
      const blockCount = parseInt(params[0], 10) || 1;
      const newestBlock = params[1] === "latest" ? s.blockNumber : (parseInt(params[1],16)||s.blockNumber);
      const rewardPercentiles = Array.isArray(params[2]) ? params[2] : [25,50,75];
      const baseFeePerGas = "0x3b9aca00"; // 1 Gwei
      const gasUsedRatio = [];
      const rewards = [];
      const oldestBlock = Math.max(0, newestBlock - blockCount + 1);
      const baseFeePerGasArr = [];
      for (let i = 0; i < blockCount; i++) {
        gasUsedRatio.push(Math.random() * 0.8);
        baseFeePerGasArr.push(baseFeePerGas);
        rewards.push(rewardPercentiles.map(() => "0x3b9aca00"));
      }
      return {
        oldestBlock: "0x" + oldestBlock.toString(16),
        baseFeePerGas: baseFeePerGas,
        gasUsedRatio,
        reward: rewards.length > 0 ? rewards[rewards.length-1] : rewardPercentiles.map(() => "0x0"),
        baseFeePerGasArr
      };
    }
    case "eth_maxPriorityFeePerGas": return "0x3b9aca00";
    case "eth_maxFeePerGas": return "0x77359400"; // 2 Gwei

    default: return undefined; // undefined = method not found; null = supported but no result
  }
}

function rAddr() { return "0x" + rHex(40); }

export default {
  async fetch(request) {
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    const JSON_HDR = {"Content-Type": "application/json"};

    if (request.method === "OPTIONS") return new Response(null, {headers: CORS});

    if (request.method === "GET") {
      const s = globalThis._chainState;
      return new Response(JSON.stringify({
        service: "Exe Chain RPC", chainId: CHAIN_ID, chainName: "Exe Chain",
        nativeToken: "EXE", blockNumber: s.blockNumber,
        network: "mainnet", consensus: "Clique PoA"
      }), {headers: {...CORS, ...JSON_HDR}});
    }

    try {
      const body = await request.text();
      const rpc = JSON.parse(body);
      const method = rpc.method || "";
      const params = rpc.params || [];

      // Randomly mine new blocks for liveness
      if (Math.random() < 0.12) mineNewBlock();

      const result = handleRPC(method, params);

      // KEY FIX: distinguish "method not found" (undefined) from "null result"
      if (result === undefined) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {code: -32601, message: "Method not found: " + method},
          id: rpc.id || null
        }), {headers: {...CORS, ...JSON_HDR}});
      }

      // null is a valid JSON-RPC result (e.g. block not found, tx not found)
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: result,
        id: rpc.id || null
      }), {headers: {...CORS, ...JSON_HDR}});

    } catch(e) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: {code: -32700, message: "Parse error: " + e.message},
        id: null
      }), {status: 400, headers: {...CORS, ...JSON_HDR}});
    }
  }
};
