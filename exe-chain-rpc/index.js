// Exe Chain RPC Worker - Simulated blockchain with MetaMask transaction support
const CHAIN_ID = 8848;
const BLOCK_TIME = 3;

// ============================================================
// Compact Keccak-256 Implementation (SAARINEN's approach)
// ============================================================
const KECCAK_RC = [
  1n, 0x8082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n,
  0x8000000000008009n, 0x000000000000008an, 0x0000000000000088n,
  0x0000000080008009n, 0x000000008000000an, 0x000000008000808bn,
  0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an,
  0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n,
  0x0000000080000001n, 0x8000000080008008n
];

const ROT = [
  [0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]
];

const MASK64 = 0xFFFFFFFFFFFFFFFFn;

function rot64(x, n) {
  return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;
}

function keccakf1600(state) {
  // state: Array of 25 BigInt (each 64-bit)
  for (let round = 0; round < 24; round++) {
    // θ (theta)
    const C = [];
    for (let i = 0; i < 5; i++) {
      C[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
    }
    const D = [];
    for (let i = 0; i < 5; i++) {
      D[i] = C[(i + 4) % 5] ^ rot64(C[(i + 1) % 5], 1);
    }
    for (let i = 0; i < 25; i++) {
      state[i] ^= D[i % 5];
    }
    // ρ (rho) and π (pi) — note: ROT[x][y] not ROT[y][x]
    const B = new Array(25);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rot64(state[x + 5 * y], ROT[x][y]);
      }
    }
    // χ (chi)
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        state[x + 5 * y] = B[x + 5 * y] ^ ((~B[(x + 1) % 5 + 5 * y]) & B[(x + 2) % 5 + 5 * y]);
      }
    }
    // ι (iota)
    state[0] ^= KECCAK_RC[round];
  }
}

function keccak256(inputBytes) {
  // inputBytes: Uint8Array
  // Output: Uint8Array(32)
  const RATE = 136; // Keccak-256: capacity=512 bits, rate=(1600-512)/8=136 bytes
  const state = new Array(25).fill(0n);
  const len = inputBytes.length;
  let offset = 0;

  // Absorb full rate-sized blocks
  while (offset + RATE <= len) {
    for (let i = 0; i < RATE; i++) {
      state[Math.floor(i / 8)] ^= BigInt(inputBytes[offset + i]) << BigInt((i % 8) * 8);
    }
    keccakf1600(state);
    offset += RATE;
  }

  // Absorb remaining partial block + Keccak pad10*1 padding
  const remaining = len - offset;
  for (let i = 0; i < remaining; i++) {
    state[Math.floor(i / 8)] ^= BigInt(inputBytes[offset + i]) << BigInt((i % 8) * 8);
  }
  // pad10*1: 0x01 at position 'remaining', 0x80 at last byte of rate
  state[Math.floor(remaining / 8)] ^= BigInt(0x01) << BigInt((remaining % 8) * 8);
 state[Math.floor((RATE - 1) / 8)] ^= BigInt(0x80) << BigInt(((RATE - 1) % 8) * 8);
  keccakf1600(state);
  
  // Squeeze (only need 32 bytes = 4 lanes)
  const output = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    const lane = state[i];
    for (let j = 0; j < 8; j++) {
      output[i * 8 + j] = Number((lane >> BigInt(j * 8)) & 0xFFn);
    }
  }
  return output;
}

function keccak256Hex(hexString) {
  // Remove 0x prefix
  const hex = hexString.startsWith('0x') || hexString.startsWith('0X') ? hexString.slice(2) : hexString;
  const bytes = hexToBytes(hex);
  const hash = keccak256(bytes);
  return '0x' + bytesToHex(hash);
}

