// End-to-end MetaMask transaction flow test against the DEPLOYED RPC
const { ethers } = require('ethers');

const RPC_URL = 'https://rpc.exepc.top';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL, { chainId: 8848, name: 'Exe Chain' });

// Test wallet (deterministic, from Hardhat)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);
const EXPECTED_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

async function main() {
  console.log('='.repeat(60));
  console.log('END-TO-END METAMASK TRANSFER TEST');
  console.log('RPC:', RPC_URL);
  console.log('Wallet:', wallet.address);
  console.log('='.repeat(60));

  // Step 1: Connection
  console.log('\n--- Step 1: Connection ---');
  const network = await provider.getNetwork();
  console.log('  Chain ID:', network.chainId, network.chainId === 8848 ? 'OK' : 'MISMATCH!');

  // Step 2: Balance
  console.log('\n--- Step 2: Balance ---');
  const balance = await provider.getBalance(wallet.address);
  console.log('  Balance:', ethers.utils.formatEther(balance), 'EXE');

  // Step 3: Send EIP-1559 transaction
  console.log('\n--- Step 3: Send EIP-1559 Transaction ---');
  const toAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const sendValue = ethers.utils.parseEther('0.001');

  try {
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: sendValue,
      gasLimit: 21000,
      type: 2,  // EIP-1559
    });
    console.log('  TX Hash:', tx.hash);
    console.log('  Hash length:', tx.hash.length, '(expected 66)');

    // Step 4: Wait for receipt
    console.log('\n--- Step 4: Wait for Receipt ---');
    const receipt = await tx.wait();
    console.log('  Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    console.log('  Block:', receipt.blockNumber);
    console.log('  Gas Used:', receipt.gasUsed.toString());

    // CRITICAL CHECK: from address must match sender!
    console.log('\n--- Step 5: Verify From Address ---');
    console.log('  Receipt from:', receipt.from);
    console.log('  Expected from:', EXPECTED_ADDRESS);
    console.log('  FROM MATCH:', receipt.from.toLowerCase() === EXPECTED_ADDRESS.toLowerCase() ? 'YES!!!' : 'NO!!!');

    if (receipt.from.toLowerCase() === EXPECTED_ADDRESS.toLowerCase()) {
      console.log('\n  *** TRANSACTION SUCCESS - FROM ADDRESS CORRECT ***');
    } else {
      console.log('\n  *** BUG: FROM ADDRESS STILL WRONG ***');
    }

    // Step 6: Verify getTransactionByHash
    console.log('\n--- Step 6: Verify getTransactionByHash ---');
    const txData = await provider.getTransaction(tx.hash);
    console.log('  TX from:', txData.from);
    console.log('  TX to:', txData.to);
    console.log('  TX value:', ethers.utils.formatEther(txData.value), 'EXE');
    console.log('  TX from match:', txData.from.toLowerCase() === EXPECTED_ADDRESS.toLowerCase() ? 'YES' : 'NO');

    // Step 7: Check nonce incremented
    console.log('\n--- Step 7: Check Nonce ---');
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log('  Current nonce:', nonce, '(expected >= 1)');

    // Step 8: Send second transaction (test nonce increment)
    console.log('\n--- Step 8: Send Second Transaction ---');
    try {
      const tx2 = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.utils.parseEther('0.0001'),
        gasLimit: 21000,
        type: 2,
      });
      console.log('  TX2 Hash:', tx2.hash);
      const receipt2 = await tx2.wait();
      console.log('  TX2 Status:', receipt2.status === 1 ? 'SUCCESS' : 'FAILED');
      console.log('  TX2 From match:', receipt2.from.toLowerCase() === EXPECTED_ADDRESS.toLowerCase() ? 'YES' : 'NO');
    } catch(e) {
      console.log('  TX2 Error:', e.message);
    }

  } catch(e) {
    console.log('  ERROR:', e.message);
    if (e.error) console.log('  Error details:', JSON.stringify(e.error));
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
