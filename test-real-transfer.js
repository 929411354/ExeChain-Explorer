// Real MetaMask Transfer Test - Two Wallets End-to-End
// Tests actual balance changes: A sends to B, check both balances
const { ethers } = require('ethers');

const RPC_URL = 'https://rpc.exepc.top';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL, { chainId: 8848, name: 'Exe Chain' });

// Wallet A: Hardhat account #0
const PRIVKEY_A = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ADDR_A = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// Wallet B: Hardhat account #1
const PRIVKEY_B = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ADDR_B = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const walletA = new ethers.Wallet(PRIVKEY_A, provider);
const walletB = new ethers.Wallet(PRIVKEY_B, provider);

const TRANSFER_AMOUNT = ethers.utils.parseEther('1.0'); // 1 EXE

async function rpcCall(method, params = []) {
  const resp = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() })
  });
  return resp.json();
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('='.repeat(70));
  console.log('REAL WALLET TRANSFER TEST - Two Wallets');
  console.log('='.repeat(70));
  console.log(`Wallet A: ${walletA.address}`);
  console.log(`Wallet B: ${walletB.address}`);
  console.log(`Transfer: ${ethers.utils.formatEther(TRANSFER_AMOUNT)} EXE`);
  console.log(`RPC: ${RPC_URL}`);
  console.log('='.repeat(70));

  // ===================== STEP 1: Connection =====================
  console.log('\n[STEP 1] Connection & Chain ID');
  try {
    const network = await provider.getNetwork();
    console.log(`  Chain ID: ${network.chainId}`);
    console.log(`  ${network.chainId === 8848 ? 'OK' : 'MISMATCH!'}`);
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
    return;
  }

  // ===================== STEP 2: Initial Balances =====================
  console.log('\n[STEP 2] Initial Balances');
  let balA_initial, balB_initial;
  try {
    const rA = await rpcCall('eth_getBalance', [ADDR_A, 'latest']);
    balA_initial = rA.result;
    console.log(`  Wallet A balance: ${balA_initial} (${ethers.utils.formatEther(balA_initial)} EXE)`);

    const rB = await rpcCall('eth_getBalance', [ADDR_B, 'latest']);
    balB_initial = rB.result;
    console.log(`  Wallet B balance: ${balB_initial} (${ethers.utils.formatEther(balB_initial)} EXE)`);

    // Check if balances are DIFFERENT for different addresses (this is the bug!)
    if (balA_initial === balB_initial) {
      console.log('  *** BUG DETECTED: Both addresses return SAME balance! ***');
      console.log('  This means balances are hardcoded, not per-account!');
    } else {
      console.log('  Balances are different - per-account tracking works');
    }
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
  }

  // ===================== STEP 3: Nonce =====================
  console.log('\n[STEP 3] Nonce Check');
  try {
    const nA = await provider.getTransactionCount(ADDR_A);
    const nB = await provider.getTransactionCount(ADDR_B);
    console.log(`  Nonce A: ${nA}`);
    console.log(`  Nonce B: ${nB}`);
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
  }

  // ===================== STEP 4: Fee Data =====================
  console.log('\n[STEP 4] Fee Data (EIP-1559)');
  try {
    const feeData = await provider.getFeeData();
    console.log(`  maxFeePerGas: ${feeData.maxFeePerGas ? ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei') + ' Gwei' : 'null'}`);
    console.log(`  maxPriorityFeePerGas: ${feeData.maxPriorityFeePerGas ? ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' Gwei' : 'null'}`);
    console.log(`  gasPrice: ${feeData.gasPrice ? ethers.utils.formatUnits(feeData.gasPrice, 'gwei') + ' Gwei' : 'null'}`);
  } catch(e) {
    console.log(`  WARN: ${e.message}`);
  }

  // ===================== STEP 5: Send Transaction A -> B =====================
  console.log('\n[STEP 5] Send Transaction: A -> B');
  let txHash, txResponse;
  try {
    txResponse = await walletA.sendTransaction({
      to: ADDR_B,
      value: TRANSFER_AMOUNT,
      gasLimit: 21000,
      type: 2, // EIP-1559
    });
    txHash = txResponse.hash;
    console.log(`  TX Hash: ${txHash}`);
    console.log(`  Hash valid: ${txHash.startsWith('0x') && txHash.length === 66}`);
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
    if (e.error) console.log(`  Error details: ${JSON.stringify(e.error)}`);
    return;
  }

  // ===================== STEP 6: Get Receipt =====================
  console.log('\n[STEP 6] Transaction Receipt');
  let receipt;
  try {
    receipt = await txResponse.wait();
    console.log(`  Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Block: ${receipt.blockNumber}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`  From: ${receipt.from}`);
    console.log(`  To: ${receipt.to}`);
    console.log(`  EffectiveGasPrice: ${receipt.effectiveGasPrice}`);

    // Verify from address
    if (receipt.from.toLowerCase() === ADDR_A.toLowerCase()) {
      console.log('  From address MATCHES wallet A');
    } else {
      console.log(`  *** BUG: From address WRONG! Expected ${ADDR_A}, got ${receipt.from}`);
    }
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
  }

  // ===================== STEP 7: Check Balances After Transfer =====================
  console.log('\n[STEP 7] Balances After Transfer');
  try {
    const rA2 = await rpcCall('eth_getBalance', [ADDR_A, 'latest']);
    const balA_after = rA2.result;
    console.log(`  Wallet A balance: ${balA_after} (${ethers.utils.formatEther(balA_after)} EXE)`);

    const rB2 = await rpcCall('eth_getBalance', [ADDR_B, 'latest']);
    const balB_after = rB2.result;
    console.log(`  Wallet B balance: ${balB_after} (${ethers.utils.formatEther(balB_after)} EXE)`);

    // Check if balances changed
    const aChanged = balA_after !== balA_initial;
    const bChanged = balB_after !== balB_initial;
    console.log(`  A balance changed: ${aChanged ? 'YES' : 'NO (BUG!)'}`);
    console.log(`  B balance changed: ${bChanged ? 'YES' : 'NO (BUG!)'}`);

    if (aChanged && bChanged) {
      console.log('  *** REAL TRANSFER WORKS - Balances updated! ***');
    } else {
      console.log('  *** BUG: Balances not updated after transfer! ***');
      console.log('  The RPC returns hardcoded balances, not tracking real state.');
    }

    // Also check if they're still the same (indicating hardcoded)
    if (balA_after === balB_after) {
      console.log('  *** STILL SAME BALANCE for both addresses - definitely hardcoded ***');
    }
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
  }

  // ===================== STEP 8: Send B -> A (reverse) =====================
  console.log('\n[STEP 8] Send Transaction: B -> A (reverse)');
  try {
    const tx2 = await walletB.sendTransaction({
      to: ADDR_A,
      value: ethers.utils.parseEther('0.5'),
      gasLimit: 21000,
      type: 2,
    });
    console.log(`  TX Hash: ${tx2.hash}`);
    const receipt2 = await tx2.wait();
    console.log(`  Status: ${receipt2.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  From: ${receipt2.from}`);
    console.log(`  From matches B: ${receipt2.from.toLowerCase() === ADDR_B.toLowerCase() ? 'YES' : 'NO'}`);
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
  }

  // ===================== STEP 9: Final Balances =====================
  console.log('\n[STEP 9] Final Balances Check');
  try {
    const rA3 = await rpcCall('eth_getBalance', [ADDR_A, 'latest']);
    const rB3 = await rpcCall('eth_getBalance', [ADDR_B, 'latest']);
    console.log(`  Final A: ${ethers.utils.formatEther(rA3.result)} EXE`);
    console.log(`  Final B: ${ethers.utils.formatEther(rB3.result)} EXE`);

    if (rA3.result === rB3.result) {
      console.log('\n  *** FINAL VERDICT: BALANCES ARE HARDCODED ***');
      console.log('  eth_getBalance returns the same value for ALL addresses.');
      console.log('  Need to implement per-account balance tracking in the RPC Worker.');
    } else {
      console.log('\n  *** FINAL VERDICT: BALANCES ARE PER-ACCOUNT ***');
      console.log('  The transfer system is working correctly!');
    }
  } catch(e) {
    console.log(`  FAIL: ${e.message}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
