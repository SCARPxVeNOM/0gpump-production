import express from 'express';
import multer from 'multer';
import { ZgFile, Indexer } from '@0glabs/0g-ts-sdk';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Constants from environment variables
const RPC_URL = process.env.RPC_URL || 'https://evmrpc.0g.ai/';
const INDEXER_RPC = process.env.INDEXER_RPC || 'https://indexer-storage-turbo.0g.ai';
// Get private key from environment variables (0G best practice)
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const GAS_PRICE = process.env.GAS_PRICE || '1000000000'; // 1 Gwei (much lower)
const MAX_GAS_LIMIT = process.env.MAX_GAS_LIMIT || '50000'; // 50K gas (much lower)

if (!PRIVATE_KEY) {
  console.error('❌ Private key not found in environment variables. Please set PRIVATE_KEY or DEPLOYER_PRIVATE_KEY');
  process.exit(1);
}

console.log('🚀 Initializing 0G Storage Kit...');
console.log(`📡 RPC URL: ${RPC_URL}`);
console.log(`🔍 Indexer RPC: ${INDEXER_RPC}`);

// Initialize provider, signer and indexer
let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet;
let indexer: Indexer;

try {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  signer = new ethers.Wallet(PRIVATE_KEY, provider);
  indexer = new Indexer(INDEXER_RPC);
  console.log('✅ 0G Storage Kit initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize 0G Storage Kit:', error);
  process.exit(1);
}

app.use(express.json());

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '0G Storage API',
      version: '1.0.0',
      description: 'API documentation for 0G Storage service',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/index.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload a file
 *     description: Upload a file to 0G Storage
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rootHash:
 *                   type: string
 *                 transactionHash:
 *                   type: string
 *       400:
 *         description: No file uploaded
 *       500:
 *         description: Server error
 */
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Create ZgFile from uploaded file using 0.3.1 API
    const zgFile = await ZgFile.fromFilePath(req.file.path);
    const [tree, treeErr] = await zgFile.merkleTree();
    
    if (treeErr !== null) {
      throw new Error(`Error generating Merkle tree: ${treeErr}`);
    }

    console.log(`📤 Uploading file to 0G Storage...`);
    console.log(`⛽ Gas Price: ${GAS_PRICE} wei (${parseInt(GAS_PRICE) / 1e9} Gwei)`);
    console.log(`⛽ Max Gas Limit: ${MAX_GAS_LIMIT} gas`);
    
    // Upload file with 0.3.1 API syntax (no custom gas options for now)
    const [tx, uploadErr] = await indexer.upload(zgFile, RPC_URL, signer as any);

    if (uploadErr !== null) {
      throw new Error(`Upload error: ${uploadErr}`);
    }

    console.log(`✅ Transaction submitted: ${tx.txHash}`);
    console.log(`📁 Root Hash: ${tx.rootHash}`);
    console.log(`⏳ Waiting for confirmation...`);

    // Wait for transaction confirmation
    try {
      const receipt = await provider.waitForTransaction(tx.txHash, 1, 60000); // 60 second timeout
      if (receipt && receipt.status === 1) {
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      } else {
        console.log(`⚠️ Transaction failed or timed out`);
      }
    } catch (waitError) {
      console.log(`⚠️ Could not wait for confirmation: ${waitError}`);
    }

    await zgFile.close();

    res.json({
      rootHash: tx.rootHash,
      transactionHash: tx.txHash
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * @swagger
 * /download/{rootHash}:
 *   get:
 *     summary: Download a file
 *     description: Download a file from 0G Storage using its root hash
 *     parameters:
 *       - in: path
 *         name: rootHash
 *         required: true
 *         schema:
 *           type: string
 *         description: The root hash of the file to download
 *     responses:
 *       200:
 *         description: File downloaded successfully
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Server error
 */
app.get('/download/:rootHash', async (req, res) => {
  const { rootHash } = req.params;
  const downloadsDir = path.join(process.cwd(), 'downloads');
  const outputPath = path.join(downloadsDir, rootHash);

  try {
    console.log(`📥 Downloading file: ${rootHash}`);
    
    // Ensure downloads directory exists
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const err = await indexer.download(rootHash, outputPath, true);
    
    if (err !== null) {
      throw new Error(`Download error: ${err}`);
    }

    console.log(`✅ Download successful: ${rootHash}`);
    
    res.download(outputPath, (err) => {
      if (err) {
        console.error('❌ Download send error:', err);
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Ensure downloads directory exists
const downloadsDir = path.join(process.cwd(), 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
  console.log('📁 Created downloads directory');
}

app.listen(PORT, () => {
  console.log(`🚀 0G Storage Kit Server running on port ${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`📤 Upload endpoint: POST http://localhost:${PORT}/upload`);
  console.log(`📥 Download endpoint: GET http://localhost:${PORT}/download/:rootHash`);
  console.log(`💚 Health check: GET http://localhost:${PORT}/health`);
});