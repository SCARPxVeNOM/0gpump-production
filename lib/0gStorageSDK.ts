export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  supply: string;
  description: string;
  imageUrl: string;
  metadataUrl?: string;
  imageRootHash?: string;
  metadataRootHash?: string;
  createdAt: string;
  creator: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
}

export interface StorageConfig {
  evmRpc: string;
  indexerRpc: string;
  privateKey: string;
  segmentNumber?: number;
  expectedReplicas?: number;
  backendUrl?: string;
}

class OGStorageSDK {
  private config: StorageConfig;
  private web3Provider: any;
  private indexerClient: any;
  private backendUrl: string;
  private storageKey = '0g_coins_data';

  constructor(config: StorageConfig) {
    this.config = {
      segmentNumber: 1,
      expectedReplicas: 3,
      backendUrl: (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000',
      ...config
    };
    this.backendUrl = this.config.backendUrl!;
  }

  // Initialize the SDK with Web3 and Indexer clients
  async initialize(): Promise<void> {
    try {
      // Initialize Web3 provider
      const { ethers } = await import('ethers');
      this.web3Provider = new ethers.JsonRpcProvider(this.config.evmRpc);
      
      // Initialize Indexer client (simulated for now)
      this.indexerClient = {
        selectNodes: async (ctx: any, segmentNumber: number, expectedReplicas: number) => {
          // Simulate node selection - in real implementation this would call the indexer
          return [
            { id: 'node1', endpoint: 'https://storage-node-1.0g.ai' },
            { id: 'node2', endpoint: 'https://storage-node-2.0g.ai' },
            { id: 'node3', endpoint: 'https://storage-node-3.0g.ai' }
          ];
        }
      };

      console.log('✅ 0G Storage SDK initialized successfully');
      console.log(`🌐 Backend URL: ${this.backendUrl}`);
    } catch (error) {
      console.error('❌ Failed to initialize 0G Storage SDK:', error);
      throw error;
    }
  }

  // Calculate Merkle root hash for a file
  async calculateFileHash(data: string): Promise<string> {
    try {
      const { ethers } = await import('ethers');
      const hash = ethers.keccak256(ethers.toUtf8Bytes(data));
      return hash;
    } catch (error) {
      console.error('Error calculating file hash:', error);
      throw error;
    }
  }

  // Upload data to 0G Storage network (using backend server)
  async uploadData(
    data: any,
    metadata?: any,
    options?: { quiet?: boolean }
  ): Promise<{ txHash: string; rootHash: string }> {
    try {
      if (!this.web3Provider) {
        throw new Error('SDK not initialized. Call initialize() first.');
      }

      // In dev, default to skipping remote uploads unless explicitly enabled
      const isDev = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NODE_ENV) !== 'production'
      const uploadsEnabled = ((typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_ENABLE_0G_UPLOADS) ?? (isDev ? 'false' : 'true')) === 'true'

      const dataString = JSON.stringify(data);
      const rootHash = await this.calculateFileHash(dataString);
      
      if (!uploadsEnabled) {
        // Short-circuit in dev or when disabled; pretend success so callers can cache locally
        return { txHash: rootHash, rootHash };
      }

      // Upload to backend server (which now uses real 0G Storage)
      const response = await fetch(`${this.backendUrl}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: dataString,
          metadata: metadata || {},
        })
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('✅ Data uploaded to 0G Storage via backend');
      console.log(`📁 Root Hash: ${result.rootHash}`);
      
      return {
        txHash: result.rootHash, // Using rootHash as txHash for now
        rootHash: result.rootHash
      };
    } catch (error) {
      if (!(options && options.quiet)) {
        console.error('❌ Upload failed:', error);
      }
      throw error;
    }
  }

  // Create a new coin with 0G Storage integration
  async createCoin(coinData: {
    name: string;
    symbol: string;
    description: string;
    supply: string;
    creator: string;
    imageFile?: File;
  }): Promise<CoinData> {
    try {
      console.log(`🪙 Creating coin: ${coinData.name} (${coinData.symbol})`);

      const formData = new FormData();
      formData.append('name', coinData.name);
      formData.append('symbol', coinData.symbol);
      formData.append('description', coinData.description);
      formData.append('supply', coinData.supply);
      formData.append('creator', coinData.creator);
      
      if (coinData.imageFile) {
        formData.append('image', coinData.imageFile);
      }

      const response = await fetch(`${this.backendUrl}/createCoin`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to create coin: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Coin created successfully with 0G Storage integration');
        console.log(`🖼️ Image Root Hash: ${result.coin.imageRootHash}`);
        console.log(`📄 Metadata Root Hash: ${result.coin.metadataRootHash}`);
        
        // Store in local storage for persistence
        this.storeCoinLocally(result.coin);
        
        return result.coin;
      } else {
        throw new Error('Failed to create coin');
      }
    } catch (error) {
      console.error('❌ Create coin failed:', error);
      throw error;
    }
  }

  // Get all coins from local storage (for now, since we don't have a database)
  async getAllCoins(): Promise<CoinData[]> {
    try {
      if (typeof window !== 'undefined') {
        // Primary key
        const storedCoins = localStorage.getItem(this.storageKey);
        if (storedCoins) {
          return JSON.parse(storedCoins);
        }
        // Legacy key migration: '0g_coins' -> '0g_coins_data'
        const legacy = localStorage.getItem('0g_coins');
        if (legacy) {
          try {
            const coins = JSON.parse(legacy);
            // Save under the new key for future loads
            localStorage.setItem(this.storageKey, JSON.stringify(coins));
            return coins;
          } catch (e) {
            console.warn('Failed to parse legacy 0g_coins; ignoring');
          }
        }
      }
      return [];
    } catch (error) {
      console.error('Error getting stored coins:', error);
      return [];
    }
  }

  // Store coin data locally
  private async storeCoinLocally(coin: CoinData): Promise<void> {
    try {
      const existingCoins = await this.getAllCoins();
      const updatedCoins = [...existingCoins, coin];
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.storageKey, JSON.stringify(updatedCoins));
        console.log(`💾 Coin stored locally: ${coin.name}`);
      }
    } catch (error) {
      console.error('Error storing coin locally:', error);
    }
  }

  // Public helper to store a coin locally (used by UI flows that already did uploads)
  public async saveCoinToLocal(coin: CoinData): Promise<void> {
    await this.storeCoinLocally(coin);
  }

  // Download data from 0G Storage
  async downloadData(rootHash: string): Promise<any> {
    try {
      console.log(`📥 Downloading data with rootHash: ${rootHash}`);
      
      const response = await fetch(`${this.backendUrl}/download/${rootHash}`);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Check if it's JSON data
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        // Return as blob for binary data (images, etc.)
        return await response.blob();
      }
    } catch (error) {
      console.error('❌ Download failed:', error);
      throw error;
    }
  }

  // Get coin image URL
  getCoinImageUrl(imageRootHash: string): string {
    return `${this.backendUrl}/download/${imageRootHash}`;
  }

  // Get coin metadata URL
  getCoinMetadataUrl(metadataRootHash: string): string {
    return `${this.backendUrl}/download/${metadataRootHash}`;
  }

  // Verify coin data integrity using root hashes
  async verifyCoinData(coin: CoinData): Promise<boolean> {
    try {
      if (!coin.metadataRootHash) {
        console.warn('No metadata root hash to verify');
        return false;
      }

      // Download and verify metadata
      const metadata = await this.downloadData(coin.metadataRootHash);
      const expectedHash = await this.calculateFileHash(JSON.stringify(metadata));
      
      const isValid = expectedHash === coin.metadataRootHash;
      console.log(`🔍 Coin verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      
      return isValid;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      return false;
    }
  }
}

// Create and export a configured instance
export const ogStorageSDK = new OGStorageSDK({
	evmRpc: process.env.NEXT_PUBLIC_EVM_RPC || 'https://evmrpc.0g.ai',
	indexerRpc: process.env.NEXT_PUBLIC_INDEXER_RPC || 'https://indexer-storage-turbo.0g.ai',
	privateKey: process.env.NEXT_PUBLIC_PRIVATE_KEY || '',
	backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
});

// Initialize the SDK when imported
ogStorageSDK.initialize().catch(console.error);
