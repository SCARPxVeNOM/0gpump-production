require('dotenv').config();
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Mainnet configuration
const MAINNET_RPC = 'https://evmrpc.0g.ai';
const MAINNET_CHAIN_ID = 16661;
const NETWORK_NAME = '0g-mainnet';

// Get private key from environment variables (0G best practice)
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error('DEPLOYER_PRIVATE_KEY or PRIVATE_KEY must be set in environment variables');
}

const DEFAULT_FEE_BPS = 500; // 5%

async function main() {
  console.log('🚀 Starting 0G Mainnet Deployment');
  console.log('===================================\n');
  
  // Setup provider and wallet from environment variable
  let wallet;
  let provider;
  try {
    // Try to get signer from hardhat network config first
    const [deployer] = await ethers.getSigners();
    if (deployer) {
      wallet = deployer;
      provider = deployer.provider;
      console.log('✅ Using wallet from hardhat network configuration');
    } else {
      throw new Error('No signer from hardhat config');
    }
  } catch (error) {
    // Fallback to creating wallet from environment variable
    console.log('⚠️  Using private key from environment variable');
    
    // Setup provider - use hardhat's ethers (compatible with v5/v6)
    if (ethers.providers && ethers.providers.JsonRpcProvider) {
      // ethers v5
      provider = new ethers.providers.JsonRpcProvider(MAINNET_RPC);
    } else {
      // ethers v6
      const ethersLib = require('ethers');
      provider = new ethersLib.JsonRpcProvider(MAINNET_RPC);
    }
    wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  }
  
  // Get wallet address (compatible with v5/v6)
  let walletAddress;
  if (wallet.address) {
    walletAddress = wallet.address;
  } else {
    walletAddress = await wallet.getAddress();
  }
  
  // Set treasury address to wallet address
  const TREASURY_ADDRESS = walletAddress;
  console.log(`👤 Deployer Address: ${walletAddress}`);
  const balance = await provider.getBalance(walletAddress);
  
  // Use formatEther from hardhat's ethers (works with both v5 and v6)
  const formatEther = ethers.formatEther || ethers.utils.formatEther;
  const balanceFormatted = formatEther(balance);
  console.log(`💰 Balance: ${balanceFormatted} 0G\n`);
  
  // Check balance - use parseEther from hardhat's ethers
  const parseEther = ethers.parseEther || ethers.utils.parseEther;
  const minBalance = parseEther('0.05'); // Minimum for deployment
  if (balance < minBalance) {
    console.warn('⚠️  WARNING: Low balance detected!');
    console.warn(`   Current: ${balanceFormatted} 0G`);
    console.warn(`   Recommended: At least 0.05 0G for deployment`);
    console.warn('   Proceeding anyway... (deployment will fail if insufficient for gas)');
    console.warn('   Please ensure funds are in the wallet before deployment.\n');
  } else {
    console.log(`✅ Sufficient balance for deployment\n`);
  }
  
  const deploymentResults = {
    network: NETWORK_NAME,
    chainId: MAINNET_CHAIN_ID,
    deployer: walletAddress,
    deployedAt: new Date().toISOString(),
    contracts: {}
  };
  
  try {
    // Step 1: Deploy DEX Core Contracts
    console.log('📦 Step 1: Deploying DEX Core Contracts...\n');
    
    // Deploy WETH9
    console.log('   Deploying WETH9...');
    const WETH = await ethers.getContractFactory('WETH9', wallet);
    const weth = await WETH.deploy();
    await weth.waitForDeployment();
    const wethAddress = await weth.getAddress();
    console.log(`   ✅ WETH9 deployed: ${wethAddress}`);
    deploymentResults.contracts.weth = wethAddress;
    
    // Deploy UniswapV2Factory
    console.log('\n   Deploying UniswapV2Factory...');
    const Factory = await ethers.getContractFactory('UniswapV2Factory', wallet);
    const factory = await Factory.deploy(walletAddress);
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`   ✅ UniswapV2Factory deployed: ${factoryAddress}`);
    deploymentResults.contracts.uniswapFactory = factoryAddress;
    
    // Deploy UniswapV2Router02
    console.log('\n   Deploying UniswapV2Router02...');
    const Router = await ethers.getContractFactory('UniswapV2Router02', wallet);
    const router = await Router.deploy(factoryAddress, wethAddress);
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log(`   ✅ UniswapV2Router02 deployed: ${routerAddress}`);
    deploymentResults.contracts.uniswapRouter = routerAddress;
    
    console.log('\n✅ DEX Core Contracts deployed successfully!\n');
    
    // Step 2: Deploy AutoTradingFactory
    console.log('🏗️ Step 2: Deploying AutoTradingFactory...\n');
    const AutoTradingFactory = await ethers.getContractFactory('AutoTradingFactory', wallet);
    const autoTradingFactory = await AutoTradingFactory.deploy(
      factoryAddress,
      routerAddress,
      wethAddress,
      walletAddress // fee recipient
    );
    await autoTradingFactory.waitForDeployment();
    const autoTradingFactoryAddress = await autoTradingFactory.getAddress();
    console.log(`   ✅ AutoTradingFactory deployed: ${autoTradingFactoryAddress}`);
    deploymentResults.contracts.autoTradingFactory = autoTradingFactoryAddress;
    
    // Step 3: Deploy App Factory (Factory.sol - MemeToken + BondingCurve Factory)
    console.log('\n🏭 Step 3: Deploying App Factory (Factory.sol)...\n');
    const AppFactory = await ethers.getContractFactory('Factory', wallet);
    const appFactory = await AppFactory.deploy(TREASURY_ADDRESS, DEFAULT_FEE_BPS);
    await appFactory.waitForDeployment();
    const appFactoryAddress = await appFactory.getAddress();
    console.log(`   ✅ App Factory deployed: ${appFactoryAddress}`);
    console.log(`   📊 Treasury: ${TREASURY_ADDRESS}`);
    console.log(`   📊 Default Fee: ${DEFAULT_FEE_BPS} bps (${DEFAULT_FEE_BPS / 100}%)`);
    deploymentResults.contracts.appFactory = appFactoryAddress;
    deploymentResults.contracts.treasury = TREASURY_ADDRESS;
    deploymentResults.contracts.defaultFeeBps = DEFAULT_FEE_BPS;
    
    // Step 4: Deploy OGToken (0G Storage Integration Token)
    console.log('\n🪙 Step 4: Deploying OGToken (0G Storage Integration)...\n');
    const OGToken = await ethers.getContractFactory('OGToken', wallet);
    const name = '0G Storage Token';
    const symbol = '0GST';
    // Use parseEther from hardhat's ethers (handles v5/v6)
    const parseEther = ethers.parseEther || ethers.utils.parseEther;
    const initialSupply = parseEther('1000000'); // 1 million tokens
    const description = 'A token demonstrating 0G Storage integration on mainnet';
    const metadataRootHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const imageRootHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    const ogToken = await OGToken.deploy(
      name,
      symbol,
      initialSupply,
      description,
      metadataRootHash,
      imageRootHash
    );
    await ogToken.waitForDeployment();
    const ogTokenAddress = await ogToken.getAddress();
    console.log(`   ✅ OGToken deployed: ${ogTokenAddress}`);
    console.log(`   📊 Name: ${name}`);
    console.log(`   📊 Symbol: ${symbol}`);
    const formatEther = ethers.formatEther || ethers.utils.formatEther;
    console.log(`   📊 Initial Supply: ${formatEther(initialSupply)} tokens`);
    deploymentResults.contracts.ogToken = ogTokenAddress;
    
    // Save deployment results
    console.log('\n💾 Saving deployment results...\n');
    
    // Ensure deployments directory exists
    if (!fs.existsSync('deployments')) {
      fs.mkdirSync('deployments', { recursive: true });
    }
    
    // Save main deployment file
    const mainDeploymentFile = path.join('deployments', 'mainnet-deployment.json');
    fs.writeFileSync(mainDeploymentFile, JSON.stringify(deploymentResults, null, 2));
    console.log(`✅ Main deployment saved: ${mainDeploymentFile}`);
    
    // Save individual contract files
    const individualFiles = {
      'dex-core-0g-mainnet.json': {
        network: NETWORK_NAME,
        chainId: MAINNET_CHAIN_ID,
        factoryAddress: factoryAddress,
        routerAddress: routerAddress,
        wethAddress: wethAddress,
        deployer: walletAddress,
        deployedAt: new Date().toISOString()
      },
      'auto-trading-factory-0g-mainnet.json': {
        network: NETWORK_NAME,
        chainId: MAINNET_CHAIN_ID,
        address: autoTradingFactoryAddress,
        factoryAddress: factoryAddress,
        routerAddress: routerAddress,
        wethAddress: wethAddress,
        feeRecipient: walletAddress,
        deployer: walletAddress,
        deployedAt: new Date().toISOString()
      },
      'app-factory-0g-mainnet.json': {
        network: NETWORK_NAME,
        chainId: MAINNET_CHAIN_ID,
        address: appFactoryAddress,
        treasury: TREASURY_ADDRESS,
        defaultFeeBps: DEFAULT_FEE_BPS,
        deployer: walletAddress,
        deployedAt: new Date().toISOString()
      },
      'ogtoken-0g-mainnet.json': {
        contractName: 'OGToken',
        address: ogTokenAddress,
        network: NETWORK_NAME,
        chainId: MAINNET_CHAIN_ID,
        deployer: walletAddress,
        constructorArgs: {
          name: name,
          symbol: symbol,
          initialSupply: initialSupply.toString ? initialSupply.toString() : initialSupply,
          description: description,
          metadataRootHash: metadataRootHash,
          imageRootHash: imageRootHash
        },
        deploymentTime: new Date().toISOString()
      }
    };
    
    for (const [filename, data] of Object.entries(individualFiles)) {
      const filePath = path.join('deployments', filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved: ${filePath}`);
    }
    
    // Update deployment-config.json
    const deploymentConfig = {
      factoryAddress: factoryAddress,
      routerAddress: routerAddress,
      wethAddress: wethAddress,
      network: NETWORK_NAME,
      chainId: MAINNET_CHAIN_ID,
      deployerAddress: walletAddress,
      deploymentTime: new Date().toISOString()
    };
    fs.writeFileSync('deployment-config.json', JSON.stringify(deploymentConfig, null, 2));
    console.log(`✅ Updated: deployment-config.json`);
    
    // Update lib/trading-config.ts
    const tradingConfig = `// Auto-generated by deployAllMainnet.js
// 0G Mainnet Configuration
export const TRADING_CONFIG = {
  FACTORY_ADDRESS: '${factoryAddress}',
  ROUTER_ADDRESS: '${routerAddress}',
  WETH_ADDRESS: '${wethAddress}',
  AUTO_TRADING_FACTORY_ADDRESS: '${autoTradingFactoryAddress}',
  APP_FACTORY_ADDRESS: '${appFactoryAddress}',
  NETWORK: '${NETWORK_NAME}',
  RPC_URL: '${MAINNET_RPC}',
  CHAIN_ID: ${MAINNET_CHAIN_ID},
  STORAGE_INDEXER: 'https://indexer-storage-turbo.0g.ai',
  BLOCK_EXPLORER: 'https://chainscan.0g.ai'
};
`;
    fs.writeFileSync(path.join('lib', 'trading-config.ts'), tradingConfig);
    console.log(`✅ Updated: lib/trading-config.ts`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📋 Contract Addresses Summary:');
    console.log('─'.repeat(60));
    console.log(`DEX Contracts:`);
    console.log(`  WETH9:              ${wethAddress}`);
    console.log(`  UniswapV2Factory:   ${factoryAddress}`);
    console.log(`  UniswapV2Router02:  ${routerAddress}`);
    console.log(`\nTrading Contracts:`);
    console.log(`  AutoTradingFactory: ${autoTradingFactoryAddress}`);
    console.log(`  App Factory:        ${appFactoryAddress}`);
    console.log(`\n0G Storage Contracts:`);
    console.log(`  OGToken:            ${ogTokenAddress}`);
    console.log('─'.repeat(60));
    console.log(`\n🔗 Network Details:`);
    console.log(`  Network: ${NETWORK_NAME}`);
    console.log(`  Chain ID: ${MAINNET_CHAIN_ID}`);
    console.log(`  RPC URL: ${MAINNET_RPC}`);
    console.log(`  Block Explorer: https://chainscan.0g.ai`);
    console.log(`  Storage Indexer: https://indexer-storage-turbo.0g.ai`);
    console.log('─'.repeat(60));
    console.log(`\n💡 Next Steps:`);
    console.log(`  1. Verify all contracts on chainscan.0g.ai`);
    console.log(`  2. Update your frontend with the new contract addresses`);
    console.log(`  3. Test token creation and trading functionality`);
    console.log(`  4. Update metadata root hashes for OGToken using 0G Storage`);
    console.log('─'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    console.error('\nError details:', error.message);
    if (error.transaction) {
      console.error('Failed transaction:', error.transaction);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });

