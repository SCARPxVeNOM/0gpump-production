require('dotenv').config();
const { ethers } = require('hardhat');

// Network configurations
const MAINNET_RPC = 'https://evmrpc.0g.ai';
const MAINNET_CHAIN_ID = 16661;
const ETHEREUM_RPC = 'https://eth.llamarpc.com'; // Public Ethereum RPC
const WALLET_ADDRESS = '0x1ab7d5ecbe2c551ebffdfa06661b77cc60dbd425';

async function main() {
  console.log('🔍 Checking Wallet Balances');
  console.log('='.repeat(60));
  console.log(`Wallet Address: ${WALLET_ADDRESS}\n`);

  // Check 0G Mainnet balance
  try {
    console.log('📊 Checking 0G Mainnet Balance...');
    let ogProvider;
    if (ethers.providers && ethers.providers.JsonRpcProvider) {
      ogProvider = new ethers.providers.JsonRpcProvider(MAINNET_RPC);
    } else {
      const ethersLib = require('ethers');
      ogProvider = new ethersLib.JsonRpcProvider(MAINNET_RPC);
    }
    const ogBalance = await ogProvider.getBalance(WALLET_ADDRESS);
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const ogBalanceFormatted = formatEther(ogBalance);
    console.log(`   0G Mainnet: ${ogBalanceFormatted} 0G`);
    
    if (parseFloat(ogBalanceFormatted) >= 0.1) {
      console.log('   ✅ Sufficient balance for deployment!\n');
    } else {
      console.log('   ⚠️  Insufficient balance. Need at least 0.1 0G for deployment.\n');
    }
  } catch (error) {
    console.log('   ❌ Error checking 0G Mainnet:', error.message, '\n');
  }

  // Check Ethereum Mainnet balance
  try {
    console.log('📊 Checking Ethereum Mainnet Balance...');
    let ethProvider;
    if (ethers.providers && ethers.providers.JsonRpcProvider) {
      ethProvider = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC);
    } else {
      const ethersLib = require('ethers');
      ethProvider = new ethersLib.JsonRpcProvider(ETHEREUM_RPC);
    }
    const ethBalance = await ethProvider.getBalance(WALLET_ADDRESS);
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    const ethBalanceFormatted = formatEther(ethBalance);
    console.log(`   Ethereum Mainnet: ${ethBalanceFormatted} ETH`);
    
    // Check for 0G token on Ethereum (if it's an ERC20)
    // Note: 0G token contract address on Ethereum would need to be known
    console.log('   (If you have 0G tokens on Ethereum, they need to be bridged)\n');
  } catch (error) {
    console.log('   ❌ Error checking Ethereum:', error.message, '\n');
  }

  console.log('='.repeat(60));
  console.log('\n💡 Next Steps:');
  console.log('   1. Bridge your 0G tokens from Ethereum to 0G Mainnet');
  console.log('   2. Check official 0G bridge: https://bridge.0g.ai (if available)');
  console.log('   3. Or check 0G documentation: https://docs.0g.ai');
  console.log('   4. Once bridged, run: npm run deploy:mainnet\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

