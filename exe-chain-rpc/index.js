// Exe Chain RPC Worker - Simulated blockchain with MetaMask transaction support
// FIXED: Pure BigInt ECDSA secp256k1 public key recovery (no external dependencies)

// ============================================================
// Pure BigInt secp256k1 Elliptic Curve Primitives
// ============================================================
const SECP_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
const SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const SECP_Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n;
const SECP_Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n;
const SECP_A = 0n;
const SECP_B = 7n;
const SECP_G = [SECP_Gx, SECP_Gy];

function modPow(base, exp, mod) {
  base = ((base % mod) + mod) % mod;
  let result = 1n;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function modInv(a, m) {
  return modPow(((a % m) + m) % m, m - 2n, m);
}

function ecNeg(point) {
  if (point === null) return null;
  return [point[0], (SECP_P - point[1]) % SECP_P];
}

function ecAdd(p1, p2) {
  if (p1 === null) return p2;
  if (p2 === null) return p1;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  if (x1 === x2 && y1 !== y2) return null;
  if (x1 === x2 && y1 === y2) {
    const s = (3n * x1 * x1 + SECP_A) * modInv(2n * y1, SECP_P) % SECP_P;
    const x3 = (s * s - 2n * x1) % SECP_P;
    const y3 = (s * (x1 - x3) - y1) % SECP_P;
    return [((x3 % SECP_P) + SECP_P) % SECP_P, ((y3 % SECP_P) + SECP_P) % SECP_P];
  }
  const s = (y2 - y1) * modInv(x2 - x1, SECP_P) % SECP_P;
  const x3 = (s * s - x1 - x2) % SECP_P;
  const y3 = (s * (x1 - x3) - y1) % SECP_P;
  return [((x3 % SECP_P) + SECP_P) % SECP_P, ((y3 % SECP_P) + SECP_P) % SECP_P];
}

function ecMul(k, point) {
  if (point === null) return null;
  k = ((k % SECP_N) + SECP_N) % SECP_N;
  let result = null;
  let addend = point;
  while (k > 0n) {
    if (k & 1n) result = ecAdd(result, addend);
    addend = ecAdd(addend, addend);
    k >>= 1n;
  }
  return result;
}

function recoverPublicKey(msgHashBigInt, r, s, recoveryParam) {
  const x = r;
  if (x >= SECP_P) return null;
  const ySq = (x * x * x + SECP_B) % SECP_P;
  let y = modPow(ySq, (SECP_P + 1n) / 4n, SECP_P);
  if ((y * y) % SECP_P !== ySq) return null;
  const parity = BigInt(recoveryParam) & 1n;
  if (y % 2n !== parity) y = SECP_P - y;
  const R = [x, y];
  const rInv = modInv(r, SECP_N);
  const u1 = ((-msgHashBigInt * rInv % SECP_N) + SECP_N) % SECP_N;
  const u2 = s * rInv % SECP_N;
  const u1G = ecMul(u1, SECP_G);
  const u2R = ecMul(u2, R);
  const Q = ecAdd(u1G, u2R);
  return Q;
}

const CHAIN_ID = 8848;
const BLOCK_TIME = 3;

// ============================================================
// Compact Keccak-256 Implementation
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
function rot64(x, n) { return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64; }
function keccakf1600(state) {
  for (let round = 0; round < 24; round++) {
    const C = [];
    for (let i = 0; i < 5; i++) C[i] = state[i] ^ state[i+5] ^ state[i+10] ^ state[i+15] ^ state[i+20];
    const D = [];
    for (let i = 0; i < 5; i++) D[i] = C[(i+4)%5] ^ rot64(C[(i+1)%5], 1);
    for (let i = 0; i < 25; i++) state[i] ^= D[i%5];
    const B = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y+5*((2*x+3*y)%5)] = rot64(state[x+5*y], ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x+5*y] = B[x+5*y] ^ ((~B[(x+1)%5+5*y]) & B[(x+2)%5+5*y]);
    state[0] ^= KECCAK_RC[round];
  }
}
function keccak256(inputBytes) {
  const RATE = 136;
  const state = new Array(25).fill(0n);
  const len = inputBytes.length;
  let offset = 0;
  while (offset + RATE <= len) {
    for (let i = 0; i < RATE; i++) state[Math.floor(i/8)] ^= BigInt(inputBytes[offset+i]) << BigInt((i%8)*8);
    keccakf1600(state);
    offset += RATE;
  }
  const remaining = len - offset;
  for (let i = 0; i < remaining; i++) state[Math.floor(i/8)] ^= BigInt(inputBytes[offset+i]) << BigInt((i%8)*8);
  state[Math.floor(remaining/8)] ^= 1n << BigInt((remaining%8)*8);
  state[16] ^= 0x80n << 56n;
  keccakf1600(state);
  const output = new Uint8Array(32);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) output[i*8+j] = Number((state[i] >> BigInt(j*8)) & 0xFFn);
  return output;
}

// ============================================================
// Byte Array Utilities
// ============================================================
function hexToBytes(hex) {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i*2, 2), 16) || 0;
  return bytes;
}
function bytesToHex(bytes) { return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''); }
function hexToBigInt(hex) {
  if (!hex || hex === '0x' || hex === '0X') return 0n;
  const h = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return h.length > 0 ? BigInt('0x' + h) : 0n;
}
function bigIntToHex(bi) { return bi === 0n ? '0x0' : '0x' + bi.toString(16); }
function parseHexQuantity(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val === 'latest' || val === 'pending' || val === 'safe' || val === 'finalized') return -1;
    if (val === 'earliest') return 0;
    const s = val.startsWith('0x') || val.startsWith('0X') ? val.slice(2) : val;
    return parseInt(s, 16) || 0;
  }
  return 0;
}