// ============================================================
// Byte Array Utilities
// ============================================================
function hexToBytes(hex) {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBigInt(hex) {
  if (!hex || hex === '0x' || hex === '0X') return 0n;
  const h = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return h.length > 0 ? BigInt('0x' + h) : 0n;
}

function bigIntToHex(bi) {
  if (bi === 0n) return '0x0';
  return '0x' + bi.toString(16);
}

function padToEven(hex) {
  return hex.length % 2 === 1 ? '0' + hex : hex;
}

function stripZeros(hex) {
  let i = 0;
  while (i < hex.length - 1 && hex[i] === '0') i++;
  return hex.slice(i);
}

// ============================================================
// RLP Decoder
// ============================================================
function rlpDecode(input) {
  // input: Uint8Array
  // returns: { data: any, remainder: Uint8Array }
  if (input.length === 0) throw new Error('RLP: empty input');
  
  const firstByte = input[0];
  let offset = 1;
  
  if (firstByte <= 0x7f) {
    // Single byte
    return { data: new Uint8Array([firstByte]), remainder: input.slice(offset) };
  } else if (firstByte <= 0xb7) {
    // Short string (0-55 bytes)
    const strLen = firstByte - 0x80;
    const data = input.slice(offset, offset + strLen);
    return { data, remainder: input.slice(offset + strLen) };
  } else if (firstByte <= 0xbf) {
    // Long string (>55 bytes)
    const lenOfLen = firstByte - 0xb7;
    const strLen = parseInt(bytesToHex(input.slice(offset, offset + lenOfLen)), 16);
    offset += lenOfLen;
    const data = input.slice(offset, offset + strLen);
    return { data, remainder: input.slice(offset + strLen) };
  } else if (firstByte <= 0xf7) {
    // Short list (0-55 bytes total payload)
    const listLen = firstByte - 0xc0;
    const listBytes = input.slice(offset, offset + listLen);
    const items = [];
    let remaining = listBytes;
    while (remaining.length > 0) {
      const result = rlpDecode(remaining);
      items.push(result.data);
      remaining = result.remainder;
    }
    return { data: items, remainder: input.slice(offset + listLen) };
  } else {
    // Long list (>55 bytes total payload)
    const lenOfLen = firstByte - 0xf7;
    const listLen = parseInt(bytesToHex(input.slice(offset, offset + lenOfLen)), 16);
    offset += lenOfLen;
    const listBytes = input.slice(offset, offset + listLen);
    const items = [];
    let remaining = listBytes;
    while (remaining.length > 0) {
      const result = rlpDecode(remaining);
      items.push(result.data);
      remaining = result.remainder;
    }
    return { data: items, remainder: input.slice(offset + listLen) };
  }
}

function bytesToAddressHex(bytes) {
  if (!bytes || bytes.length === 0) return null;
  return '0x' + bytesToHex(bytes).padStart(40, '0').slice(-40);
}

// ============================================================
// Raw Transaction Decoder
// ============================================================
function decodeRawTransaction(rawHex) {
  let hex = rawHex.startsWith('0x') || rawHex.startsWith('0X') ? rawHex.slice(2) : rawHex;
  if (!hex || hex.length < 2) return null;
  
  const bytes = hexToBytes(hex);
  
  // Check for EIP-2718 typed transaction (0x01 = LegacyFeeMarket, 0x02 = EIP-1559)
  let txType = 0;
  let payload;
  
  if (bytes[0] >= 0x01 && bytes[0] <= 0x7f) {
    // Typed transaction: type byte followed by RLP encoded envelope
    txType = bytes[0];
    const envelope = rlpDecode(bytes.slice(1));
    payload = envelope.data; // This is the list of fields
  } else {
    // Legacy transaction: RLP encoded directly
    txType = 0;
    const result = rlpDecode(bytes);
    payload = result.data;
  }
  
  if (!Array.isArray(payload)) return null;
  
  let from, to, value, gas, nonce, data, gasPrice, maxFeePerGas, maxPriorityFeePerGas, v, r, s;
  
  // CRITICAL: tx hash = keccak256 of the FULL raw bytes (including type prefix)
  // This matches exactly what MetaMask computes locally
  const hashBytes = keccak256(bytes);
  const hash = '0x' + bytesToHex(hashBytes);

  if (txType === 2) {
    // EIP-1559: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, signatureYParity, signatureR, signatureS]
    nonce = payload[1] ? hexToBigInt('0x' + bytesToHex(payload[1])) : 0n;
    maxPriorityFeePerGas = payload[2] ? hexToBigInt('0x' + bytesToHex(payload[2])) : 0n;
    maxFeePerGas = payload[3] ? hexToBigInt('0x' + bytesToHex(payload[3])) : 0n;
    gas = payload[4] ? hexToBigInt('0x' + bytesToHex(payload[4])) : 21000n;
    to = payload[5] && payload[5].length > 0 ? bytesToAddressHex(payload[5]) : null;
    value = payload[6] ? hexToBigInt('0x' + bytesToHex(payload[6])) : 0n;
    data = payload[7] ? '0x' + bytesToHex(payload[7]) : '0x';
    v = payload[9] ? hexToBigInt('0x' + bytesToHex(payload[9])) : 0n;
    r = payload[10] ? '0x' + bytesToHex(payload[10]).padStart(64, '0') : '0x0';
    s = payload[11] ? '0x' + bytesToHex(payload[11]).padStart(64, '0') : '0x0';
    gasPrice = maxFeePerGas;

    // Derive pseudo-from from r,s (can't do secp256k1 recover in Worker)
    from = '0x' + bytesToHex(keccak256(hexToBytes(r + s))).slice(0, 40);

    return {
      type: '0x2', hash, nonce: bigIntToHex(nonce), gasPrice: bigIntToHex(gasPrice),
      maxFeePerGas: bigIntToHex(maxFeePerGas), maxPriorityFeePerGas: bigIntToHex(maxPriorityFeePerGas),
      gas: bigIntToHex(gas), to, value: bigIntToHex(value), input: data,
      from, v: bigIntToHex(v), r, s
    };
  } else if (txType === 0) {
    // Legacy: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
    nonce = payload[0] ? hexToBigInt('0x' + bytesToHex(payload[0])) : 0n;
    gasPrice = payload[1] ? hexToBigInt('0x' + bytesToHex(payload[1])) : 0n;
    gas = payload[2] ? hexToBigInt('0x' + bytesToHex(payload[2])) : 21000n;
    to = payload[3] && payload[3].length > 0 ? bytesToAddressHex(payload[3]) : null;
    value = payload[4] ? hexToBigInt('0x' + bytesToHex(payload[4])) : 0n;
    data = payload[5] ? '0x' + bytesToHex(payload[5]) : '0x';
    v = payload[6] ? hexToBigInt('0x' + bytesToHex(payload[6])) : 0n;
    r = payload[7] ? '0x' + bytesToHex(payload[7]).padStart(64, '0') : '0x0';
    s = payload[8] ? '0x' + bytesToHex(payload[8]).padStart(64, '0') : '0x0';

    from = '0x' + bytesToHex(keccak256(hexToBytes(r + s))).slice(0, 40);

    return {
      type: '0x0', hash, nonce: bigIntToHex(nonce), gasPrice: bigIntToHex(gasPrice),
      gas: bigIntToHex(gas), to, value: bigIntToHex(value), input: data,
      from, v: bigIntToHex(v), r, s
    };
  }

  // For other typed transactions (type 1, etc), return hash with minimal info
  return { type: '0x' + txType.toString(16), hash };
}

// ============================================================
// RLP Encoder (minimal, for tx hash computation)
// ============================================================
function rlpEncodeLength(len, offset) {
  if (len < 56) {
    return new Uint8Array([offset + len]);
  } else {
    const hex = len.toString(16);
    const lenBytes = hexToBytes(padToEven(hex));
    const result = new Uint8Array(1 + lenBytes.length);
    result[0] = offset + 55 + lenBytes.length;
    result.set(lenBytes, 1);
    return result;
  }
}

function rlpEncodeBytes(bytes) {
  if (bytes.length === 1 && bytes[0] < 0x80) {
    return new Uint8Array(bytes);
  }
  const prefix = rlpEncodeLength(bytes.length, 0x80);
  const result = new Uint8Array(prefix.length + bytes.length);
  result.set(prefix, 0);
  result.set(bytes, prefix.length);
  return result;
}

function rlpEncodeList(items) {
  // items: array of Uint8Array
  const encodedItems = items.map(item => {
    if (item === null || item === undefined || (Array.isArray(item) && item.length === 0)) {
      return rlpEncodeBytes(new Uint8Array([]));
    }
    return rlpEncodeBytes(item);
  });
  let totalLen = 0;
  for (const enc of encodedItems) totalLen += enc.length;
  const prefix = rlpEncodeLength(totalLen, 0xc0);
  const result = new Uint8Array(prefix.length + totalLen);
  result.set(prefix, 0);
  let offset = prefix.length;
  for (const enc of encodedItems) {
    result.set(enc, offset);
    offset += enc.length;
  }
  return result;
}

// ============================================================
// Chain State Management
// ============================================================
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

function seededRng(seed) {
  const rng = mulberry32(seed);
  return {
    hex(len) { let s=""; for(let i=0;i<len;i++) s+="0123456789abcdef"[Math.floor(rng()*16)]; return s; },
    addr() { return "0x" + this.hex(40); },
    hash64() { return "0x" + this.hex(64); },
    int(min,max) { return min + Math.floor(rng()*(max-min+1)); },
    pick(arr) { return arr[Math.floor(rng()*arr.length)]; },
  };
}

function rHex(len) { let s=""; for(let i=0;i<len;i++) s+="0123456789abcdef"[Math.floor(Math.random()*16)]; return s; }
function rHash64() { return "0x" + rHex(64); }

// Build deterministic chain state
if (!globalThis._chainState) {
  const rng = seededRng(8848);
  const state = { blocks: [], transactions: [], blockNumber: 0, pendingTx: [], txHashMap: {}, accounts: [] };

  for (let i = 0; i < 25; i++) state.accounts.push(rng.addr());

  function createTx(bn, idx) {
    const from = rng.pick(state.accounts);
    const to = rng.pick(state.accounts);
    const val = BigInt(rng.int(1,200000)) * BigInt(10**15);
    const gas = BigInt(rng.int(21000,100000));
    const gp = BigInt(rng.int(1,10) * 1e9);
    const hash = rng.hash64();
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
    const hash = rng.hash64();
    const ts = Math.floor(Date.now() / 1000) - (500 - n) * BLOCK_TIME;
    const gasUsed = BigInt(rng.int(500000, parseInt("0x1c9c380", 16)));
    const miner = rng.pick(state.accounts);
    const block = {
      number: "0x" + n.toString(16), hash, parentHash,
      nonce: "0x0000000000000000",
      sha3Uncles: "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
      logsBloom: "0x" + "0".repeat(512),
      transactionsRoot: "0x" + rng.hex(64),
      stateRoot: "0x" + rng.hex(64),
      receiptsRoot: "0x" + rng.hex(64),
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
      mixHash: rng.hash64()
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
  const acc = s.accounts.length > 0 ? s.accounts : ["0x"+"0".repeat(40)];
  for (let i = 0; i < (1+Math.floor(Math.random()*3)); i++) {
    const from = acc[Math.floor(Math.random()*acc.length)];
    const to = acc[Math.floor(Math.random()*acc.length)];
    const val = BigInt(Math.floor(Math.random()*100000))*BigInt(10**15);
    const gas = BigInt(21000+Math.floor(Math.random()*80000));
    const gp = BigInt(1e9+Math.floor(Math.random()*9e9));
    const hash = rHash64();
    txs.push({ hash, nonce:"0x"+Math.floor(Math.random()*100).toString(16), blockHash:null, blockNumber:"0x"+n.toString(16), transactionIndex:"0x"+txs.length.toString(16), from, to, value:"0x"+val.toString(16), gas:"0x"+gas.toString(16), gasPrice:"0x"+gp.toString(16), input:"0x" });
  }
  const hash = rHash64();
  const ts = Math.floor(Date.now() / 1000);
  const gasUsed = txs.reduce((sum,t) => sum + BigInt(t.gas), BigInt(0));
  const miner = acc[Math.floor(Math.random()*acc.length)];
  const parentHash = s.blocks[s.blockNumber] ? s.blocks[s.blockNumber].hash : "0x"+"0".repeat(64);
  const block = {
    number:"0x"+n.toString(16), hash, parentHash,
    nonce:"0x0000000000000000",
    sha3Uncles:"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    logsBloom:"0x"+"0".repeat(512),
    transactionsRoot:rHash64(), stateRoot:rHash64(), receiptsRoot:rHash64(),
    miner, difficulty:"0x0", totalDifficulty:"0x"+(n+1).toString(16),
    extraData:"0x457865436861696e",
    size:"0x"+(500+Math.floor(Math.random()*500)).toString(16),
    gasLimit:"0x1c9c380", gasUsed:"0x"+gasUsed.toString(16),
    baseFeePerGas:"0x3b9aca00",
    timestamp:"0x"+ts.toString(16), transactions:txs.map(t=>t.hash), uncles:[],
    mixHash:rHash64()
  };
  txs.forEach(t => {
    t.blockHash = hash;
    s.transactions.push(t);
    s.txHashMap[t.hash] = t;
  });
  s.blocks.push(block);
  s.blockNumber = n;
}

function fixBlockTimestamp(blockNumber, storedTimestamp) {
  const s = globalThis._chainState;
  const now = Math.floor(Date.now() / 1000);
  const blockAge = s.blockNumber - blockNumber;
  return "0x" + Math.max(0, now - blockAge * BLOCK_TIME).toString(16);
}

// ============================================================
// Deterministic fallback: generate tx/receipt from hash
// (for cross-isolate persistence - different Worker isolate)
// ============================================================
function hashSeedRng(hashStr) {
  // Create a deterministic seed from hash string
  let seed = 0;
  for (let i = 0; i < hashStr.length; i++) {
    seed = ((seed << 5) - seed + hashStr.charCodeAt(i)) | 0;
  }
  return mulberry32(Math.abs(seed));
}

function generateFallbackReceipt(txHash) {
  // Generate a deterministic success receipt from any hash
  const rng = hashSeedRng(txHash);
  const s = globalThis._chainState;
  const blockNum = s.blockNumber - Math.floor(rng() * 3); // recent block
  const blockHash = s.blocks[blockNum] ? s.blocks[blockNum].hash : rHash64();
  return {
    transactionHash: txHash,
    transactionIndex: "0x" + Math.floor(rng() * 5).toString(16),
    blockHash: blockHash,
    blockNumber: "0x" + blockNum.toString(16),
    from: "0x" + rHex(40),
    to: "0x" + rHex(40),
    cumulativeGasUsed: "0x5208",
    effectiveGasPrice: "0x3b9aca00",
    gasUsed: "0x5208",
    contractAddress: null,
    logs: [],
    logsBloom: "0x" + "0".repeat(512),
    root: null,
    status: "0x1",
    type: "0x2"
  };
}

function generateFallbackTx(txHash) {
  const rng = hashSeedRng(txHash);
  const s = globalThis._chainState;
  const blockNum = s.blockNumber - Math.floor(rng() * 3);
  const blockHash = s.blocks[blockNum] ? s.blocks[blockNum].hash : rHash64();
  return {
    hash: txHash,
    nonce: "0x" + Math.floor(rng() * 100).toString(16),
    blockHash: blockHash,
    blockNumber: "0x" + blockNum.toString(16),
    transactionIndex: "0x" + Math.floor(rng() * 5).toString(16),
    from: "0x" + rHex(40),
    to: "0x" + rHex(40),
    value: "0x" + (BigInt(Math.floor(rng() * 100000)) * BigInt(10**15)).toString(16),
    gas: "0x5208",
    gasPrice: "0x3b9aca00",
    input: "0x",
    type: "0x2",
    maxFeePerGas: "0x77359400",
    maxPriorityFeePerGas: "0x3b9aca00"
  };
}

// ============================================================
// RPC Handler
// ============================================================
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

    case "eth_sendTransaction": {
      const input = params[0] || {};
      const from = input.from || "0x" + rHex(40);
      const to = input.to || "0x" + rHex(40);
      const value = input.value || "0x0";
      const gas = input.gas || input.gasLimit || "0x5208";
      const gasPrice = input.gasPrice || "0x3b9aca00";
      const txData = input.data || input.input || "0x";
      const hash = rHash64();
      const tx = {
        hash, nonce: "0x0", blockHash: null, blockNumber: null, transactionIndex: null,
        from, to, value: String(value), gas: String(gas), gasPrice: String(gasPrice),
        input: txData || "0x", type: "0x2"
      };
      s.pendingTx.push(tx);
      s.txHashMap[hash] = tx;
      mineNewBlock();
      return hash;
    }

    case "eth_sendRawTransaction": {
      const rawHex = params[0] || "";
      if (typeof rawHex !== 'string' || rawHex.length < 4) {
        throw new Error("Invalid raw transaction");
      }
      
      // CRITICAL: Always compute hash as keccak256 of raw bytes — this MUST match MetaMask
      let hex = rawHex.startsWith('0x') || rawHex.startsWith('0X') ? rawHex.slice(2) : rawHex;
      const rawBytes = hexToBytes(hex);
      const hash = '0x' + bytesToHex(keccak256(rawBytes));
      
      // Try to decode for extracting fields (to, from, value, gas, etc.)
      let decoded = null;
      try {
        decoded = decodeRawTransaction(rawHex);
      } catch(e) {
        // Decode failed — still proceed with hash-only tx
      }
      
      let tx;
      if (decoded && decoded.hash) {
        tx = {
          hash: decoded.hash,
          nonce: decoded.nonce || "0x0",
          blockHash: null, blockNumber: null, transactionIndex: null,
          from: decoded.from || "0x" + rHex(40),
          to: decoded.to || "0x" + rHex(40),
          value: decoded.value || "0x0",
          gas: decoded.gas || "0x5208",
          gasPrice: decoded.gasPrice || decoded.maxFeePerGas || "0x3b9aca00",
          maxFeePerGas: decoded.maxFeePerGas || decoded.gasPrice || "0x77359400",
          maxPriorityFeePerGas: decoded.maxPriorityFeePerGas || "0x3b9aca00",
          input: decoded.input || "0x",
          type: decoded.type || "0x2",
          v: decoded.v, r: decoded.r, s: decoded.s
        };
      } else {
        // Could not decode — create minimal tx with correct hash
        tx = {
          hash, nonce: "0x0", blockHash: null, blockNumber: null, transactionIndex: null,
          from: "0x" + rHex(40), to: "0x" + rHex(40), value: "0x0",
          gas: "0x5208", gasPrice: "0x3b9aca00", input: "0x", type: "0x2"
        };
      }
      
      // Store and immediately mine into a block
      s.pendingTx.push(tx);
      s.txHashMap[hash] = tx;
      mineNewBlock();
      
      return hash;
    }

    case "eth_getBlockByNumber": {
      const p = params[0];
      let n = (p === "latest" || p === "pending" || p === "safe" || p === "finalized") ? s.blockNumber : p === "earliest" ? 0 : typeof p === "string" ? parseInt(p,16)||0 : 0;
      if (n < 0 || n > s.blockNumber) return null;
      const b = {...s.blocks[n]};
      b.timestamp = fixBlockTimestamp(n, b.timestamp);
      if (params[1]) b.transactions = s.transactions.filter(t => parseInt(t.blockNumber,16) === n);
      return b;
    }

    case "eth_getBlockByHash": {
      const b = s.blocks.find(bl => bl.hash === params[0]);
      if (!b) return null;
      const r = {...b};
      r.timestamp = fixBlockTimestamp(parseInt(b.number,16), b.timestamp);
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
      const txHash = params[0];
      // Check our state first
      const tx = s.txHashMap[txHash] || s.transactions.find(t => t.hash === txHash);
      if (tx) return {...tx};
      // Cross-isolate fallback: generate deterministic tx from hash
      return generateFallbackTx(txHash);
    }

    case "eth_getTransactionReceipt": {
      const txHash = params[0];
      // Check our state first
      const tx = s.txHashMap[txHash] || s.transactions.find(t => t.hash === txHash);
      if (tx && tx.blockHash) {
        return {
          ...tx,
          transactionHash: txHash,
          contractAddress: null,
          cumulativeGasUsed: tx.gas,
          effectiveGasPrice: tx.gasPrice || tx.maxFeePerGas || "0x3b9aca00",
          gasUsed: tx.gas,
          logs: [],
          logsBloom: "0x" + "0".repeat(512),
          status: "0x1",
          type: tx.type || "0x2"
        };
      }
      // Even if tx exists but not yet in a block, mine a block now
      if (tx && !tx.blockHash) {
        mineNewBlock();
        const updated = s.txHashMap[txHash] || tx;
        return {
          ...updated,
          transactionHash: txHash,
          contractAddress: null,
          cumulativeGasUsed: updated.gas || "0x5208",
          effectiveGasPrice: updated.gasPrice || "0x3b9aca00",
          gasUsed: updated.gas || "0x5208",
          logs: [],
          logsBloom: "0x" + "0".repeat(512),
          status: "0x1",
          type: updated.type || "0x2"
        };
      }
      // Cross-isolate fallback: tx was sent on a different isolate
      // Return a successful receipt so MetaMask sees the tx as confirmed
      return generateFallbackReceipt(txHash);
    }

    case "eth_newBlockFilter": case "eth_newPendingTransactionFilter": case "eth_newFilter":
      return "0x" + rHex(16);
    case "eth_uninstallFilter": return true;
    case "eth_getFilterChanges":
      if (s.blocks.length > 0) return [s.blocks[s.blockNumber].hash];
      return [];
    case "eth_getFilterLogs": return [];

    // EIP-1559 methods
    case "eth_feeHistory": {
      const blockCount = Math.min(parseInt(params[0], 10) || 1, 1024);
      const newestBlock = params[1] === "latest" ? s.blockNumber : (parseInt(params[1],16)||s.blockNumber);
      const rewardPercentiles = Array.isArray(params[2]) ? params[2] : [25,50,75];
      const baseFeePerGas = "0x3b9aca00";
      const gasUsedRatio = [];
      const rewards = [];
      const oldestBlock = Math.max(0, newestBlock - blockCount + 1);
      const baseFeePerGasArr = [];
      for (let i = 0; i < blockCount; i++) {
        gasUsedRatio.push(0.1 + Math.random() * 0.6);
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
    case "eth_maxFeePerGas": return "0x77359400";

    default: return undefined;
  }
}

// ============================================================
// Worker Entry Point
// ============================================================
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

      // Occasionally mine new blocks for freshness
      if (Math.random() < 0.12) mineNewBlock();

      let result;
      try {
        result = handleRPC(method, params);
      } catch(e) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {code: -32000, message: e.message || "Internal error"},
          id: rpc.id || null
        }), {headers: {...CORS, ...JSON_HDR}});
      }

      if (result === undefined) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {code: -32601, message: "Method not found: " + method},
          id: rpc.id || null
        }), {headers: {...CORS, ...JSON_HDR}});
      }

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
