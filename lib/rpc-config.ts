/**
 * Centralized RPC configuration for the 0G Pump application
 */

export const RPC_CONFIG = {
  // Backend server RPC proxy (runs on port 4000)
  BACKEND_RPC: (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL)
    ? `${(process as any).env.NEXT_PUBLIC_BACKEND_URL}/api/rpc`
    : 'http://localhost:4000/api/rpc',
  
  // Direct 0G mainnet RPC (primary)
  OG_MAINNET_RPC: 'https://evmrpc.0g.ai',
  // Direct 0G testnet RPC (fallback)
  OG_TESTNET_RPC: 'https://evmrpc-testnet.0g.ai',
  
  // Chain configuration (mainnet)
  CHAIN_ID: 16661,
  NETWORK: '0g-mainnet',
  
  // Environment-specific configuration
  getRpcUrl: () => {
    // In development, prefer backend server to avoid CORS
    if (process.env.NODE_ENV === 'development') {
      return RPC_CONFIG.BACKEND_RPC;
    }
    
    // In production, can use direct RPC or backend proxy
    return process.env.USE_BACKEND_PROXY === 'true' 
      ? RPC_CONFIG.BACKEND_RPC 
      : (process.env.NEXT_PUBLIC_EVM_RPC || RPC_CONFIG.OG_MAINNET_RPC);
  },
  
  // Check if backend server is available
  isBackendAvailable: async (): Promise<boolean> => {
    try {
      const response = await fetch(RPC_CONFIG.BACKEND_RPC, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};

export default RPC_CONFIG;
























