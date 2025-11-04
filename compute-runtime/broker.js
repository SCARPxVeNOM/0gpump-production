require('dotenv').config();
const { JsonRpcProvider, Wallet } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

let brokerInstance;
let walletAddress;

async function getBroker() {
  if (brokerInstance) return { broker: brokerInstance, walletAddress };
  const rpc = process.env.OG_CHAIN_RPC || process.env.OG_RPC || 'https://evmrpc.0g.ai';
  const provider = new JsonRpcProvider(rpc);
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error('PRIVATE_KEY not set');
  const wallet = new Wallet(pk, provider);
  const broker = await createZGComputeNetworkBroker(wallet);
  brokerInstance = broker;
  walletAddress = wallet.address;
  return { broker, walletAddress };
}

async function listServices() {
  const { broker } = await getBroker();
  return broker.inference.listService();
}

module.exports = { getBroker, listServices };
