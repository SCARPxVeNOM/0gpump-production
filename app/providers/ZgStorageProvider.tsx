import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { ZgStorageService, getZgStorageService } from "../lib/zg-storage";

export const ZgStorageContext = createContext<{
  zgStorage: ZgStorageService | null;
  isConnected: boolean;
  error?: string;
}>({ 
  zgStorage: null, 
  isConnected: false 
});

export const ZgStorageProvider = ({ children }: { children: ReactNode }) => {
  const [zgStorage, setZgStorage] = useState<ZgStorageService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const initializeZgStorage = async () => {
    try {
      setError(undefined);
      
      const zgStorageService = getZgStorageService({
        rpcUrl: process.env.NEXT_PUBLIC_EVM_RPC || 'https://evmrpc.0g.ai/',
        indexerRpc: process.env.NEXT_PUBLIC_INDEXER_RPC || 'https://indexer-storage-turbo.0g.ai',
      });

      setZgStorage(zgStorageService);

      const networkStatus = await zgStorageService.getNetworkStatus();
      if (networkStatus.rpc && networkStatus.indexer) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        setError('Failed to connect to 0G Storage');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsConnected(false);
    }
  };
  
  useEffect(() => {
    initializeZgStorage();
  }, []);

  return (
    <ZgStorageContext.Provider value={{ zgStorage, isConnected, error }}>
      {children}
    </ZgStorageContext.Provider>
  );
};

export const useZgStorage = () => {
  const { zgStorage, isConnected, error } = useContext(ZgStorageContext);
  return { zgStorage, isConnected, error };
};
