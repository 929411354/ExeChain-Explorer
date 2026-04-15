// Local test: verify ECDSA recovery works in the worker context
const EC = require('elliptic').ec;
const secp256k1 = new EC('secp256k1');
const { ethers } = require('ethers');

// Copy the utility functions from the worker
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
function concatBytes(...arrays) {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

// RLP encoder
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
  let hex = bigIntToHex(item).slice(2);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const bytes = hexToBytes(hex);
  return rlpEncode(bytes);
}

// Keccak-256 (same as worker)
const KECCAK_RC = [1n,0x8082n,0x800000000000808an,0x8000000080008000n,0x000000000000808bn,0x0000000080000001n,0x8000000080008081n,0x8000000000008009n,0x000000000000008an,0x0000000000000088n,0x0000000080008009n,0x000000008000000an,0x000000008000808bn,0x800000000000008bn,0x8000000000008089n,0x8000000000008003n,0x8000000000008002n,0x8000000000000080n,0x000000000000800an,0x800000008000000an,0x8000000080008081n,0x8000000000008080n,0x0000000080000001n,0x8000000080008008n];
const ROT=[[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
const MASK64=0xFFFFFFFFFFFFFFFFn;
function rot64(x,n){return((x<<BigInt(n))|(x>>BigInt(64-n)))&MASK64;}
function keccakf1600(state){for(let round=0;round<24;round++){const C=[];for(let i=0;i<5;i++)C[i]=state[i]^state[i+5]^state[i+10]^state[i+15]^state[i+20];const D=[];for(let i=0;i<5;i++)D[i]=C[(i+4)%5]^rot64(C[(i+1)%5],1);for(let i=0;i<25;i++)state[i]^=D[i%5];const B=new Array(25);for(let x=0;x<5;x++)for(let y=0;y<5;y++)B[y+5*((2*x+3*y)%5)]=rot64(state[x+5*y],ROT[x][y]);for(let x=0;x<5;x++)for(let y=0;y<5;y++)state[x+5*y]=B[x+5*y]^((~B[(x+1)%5+5*y])&B[(x+2)%5+5*y]);state[0]^=KECCAK_RC[round];}}
function keccak256(inputBytes){const RATE=136;const state=new Array(25).fill(0n);const len=inputBytes.length;let offset=0;while(offset+RATE<=len){for(let i=0;i<RATE;i++)state[Math.floor(i/8)]^=BigInt(inputBytes[offset+i])<<BigInt((i%8)*8);keccakf1600(state);offset+=RATE;}const remaining=len-offset;for(let i=0;i<remaining;i++)state[Math.floor(i/8)]^=BigInt(inputBytes[offset+i])<<BigInt((i%8)*8);state[Math.floor(remaining/8)]^=1n<<BigInt((remaining%8)*8);state[16]^=0x80n<<56n;keccakf1600(state);const output=new Uint8Array(32);for(let i=0;i<4;i++)for(let j=0;j<8;j++)output[i*8+j]=Number((state[i]>>BigInt(j*8))&0xFFn);return output;}

// RLP decoder
function rlpDecode(input){if(input.length===0)throw new Error('RLP: empty');const f=input[0];let o=1;if(f<=0x7f)return{data:new Uint8Array([f]),remainder:input.slice(o)};else if(f<=0xb7){const l=f-0x80;return{data:input.slice(o,o+l),remainder:input.slice(o+l)};}else if(f<=0xbf){const ll=f-0xb7;const l=parseInt(bytesToHex(input.slice(o,o+ll)),16);o+=ll;return{data:input.slice(o,o+l),remainder:input.slice(o+l)};}else if(f<=0xf7){const l=f-0xc0;const lb=input.slice(o,o+l);const items=[];let rem=lb;while(rem.length>0){const r=rlpDecode(rem);items.push(r.data);rem=r.remainder;}return{data:items,remainder:input.slice(o+l)};}else{const ll=f-0xf7;const l=parseInt(bytesToHex(input.slice(o,o+ll)),16);o+=ll;const lb=input.slice(o,o+l);const items=[];let rem=lb;while(rem.length>0){const r=rlpDecode(rem);items.push(r.data);rem=r.remainder;}return{data:items,remainder:input.slice(o+l)};}}
function bytesToAddressHex(bytes){if(!bytes||bytes.length===0)return null;return'0x'+bytesToHex(bytes).padStart(40,'0').slice(-40);}

// Recovery function (same as worker)
function recoverSenderAddress(rawBytes, payload, txType) {
  let signingPayload, v, r_hex, s_hex;
  if (txType === 2) {
    const unsignedFields = payload.slice(0, 9);
    const unsignedRlp = rlpEncode(unsignedFields);
    signingPayload = concatBytes(new Uint8Array([0x02]), unsignedRlp);
    v = payload[9] ? hexToBigInt('0x' + bytesToHex(payload[9])) : 0n;
    r_hex = payload[10] ? bytesToHex(payload[10]).padStart(64, '0') : '';
    s_hex = payload[11] ? bytesToHex(payload[11]).padStart(64, '0') : '';
  } else {
    return null;
  }
  if (!r_hex || !s_hex) return null;
  const signingHash = keccak256(signingPayload);
  const signingHashHex = bytesToHex(signingHash);
  const r_bn = Buffer.from(r_hex, 'hex');
  const s_bn = Buffer.from(s_hex, 'hex');
  const msgHash = Buffer.from(signingHashHex, 'hex');
  const recoveryParam = Number(v);
  try {
    const pubKey = secp256k1.recoverPubKey(msgHash, { r: r_bn, s: s_bn }, recoveryParam);
    const pubKeyHex = pubKey.encode('hex', false);
    const pubKeyBytes = hexToBytes(pubKeyHex.slice(2));
    const addrHash = keccak256(pubKeyBytes);
    return '0x' + bytesToHex(addrHash).slice(-40);
  } catch(e) {
    // Try recovery param 0 if 1 fails, and vice versa
    try {
      const pubKey = secp256k1.recoverPubKey(msgHash, { r: r_bn, s: s_bn }, 1 - recoveryParam);
      const pubKeyHex = pubKey.encode('hex', false);
      const pubKeyBytes = hexToBytes(pubKeyHex.slice(2));
      const addrHash = keccak256(pubKeyBytes);
      return '0x' + bytesToHex(addrHash).slice(-40);
    } catch(e2) {
      return null;
    }
  }
}

// Full test
async function main() {
  const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new ethers.Wallet(privateKey);

  const tx = {
    type: 2,
    chainId: 8848,
    nonce: 0,
    maxPriorityFeePerGas: 1000000000,
    maxFeePerGas: 3000000000,
    gasLimit: 21000,
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    value: ethers.utils.parseEther('0.001'),
    data: '0x'
  };

  const signedTx = await wallet.signTransaction(tx);
  console.log('Signed TX:', signedTx.slice(0, 20) + '...');

  // Parse using our RLP decoder
  const hex = signedTx.startsWith('0x') ? signedTx.slice(2) : signedTx;
  const bytes = hexToBytes(hex);
  const txType = bytes[0]; // should be 2
  const envelope = rlpDecode(bytes.slice(1));
  const payload = envelope.data;

  console.log('txType:', txType);
  console.log('payload items:', payload.length);

  // Recover using our function
  const from = recoverSenderAddress(bytes, payload, txType);
  console.log('Recovered from:', from);
  console.log('Expected from:', wallet.address);
  console.log('MATCH:', from && from.toLowerCase() === wallet.address.toLowerCase());

  if (from && from.toLowerCase() === wallet.address.toLowerCase()) {
    console.log('\n ECDSA RECOVERY WORKS CORRECTLY IN WORKER CONTEXT!');
  } else {
    console.log('\n FAILED - need to debug');
  }
}

main().catch(console.error);
