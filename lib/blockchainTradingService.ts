import { ethers } from 'ethers'

// Contract ABIs
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function createPair(address tokenA, address tokenB) external returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)'
]

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external'
]

const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
]

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function totalSupply() external view returns (uint256)',
  'function decimals() external view returns (uint8)'
]

const IWETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256) external',
  'function transfer(address to, uint256 amount) external returns (bool)'
]

// Interfaces
export interface Trade {
  id: string
  tokenAddress: string
  action: 'buy' | 'sell'
  amount: string
  timestamp: number
  txHash?: string
  status: 'pending' | 'completed' | 'failed'
}

export interface MarketData {
  currentPrice: number
  marketCap: number
  volume24h: number
  change24h: number
  holders: number
}

export interface TokenInfo {
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  creator?: string
  createdAt?: number
  description?: string
  imageRootHash?: string
  metadataRootHash?: string
}

export interface LiquidityPool {
  tokenReserve: number
  ethReserve: number
  totalSupply: number
  tokenPrice: number
}

// Main service class
class BlockchainTradingService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  private readProvider: ethers.providers.FallbackProvider | null = null
  
  // Contract addresses from 0G testnet deployment
  // 0G Galileo DEX (deployed via deployCoreDEX.js)
  private FACTORY_ADDRESS = '0x6eb985234c12acb73619aabbE058868713c634f8'
  private ROUTER_ADDRESS = '0x6738b8c52d4C695cc92D83cfE90B00e9C9F56659'
  private WETH_ADDRESS = '0xf1c1d5E1c79B693AE7b674b8254A8A62314296fB'
  
  private factoryContract: ethers.Contract | null = null
  private routerContract: ethers.Contract | null = null
  private wethContract: ethers.Contract | null = null
  private readFactoryContract: ethers.Contract | null = null

  // Initialize the service with a Web3Provider
  async initialize(provider: ethers.providers.Web3Provider) {
    this.provider = provider
    this.signer = provider.getSigner()

    // Fallback read provider across two RPCs
    try {
      const primary = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_EVM_RPC) || 'https://evmrpc.0g.ai'
      // Use a single reliable endpoint to avoid DNS issues
      const readers = [ new ethers.providers.JsonRpcProvider(primary) ]
      this.readProvider = new ethers.providers.FallbackProvider(readers, 1)
    } catch {
      this.readProvider = new ethers.providers.FallbackProvider([this.provider as any], 1)
    }
    
    // Initialize contract instances
    this.readFactoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.readProvider as any)
    this.factoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.signer)
    this.routerContract = new ethers.Contract(this.ROUTER_ADDRESS, ROUTER_ABI, this.signer)
    this.wethContract = new ethers.Contract(this.WETH_ADDRESS, ERC20_ABI, this.signer)
  }

  // Ensure we have a read-only provider even if initialize hasn't been called
  private getOrCreateReadProvider(): ethers.providers.FallbackProvider {
    if (this.readProvider) return this.readProvider
    const primary = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_EVM_RPC) || 'https://evmrpc-testnet.0g.ai'
    const readers = [ new ethers.providers.JsonRpcProvider(primary) ]
    this.readProvider = new ethers.providers.FallbackProvider(readers, 1)
    // Lazily create read-only factory for convenience
    this.readFactoryContract = new ethers.Contract(this.FACTORY_ADDRESS, FACTORY_ABI, this.readProvider as any)
    return this.readProvider
  }

  private bnToBigInt(v: ethers.BigNumber): bigint {
    return BigInt(v.toString())
  }

  private getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number = 30): bigint {
    const feeDen = 10000n
    const amountInWithFee = amountIn * (feeDen - BigInt(feeBps)) / feeDen
    return (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
  }

  private async getPairAddress(tokenAddress: string): Promise<string> {
    if (!this.readFactoryContract) {
      // Fall back to read-only provider if not initialized
      this.getOrCreateReadProvider()
    }
    const pair = await (this.readFactoryContract as ethers.Contract).getPair(tokenAddress, this.WETH_ADDRESS)
    return pair
  }

  // Get token price from DEX pair reserves
  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const reader = this.getOrCreateReadProvider()
      const pairAddress = await this.getPairAddress(tokenAddress)
      if (pairAddress === ethers.constants.AddressZero || !reader) return 0
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, reader)
      const [r0, r1] = await pair.getReserves()
      const token0 = await pair.token0()
      const tokenIs0 = token0.toLowerCase() === tokenAddress.toLowerCase()
      const tokenReserve = this.bnToBigInt(tokenIs0 ? r0 : r1)
      const wethReserve = this.bnToBigInt(tokenIs0 ? r1 : r0)
      if (tokenReserve === 0n || wethReserve === 0n) return 0
      const priceWei = (wethReserve * 10n ** 18n) / tokenReserve
      return Number(priceWei) / 1e18
    } catch (e) {
      console.error('Error getting token price:', e)
      return 0
    }
  }

  // Get market data for a token
  async getMarketData(tokenAddress: string): Promise<MarketData> {
    try {
      const price = await this.getTokenPrice(tokenAddress)
      
      // Get token contract for total supply using read provider
      const reader = this.getOrCreateReadProvider()
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, reader)
      const totalSupply = await tokenContract.totalSupply()
      const decimals = await tokenContract.decimals()
      
      const totalSupplyNumber = totalSupply.toNumber() / Math.pow(10, decimals)
      const marketCap = price * totalSupplyNumber
      
      return {
        currentPrice: price,
        marketCap,
        volume24h: 0,
        change24h: 0,
        holders: 0
      }
    } catch (error) {
      console.error('Error getting market data:', error)
      return {
        currentPrice: 0,
        marketCap: 0,
        volume24h: 0,
        change24h: 0,
        holders: 0
      }
    }
  }

  // Execute a trade (buy or sell)
  async executeTrade(
    tokenAddress: string, 
    action: 'buy' | 'sell', 
    amount: string,
    slippageTolerance: number = 0.5 // 0.5% default slippage
  ): Promise<Trade> {
    try {
      if (!this.signer || !this.provider) {
        throw new Error('Service not initialized')
      }

      const trade: Trade = {
        id: Date.now().toString(),
        tokenAddress,
        action,
        amount,
        timestamp: Date.now(),
        status: 'pending'
      }

      const pairAddress = await this.getPairAddress(tokenAddress)
      if (pairAddress === ethers.constants.AddressZero) throw new Error('No liquidity pool')
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.signer)
      const token0 = await pair.token0()
      const tokenIs0 = token0.toLowerCase() === tokenAddress.toLowerCase()

      // use readProvider for reserves
      const reader = this.readProvider || this.provider
      const readPair = new ethers.Contract(pairAddress, PAIR_ABI, reader)
      const [r0, r1] = await readPair.getReserves()
      const reserveToken = this.bnToBigInt(tokenIs0 ? r0 : r1)
      const reserveWeth  = this.bnToBigInt(tokenIs0 ? r1 : r0)
      if (reserveToken === 0n || reserveWeth === 0n) throw new Error('Pool has zero reserves')

      let receipt: ethers.providers.TransactionReceipt
      if (action === 'buy') {
        const amtEth = ethers.utils.parseEther(amount)
        const weth = new ethers.Contract(this.WETH_ADDRESS, IWETH_ABI, this.signer)
        await (await weth.deposit({ value: amtEth })).wait()
        await (await weth.transfer(pairAddress, amtEth)).wait()
        const out = this.getAmountOut(this.bnToBigInt(amtEth), reserveWeth, reserveToken)
        const minOut = (out * BigInt(10000 - Math.floor(slippageTolerance * 100))) / 10000n
        const outBN = ethers.BigNumber.from(minOut.toString())
        const amount0Out = tokenIs0 ? outBN : ethers.constants.Zero
        const amount1Out = tokenIs0 ? ethers.constants.Zero : outBN
        const tx = await pair.swap(amount0Out, amount1Out, await this.signer.getAddress(), '0x')
        receipt = await tx.wait()
      } else {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer)
        const decimals: number = await token.decimals()
        const amtToken = ethers.utils.parseUnits(amount, decimals)
        await (await token.transfer(pairAddress, amtToken)).wait()
        const out = this.getAmountOut(this.bnToBigInt(amtToken), reserveToken, reserveWeth)
        const minOut = (out * BigInt(10000 - Math.floor(slippageTolerance * 100))) / 10000n
        const outBN = ethers.BigNumber.from(minOut.toString())
        const amount0Out = tokenIs0 ? ethers.constants.Zero : outBN
        const amount1Out = tokenIs0 ? outBN : ethers.constants.Zero
        const tx = await pair.swap(amount0Out, amount1Out, await this.signer.getAddress(), '0x')
        await tx.wait()
        const weth = new ethers.Contract(this.WETH_ADDRESS, IWETH_ABI, this.signer)
        await (await weth.withdraw(outBN)).wait()
        receipt = await tx.wait()
      }

      trade.txHash = receipt.transactionHash
      trade.status = 'completed'

      return trade
    } catch (error) {
      console.error('Trade execution failed:', error)
      throw error
    }
  }

  // Add liquidity to a token-ETH pair
  async addLiquidity(
    tokenAddress: string, 
    ethAmount: string, 
    tokenAmount: string
  ): Promise<string> {
    try {
      if (!this.routerContract || !this.signer) {
        throw new Error('Service not initialized')
      }

      const ethAmountWei = ethers.utils.parseEther(ethAmount)
      const tokenAmountWei = ethers.utils.parseEther(tokenAmount)

      // Approve router to spend tokens
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer)
      await tokenContract.approve(this.ROUTER_ADDRESS, tokenAmountWei)

      const tx = await this.routerContract.addLiquidityETH(
        tokenAddress,
        tokenAmountWei,
        0,
        0,
        await this.signer.getAddress(),
        Math.floor(Date.now() / 1000) + 1800,
        { value: ethAmountWei }
      )

      const receipt = await tx.wait()
      return receipt.transactionHash
    } catch (error) {
      console.error('Add liquidity failed:', error)
      throw error
    }
  }

  // Get liquidity pool information
  async getLiquidityPool(tokenAddress: string): Promise<LiquidityPool | null> {
    try {
      if (!this.readFactoryContract || !this.readProvider) {
        throw new Error('Service not initialized')
      }

      const pairAddress = await this.readFactoryContract.getPair(tokenAddress, this.WETH_ADDRESS)
      if (pairAddress === ethers.constants.AddressZero) {
        return null // No pair exists
      }

      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, this.readProvider)
      const reserves = await pairContract.getReserves()
      const token0 = await pairContract.token0()

      const [tokenReserve, ethReserve] = token0.toLowerCase() === tokenAddress.toLowerCase() 
        ? [reserves.reserve0, reserves.reserve1]
        : [reserves.reserve1, reserves.reserve0]

      const tokenReserveNumber = tokenReserve.toNumber() / Math.pow(10, 18)
      const ethReserveNumber = ethReserve.toNumber() / Math.pow(10, 18)
      const tokenPrice = ethReserveNumber / tokenReserveNumber

      return {
        tokenReserve: tokenReserveNumber,
        ethReserve: ethReserveNumber,
        totalSupply: 0,
        tokenPrice
      }
    } catch (error) {
      console.error('Error getting liquidity pool:', error)
      return null
    }
  }

  // Check if a liquidity pool exists for a token
  async hasLiquidityPool(tokenAddress: string): Promise<boolean> {
    try {
      if (!this.readFactoryContract) {
        throw new Error('Service not initialized')
      }

      const pairAddress = await this.readFactoryContract.getPair(tokenAddress, this.WETH_ADDRESS)
      return pairAddress !== ethers.constants.AddressZero
    } catch (error) {
      console.error('Error checking liquidity pool:', error)
      return false
    }
  }

  // Get user's token balance
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      if (!this.provider) throw new Error('Service not initialized')
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
      const balance = await tokenContract.balanceOf(userAddress)
      const decimals = await tokenContract.decimals()
      return ethers.utils.formatUnits(balance, decimals)
    } catch (error) {
      console.error('Error getting token balance:', error)
      return '0'
    }
  }

  // Get user's ETH balance
  async getETHBalance(userAddress: string): Promise<string> {
    try {
      if (!this.provider) throw new Error('Service not initialized')
      const balance = await this.provider.getBalance(userAddress)
      return ethers.utils.formatEther(balance)
    } catch (error) {
      console.error('Error getting ETH balance:', error)
      return '0'
    }
  }

  // Best-effort on-chain token info (ERC20 + optional OGToken fields)
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const reader = this.getOrCreateReadProvider()
    const baseErc20Abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)'
    ]
    const optionalMetaAbi = [
      'function creator() view returns (address)',
      'function createdAt() view returns (uint256)',
      'function description() view returns (string)',
      'function imageRootHash() view returns (bytes32)',
      'function metadataRootHash() view returns (bytes32)'
    ]
    const contract = new ethers.Contract(tokenAddress, [...baseErc20Abi, ...optionalMetaAbi], reader)
    const info: TokenInfo = {
      name: '',
      symbol: '',
      decimals: 18,
      totalSupply: '0'
    }
    try { info.name = await contract.name() } catch {}
    try { info.symbol = await contract.symbol() } catch {}
    try { info.decimals = await contract.decimals() } catch {}
    try { const ts = await contract.totalSupply(); info.totalSupply = ethers.utils.formatUnits(ts, info.decimals) } catch {}
    try { info.creator = await contract.creator() } catch {}
    try { const ca = await contract.createdAt(); info.createdAt = Number(ca) } catch {}
    try { info.description = await contract.description() } catch {}
    try { const ih = await contract.imageRootHash(); info.imageRootHash = ih } catch {}
    try { const mh = await contract.metadataRootHash(); info.metadataRootHash = mh } catch {}
    return info
  }
}

// Export singleton instance
export const blockchainTradingService = new BlockchainTradingService()
