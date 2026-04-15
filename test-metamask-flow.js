// Simulate the EXACT MetaMask transaction flow against rpc.exepc.top
// This tests every step MetaMask does when sending a transaction
const { ethers } = require('ethers');

const RPC_URL = 'https://rpc.exepc.top';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL, {
  chainId: 8848,
  name: 'Exe Chain'
});

// Private key for testing (generated locally, NOT real funds)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testStep(name, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${name}: ${JSON.stringify(result).slice(0, 120)}`);
    return result;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('MetaMask Transaction Flow Simulation');
  console.log('RPC:', RPC_URL);
  console.log('Wallet:', wallet.address);
  console.log('='.repeat(60));

  // Step 1: Check connection
  console.log('\n--- Step 1: Connection Check ---');
  const network = await provider.getNetwork();
  console.log(`  Chain ID: ${network.chainId} (expected: 8848)`);
  console.log(`  Chain ID match: ${network.chainId === 8848}`);

  // Step 2: Get block number
  console.log('\n--- Step 2: Block Number ---');
  const blockNum = await provider.getBlockNumber();
  console.log(`  Block: ${blockNum}`);

  // Step 3: Get balance (MetaMask checks this)
  console.log('\n--- Step 3: Balance ---');
  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance: ${ethers.utils.formatEther(balance)} EXE`);

  // Step 4: Get nonce (MetaMask needs this for signing)
  console.log('\n--- Step 4: Nonce ---');
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log(`  Nonce: ${nonce}`);

  // Step 5: Get gas price
  console.log('\n--- Step 5: Gas Price ---');
  const gasPrice = await provider.getGasPrice();
  console.log(`  Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} Gwei`);

  // Step 6: Fee history (MetaMask EIP-1559 fee estimation)
  console.log('\n--- Step 6: Fee History ---');
  try {
    const feeData = await provider.getFeeData();
    console.log(`  maxFeePerGas: ${feeData.maxFeePerGas ? ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei') : 'null'} Gwei`);
    console.log(`  maxPriorityFeePerGas: ${feeData.maxPriorityFeePerGas ? ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : 'null'} Gwei`);
    console.log(`  gasPrice: ${feeData.gasPrice ? ethers.utils.formatUnits(feeData.gasPrice, 'gwei') : 'null'} Gwei`);
  } catch(e) {
    console.log(`  ❌ Fee data error: ${e.message}`);
  }

  // Step 7: Estimate gas
  console.log('\n--- Step 7: Estimate Gas ---');
  const toAddress = '0x00000000000000000000000000000000000dEaD';
  try {
    const gasEstimate = await provider.estimateGas({
      from: wallet.address,
      to: toAddress,
      value: ethers.utils.parseEther('0.001')
    });
    console.log(`  Gas Estimate: ${gasEstimate.toString()}`);
  } catch(e) {
    console.log(`  ❌ Estimate gas error: ${e.message}`);
  }

  // Step 8: Send transaction (THIS IS THE CRITICAL TEST)
  console.log('\n--- Step 8: Send Transaction (the key test!) ---');
  try {
    // This is exactly what MetaMask does:
    // 1. Create unsigned tx
    // 2. Sign it locally
    // 3. Send raw signed tx via eth_sendRawTransaction
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.utils.parseEther('0.001'),
      gasLimit: 21000,
      type: 2,  // EIP-1559
    });
    console.log(`  ✅ Transaction sent! Hash: ${tx.hash}`);

    // Step 9: Wait for receipt (MetaMask polls)
    console.log('\n--- Step 9: Wait for Receipt ---');
    const receipt = await tx.wait();
    console.log(`  ✅ Receipt received!`);
    console.log(`    Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`    Block: ${receipt.blockNumber}`);
    console.log(`    Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`    From: ${receipt.from}`);
    console.log(`    To: ${receipt.to}`);

    // Verify from matches our wallet
    if (receipt.from.toLowerCase() === wallet.address.toLowerCase()) {
      console.log(`  ✅ From address matches wallet!`);
    } else {
      console.log(`  ❌ From address MISMATCH! Expected: ${wallet.address}, Got: ${receipt.from}`);
    }

  } catch(e) {
    console.log(`  ❌ Transaction FAILED: ${e.message}`);
    console.log(`  Error code: ${e.code}`);
    console.log(`  Error reason: ${e.reason}`);
    if (e.error) console.log(`  Error details: ${JSON.stringify(e.error)}`);

    // Try to understand the failure better
    if (e.message.includes('nonce')) console.log('  >> Possible nonce issue');
    if (e.message.includes('gas')) console.log('  >> Possible gas estimation issue');
    if (e.message.includes('insufficient')) console.log('  >> Possible insufficient balance');
    if (e.message.includes('network') || e.message.includes('connect')) console.log('  >> Possible network/connection issue');
  }

  // Also test: sendTransaction via eth_sendTransaction (the non-raw version)
  // MetaMask intercepts this, but let's test our RPC directly
  console.log('\n--- Step 10: Test eth_sendTransaction (non-raw) ---');
  try {
    const result = await provider.send('eth_sendTransaction', [{
      from: wallet.address,
      to: toAddress,
      value: '0x0',
      gas: '0x5208'
    }]);
    console.log(`  ✅ eth_sendTransaction result: ${result}`);
  } catch(e) {
    console.log(`  ❌ eth_sendTransaction error: ${e.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
