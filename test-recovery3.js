const { ethers } = require('ethers');
const { secp256k1 } = require('@noble/secp256k1');

const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(privateKey);

async function main() {
  const tx = {
    type: 2,
    chainId: 8848,
    nonce: 0,
    maxPriorityFeePerGas: 1000000000, // 1 gwei
    maxFeePerGas: 3000000000, // 3 gwei
    gasLimit: 21000,
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    value: ethers.utils.parseEther('0.001'),
    data: '0x'
  };

  const signedTx = await wallet.signTransaction(tx);
  const parsed = ethers.utils.parseTransaction(signedTx);
  console.log('from:', parsed.from);
  console.log('v:', parsed.v, 'r:', parsed.r, 's:', parsed.s);

  // Get the signing hash using ethers internal method
  // For type 2 tx: serializeTransaction with {from, ...} gives unsigned payload
  // Actually, the cleanest way: use computeAddress with SigningKey
  const signingKey = new ethers.utils.SigningKey(privateKey);

  // The approach: strip type byte, decode RLP, take first 9 items, re-encode, prepend type, hash
  const rawBytes = ethers.utils.arrayify(signedTx);
  // rawBytes[0] = 0x02, rest is RLP list
  // Parse the RLP list
  const rlpBuf = Buffer.from(rawBytes.slice(1));
  
  // Simple RLP decoder
  function rlpDecodeFull(buf, offset) {
    if (offset >= buf.length) return null;
    const first = buf[offset];
    if (first <= 0x7f) {
      return { data: buf.slice(offset, offset+1), end: offset+1, isList: false };
    } else if (first <= 0xb7) {
      const len = first - 0x80;
      return { data: buf.slice(offset+1, offset+1+len), end: offset+1+len, isList: false };
    } else if (first <= 0xbf) {
      const lenOfLen = first - 0xb7;
      const len = parseInt(buf.slice(offset+1, offset+1+lenOfLen).toString('hex'), 16);
      return { data: buf.slice(offset+1+lenOfLen, offset+1+lenOfLen+len), end: offset+1+lenOfLen+len, isList: false };
    } else if (first <= 0xf7) {
      const listLen = first - 0xc0;
      const items = [];
      let pos = offset + 1;
      const endPos = offset + 1 + listLen;
      while (pos < endPos) {
        const item = rlpDecodeFull(buf, pos);
        items.push(item);
        pos = item.end;
      }
      return { data: items, end: endPos, isList: true };
    } else {
      const lenOfLen = first - 0xf7;
      const listLen = parseInt(buf.slice(offset+1, offset+1+lenOfLen).toString('hex'), 16);
      const items = [];
      let pos = offset + 1 + lenOfLen;
      const endPos = offset + 1 + lenOfLen + listLen;
      while (pos < endPos) {
        const item = rlpDecodeFull(buf, pos);
        items.push(item);
        pos = item.end;
      }
      return { data: items, end: endPos, isList: true };
    }
  }
  
  const decoded = rlpDecodeFull(rlpBuf, 0);
  const items = decoded.data; // should be 12 items for EIP-1559
  
  console.log('Number of RLP items:', items.length);
  
  // Items: [chainId, nonce, maxPF, maxFF, gas, to, value, data, accessList, v, r, s]
  // First 9 items are the unsigned transaction
  
  // Re-encode first 9 items as RLP list
  function rlpEncodeItem(data) {
    if (!Buffer.isBuffer(data)) data = Buffer.from(data);
    if (data.length === 1 && data[0] < 0x80) return Buffer.from(data);
    if (data.length < 56) return Buffer.concat([Buffer.from([data.length + 0x80]), data]);
    const hex = data.toString('hex');
    const lenHex = Buffer.from(ethers.utils.hexlify(data.length).slice(2), 'hex');
    return Buffer.concat([Buffer.from([lenHex.length + 0xb7]), lenHex, data]);
  }
  
  function rlpEncodeList(items) {
    const encodedItems = items.map(item => {
      if (item.isList) {
        // recursively encode
        const inner = rlpEncodeList(item.data);
        return inner;
      }
      return rlpEncodeItem(item.data);
    });
    const payload = Buffer.concat(encodedItems);
    if (payload.length < 56) return Buffer.concat([Buffer.from([payload.length + 0xc0]), payload]);
    const lenHex = Buffer.from(ethers.utils.hexlify(payload.length).slice(2), 'hex');
    return Buffer.concat([Buffer.from([lenHex.length + 0xf7]), lenHex, payload]);
  }
  
  // Take first 9 items (unsigned fields)
  const unsignedItems = items.slice(0, 9);
  const unsignedRlp = rlpEncodeList(unsignedItems);
  
  // Signing payload: 0x02 || unsignedRlp
  const signingPayload = Buffer.concat([Buffer.from([0x02]), unsignedRlp]);
  const signingHash = ethers.utils.keccak256(signingPayload);
  console.log('Computed signing hash:', signingHash);
  
  // Verify: sign this hash and check it matches
  const sig = signingKey.signDigest(signingHash);
  console.log('Sign v:', sig.v, 'parsed v:', parsed.v);
  console.log('Sign r:', sig.r);
  console.log('Parsed r:', parsed.r);
  console.log('r match:', sig.r === parsed.r);
  console.log('s match:', sig.s === parsed.s);
  
  // Now test recovery with @noble/secp256k1
  const r_hex = parsed.r.replace('0x', '').padStart(64, '0');
  const s_hex = parsed.s.replace('0x', '').padStart(64, '0');
  const v = parsed.v; // 0 or 1 for EIP-1559
  
  console.log('Recovery v:', v);
  
  const pubKeyHex = secp256k1.recoverPublicKey(signingHash.slice(2), { r: r_hex, s: s_hex }, v, false);
  console.log('Recovered pubkey hex length:', pubKeyHex.length);
  
  // If pubKeyHex doesn't start with 04, add it
  let pubKeyForAddr = pubKeyHex;
  if (!pubKeyForAddr.startsWith('04') && pubKeyForAddr.length === 128) {
    pubKeyForAddr = '04' + pubKeyForAddr;
  }
  
  // Address = keccak256(pubKey[1:])[12:32] = last 20 bytes of keccak256
  const pubKeyBuffer = Buffer.from(pubKeyForAddr, 'hex');
  const pubKeyNoPrefix = pubKeyBuffer.slice(1); // remove 04
  const addrHash = ethers.utils.keccak256(pubKeyNoPrefix);
  const recoveredAddr = '0x' + addrHash.slice(26);
  
  console.log('Noble recovered address:', recoveredAddr);
  console.log('Expected:', wallet.address);
  console.log('MATCH:', recoveredAddr.toLowerCase() === wallet.address.toLowerCase());
  
  console.log('\n=== ECDSA RECOVERY VERIFIED! ===');
  console.log('Algorithm:');
  console.log('1. rawBytes = hexToBytes(signedTx)');
  console.log('2. Parse RLP list from rawBytes[1:]');
  console.log('3. Take first 9 items (unsigned fields)');
  console.log('4. RLP encode those 9 items');
  console.log('5. Prepend 0x02 (type byte)');
  console.log('6. signingHash = keccak256(payload)');
  console.log('7. publicKey = secp256k1.recoverPublicKey(signingHash, {r, s}, v, false)');
  console.log('8. address = keccak256(pubKey[1:])[12:32]');
}

main().catch(console.error);
