// Transaction Simulation - Show what will happen before signing
// Replaces complex preview system with simple before/after simulation

import { ethers } from 'ethers';
import { BalanceFetcher, type BalanceInfo } from './balance-fetcher.js';
import type { TransactionData } from './types.js';

export interface SimulationResult {
  // Transaction details
  transactionType: 'transfer' | 'approve' | 'unknown';
  tokenSymbol: string;
  amount: string;
  
  // Balance changes
  senderBefore: string;
  senderAfter: string;
  recipientBefore?: string;
  recipientAfter?: string;
  
  // Costs and risks
  gasCostETH: string;
  gasCostUSD?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  warnings: string[];
  
  // Summary
  summary: string;
  humanDescription: string;
}

/**
 * Transaction simulator
 * Shows exactly what will happen before user signs
 */
export class TransactionSimulator {
  private balanceFetcher: BalanceFetcher;

  constructor(rpcUrl: string) {
    this.balanceFetcher = new BalanceFetcher(rpcUrl);
  }

  /**
   * Simulate a token transfer transaction
   */
  async simulateTransfer(
    tokenAddress: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    tokenSymbol: string = 'TOKEN',
    decimals: number = 18
  ): Promise<SimulationResult> {
    
    console.log(`Simulating transfer: ${amount} ${tokenSymbol} from ${fromAddress} to ${toAddress}`);
    
    // Get current balances
    const senderBalance = await this.balanceFetcher.getTokenBalance(
      tokenAddress, fromAddress, decimals, tokenSymbol
    );
    
    const recipientBalance = await this.balanceFetcher.getTokenBalance(
      tokenAddress, toAddress, decimals, tokenSymbol
    );
    
    // Calculate transfer amount in wei
    const transferAmountWei = ethers.parseUnits(amount, decimals);
    
    // Calculate after balances
    const senderAfter = this.balanceFetcher.calculateAfterTransfer(
      senderBalance, transferAmountWei, true
    );
    
    const recipientAfter = this.balanceFetcher.calculateAfterTransfer(
      recipientBalance, transferAmountWei, false
    );
    
    // Assess risks
    const { riskLevel, warnings } = this.assessTransferRisk(
      senderBalance, transferAmountWei, toAddress
    );
    
    // Calculate gas cost (simple estimate)
    const gasCostETH = '~0.01 SEI';
    
    return {
      transactionType: 'transfer',
      tokenSymbol,
      amount: `${amount} ${tokenSymbol}`,
      
      senderBefore: senderBalance.currentFormatted,
      senderAfter: senderAfter.afterFormatted!,
      recipientBefore: recipientBalance.currentFormatted,
      recipientAfter: recipientAfter.afterFormatted!,
      
      gasCostETH,
      riskLevel,
      warnings,
      
      summary: `Transfer ${amount} ${tokenSymbol} (${riskLevel} risk)`,
      humanDescription: `Send ${amount} ${tokenSymbol} to ${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`
    };
  }

  /**
   * Simulate a token approval transaction
   */
  async simulateApproval(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string,
    amount: string,
    tokenSymbol: string = 'TOKEN'
  ): Promise<SimulationResult> {
    
    console.log(`Simulating approval: ${amount} ${tokenSymbol} to ${spenderAddress}`);
    
    // Get current balance (no balance change for approvals)
    const ownerBalance = await this.balanceFetcher.getTokenBalance(
      tokenAddress, ownerAddress, 18, tokenSymbol
    );
    
    // Assess approval risks
    const { riskLevel, warnings } = this.assessApprovalRisk(amount, spenderAddress);
    
    return {
      transactionType: 'approve',
      tokenSymbol,
      amount: `${amount} ${tokenSymbol}`,
      
      senderBefore: ownerBalance.currentFormatted,
      senderAfter: `${ownerBalance.currentFormatted} (no change)`,
      
      gasCostETH: '~0.008 SEI',
      riskLevel,
      warnings,
      
      summary: `Approve ${amount} ${tokenSymbol} spending (${riskLevel} risk)`,
      humanDescription: `Allow ${spenderAddress.slice(0, 6)}...${spenderAddress.slice(-4)} to spend ${amount} ${tokenSymbol}`
    };
  }

  /**
   * Assess risks for token transfers
   */
  private assessTransferRisk(
    senderBalance: BalanceInfo,
    transferAmount: bigint,
    toAddress: string
  ): { riskLevel: SimulationResult['riskLevel'], warnings: string[] } {
    const warnings: string[] = [];
    let riskLevel: SimulationResult['riskLevel'] = 'LOW';

    // Check if sender has enough balance
    if (transferAmount > senderBalance.current) {
      warnings.push('Insufficient balance - transaction will fail');
      riskLevel = 'CRITICAL';
    }

    // Check for zero address
    if (toAddress === '0x0000000000000000000000000000000000000000') {
      warnings.push('Sending to burn address - tokens will be lost forever');
      riskLevel = 'CRITICAL';
    }

    // Check for very large amounts (>50% of balance)
    if (transferAmount > (senderBalance.current / BigInt(2))) {
      warnings.push('Transferring large portion of balance');
      riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
    }

    return { riskLevel, warnings };
  }

  /**
   * Assess risks for token approvals
   */
  private assessApprovalRisk(
    amount: string,
    spenderAddress: string
  ): { riskLevel: SimulationResult['riskLevel'], warnings: string[] } {
    const warnings: string[] = [];
    let riskLevel: SimulationResult['riskLevel'] = 'LOW';

    // Check for unlimited approval
    const isUnlimited = ['unlimited', 'max', 'maximum', 'infinite'].includes(amount.toLowerCase()) ||
                       amount === ethers.MaxUint256.toString();

    if (isUnlimited) {
      warnings.push('UNLIMITED APPROVAL - Spender can take ALL your tokens');
      warnings.push('Consider approving only what you need');
      riskLevel = 'HIGH';
    }

    // Check for suspicious spender patterns
    if (spenderAddress === '0x0000000000000000000000000000000000000000') {
      warnings.push('Approving zero address - this will fail');
      riskLevel = 'CRITICAL';
    }

    return { riskLevel, warnings };
  }

  /**
   * Format simulation for console display
   */
  static formatSimulation(simulation: SimulationResult): string {
    const { riskLevel, warnings } = simulation;
    
    let output = `\nTransaction Simulation\n`;
    output += `[${riskLevel}] ${simulation.summary}\n\n`;
    
    // Balance changes
    if (simulation.transactionType === 'transfer') {
      output += `Your Balance: ${simulation.senderBefore} → ${simulation.senderAfter}\n`;
      output += `Recipient: ${simulation.recipientBefore} → ${simulation.recipientAfter}\n`;
    } else {
      output += `Your Balance: ${simulation.senderAfter}\n`;
    }
    
    output += `Gas Cost: ${simulation.gasCostETH}\n`;
    
    // Warnings
    if (warnings.length > 0) {
      output += `\nWarnings:\n`;
      warnings.forEach(warning => output += `  ${warning}\n`);
    }
    
    output += `\nOrbitl NEVER handles your private keys\n`;
    
    return output;
  }
}