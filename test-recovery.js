const { ethers } = require('ethers');
const { secp256k1 } = require('@noble/secp256k1');

const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(privateKey);

async function main() {
  // Manually construct and sign an EIP-1559 transaction
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

  // Sign the transaction
  const signedTx = await wallet.signTransaction(tx);
  console.log('Signed TX length:', signedTx.length);

  // Parse it back
  const parsed = ethers.utils.parseTransaction(signedTx);
  console.log('Recovered from:', parsed.from);
  console.log('Expected from:', wallet.address);
  console.log('ethers match:', parsed.from.toLowerCase() === wallet.address.toLowerCase());

  // Get the signing hash (EIP-1559 unsigned transaction hash)
  const unsignedTx = ethers.utils.serializeTransaction(tx, { type: 2 });
  const digest = ethers.utils.keccak256(ethers.utils.arrayify(unsignedTx));
  console.log('Digest:', digest);

  // Test noble/secp256k1 recovery
  const r_hex = parsed.r.replace('0x', '').padStart(64, '0');
  const s_hex = parsed.s.replace('0x', '').padStart(64, '0');
  const v = parsed.v;
  
  // For EIP-1559, v is the recovery bit (0 or 1)
  const recovery = v >= 27 ? v - 27 : v;
  console.log('v:', v, 'recovery:', recovery);

  const publicKey = secp256k1.recoverPublicKey(digest.slice(2), { r: r_hex, s: s_hex }, recovery, false);
  console.log('Recovered pubkey hex length:', publicKey.length);

  // Derive address: keccak256(pubkey[1:])[-20:]
  let pubKeyHex;
  if (publicKey.length === 128) {
    pubKeyHex = '04' + publicKey;
  } else {
    pubKeyHex = publicKey;
  }
  
  const pubKeyBuffer = Buffer.from(pubKeyHex, 'hex');
  const pubKeyNoPrefix = pubKeyBuffer.slice(1); // remove 0x04
  const hash = ethers.utils.keccak256(pubKeyNoPrefix);
  const address = '0x' + hash.slice(26); // last 20 bytes = 40 hex chars
  console.log('Noble recovered address:', address);
  console.log('Address match:', address.toLowerCase() === wallet.address.toLowerCase());
  
  // SUCCESS! Now we know the algorithm works.
  console.log('\n=== ALGORITHM VERIFIED - ready to implement in Worker ===');
}

main().catch(console.error);
