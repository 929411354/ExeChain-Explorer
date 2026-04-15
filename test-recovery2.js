const { ethers } = require('ethers');

const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(privateKey);

async function main() {
  const tx = {
    type: 2,
    chainId: 8848,
    nonce: 0,
    maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei'),
    maxFeePerGas: ethers.utils.parseUnits('3', 'gwei'),
    gasLimit: 21000,
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    value: ethers.utils.parseEther('0.001'),
    data: '0x'
  };

  // Sign and get the raw bytes
  const signedTx = await wallet.signTransaction(tx);
  console.log('Signed TX hex:', signedTx.slice(0, 20) + '...');
  console.log('Signed TX length:', signedTx.length, 'chars =', Math.ceil(signedTx.length/2-1), 'bytes');

  // Parse the signed tx to get v, r, s
  const parsed = ethers.utils.parseTransaction(signedTx);
  console.log('v:', parsed.v, 'type:', typeof parsed.v);
  console.log('r:', parsed.r);
  console.log('s:', parsed.s);
  console.log('from:', parsed.from);

  // Get the raw bytes of the signed transaction
  const rawBytes = ethers.utils.arrayify(signedTx);
  console.log('Raw bytes[0] (tx type):', rawBytes[0]); // should be 0x02

  // Compute keccak256 of the raw bytes (this is the tx hash)
  const txHash = ethers.utils.keccak256(rawBytes);
  console.log('TX Hash:', txHash);

  // Now, to recover the from address, we need:
  // 1. The signing hash = keccak256(type_byte || rlp(unsigned_fields))
  //    For EIP-1559: keccak256(0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList]))
  //
  // We can compute this by taking the raw signed tx, removing the signature (v, r, s),
  // and hashing the result.

  // Actually, the easier way: ethers.js Transaction class has a method for this
  // But let's do it manually using our own code to match what the Worker needs

  // Manual approach: get the raw signed tx bytes, strip the last 3 RLP items (v, r, s)
  // and hash the rest

  // The raw signed tx is: 0x02 || rlp([chainId, nonce, maxPF, maxFF, gas, to, value, data, [], v, r, s])
  // The signing payload is: 0x02 || rlp([chainId, nonce, maxPF, maxFF, gas, to, value, data, []])
  // So we need to strip v, r, s from the RLP list

  // Alternative: reconstruct the unsigned tx manually
  // Let's use the hex representation

  // EIP-1559 unsigned fields (9 fields):
  // chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList
  const fields = [
    ethers.utils.arrayify(ethers.utils.hexlify(tx.chainId)),
    ethers.utils.arrayify(ethers.utils.hexlify(tx.nonce)),
    ethers.utils.arrayify(tx.maxPriorityFeePerGas.toHexString()),
    ethers.utils.arrayify(tx.maxFeePerGas.toHexString()),
    ethers.utils.arrayify(tx.gasLimit.toHexString()),
    ethers.utils.arrayify(tx.to),
    ethers.utils.arrayify(tx.value.toHexString()),
    ethers.utils.arrayify(tx.data),
    [], // empty access list
  ];

  // RLP encode the fields
  function rlpEncodeLength(len, offset) {
    if (len < 56) return Buffer.from([len + offset]);
    const lenBytes = ethers.utils.arrayify(ethers.utils.hexlify(len));
    return Buffer.concat([Buffer.from([lenBytes.length + offset + 55]), lenBytes]);
  }

  function rlpEncode(item) {
    if (Buffer.isBuffer(item) || item instanceof Uint8Array) {
      if (item.length === 1 && item[0] < 0x80) return Buffer.from(item);
      return Buffer.concat([rlpEncodeLength(item.length, 0x80), item]);
    }
    if (Array.isArray(item)) {
      const encoded = item.map(rlpEncode);
      const payload = Buffer.concat(encoded);
      return Buffer.concat([rlpEncodeLength(payload.length, 0xc0), payload]);
    }
    return rlpEncode(Buffer.from(item));
  }

  const unsignedList = rlpEncode(fields);
  // The signing payload is: 0x02 || unsignedList
  const signingPayload = Buffer.concat([Buffer.from([0x02]), unsignedList]);
  const signingHash = ethers.utils.keccak256(signingPayload);
  console.log('Signing hash:', signingHash);

  // Now let's verify: sign this hash with the private key and check
  const signingKey = new ethers.utils.SigningKey(privateKey);
  const signature = signingKey.signDigest(signingHash);
  console.log('Sig v:', signature.v);
  console.log('Sig r:', signature.r);
  console.log('Sig s:', signature.s);
  console.log('v match:', Number(signature.v) === parsed.v);
  console.log('r match:', signature.r === parsed.r);
  console.log('s match:', signature.s === parsed.s);

  // Recover the public key using ethers
  const recovered = ethers.utils.recoverAddress(signingHash, {
    v: signature.v,
    r: signature.r,
    s: signature.s
  });
  console.log('Recovered address:', recovered);
  console.log('Match:', recovered.toLowerCase() === wallet.address.toLowerCase());

  console.log('\n=== NOW we know the exact algorithm ===');
  console.log('For EIP-1559:');
  console.log('1. Extract chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList from raw tx');
  console.log('2. RLP encode these 9 fields');
  console.log('3. Prepend 0x02 type byte');
  console.log('4. keccak256 the result = signingHash');
  console.log('5. Recover public key from (signingHash, v, r, s)');
  console.log('6. Address = keccak256(uncompressed_pubkey[1:])[12:32]');
}

main().catch(console.error);