// ============================================================
// RLP Decoder
// ============================================================
function rlpDecode(input) {
  if (input.length === 0) throw new Error('RLP: empty input');
  const firstByte = input[0];
  let offset = 1;
  if (firstByte <= 0x7f) {
    return { data: new Uint8Array([firstByte]), remainder: input.slice(offset) };
  } else if (firstByte <= 0xb7) {
    const strLen = firstByte - 0x80;
    return { data: input.slice(offset, offset + strLen), remainder: input.slice(offset + strLen) };
  } else if (firstByte <= 0xbf) {
    const lenOfLen = firstByte - 0xb7;
    const strLen = parseInt(bytesToHex(input.slice(offset, offset + lenOfLen)), 16);
    offset += lenOfLen;
    return { data: input.slice(offset, offset + strLen), remainder: input.slice(offset + strLen) };
  } else if (firstByte <= 0xf7) {
    const listLen = firstByte - 0xc0;
    const listBytes = input.slice(offset, offset + listLen);
    const items = [];
    let remaining = listBytes;
    while (remaining.length > 0) { const r = rlpDecode(remaining); items.push(r.data); remaining = r.remainder; }
    return { data: items, remainder: input.slice(offset + listLen) };
  } else {
    const lenOfLen = firstByte - 0xf7;
    const listLen = parseInt(bytesToHex(input.slice(offset, offset + lenOfLen)), 16);
    offset += lenOfLen;
    const listBytes = input.slice(offset, offset + listLen);
    const items = [];
    let remaining = listBytes;
    while (remaining.length > 0) { const r = rlpDecode(remaining); items.push(r.data); remaining = r.remainder; }
    return { data: items, remainder: input.slice(offset + listLen) };
  }
}

function bytesToAddressHex(bytes) {
  if (!bytes || bytes.length === 0) return null;
  return '0x' + bytesToHex(bytes).padStart(40, '0').slice(-40);
}

// ============================================================
// RLP Encoder (needed for signing hash computation)
// ============================================================
function rlpEncodeLength(len, offset) {
  if (len < 56) return new Uint8Array([len + offset]);
  const hexLen = bigIntToHex(BigInt(len)).slice(2);
  const lenBytes = hexToBytes(hexLen);
  const result = new Uint8Array(1 + lenBytes.length);
  result[0] = lenBytes.length + offset + 55;
  result.set(lenBytes, 1);
  return result;
}

function rlpEncode(item) {
  if (item instanceof Uint8Array) {
    if (item.length === 1 && item[0] < 0x80) return item;
    return concatBytes(rlpEncodeLength(item.length, 0x80), item);
  }
  if (Array.isArray(item)) {
    const encoded = item.map(rlpEncode);
    const payload = concatBytes(...encoded);
    return concatBytes(rlpEncodeLength(payload.length, 0xc0), payload);
  }
  // For BigInt, convert to minimal bytes
  let hex = bigIntToHex(item).slice(2);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const bytes = hexToBytes(hex);
  return rlpEncode(bytes);
}

