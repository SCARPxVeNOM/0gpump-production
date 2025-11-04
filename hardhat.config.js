require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    "0g-galileo-testnet": {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      // Ensure EIP-1559 with min tip of 2 gwei
      gas: 8000000,
      gasPrice: undefined,
      maxPriorityFeePerGas: 2000000000,
      maxFeePerGas: 2000000000
    },
    "0g-mainnet": {
      url: "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: process.env.DEPLOYER_PRIVATE_KEY 
        ? [process.env.DEPLOYER_PRIVATE_KEY] 
        : process.env.PRIVATE_KEY 
          ? [process.env.PRIVATE_KEY] 
          : [],
      gas: 8000000,
      gasPrice: undefined,
      maxPriorityFeePerGas: 2000000000,
      maxFeePerGas: 2000000000
    }
  }
};
