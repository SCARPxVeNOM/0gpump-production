import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import os from "os";

dotenv.config();

const INDEXER_RPC = process.env.INDEXER_RPC || "https://indexer-storage-turbo.0g.ai";
const RPC_URL = process.env.RPC_ENDPOINT || process.env.RPC_URL || "https://evmrpc.0g.ai";
const DIALOGUE_MAP_FILE = path.join(os.tmpdir(), '0g-dialogue-map.json');

export class StorageManager {
  constructor() {
    this.indexer = new Indexer(INDEXER_RPC);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    this.provider = provider;
    this.evmRpc = RPC_URL;
    
    this.dialogueMap = new Map();

    this.initializeAndLog();
    console.log("✅ 0G Storage Manager initialized successfully.");
  }

  async initializeAndLog() {
    await this._loadDialogueMap();
    try {
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(this.signer.address);
      console.log(`🌐 Connected to network: Chain ID ${network.chainId}`);
      console.log(`💰 Wallet: ${this.signer.address}`);
      console.log(`💰 Balance: ${ethers.formatEther(balance)} A0GI`);
      
      if (balance === 0n) {
        console.warn("⚠️  WARNING: Wallet balance is 0! Get testnet tokens from https://faucet.0g.ai");
      }
    } catch (error) {
      console.error("Error getting network info:", error.message);
    }
  }

  async _loadDialogueMap() {
    try {
      const data = await fs.readFile(DIALOGUE_MAP_FILE, 'utf8');
      const obj = JSON.parse(data);
      this.dialogueMap = new Map(Object.entries(obj));
      console.log(`🗺️  Dialogue map loaded from ${DIALOGUE_MAP_FILE}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('ℹ️  No existing dialogue map found. A new one will be created.');
      } else {
        console.error('Error loading dialogue map:', error);
      }
    }
  }

  async _saveDialogueMap() {
    try {
      const obj = Object.fromEntries(this.dialogueMap);
      await fs.writeFile(DIALOGUE_MAP_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving dialogue map:', error);
    }
  }

  async _uploadAsFile(data) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), '0g-storage-'));
    const tempFile = path.join(tempDir, `dialogue-${Date.now()}.json`);
    
    try {
      const jsonData = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await fs.writeFile(tempFile, jsonData, 'utf8');
      
      console.log(`📝 Created temporary file: ${tempFile}`);
      
      const zgFile = await ZgFile.fromFilePath(tempFile);
      const [tree, treeErr] = await zgFile.merkleTree();
      
      if (treeErr) {
        throw new Error(`Failed to generate merkle tree: ${treeErr}`);
      }
      
      const rootHash = tree.rootHash();
      console.log(`🌳 File merkle root: ${rootHash}`);
      console.log(`📦 Uploading to 0G Storage...`);
      
      const [tx, uploadErr] = await this.indexer.upload(zgFile, this.evmRpc, this.signer);
      
      if (uploadErr) {
        throw new Error(`Upload failed: ${uploadErr}`);
      }
      
      console.log(`✅ File uploaded successfully!`);
      console.log(`📋 Transaction Hash: ${tx.hash || tx}`);
      console.log(`🔑 Root Hash: ${rootHash}`);
      console.log(`🔍 View transaction: https://chainscan-newton.0g.ai/tx/${tx.hash || tx}`);
      console.log(`🔍 View on StorageScan: https://storagescan-newton.0g.ai/`);
      
      await zgFile.close();
      await fs.unlink(tempFile);
      await fs.rmdir(tempDir);
      
      return { txHash: tx.hash || tx, rootHash };
    } catch (error) {
      try {
        await fs.unlink(tempFile);
        await fs.rmdir(tempDir);
      } catch {}
      throw error;
    }
  }

  async saveFullDialogueHistory(walletAddress, fullHistory) {
    try {
      const data = typeof fullHistory === "string" ? fullHistory : JSON.stringify(fullHistory);
      
      const result = await this._uploadAsFile(data);
      
      this.dialogueMap.set(walletAddress, result.rootHash);
      await this._saveDialogueMap();
      
      console.log(`🗃️ Saved full dialogue history for ${walletAddress}`);
      console.log(`   Root Hash: ${result.rootHash}`);
      console.log(`   Transaction: ${result.txHash}`);
      
      return true;
    } catch (err) {
      console.error("❌ Error saving full dialogue history:", err);
      return false;
    }
  }

  async saveDialogue(walletAddress, newDialogue) {
    try {
      const existing = await this.getDialogue(walletAddress);
      const parsed = typeof existing === "object" && existing.dialogue_history
        ? existing
        : { dialogue_history: [] };

      const dialogueObj = typeof newDialogue === "string"
        ? JSON.parse(newDialogue)
        : newDialogue;

      parsed.dialogue_history.push({
        ...dialogueObj,
        timestamp: new Date().toISOString(),
      });

      const result = await this._uploadAsFile(JSON.stringify(parsed));
      
      this.dialogueMap.set(walletAddress, result.rootHash);
      await this._saveDialogueMap();

      console.log(`🗃️ Saved dialogue for ${walletAddress}`);
      console.log(`   Root Hash: ${result.rootHash}`);
      
      return true;
    } catch (err) {
      console.error("❌ Error saving dialogue:", err);
      return false;
    }
  }

  async getDialogue(walletAddress, retries = 3, delay = 2000) {
    try {
      const rootHash = this.dialogueMap.get(walletAddress);
      
      if (!rootHash) {
        console.log(`ℹ️  No dialogue history found for ${walletAddress}`);
        return { dialogue_history: [] };
      }

      console.log(`📥 Attempting to download dialogue for ${walletAddress} (Root: ${rootHash})`);

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), '0g-download-'));
      const tempFile = path.join(tempDir, 'dialogue.json');
      
      try {
        const downloadPromise = this.indexer.download(rootHash, tempFile, true);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Download operation timed out after 45 seconds')), 45000)
        );

        const err = await Promise.race([downloadPromise, timeoutPromise]);
        
        if (err) {
          const errorMessage = typeof err === 'object' ? JSON.stringify(err) : err.toString();
          throw new Error(`SDK download function failed: ${errorMessage}`);
        }
        
        console.log(`✅ Download completed successfully for ${walletAddress}.`);
        const content = await fs.readFile(tempFile, 'utf8');
        const data = JSON.parse(content);
        
        await fs.unlink(tempFile);
        await fs.rmdir(tempDir);
        
        return data;
      } catch (error) {
        try {
          await fs.unlink(tempFile);
          await fs.rmdir(tempDir);
        } catch {}
        throw error;
      }
    } catch (error) {
      console.error(`[Attempt ${4 - retries}/3] Error retrieving dialogue for ${walletAddress}:`, error.message);
      
      if (retries > 1) {
        console.log(`   Retrying in ${delay / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delay));
        return this.getDialogue(walletAddress, retries - 1, delay * 1.5);
      } else {
        console.error(`❌ All retry attempts failed for ${walletAddress}. Returning empty history.`);
        return { dialogue_history: [] };
      }
    }
  }
}