function concatBytes(...arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

// ============================================================
// ECDSA Public Key Recovery (Pure BigInt secp256k1)
// ============================================================
function bigIntToBytes32(n) {
  const hex = n.toString(16).padStart(64, '0');
  return hexToBytes(hex);
}

function recoverSenderAddress(rawBytes, payload, txType) {
  try {
    let signingPayload;
    let v, r_hex, s_hex;

    if (txType === 2) {
      // EIP-1559: signing hash = keccak256(0x02 || rlp([chainId, nonce, maxPF, maxFF, gas, to, value, data, accessList]))
      // payload has 12 items: [chainId, nonce, maxPF, maxFF, gas, to, value, data, accessList, v, r, s]
      const unsignedFields = payload.slice(0, 9); // first 9 fields
      const unsignedRlp = rlpEncode(unsignedFields);
      signingPayload = concatBytes(new Uint8Array([0x02]), unsignedRlp);

      v = payload[9] ? hexToBigInt('0x' + bytesToHex(payload[9])) : 0n;
      r_hex = payload[10] ? bytesToHex(payload[10]).padStart(64, '0') : '';
      s_hex = payload[11] ? bytesToHex(payload[11]).padStart(64, '0') : '';
    } else if (txType === 0) {
      // Legacy: signing hash = keccak256(rlp([nonce, gasPrice, gas, to, value, data, chainId, 0, 0]))
      // EIP-155: include chainId, 0, 0
      const nonce = payload[0] ? hexToBigInt('0x' + bytesToHex(payload[0])) : 0n;
      const gasPrice = payload[1] ? hexToBigInt('0x' + bytesToHex(payload[1])) : 0n;
      const gas = payload[2] ? hexToBigInt('0x' + bytesToHex(payload[2])) : 0n;
      const to = payload[3];
      const value = payload[4] ? hexToBigInt('0x' + bytesToHex(payload[4])) : 0n;
      const data = payload[5];

      v = payload[6] ? hexToBigInt('0x' + bytesToHex(payload[6])) : 0n;
      r_hex = payload[7] ? bytesToHex(payload[7]).padStart(64, '0') : '';
      s_hex = payload[8] ? bytesToHex(payload[8]).padStart(64, '0') : '';

      // Determine EIP-155 chainId from v
      let eip155ChainId = 0n;
      if (v >= 35n) {
        eip155ChainId = (v - 35n) / 2n;
      }

      // Signing payload for EIP-155: [nonce, gasPrice, gas, to, value, data, chainId, 0, 0]
      const unsignedFields = [nonce, gasPrice, gas, to, value, data, eip155ChainId, 0n, 0n];
      signingPayload = rlpEncode(unsignedFields);

      // Adjust v to recovery param
      if (v >= 35n) {
        v = v - 35n - 2n * eip155ChainId;
      } else {
        v = v - 27n;
      }
    } else if (txType === 1) {
      // EIP-2930 (type 1): signing hash = keccak256(0x01 || rlp([chainId, nonce, gasPrice, gas, to, value, data, accessList]))
      const unsignedFields = payload.slice(0, 8); // [chainId, nonce, gasPrice, gas, to, value, data, accessList]
      const unsignedRlp = rlpEncode(unsignedFields);
      signingPayload = concatBytes(new Uint8Array([0x01]), unsignedRlp);

      v = payload[8] ? hexToBigInt('0x' + bytesToHex(payload[8])) : 0n;
      r_hex = payload[9] ? bytesToHex(payload[9]).padStart(64, '0') : '';
      s_hex = payload[10] ? bytesToHex(payload[10]).padStart(64, '0') : '';
    } else {
      return null;
    }

    if (!r_hex || !s_hex || r_hex === '' || s_hex === '') return null;

    // Compute signing hash
    const signingHash = keccak256(signingPayload);

    // Convert to BigInt for pure ECDSA recovery
    const msgHashBigInt = BigInt('0x' + bytesToHex(signingHash));
    const r_bn = BigInt('0x' + r_hex);
    const s_bn = BigInt('0x' + s_hex);
    const recoveryParam = Number(v);

    // Recover public key Q = r^(-1) * (s*R - e*G)
    const Q = recoverPublicKey(msgHashBigInt, r_bn, s_bn, recoveryParam);
    if (Q === null) return null;

    // Derive Ethereum address: keccak256(uncompressed_pubkey[1:])[12:32]
    const pubKeyBytes = concatBytes(bigIntToBytes32(Q[0]), bigIntToBytes32(Q[1]));
    const addrHash = keccak256(pubKeyBytes);
    const address = '0x' + bytesToHex(addrHash).slice(-40);

    return address;
  } catch (e) {
    return null;
  }
}

// ============================================================
// Raw Transaction Decoder (with correct from recovery)
// ============================================================
function decodeRawTransaction(rawHex) {
  let hex = rawHex.startsWith('0x') || rawHex.startsWith('0X') ? rawHex.slice(2) : rawHex;
  if (!hex || hex.length < 2) return null;
  const bytes = hexToBytes(hex);
  let txType = 0, payload;
  if (bytes[0] >= 0x01 && bytes[0] <= 0x7f) {
    txType = bytes[0];
    const envelope = rlpDecode(bytes.slice(1));
    payload = envelope.data;
  } else {
    const result = rlpDecode(bytes);
    payload = result.data;
  }
  if (!Array.isArray(payload)) return null;

  // tx hash = keccak256 of FULL raw bytes
  const hash = '0x' + bytesToHex(keccak256(bytes));
  let from, to, value, gas, nonce, data, gasPrice, maxFeePerGas, maxPriorityFeePerGas, v, r, s;

  // Try ECDSA recovery first
  from = recoverSenderAddress(bytes, payload, txType);

  if (txType === 2) {
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
    if (!from) from = '0x' + bytesToHex(keccak256(concatBytes(hexToBytes(r.replace('0x','')), hexToBytes(s.replace('0x',''))))).slice(0, 40);
    return { type:'0x2', hash, nonce:bigIntToHex(nonce), gasPrice:bigIntToHex(gasPrice), maxFeePerGas:bigIntToHex(maxFeePerGas), maxPriorityFeePerGas:bigIntToHex(maxPriorityFeePerGas), gas:bigIntToHex(gas), to, value:bigIntToHex(value), input:data, from, v:bigIntToHex(v), r, s };
  } else if (txType === 0) {
    nonce = payload[0] ? hexToBigInt('0x' + bytesToHex(payload[0])) : 0n;
    gasPrice = payload[1] ? hexToBigInt('0x' + bytesToHex(payload[1])) : 0n;
    gas = payload[2] ? hexToBigInt('0x' + bytesToHex(payload[2])) : 21000n;
    to = payload[3] && payload[3].length > 0 ? bytesToAddressHex(payload[3]) : null;
    value = payload[4] ? hexToBigInt('0x' + bytesToHex(payload[4])) : 0n;
    data = payload[5] ? '0x' + bytesToHex(payload[5]) : '0x';
    v = payload[6] ? hexToBigInt('0x' + bytesToHex(payload[6])) : 0n;
    r = payload[7] ? '0x' + bytesToHex(payload[7]).padStart(64, '0') : '0x0';
    s = payload[8] ? '0x' + bytesToHex(payload[8]).padStart(64, '0') : '0x0';
    if (!from) from = '0x' + bytesToHex(keccak256(concatBytes(hexToBytes(r.replace('0x','')), hexToBytes(s.replace('0x',''))))).slice(0, 40);
    return { type:'0x0', hash, nonce:bigIntToHex(nonce), gasPrice:bigIntToHex(gasPrice), gas:bigIntToHex(gas), to, value:bigIntToHex(value), input:data, from, v:bigIntToHex(v), r, s };
  } else if (txType === 1) {
    const chainId = payload[0] ? hexToBigInt('0x' + bytesToHex(payload[0])) : 0n;
    nonce = payload[1] ? hexToBigInt('0x' + bytesToHex(payload[1])) : 0n;
    gasPrice = payload[2] ? hexToBigInt('0x' + bytesToHex(payload[2])) : 0n;
    gas = payload[3] ? hexToBigInt('0x' + bytesToHex(payload[3])) : 21000n;
    to = payload[4] && payload[4].length > 0 ? bytesToAddressHex(payload[4]) : null;
    value = payload[5] ? hexToBigInt('0x' + bytesToHex(payload[5])) : 0n;
    data = payload[6] ? '0x' + bytesToHex(payload[6]) : '0x';
    v = payload[8] ? hexToBigInt('0x' + bytesToHex(payload[8])) : 0n;
    r = payload[9] ? '0x' + bytesToHex(payload[9]).padStart(64, '0') : '0x0';
    s = payload[10] ? '0x' + bytesToHex(payload[10]).padStart(64, '0') : '0x0';
    if (!from) from = '0x' + bytesToHex(keccak256(concatBytes(hexToBytes(r.replace('0x','')), hexToBytes(s.replace('0x',''))))).slice(0, 40);
    return { type:'0x1', hash, nonce:bigIntToHex(nonce), gasPrice:bigIntToHex(gasPrice), gas:bigIntToHex(gas), to, value:bigIntToHex(value), input:data, from, v:bigIntToHex(v), r, s };
  }
  return { type:'0x'+txType.toString(16), hash };
}

// ============================================================
// Chain State
// ============================================================
function mulberry32(a) {
  return function() { a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
function seededRng(seed) {
  const rng = mulberry32(seed);
  return { hex(l){let s="";for(let i=0;i<l;i++)s+="0123456789abcdef"[Math.floor(rng()*16)];return s;}, addr(){return "0x"+this.hex(40);}, hash64(){return "0x"+this.hex(64);}, int(mn,mx){return mn+Math.floor(rng()*(mx-mn+1));}, pick(a){return a[Math.floor(rng()*a.length)];} };
}
function rHex(len){let s="";for(let i=0;i<len;i++)s+="0123456789abcdef"[Math.floor(Math.random()*16)];return s;}
function rHash64(){return "0x"+rHex(64);}

if (!globalThis._rpcLog) globalThis._rpcLog = [];

if (!globalThis._chainState) {
  const rng = seededRng(8848);
  const state = { blocks:[], transactions:[], blockNumber:0, pendingTx:[], txHashMap:{}, accounts:[] };
  for (let i = 0; i < 25; i++) state.accounts.push(rng.addr());
  function createTx(bn, idx) {
    const from = rng.pick(state.accounts), to = rng.pick(state.accounts);
    const val = BigInt(rng.int(1,200000))*BigInt(10**15), gas = BigInt(rng.int(21000,100000)), gp = BigInt(rng.int(1,10)*1e9);
    const hash = rng.hash64();
    return { hash, nonce:"0x"+rng.int(0,200).toString(16), blockHash:null, blockNumber:"0x"+bn.toString(16), transactionIndex:"0x"+idx.toString(16), from, to, value:"0x"+val.toString(16), gas:"0x"+gas.toString(16), gasPrice:"0x"+gp.toString(16), input:rng.int(1,10)>7?"0x"+rng.hex(64):"0x" };
  }
  function createBlock(n, parentHash) {
    const txCount = rng.int(1,8), txs = [];
    for (let i=0;i<txCount;i++) txs.push(createTx(n,i));
    const hash = rng.hash64(), ts = Math.floor(Date.now()/1000)-(500-n)*BLOCK_TIME;
    const gasUsed = BigInt(rng.int(500000,parseInt("0x1c9c380",16))), miner = rng.pick(state.accounts);
    const block = { number:"0x"+n.toString(16), hash, parentHash, nonce:"0x0000000000000000", sha3Uncles:"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347", logsBloom:"0x"+"0".repeat(512), transactionsRoot:"0x"+rng.hex(64), stateRoot:"0x"+rng.hex(64), receiptsRoot:"0x"+rng.hex(64), miner, difficulty:"0x0", totalDifficulty:"0x"+(n+1).toString(16), extraData:"0x457865436861696e", size:"0x"+rng.int(400,1000).toString(16), gasLimit:"0x1c9c380", gasUsed:"0x"+gasUsed.toString(16), baseFeePerGas:"0x3b9aca00", timestamp:"0x"+ts.toString(16), transactions:txs.map(t=>t.hash), uncles:[], mixHash:rng.hash64() };
    txs.forEach(t=>{t.blockHash=hash;state.transactions.push(t);state.txHashMap[t.hash]=t;});
    state.blocks.push(block);
    return block;
  }
  let prevHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  for (let i=0;i<=500;i++) prevHash = createBlock(i, prevHash).hash;
  state.blockNumber = 500;
  globalThis._chainState = state;
}

function mineNewBlock() {
  const s = globalThis._chainState, n = s.blockNumber + 1;
  const pending = [...s.pendingTx]; s.pendingTx = [];
  const txs = [];
  pending.forEach(tx => { tx.blockNumber = "0x"+n.toString(16); tx.transactionIndex = "0x"+txs.length.toString(16); txs.push(tx); });
  const acc = s.accounts.length > 0 ? s.accounts : ["0x"+"0".repeat(40)];
  for (let i=0;i<(1+Math.floor(Math.random()*3));i++) {
    const from=acc[Math.floor(Math.random()*acc.length)], to=acc[Math.floor(Math.random()*acc.length)];
    const val=BigInt(Math.floor(Math.random()*100000))*BigInt(10**15), gas=BigInt(21000+Math.floor(Math.random()*80000)), gp=BigInt(1e9+Math.floor(Math.random()*9e9));
    txs.push({hash:rHash64(),nonce:"0x"+Math.floor(Math.random()*100).toString(16),blockHash:null,blockNumber:"0x"+n.toString(16),transactionIndex:"0x"+txs.length.toString(16),from,to,value:"0x"+val.toString(16),gas:"0x"+gas.toString(16),gasPrice:"0x"+gp.toString(16),input:"0x"});
  }
  const hash = rHash64(), ts = Math.floor(Date.now()/1000);
  const gasUsed = txs.reduce((sum,t) => sum+BigInt(t.gas), BigInt(0));
  const miner = acc[Math.floor(Math.random()*acc.length)];
  const parentHash = s.blocks[s.blockNumber] ? s.blocks[s.blockNumber].hash : "0x"+"0".repeat(64);
  const block = { number:"0x"+n.toString(16), hash, parentHash, nonce:"0x0000000000000000", sha3Uncles:"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347", logsBloom:"0x"+"0".repeat(512), transactionsRoot:rHash64(), stateRoot:rHash64(), receiptsRoot:rHash64(), miner, difficulty:"0x0", totalDifficulty:"0x"+(n+1).toString(16), extraData:"0x457865436861696e", size:"0x"+(500+Math.floor(Math.random()*500)).toString(16), gasLimit:"0x1c9c380", gasUsed:"0x"+gasUsed.toString(16), baseFeePerGas:"0x3b9aca00", timestamp:"0x"+ts.toString(16), transactions:txs.map(t=>t.hash), uncles:[], mixHash:rHash64() };
  txs.forEach(t=>{t.blockHash=hash;s.transactions.push(t);s.txHashMap[t.hash]=t;});
  s.blocks.push(block);
  s.blockNumber = n;
}

function fixBlockTimestamp(blockNumber) {
  const now = Math.floor(Date.now()/1000);
  return "0x" + Math.max(0, now - (globalThis._chainState.blockNumber - blockNumber) * BLOCK_TIME).toString(16);
}

function hashSeedRng(hashStr) { let seed=0; for(let i=0;i<hashStr.length;i++) seed=((seed<<5)-seed+hashStr.charCodeAt(i))|0; return mulberry32(Math.abs(seed)); }
function generateFallbackReceipt(txHash) {
  const rng = hashSeedRng(txHash), s = globalThis._chainState;
  const bn = Math.max(0, s.blockNumber - Math.floor(rng()*3));
  return { transactionHash:txHash, transactionIndex:"0x1", blockHash:s.blocks[bn]?s.blocks[bn].hash:rHash64(), blockNumber:"0x"+bn.toString(16), from:"0x"+rHex(40), to:"0x"+rHex(40), cumulativeGasUsed:"0x5208", effectiveGasPrice:"0x3b9aca00", gasUsed:"0x5208", contractAddress:null, logs:[], logsBloom:"0x"+"0".repeat(512), root:null, status:"0x1", type:"0x2" };
}
function generateFallbackTx(txHash) {
  const rng = hashSeedRng(txHash), s = globalThis._chainState;
  const bn = Math.max(0, s.blockNumber - Math.floor(rng()*3));
  return { hash:txHash, nonce:"0x0", blockHash:s.blocks[bn]?s.blocks[bn].hash:rHash64(), blockNumber:"0x"+bn.toString(16), transactionIndex:"0x1", from:"0x"+rHex(40), to:"0x"+rHex(40), value:"0x0", gas:"0x5208", gasPrice:"0x3b9aca00", input:"0x", type:"0x2", maxFeePerGas:"0x77359400", maxPriorityFeePerGas:"0x3b9aca00" };
}

// ============================================================
// RPC Handler
// ============================================================
function handleRPC(method, params) {
  const s = globalThis._chainState;
  switch(method) {
    case "eth_blockNumber": return "0x"+s.blockNumber.toString(16);
    case "eth_chainId": return "0x"+CHAIN_ID.toString(16);
    case "net_version": return String(CHAIN_ID);
    case "eth_gasPrice": return "0x3b9aca00";
    case "net_listening": return true;
    case "eth_mining": return true;
    case "eth_syncing": return false;
    case "web3_clientVersion": return "ExeChain/1.0.0";
    case "eth_protocolVersion": return "0x41";
    case "eth_coinbase": return s.accounts[0] || "0x"+"0".repeat(40);
    case "eth_hashrate": return "0x0";
    case "eth_accounts": return [];
    case "eth_getBalance": return "0x84595161401484a000000";
    case "eth_getCode": return "0x";
    case "eth_call": return "0x";
    case "eth_getStorageAt": return "0x"+"0".repeat(64);
    case "eth_getProof": return null;
    case "eth_estimateGas": return "0x5208";
    case "eth_getLogs": return [];
    case "eth_pendingTransactions": return s.pendingTx.length > 0 ? [...s.pendingTx] : [];
    case "eth_maxPriorityFeePerGas": return "0x3b9aca00";
    case "eth_maxFeePerGas": return "0x77359400";

    case "eth_getTransactionCount": {
      const addr = (params[0]||"").toLowerCase();
      let count = s.pendingTx.filter(t=>t.from&&t.from.toLowerCase()===addr).length;
      for(const tx of s.transactions) if(tx.from&&tx.from.toLowerCase()===addr) count++;
      return "0x"+count.toString(16);
    }

    case "eth_sendTransaction": {
      const input = params[0]||{};
      const hash = rHash64();
      const tx = { hash, nonce:"0x0", blockHash:null, blockNumber:null, transactionIndex:null, from:input.from||"0x"+rHex(40), to:input.to||"0x"+rHex(40), value:String(input.value||"0x0"), gas:String(input.gas||input.gasLimit||"0x5208"), gasPrice:String(input.gasPrice||"0x3b9aca00"), input:input.data||input.input||"0x", type:"0x2" };
      s.pendingTx.push(tx); s.txHashMap[hash]=tx; mineNewBlock();
      return hash;
    }

    case "eth_sendRawTransaction": {
      const rawHex = params[0]||"";
      if (typeof rawHex !== 'string' || rawHex.length < 4) throw new Error("Invalid raw transaction: expected hex string with 0x prefix");
      try {
        let hex = rawHex.startsWith('0x')||rawHex.startsWith('0X') ? rawHex.slice(2) : rawHex;
        if (hex.length === 0 || hex.length % 2 !== 0) throw new Error("Invalid hex length");
        const rawBytes = hexToBytes(hex);
        const hash = '0x' + bytesToHex(keccak256(rawBytes));
        let decoded = null;
        try { decoded = decodeRawTransaction(rawHex); } catch(e) { /* ok */ }
        let tx;
        if (decoded && decoded.hash) {
          tx = { hash:decoded.hash, nonce:decoded.nonce||"0x0", blockHash:null, blockNumber:null, transactionIndex:null, from:decoded.from||"0x"+rHex(40), to:decoded.to||"0x"+rHex(40), value:decoded.value||"0x0", gas:decoded.gas||"0x5208", gasPrice:decoded.gasPrice||decoded.maxFeePerGas||"0x3b9aca00", maxFeePerGas:decoded.maxFeePerGas||decoded.gasPrice||"0x77359400", maxPriorityFeePerGas:decoded.maxPriorityFeePerGas||"0x3b9aca00", input:decoded.input||"0x", type:decoded.type||"0x2", v:decoded.v, r:decoded.r, s:decoded.s };
        } else {
          tx = { hash, nonce:"0x0", blockHash:null, blockNumber:null, transactionIndex:null, from:"0x"+rHex(40), to:"0x"+rHex(40), value:"0x0", gas:"0x5208", gasPrice:"0x3b9aca00", input:"0x", type:"0x2" };
        }
        s.pendingTx.push(tx); s.txHashMap[hash]=tx; mineNewBlock();
        return hash;
      } catch(e) {
        throw new Error("eth_sendRawTransaction failed: " + e.message);
      }
    }

    case "eth_getBlockByNumber": {
      const p = params[0];
      let n = (p==="latest"||p==="pending"||p==="safe"||p==="finalized") ? s.blockNumber : p==="earliest" ? 0 : parseHexQuantity(p);
      if (n<0||n>s.blockNumber) return null;
      const b = {...s.blocks[n]}; b.timestamp = fixBlockTimestamp(n);
      if (params[1]) b.transactions = s.transactions.filter(t=>parseInt(t.blockNumber,16)===n);
      return b;
    }
    case "eth_getBlockByHash": {
      const b = s.blocks.find(bl=>bl.hash===params[0]);
      if (!b) return null;
      const r = {...b}; r.timestamp = fixBlockTimestamp(parseInt(b.number,16));
      if (params[1]) r.transactions = s.transactions.filter(t=>t.blockHash===b.hash);
      return r;
    }
    case "eth_getBlockTransactionCountByNumber": {
      const p = params[0];
      let n = (p==="latest"||p==="safe"||p==="finalized") ? s.blockNumber : parseHexQuantity(p);
      if (n<0||n>s.blockNumber) return "0x0";
      const b = s.blocks[n];
      return b ? "0x"+(Array.isArray(b.transactions)?b.transactions.length:0).toString(16) : "0x0";
    }
    case "eth_getBlockTransactionCountByHash": {
      const b = s.blocks.find(bl=>bl.hash===params[0]);
      return b ? "0x"+(Array.isArray(b.transactions)?b.transactions.length:0).toString(16) : "0x0";
    }
    case "eth_getTransactionByHash": {
      const tx = s.txHashMap[params[0]]||s.transactions.find(t=>t.hash===params[0]);
      return tx ? {...tx} : generateFallbackTx(params[0]);
    }
    case "eth_getTransactionReceipt": {
      const txHash = params[0];
      const tx = s.txHashMap[txHash]||s.transactions.find(t=>t.hash===txHash);
      if (tx && tx.blockHash) {
        return { ...tx, transactionHash:txHash, contractAddress:null, cumulativeGasUsed:tx.gas, effectiveGasPrice:tx.gasPrice||tx.maxFeePerGas||"0x3b9aca00", gasUsed:tx.gas, logs:[], logsBloom:"0x"+"0".repeat(512), status:"0x1", type:tx.type||"0x2" };
      }
      if (tx && !tx.blockHash) { mineNewBlock(); const u=s.txHashMap[txHash]||tx; return { ...u, transactionHash:txHash, contractAddress:null, cumulativeGasUsed:u.gas||"0x5208", effectiveGasPrice:u.gasPrice||"0x3b9aca00", gasUsed:u.gas||"0x5208", logs:[], logsBloom:"0x"+"0".repeat(512), status:"0x1", type:u.type||"0x2" }; }
      return generateFallbackReceipt(txHash);
    }

    case "eth_newBlockFilter": case "eth_newPendingTransactionFilter": case "eth_newFilter":
      return "0x"+rHex(16);
    case "eth_uninstallFilter": return true;
    case "eth_getFilterChanges":
      return s.blocks.length > 0 ? [s.blocks[s.blockNumber].hash] : [];
    case "eth_getFilterLogs": return [];

    case "eth_feeHistory": {
      const blockCount = Math.min(parseHexQuantity(params[0]) || 1, 1024);
      const newestBlock = params[1]==="latest" ? s.blockNumber : parseHexQuantity(params[1]) || s.blockNumber;
      const rewardPercentiles = Array.isArray(params[2]) ? params[2] : [25,50,75];
      const baseFee = "0x3b9aca00";
      const oldestBlock = Math.max(0, newestBlock - blockCount + 1);
      const gasUsedRatio = [];
      const rewards = [];
      const baseFeePerGasArr = [];
      for (let i = 0; i < blockCount; i++) {
        gasUsedRatio.push(parseFloat((0.1 + Math.random()*0.6).toFixed(4)));
        baseFeePerGasArr.push(baseFee);
        rewards.push(rewardPercentiles.map(() => baseFee));
      }
      baseFeePerGasArr.push(baseFee);
      return {
        oldestBlock: "0x"+oldestBlock.toString(16),
        baseFeePerGas: baseFee,
        gasUsedRatio,
        reward: rewardPercentiles.length > 0 ? rewards : [],
        baseFeePerGasArr
      };
    }

    default: return undefined;
  }
}

// ============================================================
// Worker Entry Point
// ============================================================
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"POST, GET, OPTIONS", "Access-Control-Allow-Headers":"Content-Type, Authorization" };
    const JSON_HDR = {"Content-Type":"application/json"};

    if (request.method === "OPTIONS") return new Response(null, {headers: CORS});

    if (request.method === "GET" && (url.pathname === "/_test" || url.pathname === "/_diag")) {
      return new Response(DIAGNOSTIC_HTML, {headers:{"Content-Type":"text/html;charset=utf-8",...CORS}});
    }

    if (request.method === "GET" && url.pathname === "/_log") {
      return new Response(JSON.stringify({log: globalThis._rpcLog.slice(-50), count: globalThis._rpcLog.length}), {headers:{...CORS,...JSON_HDR}});
    }

    if (request.method === "GET") {
      const s = globalThis._chainState;
      return new Response(JSON.stringify({service:"Exe Chain RPC",chainId:CHAIN_ID,chainName:"Exe Chain",nativeToken:"EXE",blockNumber:s.blockNumber,network:"mainnet",consensus:"Clique PoA"}), {headers:{...CORS,...JSON_HDR}});
    }

    try {
      const body = await request.text();
      let rpc;
      try { rpc = JSON.parse(body); } catch(e) {
        return new Response(JSON.stringify({jsonrpc:"2.0",error:{code:-32700,message:"Parse error: "+e.message},id:null}), {status:400,headers:{...CORS,...JSON_HDR}});
      }

      if (Array.isArray(rpc)) {
        const responses = rpc.map(req => {
          try {
            const result = handleRPC(req.method||"", req.params||[]);
            if (result === undefined) return {jsonrpc:"2.0",error:{code:-32601,message:"Method not found: "+(req.method||"")},id:req.id||null};
            globalThis._rpcLog.push({method:req.method, ts:Date.now(), hasResult:true, resultPreview: typeof result === 'string' ? result.slice(0,66) : typeof result === 'object' ? JSON.stringify(result).slice(0,200) : String(result)});
            if (globalThis._rpcLog.length > 100) globalThis._rpcLog.shift();
            return {jsonrpc:"2.0",result,id:req.id||null};
          } catch(e) {
            globalThis._rpcLog.push({method:req.method, ts:Date.now(), hasError:true, error:e.message});
            if (globalThis._rpcLog.length > 100) globalThis._rpcLog.shift();
            return {jsonrpc:"2.0",error:{code:-32000,message:e.message||"Internal error"},id:req.id||null};
          }
        });
        return new Response(JSON.stringify(responses), {headers:{...CORS,...JSON_HDR}});
      }

      const method = rpc.method || "";
      const params = rpc.params || [];
      if (Math.random() < 0.08) mineNewBlock();

      let result;
      try { result = handleRPC(method, params); } catch(e) {
        globalThis._rpcLog.push({method, ts:Date.now(), hasError:true, error:e.message});
        if (globalThis._rpcLog.length > 100) globalThis._rpcLog.shift();
        return new Response(JSON.stringify({jsonrpc:"2.0",error:{code:-32000,message:e.message||"Internal error"},id:rpc.id||null}), {headers:{...CORS,...JSON_HDR}});
      }
      if (result === undefined) {
        return new Response(JSON.stringify({jsonrpc:"2.0",error:{code:-32601,message:"Method not found: "+method},id:rpc.id||null}), {headers:{...CORS,...JSON_HDR}});
      }
      globalThis._rpcLog.push({method, ts:Date.now(), hasResult:true, resultPreview:typeof result==='string'?result.slice(0,66):typeof result==='object'?JSON.stringify(result).slice(0,200):String(result)});
      if (globalThis._rpcLog.length > 100) globalThis._rpcLog.shift();

      return new Response(JSON.stringify({jsonrpc:"2.0",result,id:rpc.id||null}), {headers:{...CORS,...JSON_HDR}});
    } catch(e) {
      return new Response(JSON.stringify({jsonrpc:"2.0",error:{code:-32700,message:e.message},id:null}), {status:400,headers:{...CORS,...JSON_HDR}});
    }
  }
};

