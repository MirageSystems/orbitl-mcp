/**
 * Unified Tool Manager
 * Consolidates all AI tools from different domains
 */

import { AIClient } from '../client.js';
import { setupAnalysisTools } from './analysis-tools.js';
import { setupTransactionTools } from './transaction-tools.js';  
import { setupWalletTools } from './wallet-tools.js';
import log from '../../utils/logger.js';

/**
 * Setup all contract analysis and transaction tools
 * Organized by domain: Analysis, Transaction Building, Wallet & Execution
 */
export async function setupAllTools(ai: AIClient, network: 'mainnet' | 'testnet' = 'mainnet') {
  log.info('Setting up AI tools by domain...');
  
  // Domain 1: Contract Analysis Tools
  await setupAnalysisTools(ai, network);
  
  // Domain 2: Transaction Building Tools  
  await setupTransactionTools(ai, network);
  
  // Domain 3: Wallet & Execution Tools
  await setupWalletTools(ai, network);
  
  const totalTools = ai.getRegisteredTools().length;
  log.info(`✅ Registered ${totalTools} tools across 3 domains`);
  log.info(`📊 Analysis: 4 tools | 🔨 Transactions: 4 tools | 💳 Wallet: 5 tools`);
  
  return ai;
}