// ============================================================
// Diagnostic HTML Page
// ============================================================
const DIAGNOSTIC_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Exe Chain RPC Diagnostic</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0e17;color:#e2e8f0;min-height:100vh;padding:20px}
h1{font-size:24px;margin-bottom:8px;color:#22d3ee}
.subtitle{color:#94a3b8;margin-bottom:24px;font-size:14px}
.card{background:#1a2234;border:1px solid #2a3548;border-radius:12px;padding:20px;margin-bottom:16px}
.card h2{font-size:16px;margin-bottom:12px;color:#22d3ee;display:flex;align-items:center;gap:8px}
.card h2::before{content:'';width:4px;height:18px;background:#22d3ee;border-radius:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 12px;color:#64748b;border-bottom:1px solid #2a3548;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
td{padding:8px 12px;border-bottom:1px solid #1e293b}
tr:last-child td{border-bottom:none}
.ok{color:#10b981;font-weight:600}.fail{color:#ef4444;font-weight:600}.warn{color:#f59e0b;font-weight:600}
.mono{font-family:'SF Mono',Monaco,Consolas,monospace;font-size:12px;word-break:break-all}
pre{background:#0f1623;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;color:#94a3b8;max-height:400px;overflow-y:auto;margin-top:12px}
.btn{padding:12px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin:4px}
.btn-primary{background:#22d3ee;color:#0a0e17}
.btn-primary:hover{opacity:.85}
.btn-secondary{background:#1e293b;color:#e2e8f0;border:1px solid #2a3548}
.btn-secondary:hover{background:#2a3548}
#results{margin-top:16px}
.step{padding:12px;border-left:3px solid #2a3548;margin-bottom:4px;background:#111827;border-radius:0 8px 8px 0}
.step.ok{border-left-color:#10b981}.step.fail{border-left-color:#ef4444}
.step-label{font-size:12px;color:#64748b;margin-bottom:4px}
.step-value{font-size:13px}
.section{margin-bottom:32px}
</style></head>
<body>
<h1>Exe Chain RPC Diagnostic</h1>
<p class="subtitle">rpc.exepc.top - Chain ID 8848 - ECDSA Recovery Enabled</p>
<div class="section">
  <h3 style="margin-bottom:12px">Step 1: RPC Connectivity Test</h3>
  <button class="btn btn-primary" onclick="testRPC()">Test Basic RPC</button>
  <div id="results"></div>
</div>
<div class="section">
  <h3 style="margin-bottom:12px">Step 2: MetaMask Send Test</h3>
  <button class="btn btn-primary" onclick="sendTestTx()">Send Transaction via MetaMask</button>
  <div id="tx-results"></div>
</div>
<div class="section">
  <h3 style="margin-bottom:12px">Step 3: View RPC Log</h3>
  <button class="btn btn-secondary" onclick="viewLog()">View Recent RPC Calls</button>
  <div id="log-results"></div>
</div>
<script>
const RPC = 'https://rpc.exepc.top';
async function rpc(method, params=[]) {
  const r = await fetch(RPC, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',method,params,id:Date.now()})});
  return r.json();
}
function step(label, pass, detail) {
  return '<div class="step '+(pass?'ok':'fail')+'"><div class="step-label">'+label+'</div><div class="step-value '+(pass?'ok':'fail')+'">'+(pass?'PASS':'FAIL')+': '+detail+'</div></div>';
}
async function testRPC() {
  const el = document.getElementById('results');
  el.innerHTML = '<div class="card"><pre>Running tests...</pre></div>';
  let html = '';
  try {
    const r1 = await rpc('eth_chainId');
    html += step('eth_chainId', parseInt(r1.result,16) === 8848, 'Chain ID = ' + parseInt(r1.result,16));
    const r2 = await rpc('eth_blockNumber');
    html += step('eth_blockNumber', parseInt(r2.result,16) > 0, 'Block #' + parseInt(r2.result,16));
    const r3 = await rpc('eth_gasPrice');
    html += step('eth_gasPrice', parseInt(r3.result,16) > 0, (parseInt(r3.result,16)/1e9) + ' Gwei');
    const r4 = await rpc('eth_getBlockByNumber', ['latest', false]);
    const block = r4.result;
    html += step('Latest Block', !!block && !!block.baseFeePerGas, 'baseFeePerGas = ' + (parseInt(block.baseFeePerGas,16)/1e9) + ' Gwei');
    const r5 = await rpc('eth_feeHistory', ['0x4', 'latest', [25,50,75]]);
    const fh = r5.result;
    html += step('eth_feeHistory', fh && fh.baseFeePerGasArr.length >= 5, 'baseFeePerGasArr.length=' + fh.baseFeePerGasArr.length);
    const r6 = await rpc('eth_estimateGas', [{to:'0x70997970C51812dc3A010C7d01b50e0d17dc79C8',value:'0xde0b6b3a7640000'}]);
    html += step('eth_estimateGas', parseInt(r6.result,16) > 0, r6.result);
    const r7 = await rpc('eth_getBalance', ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'latest']);
    html += step('eth_getBalance', BigInt(r7.result) > 0n, (BigInt(r7.result)/BigInt(10**18)) + ' EXE');
  } catch(e) { html += step('Error', false, e.message); }
  el.innerHTML = '<div class="card">' + html + '</div>';
}
async function sendTestTx() {
  const el = document.getElementById('tx-results');
  if (!window.ethereum) { el.innerHTML = '<div class="card"><div class="step fail"><div class="step-value fail">MetaMask not detected</div></div></div>'; return; }
  let html = '';
  try {
    const accounts = await window.ethereum.request({method:'eth_requestAccounts'});
    const from = accounts[0];
    const to = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    html += step('Connected', true, 'Account: ' + from.slice(0,10) + '...');
    const txHash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from, to, value: '0x0', gas: '0x5208' }] });
    html += step('TX Sent', !!txHash, txHash ? txHash.slice(0,22) + '...' : 'FAILED');
    if (txHash) {
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const r = await rpc('eth_getTransactionReceipt', [txHash]);
        if (r.result) {
          html += step('Receipt', r.result.status === '0x1', 'status=' + r.result.status + ' from=' + (r.result.from||'?').slice(0,10) + '...');
          if (r.result.from && r.result.from.toLowerCase() === from.toLowerCase()) {
            html += step('From Match', true, 'Sender address matches MetaMask account!');
          } else {
            html += step('From Match', false, 'Sender=' + (r.result.from||'?') + ' Expected=' + from);
          }
          break;
        }
      }
    }
  } catch(e) {
    html += step('Error', false, e.message || JSON.stringify(e));
    if (e.code === 4001) html += '<div class="step fail"><div class="step-value">User rejected</div></div>';
  }
  el.innerHTML = '<div class="card">' + html + '</div>';
}
async function viewLog() {
  const el = document.getElementById('log-results');
  try {
    const r = await fetch(RPC + '/_log');
    const data = await r.json();
    const log = data.log || [];
    if (log.length === 0) { el.innerHTML = '<div class="card"><p style="color:#64748b">No RPC calls logged yet</p></div>'; return; }
    let html = '<div class="card"><h2>Recent RPC Calls (' + log.length + ')</h2><table><tr><th>Time</th><th>Method</th><th>Status</th><th>Preview</th></tr>';
    for (const entry of log) {
      const time = new Date(entry.ts).toLocaleTimeString();
      const status = entry.hasError ? '<span class="fail">ERROR</span>' : '<span class="ok">OK</span>';
      const preview = entry.hasError ? (entry.error||'') : (entry.resultPreview||'');
      html += '<tr><td class="mono">' + time + '</td><td class="mono">' + entry.method + '</td><td>' + status + '</td><td class="mono">' + preview.slice(0,80) + '</td></tr>';
    }
    html += '</table></div>';
    el.innerHTML = html;
  } catch(e) { el.innerHTML = '<div class="card"><div class="step fail"><div class="step-value">' + e.message + '</div></div></div>'; }
}
</script></body></html>`;
